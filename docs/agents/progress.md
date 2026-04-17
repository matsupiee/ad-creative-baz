# Progress Log

> **ファイルシステムは唯一の永続メモリ**。Claude Code のコンテキストは毎セッション消える。
>
> 毎セッション冒頭にこのファイルを読み、末尾に更新する（[`workflow.md`](workflow.md) 参照）。
> 作業を JSON/テーブルで淡々と記録し、モデルによる改変を受けにくくする。

---

## 現在のフェーズ

- **MVP Week 1-2 (PoC)**：TikTok Creative Center からのデータ取得可否を検証する段階
- Stack scaffolding（Better-T-Stack）は完了。アプリ独自機能は未着手。

---

## 次に手をつけるべきタスク（優先順）

| # | タスク | 完了条件 | ブロッカー |
|---|---|---|---|
| 1 | Playwright で TikTok Creative Center のトップ広告一覧を取得できるか検証 | 1件でも動画URL と再生数が取れれば go | なし |
| 2 | `packages/db/src/schema/ads.ts` のスキーマ設計 | migration が生成され、ローカル SQLite に push できる | #1 |
| 3 | Whisper API 呼び出しのラッパ実装 | 1分の動画を投げてテキストが返る | OPENAI_API_KEY |
| 4 | ランキング一覧画面のプロトタイプ | `/` で DB から静的データを表示できる | #2 |
| 5 | Better-Auth のログイン画面を MVP 用にカスタム | メール+パスワードでログイン→ダッシュボードへ遷移 | なし |
| 6 | Stripe Subscription の最低限組み込み | テストモードで月1万円プランを購読できる | Stripe アカウント |

---

## 完了したタスク

- [x] Better-T-Stack による scaffolding
- [x] docs/mvp.md 作成
- [x] harness engineering セットアップ（このファイル・AGENTS.md・CLAUDE.md・.claude/ 各種）

---

## 意思決定ログ

- **2026-04-17**: フロントは TanStack Start（SSR 前提）を採用。元のMVP企画書は Next.js だったが、Better-T-Stack の既定を尊重。
- **2026-04-17**: DB は SQLite (Turso/libSQL) + Drizzle。Supabase 想定からの変更。認証は Better-Auth 直使いに移行。
- **2026-04-18**: harness engineering を導入。コーディングエージェントがレイヤを破壊しないよう `docs/agents/architecture.md` で依存方向を固定。

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
