import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { createDb } from "../index";
import type { AdOrderBy, AdPeriod, AdRegion } from "../schema/ads";
import { ads } from "../schema/ads";

export interface ListAdsInput {
  region: AdRegion;
  period: AdPeriod;
  orderBy: AdOrderBy;
  limit: number;
}

export async function listAds({ region, period, orderBy, limit }: ListAdsInput) {
  const db = createDb();

  return db
    .select({
      id: ads.id,
      title: ads.title,
      brand: ads.brand,
      industry: ads.industry,
      videoUrl: ads.videoUrl,
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
      ),
    )
    .orderBy(sql`${ads.rank} IS NULL`, asc(ads.rank))
    .limit(limit);
}

export type AdListItem = Awaited<ReturnType<typeof listAds>>[number];
