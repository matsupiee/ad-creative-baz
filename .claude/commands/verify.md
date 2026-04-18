---
description: 品質ゲート（lint / types / build / 手動確認）を全通しする
allowed-tools: Bash(bun *), Bash(turbo *), Bash(oxlint*), Bash(oxfmt*), Bash(git diff*), Bash(git status*), Read, Glob, Grep
---

# /verify — 品質ゲート

以下を順に実行し、**1 つでも落ちたら止まって報告**する。

## 手順

1. **変更範囲の確認**
   ```bash
   git status
   git diff --stat
   ```

2. **lint + fmt**
   ```bash
   bun run check
   ```

3. **型チェック**
   ```bash
   bun run check-types
   ```

4. **ビルド**（`apps/web` や `packages/api` など出力物を持つパッケージを触った場合のみ）
   ```bash
   bun run build
   ```

5. **UI 変更がある場合**:
   - `bun run dev:web` を立ち上げる（バックグラウンド）
   - ブラウザで変更箇所を実際に操作：golden path 1 本 + 代表的エッジケース 1 本
   - DevTools Console にエラーが出ていないか確認
   - 無理な場合（環境なし等）は **「UI 手動確認未実施」と明示報告**。勝手に「動きました」と書かない

6. **スキーマ変更があった場合**:
   - `bun run db:generate` で生成されたマイグレーションを diff で確認
   - `bun run db:push` は実行しない（ユーザーに依頼）

7. すべて green になったら要約を出す：
   ```
   ✅ check / check-types / build 通過
   ✅ UI 手動確認: <内容> or ⚠ 未実施（理由）
   ⚠ 要ユーザー対応: <db:push / deploy が必要なら>
   ```

## 失敗したときの対応

- **1 箇所だけ落ちた** → 直す → 落ちたステップから再実行
- **複数箇所が連鎖的に落ちている** → 直前 1 コミットを疑う。戻すか修正の優先順を相談
- **型エラーの原因が不明** → `as any` で逃げず、該当コードを Read で丹念に読む
