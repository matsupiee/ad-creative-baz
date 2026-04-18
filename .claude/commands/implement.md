---
description: 承認済み plan に沿って実装する（execute フェーズ）
argument-hint: <plan のタイトル or タスク>
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(git *), Bash(bun *), Bash(turbo *), Bash(oxfmt*), Bash(oxlint*), Agent
---

# /implement — 計画を実装する

対象：**$ARGUMENTS**

## 前提
- 事前に `/plan` で計画が作られ、ユーザーが合意していること。
- 未確定事項が残っていたら、止めてユーザーに確認する。

## 実行手順

1. 直前の plan を確認（会話履歴・`docs/agents/progress.md` のどちらか）。

2. 計画に沿って **1 ファイルずつ小さく** 実装する：
   - 新規ファイルは [`conventions.md`](../../docs/agents/conventions.md) の命名・配置に従う
   - 既存に似た実装があれば読んでスタイルを合わせる
   - `any` / `@ts-ignore` は使わない（やむを得ない場合は理由コメント）
   - PostToolUse hook が保存時に `oxfmt` を走らせるので、手動で format しない
   - 外部 API 呼び出しは必ずサーバ側（`packages/api`）に閉じる

3. 1 論理単位（例：「ログインフォームとハンドラ」）ができたら以下を即座に実行：
   ```bash
   bun run check          # oxlint + oxfmt
   bun run check-types    # 型
   ```
   失敗したら直して再実行。通ってから次の単位へ。

4. スキーマ変更（`packages/db/src/schema/*` を編集した場合）は **自分で db:push しない**。
   ユーザーに告知：
   ```
   ⚠ スキーマ変更を行いました。以下を実行してください：
     bun run db:generate
     bun run db:push
   ```

5. すべての単位が終わったら `/verify` を促す。

## やってはいけないこと

- plan で合意した範囲外のファイルを触る（「ついでに直した」禁止）
- 計画にない新しい依存パッケージを追加する
- lint エラーを disable コメントで潰す
- 型エラーを `as any` で押し通す
- 複数コミットをまとめて1コミットにする
