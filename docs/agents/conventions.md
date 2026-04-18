# Coding Conventions — ad-creative-baz

> 迷わず書けるよう、既存コードから読み取れる規約を明文化したもの。AGENTS.md と併せて読む。

---

## TypeScript

- **strict モード前提**。`any` / `@ts-ignore` / `@ts-expect-error` の新規追加は禁止。やむを得ない場合は理由を1行コメント。
- `unknown` で受けて zod で絞り込む。zod スキーマは `packages/db` / `packages/api` 側で定義。
- 型は**値から導出**する：
  - Drizzle のテーブル → `InferSelectModel<typeof t>` / `InferInsertModel<typeof t>`
  - oRPC の output → `RouterClient<typeof router>` を使う
- `enum` は使わない。`as const` 配列 + `typeof arr[number]` の Union で置き換える。
- export はファイル末尾にまとめない。宣言箇所で直接 `export` する。

## インポート順

1. Node 標準
2. 外部パッケージ（`react`, `@tanstack/*` など）
3. ワークスペース (`@ad-creative-baz/*`)
4. 相対 (`./`, `../`)

oxlint / oxfmt が整えてくれるので、人間が並び替えを意識する必要はない。

## 命名

- ファイル名: `kebab-case.ts`（React コンポーネント含む）
- コンポーネント: `PascalCase`
- 関数・変数: `camelCase`
- 定数: `SCREAMING_SNAKE_CASE`（設定値・魔法数字）
- 型・interface: `PascalCase`。`IFoo` / `TFoo` のプレフィックスは使わない。

---

## React / TanStack Start

- **デフォルトは Server Component 的発想**: `apps/web/src/routes/*` のローダで API を叩き、props 経由で props-drilling。クライアント状態が必要なら `use client` 相当の構造に切り出す。
- `useEffect` でデータ取得しない。`@tanstack/react-query` か loader を使う。
- フォームは `@tanstack/react-form` + zod。
- `packages/ui` のコンポーネントは **presentational only**。API 呼び出し / react-query フックを内包しない。
- Suspense / ErrorBoundary は route レベルに置く（`apps/web/src/routes/__root.tsx` 近辺）。
- `"use client"` 境界が曖昧になる変更は事前に [`architecture.md`](architecture.md) のレイヤ確認をする。

## shadcn

- 新しいプリミティブは `packages/ui` に追加：`npx shadcn@latest add <name> -c packages/ui`。
- 追加後、`packages/ui/src/components/*` の中身を見て、このプロジェクトの他コンポーネントと命名・props・class-variance-authority の使い方を合わせる。
- アプリ固有の組み合わせコンポーネント（例: `PricingCard`）は `apps/web/src/components/*` に置く。

---

## oRPC

- ルータは `packages/api/src/routers/<domain>.ts` に1ドメイン1ファイル。
- input / output は必ず zod で定義。型は zod から `z.infer` で取り出す。
- 認証必須のエンドポイントは `packages/api/src/context.ts` のミドルウェアでセッションを注入する。
- エラーは `ORPCError` を throw する。`throw new Error("...")` を素で投げない。

## Drizzle

- スキーマ変更 → `bun run db:generate` → 生成されたマイグレーションを確認 → `bun run db:push`（破壊的なので人間に委ねる）。
- テーブル名は `snake_case` 複数形、カラム名は `snake_case`。
- 主キーは `id text primary key` + `crypto.randomUUID()` または ULID。連番 int は使わない。
- 論理削除は `deleted_at` (nullable timestamp)。physical delete はバッチ側だけ。

## Better-Auth

- プラグインの追加は skill `better-auth-best-practices` を参照。
- セッションの読み出しは `packages/auth` の helper 経由でのみ行う。cookie を直接触らない。

---

## エラーハンドリング

- **境界でのみ try/catch**：外部 HTTP・DB・ファイル I/O の直近。内部ロジックでは例外をそのまま伝播させる。
- ユーザーに見せるメッセージは `ORPCError` / フォームバリデーションに集約。console.log を本番経路に残さない。
- Sentry はバッチとサーバの uncaught を拾う設定（PoC 期は後回し可）。

## ロギング

- `console.log` は本番コードから削除。残す必要があれば `console.info` / `console.warn` を使い理由コメント。
- バッチ側は構造化ログ（JSON）で出す。

---

## コメントとドキュメント

- WHAT は書かない（識別子で語る）。WHY が非自明な場合だけ書く：制約・前提・既知のバグ回避。
- マイグレーション理由・仕様の根拠は commit メッセージと `docs/agents/progress.md` に残す。コード内に長文コメントは書かない。
- TODO コメントは GitHub Issue 番号とセットで。

---

## テスト

MVP 期は以下の優先順で最低限だけ書く：

1. `packages/api` の routers: zod 入出力と happy path の 1 ケース
2. `packages/auth` / `packages/db` のヘルパ: 非自明なロジックがあるときのみ
3. `apps/web` のコンポーネント: 壊れると UX に直結する重要画面のみ

framework: `@testing-library/react` + `vitest`（apps/web に既に入っている）。

---

## Git

- コミットは1論理単位ごと。「AGENTS.md 更新 + ログイン画面実装」を1コミットにしない。
- コミットメッセージは日本語 OK、主語は動詞命令形（例: `add TikTok ranking loader`）。
- 破壊的変更（DB スキーマ・env 追加）は commit メッセージに `BREAKING:` プレフィックス。
- `git push --force` / `git reset --hard` は人間に確認してから実行。

---

## 外部 API を扱うとき

- TikTok / Whisper / Stripe / OpenAI は **すべてサーバ側**から呼ぶ。API キーは `packages/env` で型定義し、`.env` で管理。
- レート制限に触れる可能性のある呼び出しは指数バックオフ。`packages/api/src/lib/retry.ts`（なければ作る）に集約。
- TikTok 取得は Playwright を **別プロセス** (Railway / Fly.io) で動かす。`apps/web` の runtime からは呼ばない。
