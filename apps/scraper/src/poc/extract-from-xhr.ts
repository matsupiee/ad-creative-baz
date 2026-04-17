import type { Response } from "playwright";
import { z } from "zod";

export type TopAdItem = {
  videoUrl: string;
  playCount: number;
  title?: string;
  advertiser?: string;
};

// loose schema: TikTok Creative Center のレスポンスは仕様不明瞭なため、
// 取れる可能性のあるフィールドだけを optional で拾って粗く parse する。
const videoInfoSchema = z
  .object({
    video_url: z.string().url().optional(),
    play_url: z.string().url().optional(),
    download_url: z.string().url().optional(),
  })
  .passthrough();

const itemSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    ad_title: z.string().optional(),
    advertiser: z
      .union([z.string(), z.object({ name: z.string().optional() }).passthrough()])
      .optional(),
    brand_name: z.string().optional(),
    video_info: videoInfoSchema.optional(),
    video: videoInfoSchema.optional(),
    play: z.number().optional(),
    play_count: z.number().optional(),
    playback_count: z.number().optional(),
    video_play: z.number().optional(),
  })
  .passthrough();

const listShapeSchemas = [
  z.object({ data: z.object({ materials: z.array(itemSchema) }).passthrough() }),
  z.object({ data: z.object({ list: z.array(itemSchema) }).passthrough() }),
  z.object({ data: z.object({ items: z.array(itemSchema) }).passthrough() }),
  z.object({ data: z.object({ pad_materials: z.array(itemSchema) }).passthrough() }),
  z.object({ data: z.array(itemSchema) }),
  z.object({ materials: z.array(itemSchema) }),
  z.object({ list: z.array(itemSchema) }),
] as const;

function extractArray(payload: unknown): z.infer<typeof itemSchema>[] {
  for (const schema of listShapeSchemas) {
    const parsed = schema.safeParse(payload);
    if (parsed.success) {
      const data = parsed.data as unknown as
        | {
            data:
              | { materials?: unknown; list?: unknown; items?: unknown; pad_materials?: unknown }
              | unknown[];
          }
        | { materials?: unknown; list?: unknown };
      if (Array.isArray((data as { data?: unknown }).data)) {
        return (data as { data: z.infer<typeof itemSchema>[] }).data;
      }
      if ("data" in data && data.data && typeof data.data === "object") {
        const d = data.data as Record<string, unknown>;
        for (const key of ["materials", "list", "items", "pad_materials"]) {
          const v = d[key];
          if (Array.isArray(v)) return v as z.infer<typeof itemSchema>[];
        }
      }
      const top = data as Record<string, unknown>;
      for (const key of ["materials", "list"]) {
        const v = top[key];
        if (Array.isArray(v)) return v as z.infer<typeof itemSchema>[];
      }
    }
  }
  return [];
}

function pickPlayCount(item: z.infer<typeof itemSchema>): number | undefined {
  return item.play ?? item.play_count ?? item.playback_count ?? item.video_play;
}

function pickVideoUrl(item: z.infer<typeof itemSchema>): string | undefined {
  const info = item.video_info ?? item.video;
  return info?.video_url ?? info?.play_url ?? info?.download_url;
}

function pickTitle(item: z.infer<typeof itemSchema>): string | undefined {
  return item.title ?? item.ad_title ?? item.name;
}

function pickAdvertiser(item: z.infer<typeof itemSchema>): string | undefined {
  if (typeof item.advertiser === "string") return item.advertiser;
  if (item.advertiser && typeof item.advertiser === "object") {
    return item.advertiser.name;
  }
  return item.brand_name;
}

function normalize(raw: unknown): TopAdItem[] {
  const items = extractArray(raw);
  const out: TopAdItem[] = [];
  for (const item of items) {
    const videoUrl = pickVideoUrl(item);
    const playCount = pickPlayCount(item);
    if (!videoUrl || typeof playCount !== "number") continue;
    const entry: TopAdItem = { videoUrl, playCount };
    const title = pickTitle(item);
    if (title) entry.title = title;
    const advertiser = pickAdvertiser(item);
    if (advertiser) entry.advertiser = advertiser;
    out.push(entry);
  }
  return out;
}

function looksLikeCandidate(url: string): boolean {
  return (
    url.includes("/api/") ||
    url.includes("pacific") ||
    url.includes("creative_radar") ||
    url.includes("creativecenter")
  );
}

export async function collectXhrCandidates(responses: Response[]): Promise<TopAdItem[]> {
  const candidates = responses.filter((r) => {
    try {
      return looksLikeCandidate(r.url());
    } catch {
      return false;
    }
  });

  const results: TopAdItem[] = [];
  for (const r of candidates) {
    let payload: unknown;
    try {
      payload = await r.json();
    } catch {
      continue;
    }
    const items = normalize(payload);
    if (items.length > 0) {
      results.push(...items);
    }
  }
  return results;
}
