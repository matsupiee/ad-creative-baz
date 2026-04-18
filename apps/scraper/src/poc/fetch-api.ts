import type { BrowserContext } from "playwright";
import { z } from "zod";

const materialSchema = z
  .object({
    id: z.string().optional(),
    ad_title: z.string().optional(),
    brand_name: z.string().optional(),
    industry_key: z.string().optional(),
    like: z.number().optional(),
    video_info: z
      .object({
        vid: z.string().optional(),
        // video_url は解像度別 map (例: { "720p": "https://..." }) で返ることが観測されているため緩く受ける。
        video_url: z.record(z.string(), z.string()).optional(),
        cover_url: z.string().optional(),
        duration: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const listResponseSchema = z
  .object({
    code: z.number(),
    msg: z.string(),
    data: z
      .object({
        materials: z.array(materialSchema),
        pagination: z.object({ total_count: z.number() }).passthrough().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type TopAdMaterial = z.infer<typeof materialSchema>;

type FetchParams = {
  period: number;
  orderBy: string;
  countryCode: string;
  limit?: number;
};

export type FetchResult = { ok: true; materials: TopAdMaterial[] } | { ok: false; reason: string };

export async function fetchTopAds(
  context: BrowserContext,
  params: FetchParams,
): Promise<FetchResult> {
  const url = new URL("https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/list");
  url.searchParams.set("period", String(params.period));
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(params.limit ?? 20));
  url.searchParams.set("order_by", params.orderBy);
  url.searchParams.set("country_code", params.countryCode);

  try {
    const res = await context.request.get(url.toString(), {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en",
      },
    });
    if (!res.ok()) {
      return { ok: false, reason: `http ${res.status()}` };
    }
    const json: unknown = await res.json();
    const parsed = listResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { ok: false, reason: `schema: ${parsed.error.message.slice(0, 120)}` };
    }
    if (parsed.data.code !== 0) {
      return { ok: false, reason: `api code ${parsed.data.code}: ${parsed.data.msg}` };
    }
    return { ok: true, materials: parsed.data.data.materials };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export type NormalizedMaterial = {
  id?: string;
  videoUrl?: string;
  coverUrl?: string;
  title?: string;
  brand?: string;
  industry?: string;
  likes?: number;
};

export function normalizeMaterial(m: TopAdMaterial): NormalizedMaterial {
  const videoUrlRaw = m.video_info?.video_url;
  let videoUrl: string | undefined;
  if (videoUrlRaw && typeof videoUrlRaw === "object") {
    const first = Object.values(videoUrlRaw).find((v): v is string => typeof v === "string");
    videoUrl = first;
  }
  const result: NormalizedMaterial = {};
  if (m.id !== undefined) result.id = m.id;
  if (videoUrl !== undefined) result.videoUrl = videoUrl;
  if (m.video_info?.cover_url !== undefined) result.coverUrl = m.video_info.cover_url;
  if (m.ad_title !== undefined) result.title = m.ad_title;
  if (m.brand_name !== undefined) result.brand = m.brand_name;
  if (m.industry_key !== undefined) result.industry = m.industry_key;
  if (m.like !== undefined) result.likes = m.like;
  return result;
}
