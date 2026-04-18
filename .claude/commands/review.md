---
description: 独立視点でのセルフレビュー（reviewer サブエージェントに委譲）
allowed-tools: Read, Grep, Glob, Bash(git diff*), Bash(git log*), Bash(git status*), Agent
---

# /review — 独立レビュー

現在の変更を `reviewer` サブエージェントに独立視点で見てもらう。メイン会話の文脈を持たないので、コードが自立して語れているかの検証になる。

## 実行手順

1. 現状の変更を確認：
   ```bash
   git status
   git diff
   ```

2. `reviewer` サブエージェントを起動し、以下を渡す：
   - 対象コミット範囲 or diff
   - 意図の1行サマリ
   - 「[`AGENTS.md`](../../AGENTS.md) と [`docs/agents/architecture.md`](../../docs/agents/architecture.md), [`conventions.md`](../../docs/agents/conventions.md) に照らしてレビューしてください」

3. Reviewer のチェックリスト（エージェント側のプロンプトで既定される）：
   - [ ] レイヤ違反（上位 → 下位の向きに沿っているか）
   - [ ] `any` / `@ts-ignore` / `@ts-expect-error` の新規追加
   - [ ] クライアントから外部 API を直接叩いていないか
   - [ ] 既存ヘルパを再発明していないか
   - [ ] zod バリデーションの抜け
   - [ ] エラーハンドリングの抜け（境界で try/catch）
   - [ ] n+1 クエリ / 非ストリーミング
   - [ ] 不要なコメント（WHAT を説明するだけのもの）
   - [ ] テスト追加の要否

4. 指摘が 0 件なら完了。1件以上なら **修正 → /review 再実行** をループ。

5. Reviewer 側で blocking な指摘が出た場合、自力で直すのが怪しい箇所があればユーザーに相談する。
