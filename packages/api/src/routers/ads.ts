import { listAds } from "@ad-creative-baz/db/queries/ads";
import { AD_ORDER_BYS, AD_PERIODS, AD_REGIONS } from "@ad-creative-baz/db/schema/ads";
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

export const adsRouter = {
  list,
};
