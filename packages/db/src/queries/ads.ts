import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { createDb } from "../index";
import type { AdOrderBy, AdPeriod, AdRegion, NewAd, NewAdSnapshot } from "../schema/ads";
import { adSnapshots, ads } from "../schema/ads";

export type AdListSort = "score" | "tiktok_rank";

// likes × 鮮度のハイブリッドスコア。half-life = 7d、指数減衰。
// likes IS NULL は 0 として最下位に沈む（実 ingest では likes は必ず取得できる前提。
// 取得失敗が常態化したら sort 戦略から見直す）。
// 鮮度は ads.lastSeenAt 基準。Task #8 で ad_rankings 切り出し時はこの式の参照先を
// `ad_rankings.lastSeenAt` に乗せ替えること（バケット別の鮮度になる）。
const HALF_LIFE_DAYS = 7;
const DECAY_LAMBDA = Math.LN2 / HALF_LIFE_DAYS;
const scoreExpr = sql`coalesce(${ads.likes}, 0) * exp(${-DECAY_LAMBDA} * (unixepoch('subsecond') - ${ads.lastSeenAt} / 1000.0) / 86400.0)`;

export interface ListAdsInput {
  region: AdRegion;
  period: AdPeriod;
  orderBy: AdOrderBy;
  limit: number;
  freshOnly?: boolean;
  sort?: AdListSort;
}

export async function listAds({
  region,
  period,
  orderBy,
  limit,
  freshOnly,
  sort = "score",
}: ListAdsInput) {
  const db = createDb();

  const orderClauses =
    sort === "score"
      ? [desc(scoreExpr), sql`${ads.rank} IS NULL`, asc(ads.rank)]
      : [sql`${ads.rank} IS NULL`, asc(ads.rank)];

  return db
    .select({
      id: ads.id,
      title: ads.title,
      brand: ads.brand,
      industry: ads.industry,
      videoUrl: ads.videoUrl,
      videoUrlExpiresAt: ads.videoUrlExpiresAt,
      coverUrl: ads.coverUrl,
      durationSeconds: ads.durationSeconds,
      likes: ads.likes,
      playCount: ads.playCount,
      rank: ads.rank,
      region: ads.region,
      period: ads.period,
      orderBy: ads.orderBy,
      lastSeenAt: ads.lastSeenAt,
    })
    .from(ads)
    .where(
      and(
        eq(ads.region, region),
        eq(ads.period, period),
        eq(ads.orderBy, orderBy),
        isNull(ads.deletedAt),
        freshOnly ? gt(ads.videoUrlExpiresAt, new Date()) : undefined,
      ),
    )
    .orderBy(...orderClauses)
    .limit(limit);
}

export type AdListItem = Awaited<ReturnType<typeof listAds>>[number];

export interface UpsertAdItem {
  sourceMaterialId: string;
  title?: string | null;
  brand?: string | null;
  industry?: string | null;
  videoVid?: string | null;
  videoUrl?: string | null;
  videoUrlExpiresAt?: Date | null;
  coverUrl?: string | null;
  durationSeconds?: number | null;
  likes?: number | null;
  playCount?: number | null;
  shares?: number | null;
  rank?: number | null;
}

export interface UpsertAdsInput {
  source: "tiktok";
  region: AdRegion;
  period: AdPeriod;
  orderBy: AdOrderBy;
  capturedAt: Date;
  items: UpsertAdItem[];
}

export interface UpsertAdsResult {
  upsertedAds: number;
  insertedSnapshots: number;
}

export async function upsertAds(input: UpsertAdsInput): Promise<UpsertAdsResult> {
  const { source, region, period, orderBy, capturedAt, items } = input;
  if (items.length === 0) {
    return { upsertedAds: 0, insertedSnapshots: 0 };
  }

  const db = createDb();

  const adRows: NewAd[] = items.map((item) => ({
    id: `${source}:${item.sourceMaterialId}`,
    source,
    sourceMaterialId: item.sourceMaterialId,
    title: item.title ?? null,
    brand: item.brand ?? null,
    industry: item.industry ?? null,
    videoVid: item.videoVid ?? null,
    videoUrl: item.videoUrl ?? null,
    videoUrlExpiresAt: item.videoUrlExpiresAt ?? null,
    coverUrl: item.coverUrl ?? null,
    durationSeconds: item.durationSeconds ?? null,
    likes: item.likes ?? null,
    playCount: item.playCount ?? null,
    shares: item.shares ?? null,
    region,
    period,
    orderBy,
    rank: item.rank ?? null,
    lastSeenAt: capturedAt,
  }));

  // Snapshot PK は (source, material, region, period, orderBy, capturedAt) を合成。
  // これにより異なるバケットや同一 ms の再取得がぶつからない。
  const snapshotRows: NewAdSnapshot[] = items.map((item) => ({
    id: `${source}:${item.sourceMaterialId}:${region}:${period}:${orderBy}:${capturedAt.getTime()}`,
    adId: `${source}:${item.sourceMaterialId}`,
    region,
    period,
    orderBy,
    rank: item.rank ?? null,
    likes: item.likes ?? null,
    playCount: item.playCount ?? null,
    shares: item.shares ?? null,
    capturedAt,
  }));

  // NOTE: `ads` テーブルは region/period/orderBy/rank をカラムに持つため、
  // 同じ material が別バケットで上位に来た場合、最新の INGEST だけが `ads` に反映される
  // （履歴は ad_snapshots で保持）。複数バケットを並行して listAds したいときは
  // 将来的に `ad_rankings(ad_id, region, period, orderBy, rank)` を切り出すこと。
  // D1 の bound-parameter 上限に当たらないよう 1 バッチあたりの行数をチャンクする。
  // ads は 1 行 19 変数、snapshots は 10 変数（合計 29/行）。D1 のデフォルトは 100 binding/query
  // 程度と低いので、3 行/バッチ（87 binding）で安全マージンを取る。
  const CHUNK_SIZE = 3;
  for (let i = 0; i < adRows.length; i += CHUNK_SIZE) {
    const adChunk = adRows.slice(i, i + CHUNK_SIZE);
    const snapshotChunk = snapshotRows.slice(i, i + CHUNK_SIZE);

    const upsertAdsStmt = db
      .insert(ads)
      .values(adChunk)
      .onConflictDoUpdate({
        target: ads.id,
        set: {
          title: sql`excluded.title`,
          brand: sql`excluded.brand`,
          industry: sql`excluded.industry`,
          videoVid: sql`excluded.video_vid`,
          videoUrl: sql`excluded.video_url`,
          videoUrlExpiresAt: sql`excluded.video_url_expires_at`,
          coverUrl: sql`excluded.cover_url`,
          durationSeconds: sql`excluded.duration_seconds`,
          likes: sql`excluded.likes`,
          playCount: sql`excluded.play_count`,
          shares: sql`excluded.shares`,
          region: sql`excluded.region`,
          period: sql`excluded.period`,
          orderBy: sql`excluded.order_by`,
          rank: sql`excluded.rank`,
          lastSeenAt: sql`excluded.last_seen_at`,
          deletedAt: sql`NULL`,
        },
      });

    const insertSnapshotsStmt = db.insert(adSnapshots).values(snapshotChunk).onConflictDoNothing();

    await db.batch([upsertAdsStmt, insertSnapshotsStmt]);
  }

  return { upsertedAds: adRows.length, insertedSnapshots: snapshotRows.length };
}
