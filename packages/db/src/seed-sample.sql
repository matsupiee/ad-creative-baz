-- Sample seed data for local dev. Not tracked by d1_migrations.
-- Mimics the shape of `creative_radar_api/v1/top_ads/v2/list` responses.
DELETE FROM ads WHERE source_material_id LIKE 'sample-%';

INSERT INTO ads (id, source, source_material_id, title, brand, industry, video_vid, video_url, cover_url, duration_seconds, likes, play_count, shares, region, period, order_by, rank)
VALUES
  ('sample-1', 'tiktok', 'sample-1', 'Summer campaign — beach vibes', 'SunCo', 'Fashion', NULL, NULL, 'https://picsum.photos/seed/ad1/360/640', 15, 1285000, 9800000, 32100, 'US', 30, 'for_you', 1),
  ('sample-2', 'tiktok', 'sample-2', 'New snack drop, crunchy take', 'BiteLabs', 'Food & Drink', NULL, NULL, 'https://picsum.photos/seed/ad2/360/640', 22, 980000, 7200000, 24400, 'US', 30, 'for_you', 2),
  ('sample-3', 'tiktok', 'sample-3', 'Gaming mouse unboxed', 'GripZ', 'Electronics', NULL, NULL, 'https://picsum.photos/seed/ad3/360/640', 30, 742000, 5100000, 18200, 'US', 30, 'for_you', 3),
  ('sample-4', 'tiktok', 'sample-4', 'Cute plushie POV', 'FluffTown', 'Toys & Games', NULL, NULL, 'https://picsum.photos/seed/ad4/360/640', 12, 610000, 4300000, 11800, 'US', 30, 'for_you', 4),
  ('sample-5', 'tiktok', 'sample-5', 'Skincare routine, 3 steps', 'GlowFix', 'Beauty', NULL, NULL, 'https://picsum.photos/seed/ad5/360/640', 25, 552000, 3900000, 9600, 'US', 30, 'for_you', 5),
  ('sample-6', 'tiktok', 'sample-6', 'Travel vlog — Kyoto', 'WayGo', 'Travel', NULL, NULL, 'https://picsum.photos/seed/ad6/360/640', 40, 481000, 3400000, 8200, 'US', 30, 'for_you', 6),
  ('sample-7', 'tiktok', 'sample-7', 'Plant-based protein shake', 'LeafFuel', 'Food & Drink', NULL, NULL, 'https://picsum.photos/seed/ad7/360/640', 18, 420000, 3000000, 7100, 'US', 30, 'for_you', 7),
  ('sample-8', 'tiktok', 'sample-8', 'Running shoes stress test', 'PaceKick', 'Sports', NULL, NULL, 'https://picsum.photos/seed/ad8/360/640', 20, 388000, 2800000, 6400, 'US', 30, 'for_you', 8),
  ('sample-9', 'tiktok', 'sample-9', 'DIY home office upgrade', 'DeskFlow', 'Home', NULL, NULL, 'https://picsum.photos/seed/ad9/360/640', 35, 355000, 2600000, 5800, 'US', 30, 'for_you', 9),
  ('sample-10', 'tiktok', 'sample-10', 'EV quick-charge demo', 'VoltGo', 'Automotive', NULL, NULL, 'https://picsum.photos/seed/ad10/360/640', 28, 330000, 2450000, 5100, 'US', 30, 'for_you', 10),
  ('sample-11', 'tiktok', 'sample-11', 'Coffee ASMR steam', 'BrewBloom', 'Food & Drink', NULL, NULL, 'https://picsum.photos/seed/ad11/360/640', 14, 305000, 2300000, 4700, 'US', 30, 'for_you', 11),
  ('sample-12', 'tiktok', 'sample-12', 'Tiny-home tour, 18m²', 'NestKit', 'Home', NULL, NULL, 'https://picsum.photos/seed/ad12/360/640', 45, 284000, 2100000, 4300, 'US', 30, 'for_you', 12);
