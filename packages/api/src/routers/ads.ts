import { listAds, upsertAds } from "@ad-creative-baz/db/queries/ads";
import { AD_ORDER_BYS, AD_PERIODS, AD_REGIONS, AD_SOURCES } from "@ad-creative-baz/db/schema/ads";
import { env } from "@ad-creative-baz/env/server";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { publicProcedure } from "../index";

const periodSchema = z.union(
  AD_PERIODS.map((value) => z.literal(value)) as [
    z.ZodLiteral<(typeof AD_PERIODS)[0]>,
    z.ZodLiteral<(typeof AD_PERIODS)[1]>,
    z.ZodLiteral<(typeof AD_PERIODS)[2]>,
  ],
);

const listInputSchema = z.object({
  region: z.enum(AD_REGIONS).default("US"),
  period: periodSchema.default(30),
  orderBy: z.enum(AD_ORDER_BYS).default("for_you"),
  limit: z.number().int().min(1).max(100).default(20),
  freshOnly: z.boolean().default(false),
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
  title: z.string().max(512).nullish(),
  brand: z.string().max(256).nullish(),
  industry: z.string().max(128).nullish(),
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
  period: periodSchema,
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
