import { listAds, upsertAds } from "@ad-creative-baz/db/queries/ads";
import { AD_ORDER_BYS, AD_PERIODS, AD_REGIONS, AD_SOURCES } from "@ad-creative-baz/db/schema/ads";
import { env } from "@ad-creative-baz/env/server";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { publicProcedure } from "../index";

// API 入力として受け付ける列挙。今は DB enum と同一だが、API が DB の部分集合だけ
// 受けたい局面が来たら API 側で絞れるよう一次の alias を切っておく。
export const AD_LIST_REGIONS = AD_REGIONS;
export const AD_LIST_PERIODS = AD_PERIODS;
export const AD_LIST_SORTS = ["score", "tiktok_rank"] as const;

export type AdListRegion = (typeof AD_LIST_REGIONS)[number];
export type AdListPeriod = (typeof AD_LIST_PERIODS)[number];
export type AdListSort = (typeof AD_LIST_SORTS)[number];

// AD_LIST_PERIODS は数値リテラルなので z.enum が使えず z.union で組む。
// 配列長が変わったらここの as cast も追従させる必要がある（テストは無いので
// AD_LIST_PERIODS を変更したら手動で要素数を合わせること）。
export const adListPeriodSchema = z.union(
  AD_LIST_PERIODS.map((value) => z.literal(value)) as [
    z.ZodLiteral<(typeof AD_LIST_PERIODS)[0]>,
    z.ZodLiteral<(typeof AD_LIST_PERIODS)[1]>,
    z.ZodLiteral<(typeof AD_LIST_PERIODS)[2]>,
  ],
);

export const adListRegionSchema = z.enum(AD_LIST_REGIONS);
export const adListSortSchema = z.enum(AD_LIST_SORTS);

const listInputSchema = z.object({
  region: adListRegionSchema.default("US"),
  period: adListPeriodSchema.default(7),
  orderBy: z.enum(AD_ORDER_BYS).default("for_you"),
  limit: z.number().int().min(1).max(100).default(20),
  freshOnly: z.boolean().default(false),
  sort: adListSortSchema.default("score"),
});

export type AdsListInput = z.infer<typeof listInputSchema>;

export const list = publicProcedure.input(listInputSchema).handler(async ({ input }) => {
  try {
    return await listAds(input);
  } catch (cause) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Failed to list ads",
      cause,
    });
  }
});

const ingestItemSchema = z.object({
  sourceMaterialId: z.string().min(1).max(128),
  title: z.string().max(4096).nullish(),
  brand: z.string().max(512).nullish(),
  industry: z.string().max(256).nullish(),
  videoVid: z.string().max(128).nullish(),
  videoUrl: z.string().url().max(2048).nullish(),
  videoUrlExpiresAt: z.coerce.date().nullish(),
  coverUrl: z.string().url().max(2048).nullish(),
  durationSeconds: z.number().int().nonnegative().max(3600).nullish(),
  likes: z.number().int().nonnegative().nullish(),
  playCount: z.number().int().nonnegative().nullish(),
  shares: z.number().int().nonnegative().nullish(),
  rank: z.number().int().positive().max(1000).nullish(),
});

const ingestInputSchema = z.object({
  source: z.enum(AD_SOURCES).default("tiktok"),
  region: z.enum(AD_REGIONS),
  period: adListPeriodSchema,
  orderBy: z.enum(AD_ORDER_BYS),
  capturedAt: z.coerce.date().default(() => new Date()),
  items: z.array(ingestItemSchema).min(1).max(200),
});

export type AdsIngestInput = z.infer<typeof ingestInputSchema>;

// 固定時間比較。length が一致しない場合は expected と比較しても false になるよう pad。
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export const ingest = publicProcedure
  .input(ingestInputSchema)
  .handler(async ({ input, context }) => {
    const provided = context.headers.get("x-ingest-token") ?? "";
    const expected = env.INGEST_TOKEN ?? "";
    if (expected.length === 0 || !timingSafeEqual(provided, expected)) {
      throw new ORPCError("UNAUTHORIZED", { message: "Invalid ingest token" });
    }
    try {
      return await upsertAds(input);
    } catch (cause) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to ingest ads",
        cause,
      });
    }
  });

export const adsRouter = {
  list,
  ingest,
};
