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

## 環境変数

`apps/scraper/.env` に記述（gitignore 済み）：

| 変数 | 既定 | 役割 |
|---|---|---|
| `TIKTOK_LOCALE` | `en` | TikTok Creative Center のロケール |
| `PLAYWRIGHT_HEADLESS` | `true` | ヘッドレス可否。デバッグ時は `false` |
| `PROXY_URL` | （未設定） | プロキシ URL。必要になったら設定 |

## 設計メモ

- **`@ad-creative-baz/env` を使わない理由**: 既存 `packages/env` は `cloudflare:workers` import を含むため、Node ランタイムでは解決できない。PoC 期は apps/scraper 専用の薄い env ローダを `src/env.ts` に置く。
- **外部 HTTP はサーバ側に閉じる**: 本パッケージは Node プロセス（将来的に Railway / Fly.io 上の cron）からのみ呼ばれる。`apps/web` からの直接 import は禁止。
