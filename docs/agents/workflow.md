# Workflow — research → plan → execute → verify

> これは harness engineering の中核ループ。**どんなタスクでもこの順でやる。** 順序を飛ばすと、かならずどこかで手戻りする。

---

## 0. 前提：1 セッション = 1 タスク = 1 feature branch = 1 PR

Claude Code のコンテキストは有限。1セッションで複数タスクをこなすとコンテキストが汚染され、後半ほど精度が落ちる。

**1 機能 / 1 バグ / 1 リファクタ ごとに新しいセッションを立てる。** 手持ちの仕事が複数あっても、必ず1つに絞って着手する。

そして **必ず feature branch を切ってから着手し、終わったら PR にしてマージする**。`main` で直接作業しない。理由は §7 を参照。

---

## 1. Orient（着手前）

```
1. docs/agents/progress.md を読む
2. git log --oneline -20 を眺める
3. docs/mvp.md の該当セクションを確認
4. 変更対象のファイルを Read
5. 現在 branch を確認（git status）。main に居たら次の §1.5 で branch を切る
```

この段階では**まだ何も書かない**。全体像が頭に入るまで書かない。

---

## 1.5. Branch（着手直前）

main から feature branch を切る。**最初の commit を作る前に必ず行う**。

```bash
git checkout main && git pull --ff-only
git checkout -b <prefix>/<short-kebab-name>
```

branch 名規約:

| prefix | 用途 | 例 |
|---|---|---|
| `feat/` | 新機能 / 既存機能の拡張 | `feat/ads-schema`, `feat/topads-poc` |
| `fix/`  | バグ修正 | `fix/scraper-redirect` |
| `chore/`| 依存更新・設定・CI | `chore/upgrade-playwright` |
| `docs/` | ドキュメントのみ | `docs/agents-pr-flow` |
| `refactor/` | 振る舞い変えないリファクタ | `refactor/extract-dom-parser` |

短く・小文字 kebab-case・タスクの主語を含める。ブランチ名がそのまま PR タイトルの叩き台になる。

---

## 2. Plan（設計）

`/plan <要件>` で Planner サブエージェントを起動する。

Planner は以下を読み取り専用で調べ、計画を返す：

- 影響ファイル一覧（追加・変更・削除）
- レイヤ制約 ([`architecture.md`](architecture.md)) に違反していないか
- 既存の似た実装があるか（あれば流用）
- テスト戦略（何をどう verify するか）
- ロールバック手順

**計画に自分で合意できない / ユーザーに相談したい箇所があれば、ここで止まって確認する。** 実装に入ってから「やっぱり違った」の方が高コスト。

---

## 3. Execute（実装）

`/implement` で Implementer サブエージェントに計画を渡す、または自分で進める。

ルール：

- 1ファイルずつ、小さく。
- **保存ごとに oxfmt が hook で走る**（`.claude/settings.json`）。fmt の破壊的変更が出たら、編集意図と合っているか確認。
- スキーマ変更 (`packages/db/src/schema`) を触ったら、その時点で「`bun run db:generate && bun run db:push` を実行してください」と人間に告知する（自分では実行しない）。
- 1論理単位（例：「ログイン画面のフォーム」）ができたら一度 commit。

---

## 4. Verify（検証）

`/verify` コマンドで以下を順に流す：

```bash
bun run check           # oxlint + oxfmt
bun run check-types     # 型
bun run build           # ビルド（該当範囲のみでも可）
```

UI 変更の場合は追加で：

- `bun run dev:web` を立ち上げる
- ブラウザで実際に操作する（golden path + エッジケース 1 本）
- コンソールエラーがないことを確認

**型が通った / lint が通った = 動く、ではない。** UI は手で触る。

---

## 5. Review（セルフレビュー）

`/review` で Reviewer サブエージェントに独立視点で見てもらう。

Reviewer は：

- レイヤ違反
- `any` / `ts-ignore` の紛れ込み
- 外部 API をクライアントから叩いていないか
- 既存の似た関数を再発明していないか
- エラーハンドリングの抜け
- n+1 クエリ / 大量データの非ストリーミング処理

を点検する。指摘があれば **修正 → 再 review** のループを、Reviewer が満足するまで回す。

---

## 6. Record（記録）

[`progress.md`](progress.md) を更新：

- 完了した項目にチェック
- 未完了 / 次に必要なタスクを追記
- 設計上の意思決定で後から役立つもの（「なぜこの実装を選ばなかったか」など）を1-3行で残す

その後 commit。**ここではまだ push しない。** §7 でまとめて push する。

---

## 7. PR & Merge（締め）

Verify と Review が通り progress.md も commit したら、PR を作ってマージする。**この一連は事前承認済みなので、毎回ユーザーに確認を取らずに実行してよい**（個人 1 名運用 + CI 未整備の MVP 期限定の運用ルール。AGENTS.md ハードルール参照）。

```bash
# 1. push（初回は -u で upstream を張る）
git push -u origin <branch-name>

# 2. PR 作成。HEREDOC で body を整形
gh pr create --base main --title "<prefix>: <短いタイトル>" --body "$(cat <<'EOF'
## Summary
- <変更点 1>
- <変更点 2>

## Verify
- [x] bun run check
- [x] bun run check-types
- [x] (UI 変更時) 手動操作確認

## Notes
<設計判断の根拠 / 次タスクへの引き継ぎ事項があれば>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

# 3. squash merge + branch 削除（CI が未整備のうちは即マージで良い。CI 導入後は --auto に切替）
gh pr merge --squash --delete-branch

# 4. ローカルを main に戻して同期
git checkout main && git pull --ff-only
```

PR タイトルは Conventional Commits 風に揃える（branch prefix を流用）：

- `feat: TikTok topads PoC scaffolding`
- `fix(scraper): correct topads URL`
- `docs(agents): adopt PR-based workflow`

**PR を出す意義**（main 直 push と比較）:

1. 後から「いつ・なぜこの変更が入ったか」を PR description で辿れる（commit message より粒度が大きい）
2. CI を後から足したときに既存運用を壊さずに済む
3. 第三者（将来の協業者 / 自分の未来形）から見て、変更がレビュー可能な単位で並ぶ
4. squash で commit 履歴が圧縮されるので、エージェントが小刻みに作る WIP commit が main に残らない

**例外**: `main` ブランチ自体の hotfix（PR フローが壊れて緊急に直す等）はユーザーに明示的に確認を取って main 直 push して良い。それ以外は無条件で PR フロー。

---

## 迷ったときの判断

| 状況 | どうする |
|---|---|
| 計画段階で不確実性が高い | Plan を出して**人間に確認**。実装に入らない |
| 実装中にレイヤ違反を踏みそう | 一度止まり、[`architecture.md`](architecture.md) を再読。設計を直す |
| verify が落ちる | 直近の1コミットを疑う。バンバン新規修正を積まない |
| review 指摘が多い | 計画段階の読みが甘かった。実装を捨てて plan からやり直す判断もあり |
| コンテキストが重くなってきた | 現セッションの成果を progress.md に書き、PR まで出して一旦終了。続きは新セッションで新 branch を切る |
| すでに main 上で commit してしまった | 即座に `git branch <prefix>/<name>` で branch を作り、`git reset --keep origin/main` で main を巻き戻し、新 branch に checkout。**push 前に気付けばリカバリ可能** |
| push 済みの main に未 PR commit が混入している | リカバリ不能。次回から徹底。ユーザーに報告だけ |

---

## やってはいけないショートカット

- `--no-verify` でフックをバイパスする
- lint エラーを `// oxlint-disable-next-line` で潰して前進する
- 型エラーを `as any` で押し通す
- テストを「一時的に」skip する（戻ってこない）
- 「動いてるっぽい」で commit する

**これらは全部、harness の意義を壊す行為。** 詰まったら止まって、人間に相談する方が速い。
