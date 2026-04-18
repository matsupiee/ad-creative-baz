# scraper

TikTok Creative Center からの広告データ取得を行う Node ランタイム用スクレイパ。MVP 期は PoC 1 本のみ。

## 前提

- bun / Node v22+
- Playwright の Chromium ブラウザがインストールされていること。初回のみ以下を実行する：

  ```bash
  bunx playwright install chromium
  ```

## PoC: topads

TikTok Creative Center のトップ広告一覧ページからデータ取得できるかを検証する PoC。

```bash
bun run poc:topads
```

### 成功判定

stdout に 1 行の JSON が出力される：

```json
{"status":"ok","source":"xhr","items":[{"videoUrl":"...","playCount":12345,"title":"..."}]}
```

`source` は取得経路。

- `xhr` … ネットワーク経由 (Playwright `page.on("response")` で捕捉) で JSON を取れた場合。
- `dom` … XHR 経路で取れず、DOM パースにフォールバックして取れた場合。

### 失敗時

stderr に `{"status":"blocked"|"empty","reason":"..."}` が出力され、`apps/scraper/artifacts/topads-<timestamp>.png` にスクリーンショットが保存される。exit code は 1。

## A / B 路線

| 路線 | 実体 | 備考 |
|---|---|---|
| A: XHR 捕捉 | `src/poc/extract-from-xhr.ts` | 壊れにくく高速。優先ルート。|
| B: DOM パース | `src/poc/extract-from-dom.ts` | 最後の砦。UI 変更に弱い。|

両方試してどちらかで取れれば ok。

## Ingest バッチ

`poc:topads` と同じ経路で収集した結果を `apps/web` の `ads.ingest` oRPC エンドポイントに POST し、`ads` / `ad_snapshots` に UPSERT する。Cron からの定期実行を想定。

```bash
bun run ingest
```

- `INGEST_API_URL`（例: `http://localhost:3001` や本番 `https://<host>`）と `INGEST_TOKEN` が必須。
- stdout に 1 行 JSON: `{"status":"ok","results":[{"region":"US","period":30,"captured":20,"upsertedAds":20,"insertedSnapshots":20}, ...],"failures":[...]}`
- `apps/web` 側は `INGEST_TOKEN` バインディングを持ち、`x-ingest-token` ヘッダで突合する。

## 環境変数

`apps/scraper/.env` に記述（gitignore 済み）：

| 変数 | 既定 | 役割 |
|---|---|---|
| `TIKTOK_LOCALE` | `en` | TikTok Creative Center のロケール |
| `PLAYWRIGHT_HEADLESS` | `true` | ヘッドレス可否。デバッグ時は `false` |
| `PROXY_URL` | （未設定） | プロキシ URL。必要になったら設定 |
| `INGEST_API_URL` | （未設定） | `apps/web` のベース URL。末尾 `/` は任意 |
| `INGEST_TOKEN` | （未設定） | ingest エンドポイント用の shared secret |

## 設計メモ

- **`@ad-creative-baz/env` を使わない理由**: 既存 `packages/env` は `cloudflare:workers` import を含むため、Node ランタイムでは解決できない。PoC 期は apps/scraper 専用の薄い env ローダを `src/env.ts` に置く。
- **外部 HTTP はサーバ側に閉じる**: 本パッケージは Node プロセス（将来的に Railway / Fly.io 上の cron）からのみ呼ばれる。`apps/web` からの直接 import は禁止。
