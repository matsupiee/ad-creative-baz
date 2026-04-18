# Architecture — ad-creative-baz

> **Rule #1**: 依存は一方向。逆流させない。これを守れば、どこを触っても爆発しない。

---

## レイヤと依存方向

```
env → config → db → auth → api → ui → web
                                    ↘
                                     infra
```

| Layer | Package / Path | 役割 | 依存してよい先 |
|---|---|---|---|
| 0. env | `packages/env` | 環境変数の型定義と zod 検証 | （なし） |
| 1. config | `packages/config` | tsconfig base / 共通設定 | env |
| 2. db | `packages/db` | Drizzle スキーマ・DB クライアント | env |
| 3. auth | `packages/auth` | Better-Auth 設定・セッション | db, env |
| 4. api | `packages/api` | oRPC ルータ・ビジネスロジック | db, auth, env |
| 5. ui | `packages/ui` | shadcn プリミティブ（純粋 presentational） | （なし、UI 単独） |
| 6. web | `apps/web` | TanStack Start アプリ（画面・ルーティング） | api, auth, ui, env |
| X. infra | `packages/infra` | Alchemy デプロイ設定 | env |

### 禁止パターン

- `packages/ui` から `packages/api` や `packages/db` を import する（UI は I/O 非依存に保つ）。
- `packages/db` から `packages/api` を import する（下位が上位を知ってはいけない）。
- `apps/web` のルート / コンポーネントから直接 Drizzle クライアントを呼ぶ（oRPC 経由にする）。
- TikTok / OpenAI / Stripe などの外部 API をクライアントコンポーネントから直接叩く（全てサーバサイド = `packages/api` / batch worker 経由）。

### 境界を跨ぐときのチェックリスト

- [ ] 新しい import は上表の「依存してよい先」の範囲内か
- [ ] `packages/ui` に業務ロジック (API 呼び出し・データ整形) を持ち込んでいないか
- [ ] DB クエリは `packages/db` または `packages/api` の内側で完結しているか

---

## データフロー（MVP のバッチ側）

```
Cron (Railway)
  → Playwright で TikTok Creative Center を取得
  → 正規化して packages/db に保存
  → 未処理動画は Whisper API で文字起こし
  → Claude/GPT で整形して DB 更新
```

このバッチは `apps/web` とは別プロセス。共有するのは `packages/db` のスキーマと `packages/env` の型だけ。

---

## データフロー（MVP の表示側）

```
ユーザー
  → apps/web (TanStack Start)
  → @orpc/client で packages/api を呼ぶ
  → packages/api が packages/db を読む
  → Better-Auth でセッション検証
  → Stripe サブスク状態を確認
  → レスポンスを返す
```

クライアントから DB を直接見に行くルートは存在しない。

---

## ファイル配置のデフォルト

| 何を書くか | どこに置くか |
|---|---|
| 新しい DB テーブル | `packages/db/src/schema/<domain>.ts` |
| DB へのアクセスヘルパ | `packages/db/src/queries/<domain>.ts` |
| 新しい API エンドポイント | `packages/api/src/routers/<domain>.ts` |
| 認証・認可ロジック | `packages/auth/src/*` |
| 画面 | `apps/web/src/routes/<path>.tsx`（TanStack Router file-based） |
| 画面専用のコンポーネント | `apps/web/src/components/<feature>/*` |
| 再利用する UI プリミティブ | `packages/ui/src/components/*` |
| 環境変数の追加 | `packages/env/env.d.ts` と `packages/env/src/*` |

迷ったら **「このコードはどこから呼ばれる？」** を基準に、最も下位の共通祖先に置く。

---

## よくある判断基準

- **「ui に置く？ web/components に置く？」** → 複数 app / 複数画面から使うなら `ui`、特定画面専用なら `web/components`。
- **「api に置く？ web の server function に置く？」** → 認証やビジネスルールを含むなら `api`。画面固有のデータ整形だけなら web 側の server function でよい。
- **「新しい npm パッケージを入れたい」** → `package.json` の `catalog` に追加して各 workspace で `catalog:` 参照する。バージョンは一元管理。

---

## 長期の Evolution 方針

- v1: 上記構成のまま MVP。
- v2 (Meta 広告追加): `packages/api/src/routers/meta/*` を足す。`packages/db` に `ad_source` カラム追加でプラットフォーム種別を識別。
- v3 (YouTube Shorts): 同上。
- v4 (AI 機能): `packages/api/src/services/ai/*` を新設。Claude / GPT 呼び出しはここに閉じる。UI からは oRPC 経由でのみアクセス。

どのフェーズでも **上表のレイヤを増やさず、パッケージを横に広げる** ことを優先する。
