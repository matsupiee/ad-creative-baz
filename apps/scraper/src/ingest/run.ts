import { chromium } from "playwright";

import { env } from "../env.ts";
import { log } from "../lib/logger.ts";
import { normalizeMaterial, parseListResponse, type TopAdMaterial } from "../poc/fetch-api.ts";

const COUNTRIES = ["US"] as const;
const PERIODS = [7, 30, 180] as const;
const ORDER_BY = "for_you" as const;

type BatchResult = {
  region: string;
  period: number;
  orderBy: string;
  captured: number;
  upsertedAds: number;
  insertedSnapshots: number;
};

type IngestItem = {
  sourceMaterialId: string;
  title?: string | null;
  brand?: string | null;
  industry?: string | null;
  videoVid?: string | null;
  videoUrl?: string | null;
  videoUrlExpiresAt?: string | null;
  coverUrl?: string | null;
  durationSeconds?: number | null;
  likes?: number | null;
  rank?: number | null;
};

function buildTargetUrl(region: string, period: number): string {
  const locale = env.TIKTOK_LOCALE;
  return `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/${locale}?region=${region}&period=${period}`;
}

function toIngestItem(material: TopAdMaterial, rank: number): IngestItem | undefined {
  const normalized = normalizeMaterial(material);
  if (!normalized.id) return undefined;
  const item: IngestItem = {
    sourceMaterialId: normalized.id,
    rank,
  };
  if (normalized.title !== undefined) item.title = normalized.title;
  if (normalized.brand !== undefined) item.brand = normalized.brand;
  if (normalized.industry !== undefined) item.industry = normalized.industry;
  if (normalized.videoUrl !== undefined) item.videoUrl = normalized.videoUrl;
  if (normalized.videoUrlExpiresAt !== undefined) {
    item.videoUrlExpiresAt = normalized.videoUrlExpiresAt;
  }
  if (normalized.coverUrl !== undefined) item.coverUrl = normalized.coverUrl;
  if (normalized.likes !== undefined) item.likes = normalized.likes;
  const videoVid = material.video_info?.vid;
  if (typeof videoVid === "string") item.videoVid = videoVid;
  const duration = material.video_info?.duration;
  if (typeof duration === "number") item.durationSeconds = Math.round(duration);
  return item;
}

async function postIngest(params: {
  region: string;
  period: number;
  orderBy: string;
  capturedAt: Date;
  items: IngestItem[];
}): Promise<{ upsertedAds: number; insertedSnapshots: number }> {
  const apiUrl = env.INGEST_API_URL;
  const token = env.INGEST_TOKEN;
  if (!apiUrl || !token) {
    throw new Error("INGEST_API_URL and INGEST_TOKEN must be set");
  }

  const url = `${apiUrl.replace(/\/$/, "")}/api/rpc/ads/ingest`;
  const body = JSON.stringify({
    json: {
      source: "tiktok",
      region: params.region,
      period: params.period,
      orderBy: params.orderBy,
      capturedAt: params.capturedAt.toISOString(),
      items: params.items,
    },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-token": token,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ingest HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    json?: { upsertedAds?: number; insertedSnapshots?: number };
  };
  const result = payload.json ?? {};
  return {
    upsertedAds: result.upsertedAds ?? 0,
    insertedSnapshots: result.insertedSnapshots ?? 0,
  };
}

async function main(): Promise<number> {
  if (!env.INGEST_API_URL || !env.INGEST_TOKEN) {
    process.stderr.write(
      `${JSON.stringify({ status: "error", reason: "INGEST_API_URL/INGEST_TOKEN unset" })}\n`,
    );
    return 1;
  }

  log({ level: "info", msg: "launching browser", headless: env.PLAYWRIGHT_HEADLESS });
  const browser = await chromium.launch({
    headless: env.PLAYWRIGHT_HEADLESS,
    proxy: env.PROXY_URL ? { server: env.PROXY_URL } : undefined,
  });

  const results: BatchResult[] = [];
  const failures: Array<{ region: string; period: number; reason: string }> = [];

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: env.TIKTOK_LOCALE === "ja" ? "ja-JP" : "en-US",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    for (const country of COUNTRIES) {
      for (const period of PERIODS) {
        const url = buildTargetUrl(country, period);
        log({ level: "info", msg: "navigating", url });

        const listResponsePromise = page
          .waitForResponse(
            (res) =>
              res.url().includes("/creative_radar_api/v1/top_ads/v2/list") && res.status() === 200,
            { timeout: 20_000 },
          )
          .catch(() => undefined);

        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        } catch (err) {
          log({ level: "warn", msg: "goto soft-failed", url, error: String(err) });
        }

        const listRes = await listResponsePromise;
        if (!listRes) {
          failures.push({ region: country, period, reason: "no /list response" });
          continue;
        }
        let body: unknown;
        try {
          body = await listRes.json();
        } catch (err) {
          failures.push({ region: country, period, reason: `json parse: ${String(err)}` });
          continue;
        }
        const parsed = parseListResponse(body);
        if (!parsed.ok) {
          failures.push({ region: country, period, reason: parsed.reason });
          continue;
        }
        if (parsed.materials.length === 0) {
          failures.push({ region: country, period, reason: "empty materials" });
          continue;
        }

        const items: IngestItem[] = [];
        parsed.materials.forEach((material, index) => {
          const item = toIngestItem(material, index + 1);
          if (item) items.push(item);
        });
        if (items.length === 0) {
          failures.push({ region: country, period, reason: "no items with id" });
          continue;
        }

        const capturedAt = new Date();
        try {
          const outcome = await postIngest({
            region: country,
            period,
            orderBy: ORDER_BY,
            capturedAt,
            items,
          });
          results.push({
            region: country,
            period,
            orderBy: ORDER_BY,
            captured: items.length,
            upsertedAds: outcome.upsertedAds,
            insertedSnapshots: outcome.insertedSnapshots,
          });
          log({
            level: "info",
            msg: "ingested",
            country,
            period,
            captured: items.length,
            upsertedAds: outcome.upsertedAds,
            insertedSnapshots: outcome.insertedSnapshots,
          });
        } catch (err) {
          failures.push({ region: country, period, reason: `ingest: ${String(err)}` });
        }
      }
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(
    `${JSON.stringify({
      status: results.length > 0 ? "ok" : "empty",
      results,
      failures,
    })}\n`,
  );
  return results.length > 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    log({ level: "error", msg: "unhandled error", error: String(err) });
    process.exit(1);
  });
