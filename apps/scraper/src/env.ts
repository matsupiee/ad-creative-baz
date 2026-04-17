import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    TIKTOK_LOCALE: z.string().default("en"),
    PLAYWRIGHT_HEADLESS: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? true : v !== "false" && v !== "0")),
    PROXY_URL: z.string().url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
