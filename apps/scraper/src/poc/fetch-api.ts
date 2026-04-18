import type { Page } from "playwright";
import { z } from "zod";

import { parseTiktokCdnExpiry } from "../lib/video-url-expiry.ts";

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
        materials: z.array(materialSchema).default([]),
        pagination: z.object({ total_count: z.number() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
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

export function parseListResponse(body: unknown): FetchResult {
  const parsed = listResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, reason: `schema: ${parsed.error.message.slice(0, 120)}` };
  }
  if (parsed.data.code !== 0) {
    return { ok: false, reason: `api code ${parsed.data.code}: ${parsed.data.msg}` };
  }
  const materials = parsed.data.data?.materials ?? [];
  return { ok: true, materials };
}

export async function fetchTopAds(page: Page, params: FetchParams): Promise<FetchResult> {
  const url = new URL("https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/list");
  url.searchParams.set("period", String(params.period));
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(params.limit ?? 20));
  url.searchParams.set("order_by", params.orderBy);
  url.searchParams.set("country_code", params.countryCode);

  try {
    // ブラウザコンテキスト内 fetch を使う。context.request.get は Playwright 内部の
    // redirect/Set-Cookie パーサが Bun 環境と相性問題を起こすため回避。
    const result: { ok: boolean; status: number; body: unknown } = await page.evaluate(
      async (u: string) => {
        const r = await fetch(u, {
          credentials: "include",
          headers: { "Accept-Language": "en-US,en;q=0.9" },
        });
        let body: unknown = null;
        try {
          body = await r.json();
        } catch {
          body = null;
        }
        return { ok: r.ok, status: r.status, body };
      },
      url.toString(),
    );

    if (!result.ok) {
      return { ok: false, reason: `http ${result.status}` };
    }
    const parsed = listResponseSchema.safeParse(result.body);
    if (!parsed.success) {
      return { ok: false, reason: `schema: ${parsed.error.message.slice(0, 120)}` };
    }
    if (parsed.data.code !== 0) {
      return { ok: false, reason: `api code ${parsed.data.code}: ${parsed.data.msg}` };
    }
    const materials = parsed.data.data?.materials ?? [];
    return { ok: true, materials };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export type NormalizedMaterial = {
  id?: string;
  videoUrl?: string;
  videoUrlExpiresAt?: string;
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
  const expiresAt = videoUrl ? parseTiktokCdnExpiry(videoUrl) : null;
  const result: NormalizedMaterial = {};
  if (m.id !== undefined) result.id = m.id;
  if (videoUrl !== undefined) result.videoUrl = videoUrl;
  if (expiresAt !== null) result.videoUrlExpiresAt = expiresAt.toISOString();
  if (m.video_info?.cover_url !== undefined) result.coverUrl = m.video_info.cover_url;
  if (m.ad_title !== undefined) result.title = m.ad_title;
  if (m.brand_name !== undefined) result.brand = m.brand_name;
  if (m.industry_key !== undefined) result.industry = m.industry_key;
  if (m.like !== undefined) result.likes = m.like;
  return result;
}
