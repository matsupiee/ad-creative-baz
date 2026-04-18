import { type InferInsertModel, type InferSelectModel, relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const AD_SOURCES = ["tiktok"] as const;
export type AdSource = (typeof AD_SOURCES)[number];

export const AD_REGIONS = ["US", "GB", "KR", "DE", "JP"] as const;
export type AdRegion = (typeof AD_REGIONS)[number];

export const AD_PERIODS = [7, 30, 180] as const;
export type AdPeriod = (typeof AD_PERIODS)[number];

export const AD_ORDER_BYS = ["for_you", "like", "play"] as const;
export type AdOrderBy = (typeof AD_ORDER_BYS)[number];

export const TRANSCRIPT_STATUSES = [
  "pending",
  "transcribing",
  "refining",
  "done",
  "failed",
] as const;
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

export const ads = sqliteTable(
  "ads",
  {
    id: text("id").primaryKey(),
    source: text("source", { enum: AD_SOURCES }).notNull().default("tiktok"),
    sourceMaterialId: text("source_material_id").notNull(),
    title: text("title"),
    brand: text("brand"),
    industry: text("industry"),
    videoVid: text("video_vid"),
    videoUrl: text("video_url"),
    videoUrlExpiresAt: integer("video_url_expires_at", { mode: "timestamp_ms" }),
    coverUrl: text("cover_url"),
    durationSeconds: integer("duration_seconds"),
    likes: integer("likes"),
    playCount: integer("play_count"),
    shares: integer("shares"),
    region: text("region", { enum: AD_REGIONS }).notNull(),
    period: integer("period").notNull(),
    orderBy: text("order_by", { enum: AD_ORDER_BYS }).notNull(),
    rank: integer("rank"),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("ads_source_material_idx").on(table.source, table.sourceMaterialId),
    index("ads_region_period_likes_idx").on(table.region, table.period, table.likes),
    index("ads_region_period_play_idx").on(table.region, table.period, table.playCount),
    index("ads_region_period_expires_idx").on(table.region, table.period, table.videoUrlExpiresAt),
    index("ads_deleted_at_idx").on(table.deletedAt),
    index("ads_last_seen_idx").on(table.lastSeenAt),
  ],
);

export const adSnapshots = sqliteTable(
  "ad_snapshots",
  {
    id: text("id").primaryKey(),
    adId: text("ad_id")
      .notNull()
      .references(() => ads.id, { onDelete: "cascade" }),
    region: text("region", { enum: AD_REGIONS }).notNull(),
    period: integer("period").notNull(),
    orderBy: text("order_by", { enum: AD_ORDER_BYS }).notNull(),
    rank: integer("rank"),
    likes: integer("likes"),
    playCount: integer("play_count"),
    shares: integer("shares"),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("ad_snapshots_ad_captured_idx").on(table.adId, table.capturedAt),
    index("ad_snapshots_region_period_captured_idx").on(
      table.region,
      table.period,
      table.capturedAt,
    ),
  ],
);

export const adTranscripts = sqliteTable(
  "ad_transcripts",
  {
    adId: text("ad_id")
      .primaryKey()
      .references(() => ads.id, { onDelete: "cascade" }),
    status: text("status", { enum: TRANSCRIPT_STATUSES }).notNull().default("pending"),
    rawText: text("raw_text"),
    refinedText: text("refined_text"),
    language: text("language"),
    modelWhisper: text("model_whisper"),
    modelRefiner: text("model_refiner"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("ad_transcripts_status_idx").on(table.status)],
);

export const adsRelations = relations(ads, ({ one, many }) => ({
  transcript: one(adTranscripts, {
    fields: [ads.id],
    references: [adTranscripts.adId],
  }),
  snapshots: many(adSnapshots),
}));

export const adSnapshotsRelations = relations(adSnapshots, ({ one }) => ({
  ad: one(ads, {
    fields: [adSnapshots.adId],
    references: [ads.id],
  }),
}));

export const adTranscriptsRelations = relations(adTranscripts, ({ one }) => ({
  ad: one(ads, {
    fields: [adTranscripts.adId],
    references: [ads.id],
  }),
}));

export type Ad = InferSelectModel<typeof ads>;
export type NewAd = InferInsertModel<typeof ads>;
export type AdSnapshot = InferSelectModel<typeof adSnapshots>;
export type NewAdSnapshot = InferInsertModel<typeof adSnapshots>;
export type AdTranscript = InferSelectModel<typeof adTranscripts>;
export type NewAdTranscript = InferInsertModel<typeof adTranscripts>;
