# Progress Log

> **ファイルシステムは唯一の永続メモリ**。Claude Code のコンテキストは毎セッション消える。
>
> 毎セッション冒頭にこのファイルを読み、末尾に更新する（[`workflow.md`](workflow.md) 参照）。
> 作業を JSON/テーブルで淡々と記録し、モデルによる改変を受けにくくする。

---

## 現在のフェーズ

- **MVP Week 1-2 (PoC) 突破**：TikTok Creative Center からのデータ取得は **Go 判定**（US + period=30 で 20 件取得成功）
- 次フェーズ: Week 3 データパイプライン構築（DB スキーマ設計 → Whisper → フロント表示）

---

## 次に手をつけるべきタスク（優先順）

| # | タスク | 完了条件 | ブロッカー |
|---|---|---|---|
| 3 | Whisper API 呼び出しのラッパ実装 | 1分の動画を投げてテキストが返る | OPENAI_API_KEY |
| 4 | ランキング一覧画面のプロトタイプ | `/` で DB から静的データを表示できる | #2 完了済み。migration 適用待ち |
| 5 | Better-Auth のログイン画面を MVP 用にカスタム | メール+パスワードでログイン→ダッシュボードへ遷移 | なし |
| 6 | Stripe Subscription の最低限組み込み | テストモードで月1万円プランを購読できる | Stripe アカウント |
| 7 | scraper の結果を `ads` / `ad_snapshots` に UPSERT するバッチ実装 | Cron 1 回で DB にレコードが積まれる | #2 の migration 適用 |

---

## 完了したタスク

- [x] Better-T-Stack による scaffolding
- [x] docs/mvp.md 作成
- [x] harness engineering セットアップ（このファイル・AGENTS.md・CLAUDE.md・.claude/ 各種）
- [x] **Task #1**: Playwright PoC。`apps/scraper` で `creative_radar_api/v1/top_ads/v2/list` から 20 件取得成功（US region, period=30）。videoUrl, title, brand, industry, likes が取得可能。動画URL は tiktokcdn.com の mp4 直リンク。
- [x] **Task #2**: `packages/db/src/schema/ads.ts` で `ads` / `ad_snapshots` / `ad_transcripts` を定義。relations + as-const unions (source/region/order_by/status) をカラム型に反映。migration 生成と `db:push` は人間タスク（AGENTS.md）。

---

## 意思決定ログ

- **2026-04-17**: フロントは TanStack Start（SSR 前提）を採用。元のMVP企画書は Next.js だったが、Better-T-Stack の既定を尊重。
- **2026-04-17**: DB は SQLite (Turso/libSQL) + Drizzle。Supabase 想定からの変更。認証は Better-Auth 直使いに移行。
- **2026-04-18**: harness engineering を導入。コーディングエージェントがレイヤを破壊しないよう `docs/agents/architecture.md` で依存方向を固定。
- **2026-04-18**: TikTok Creative Center は API (`creative_radar_api/v1/top_ads/v2/list`) 経由で取得可能。ただし裸 fetch は 40101 (CSRF/署名ヘッダ不足) で拒否されるため、**Playwright で navigate してブラウザ自身に署名付き XHR を発行させ、response body を `page.waitForResponse` で捕捉する**路線を採用。
- **2026-04-18**: JP region は現状 0 件（TikTok One へ移管中の告知モーダルあり）。MVP はまず US リージョンで データパイプラインを作り、JP は TikTok One 側の API が公開され次第再検証する。
- **2026-04-18**: `/list` レスポンスには `like` はあるが `play_count` は無い。再生数取得は詳細エンドポイント調査 or 別経路が必要（Task #2 以降の課題）。
- **2026-04-18**: `ads.id` に ULID を振らず TikTok の `material.id` をそのまま PK に採用。UPSERT とクロスシステムでの突合が容易。v2 以降で他プラットフォームを足すときは `(source, source_material_id)` の unique index で衝突を防ぐ。
- **2026-04-18**: MVP UI は履歴を見せないが、`ad_snapshots` を先に用意。履歴は後からバックフィル不能なので、Cron 稼働前に器だけ作る。`ad_fetch_runs` は stdout + Sentry で代用し、今は作らない。

---

## オープンクエスチョン（人間の判断待ち）

- TikTok Creative Center のスクレイピングで BAN を食らった場合、プロキシ購入をいつ判断するか
- Whisper の代わりに Deepgram 等を使うかのコスト比較をいつやるか
- Stripe の 7日無料トライアル運用で、カード未登録ユーザーの扱いをどうするか

---

## セッション履歴テンプレート

新セッションで進捗があったら、以下をコピペして埋める：

```
### <date> — <タスク名>

- 変更: <影響したファイル / 追加したパッケージ>
- verify: <bun run check / check-types / build / 手動確認>
- 次: <このセッションで着手しなかった残タスク>
- メモ: <設計で迷った点・後から意味がある決定>
```

---

### 2026-04-18 — harness engineering 導入

- 変更: AGENTS.md, CLAUDE.md, docs/agents/{architecture,conventions,workflow,progress}.md, .claude/settings.json, .claude/commands/*, .claude/agents/*
- verify: 設定ファイル構文と hook の発火のみ確認（機能実装はまだ）
- 次: 上記「次に手をつけるべきタスク」#1 の Playwright PoC
- メモ: AGENTS.md は150行以内の ToC に留めた。詳細はすべて docs/agents/。

### 2026-04-18 — タスク#1 Playwright PoC scaffolding

- 変更: apps/scraper/{package.json, tsconfig.json, README.md, src/env.ts, src/lib/logger.ts, src/poc/{topads.ts, extract-from-xhr.ts, extract-from-dom.ts}}、root package.json (catalog に playwright, `poc:topads` script)、turbo.json (poc:topads タスク、cache:false)、.gitignore
- verify: `bun run check` (新規追加分は lint クリーン、既存 3 件は PRE-EXISTING)、`bun run check-types` green、reviewer による独立レビューで blocking なし
- 次: 人間が `bunx playwright install chromium` → `bun run poc:topads` を実行して stdout に `{"status":"ok",...}` が出るか判定。出れば go、出なければ XHR スキーマを実データで確定させる二次イテレーション
- メモ: packages/env は `cloudflare:workers` import を含み Node 実行不可なので、apps/scraper にローカル env (`@t3-oss/env-core` + dotenv) を設置。路線 A (XHR sniff) を第一候補、B (DOM 抽出) をフォールバックにする二段構え。XHR のフィールド名は実行時に DevTools で確定させる前提の loose zod schema。

### 2026-04-18 — タスク#1 完了: Go 判定

- 実行: `bunx playwright install chromium` → `bun run poc:topads` を同セッション内で反復試験
- 経路の変遷:
  1. 初回: URL `/topads/pad/en` で Creative Center ランディングへリダイレクト → 広告一覧に到達せず（空）
  2. URL 修正 + XHR dump 診断: `/inspiration/topads/pc/en` が正しい。140 XHR 捕捉 + 9 件 body を保存 → `074.json` で API エンドポイント `creative_radar_api/v1/top_ads/v2/list` を発見。ただし JP + period=7 + for_you は 0 件（"Top Ads is upgrading to TikTok One" モーダル）
  3. `context.request.get` で直叩き: Bun 環境の Playwright 内部 URL パーサのバグで ERR_INVALID_URL
  4. `page.evaluate(() => fetch(...))` に切替: 全組み合わせ 40101 "no permission"（CSRF/署名ヘッダ不足）
  5. **navigate 複数回 + `page.waitForResponse` で signed XHR をキャプチャ**: US + period=30 で **20 件取得成功** ✅
- 成果物: commit `c1d1874`。stdout は `{"status":"ok","source":"xhr","country":"US","period":30,"order":"for_you","items":[{id,videoUrl,title,brand,industry,likes,...}×20]}`
- verify: `bun run check-types` green、`bun run check` は PRE-EXISTING 3 件のみ（新規分クリーン）
- 未解決: (a) `play_count` / view 数はこの `/list` エンドポイントに含まれない → 詳細エンドポイント要調査。(b) JP 0 件問題。(c) `/list` は 1 ページ 20 件、ページネーション未検証
- 次タスク: #2 `packages/db/src/schema/ads.ts` 設計

### 2026-04-18 — タスク#2 ads スキーマ追加

- 変更: `packages/db/src/schema/ads.ts` (新規)、`packages/db/src/schema/index.ts` (barrel)
- 3 テーブル: `ads` (TikTok material id を PK、region/period/order_by/rank をカラム持ち、`deleted_at` 論理削除)、`ad_snapshots` (履歴)、`ad_transcripts` (1:1、`status` で Whisper→LLM パイプラインを駆動)
- as-const unions (`AD_SOURCES`, `AD_REGIONS`, `AD_PERIODS`, `AD_ORDER_BYS`, `TRANSCRIPT_STATUSES`) を `text(..., { enum })` でカラム型に反映、`InferSelectModel` の推論が狭まるようにした
- verify: `bun run check-types` green (FULL TURBO cache hit)、`bun run check` は pre-existing 2 件 (`packages/env/src/server.ts` triple-slash, `packages/env/src/web.ts` unused `z`)。reviewer サブエージェントで blocking 0、non-blocking 指摘の #1 (enum typing) を反映
- 次: 人間が `bun run db:generate` → 生成 SQL を確認 → `bun run db:push` で dev D1 に適用。その後 Task #7 (scraper → DB UPSERT バッチ) へ
- メモ: `ads.id` に ULID を振らず TikTok material id を直接採用した理由は意思決定ログ参照。`ad_snapshots` は UI 未使用だが履歴がバックフィル不能なので先に器を用意
