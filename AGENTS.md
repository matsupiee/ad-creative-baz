# AGENTS.md — ad-creative-baz

このファイルはコーディングエージェント（Claude Code / Codex 等）のエントリーポイントです。**目次**として機能し、詳細は `docs/agents/` 配下に分割しています。

MVP ゴールとプロダクト仕様は [`docs/mvp.md`](docs/mvp.md) を参照してください。

---

## 最初に読むべきドキュメント（優先順）

1. [`docs/agents/architecture.md`](docs/agents/architecture.md) — レイヤ制約・依存の向き・パッケージ境界。**コードを書く前に必ず読む**。
2. [`docs/agents/conventions.md`](docs/agents/conventions.md) — コーディング規約・命名・ファイル配置。
3. [`docs/agents/workflow.md`](docs/agents/workflow.md) — research → plan → execute → verify の標準ループ。
4. [`docs/agents/progress.md`](docs/agents/progress.md) — 進捗ログ・未完了タスク・意思決定履歴。**セッション冒頭に読み、末尾に更新する**。

---

## 標準ワークフロー（必ず守る）

1 セッション = 1 タスク = 1 feature branch = 1 PR。コンテキストウィンドウの枯渇を避けるため、複数タスクを1セッションで実装しない。

```
1. Orient   → progress.md と git log を読む
2. Branch   → main から feat/<name> を切る（main で作業しない）
3. Plan     → /plan で Planner に設計させる（変更範囲・影響ファイル・検証方法）
4. Execute  → Plan に沿って実装。1ファイルずつ、小さく commit
5. Verify   → /verify で型チェック・lint・振る舞い確認
6. Review   → /review で自己レビュー。指摘はループで解消
7. Record   → progress.md を更新して commit
8. PR       → push → gh pr create → gh pr merge --squash --delete-branch（事前承認済み）
```

詳細は [`docs/agents/workflow.md`](docs/agents/workflow.md)。

---

## ハードルール（違反したら止まって報告）

- **レイヤ違反禁止**: 依存は `env → config → db → auth → api → ui → web` の一方向のみ。逆方向 import は書かない。詳細は [`docs/agents/architecture.md`](docs/agents/architecture.md)。
- **`main` 直 commit / push 禁止**: 1 タスク = 1 feature branch + 1 PR。branch 名は `feat/`, `fix/`, `chore/`, `docs/` プレフィックス。マージは squash + branch 削除。詳細は [`docs/agents/workflow.md`](docs/agents/workflow.md) §7。**`gh pr create` / `gh pr merge --squash --delete-branch` / branch push は事前承認済み**：毎回確認を取らずに実行してよい（リポジトリオーナーは個人 1 名、CI もまだ無いため）。
- **スキーマ直触り禁止**: `packages/db/src/schema` を編集したら必ず `bun run db:generate && bun run db:push` を案内する（実行は人間に委ねる）。
- **`any` / `@ts-ignore` / `@ts-expect-error` の新規追加禁止**: やむを得ない場合は理由コメント必須。
- **シークレット直書き禁止**: `.env` / `.env.local` を触るときは値を echo しない。追加が必要な環境変数は `packages/env/env.d.ts` に型定義を追加する。
- **外部 HTTP 取得は Playwright / サーバ側に閉じる**: フロントから TikTok など外部サービスを直接叩かない（CORS / レート制限 / 著作権）。
- **その他破壊的操作は確認必須**: `db:push`, migrations の巻き戻し, `rm -rf`, `git reset --hard`, `git push --force`, `gh pr close` は必ず人間に確認。

---

## 品質ゲート（commit 前）

以下がすべて green になってから commit する:

```bash
bun run check          # oxlint + oxfmt --write
bun run check-types    # turbo check-types
bun run build          # 変更が apps/web に及ぶ場合
```

hook で `oxfmt` は保存時に自動適用される（`.claude/settings.json` 参照）。lint / 型チェックはエージェント側で明示的に回す。

---

## Skills / サブエージェント

プロジェクトにインストール済みの skill（`.claude/skills/`）:

- `better-auth-best-practices` — 認証を触るとき
- `shadcn` — UI コンポーネント追加時
- `turborepo` — turbo.json やパイプライン編集時
- `vercel-composition-patterns` / `vercel-react-best-practices` — React コンポーネント設計時
- `web-design-guidelines` — UI レビュー時

スコープの狭い作業はサブエージェント（`.claude/agents/`）に委譲する:

- `planner` — 実装計画を立てる（読み取り専用）
- `implementer` — 計画に沿ってコードを書く
- `reviewer` — 変更を独立視点でレビュー
- `verifier` — lint / 型 / build / 振る舞いを検証

---

## スラッシュコマンド

- `/plan <要件>` — Planner を起動し、実装計画を作る
- `/implement <plan への参照>` — 計画に沿って実装
- `/verify` — 品質ゲートを全通し
- `/review` — Reviewer による独立レビュー

---

## よく使うコマンド

```bash
bun install                 # 依存インストール
bun run dev                 # 全アプリ起動
bun run dev:web             # web アプリのみ
bun run check               # oxlint + oxfmt
bun run check-types         # 型チェック
bun run db:generate         # Drizzle スキーマから型生成
bun run db:push             # スキーマをDB反映（破壊的、人間確認）
bun run deploy              # Cloudflare デプロイ（破壊的、人間確認）
```

---

## このファイル自体のメンテナンス

- AGENTS.md は **150行以内** を目安に保つ。詳細は `docs/agents/` に逃がす。
- 古くなった記述を見つけたら、その場で直すか issue 化する。
- 新しい制約・規約を追加するときは `docs/agents/` の該当ファイルに書き、AGENTS.md からはリンクだけ足す。
