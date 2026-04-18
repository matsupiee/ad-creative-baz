---
description: research→plan フェーズ。要件から実装計画を作る（書かない）
argument-hint: <要件の1行サマリ>
allowed-tools: Read, Glob, Grep, Bash(git log*), Bash(git diff*), Bash(git show*), Bash(git status*), Bash(ls*), Bash(bun x *), Agent
---

# /plan — 実装計画を作る

要件：**$ARGUMENTS**

このコマンドは **コードを書かない**。`planner` サブエージェントに以下を調査させ、構造化された計画を出すだけ。実装は `/implement` で。

## 実行手順

1. まず必読ドキュメントを確認：
   - [`AGENTS.md`](../../AGENTS.md)
   - [`docs/agents/architecture.md`](../../docs/agents/architecture.md)
   - [`docs/agents/conventions.md`](../../docs/agents/conventions.md)
   - [`docs/agents/progress.md`](../../docs/agents/progress.md)（進捗・既知ブロッカー）

2. `planner` サブエージェントを起動し、**$ARGUMENTS** を渡す。Planner は読み取り専用で:
   - 影響する既存ファイル（追加/変更/削除）を列挙
   - [`architecture.md`](../../docs/agents/architecture.md) のレイヤ制約違反がないかチェック
   - 既存の似た実装を検索（流用候補）
   - スキーマ変更の有無（あれば `db:generate` / `db:push` を要告知）
   - 検証戦略（どの品質ゲートを通すか、手動確認の要否）
   - ロールバック手順
   - **未確定事項**（人間に確認すべき点）を明示

3. 計画を以下のフォーマットでユーザーに提示：

```markdown
## Plan: <機能名>

### 目的
<1-2行で>

### 影響ファイル
- ADD: path/to/new.ts — <役割>
- MOD: path/to/existing.ts — <変更内容>
- DEL: ...

### レイヤ適合性
- ✅ env → config → db → auth → api → ui → web の向きに沿っている
- 注意点: <あれば>

### 既存実装の流用
- <あれば>

### スキーマ変更
- なし / あり（`bun run db:generate && bun run db:push` を人間に要告知）

### 検証
- [ ] bun run check
- [ ] bun run check-types
- [ ] bun run build（該当範囲）
- [ ] 手動確認: <あれば具体的な操作>

### ロールバック
<1行>

### 未確定事項（要確認）
- <あれば>
```

4. 計画に未確定事項がある / 複数の有効な方針が存在する場合は、**ここで止まってユーザーに確認**。勝手に実装に進まない。
