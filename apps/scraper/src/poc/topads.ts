import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Response } from "playwright";

import { env } from "../env.ts";
import { log } from "../lib/logger.ts";
import { extractFromDom } from "./extract-from-dom.ts";
import { collectXhrCandidates, type TopAdItem } from "./extract-from-xhr.ts";

const ARTIFACTS_DIR = resolve(import.meta.dirname, "..", "..", "artifacts");

function buildTargetUrl(): string {
  const locale = env.TIKTOK_LOCALE;
  return `https://ads.tiktok.com/business/creativecenter/topads/pad/${locale}?region=JP&period=7`;
}

function emitOk(source: "xhr" | "dom", items: TopAdItem[]): void {
  process.stdout.write(`${JSON.stringify({ status: "ok", source, items })}\n`);
}

function emitFail(status: "blocked" | "empty", reason: string): void {
  process.stderr.write(`${JSON.stringify({ status, reason })}\n`);
}

async function saveScreenshot(
  page: import("playwright").Page,
  tag: string,
): Promise<string | undefined> {
  try {
    await mkdir(ARTIFACTS_DIR, { recursive: true });
    const path = resolve(ARTIFACTS_DIR, `topads-${tag}-${Date.now()}.png`);
    await page.screenshot({ path, fullPage: true });
    return path;
  } catch (err) {
    log({ level: "warn", msg: "screenshot failed", error: String(err) });
    return undefined;
  }
}

async function main(): Promise<number> {
  const url = buildTargetUrl();
  log({ level: "info", msg: "launching browser", headless: env.PLAYWRIGHT_HEADLESS, url });

  const browser = await chromium.launch({
    headless: env.PLAYWRIGHT_HEADLESS,
    proxy: env.PROXY_URL ? { server: env.PROXY_URL } : undefined,
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: env.TIKTOK_LOCALE === "ja" ? "ja-JP" : "en-US",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    const xhrResponses: Response[] = [];
    page.on("response", (response) => {
      xhrResponses.push(response);
    });

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    } catch (err) {
      log({ level: "warn", msg: "page.goto soft-failed", error: String(err) });
    }

    // XHR 完了待ち + クライアントレンダリングの追加時間。
    await page.waitForTimeout(3_000);

    // Route A: XHR 捕捉
    const xhrItems = await collectXhrCandidates(xhrResponses);
    if (xhrItems.length > 0) {
      emitOk("xhr", xhrItems);
      return 0;
    }

    log({
      level: "info",
      msg: "xhr route yielded no items, falling back to dom",
      captured: xhrResponses.length,
    });

    // Route B: DOM パース
    const domItems = await extractFromDom(page);
    if (domItems.length > 0) {
      emitOk("dom", domItems);
      return 0;
    }

    const shotPath = await saveScreenshot(page, "empty");
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) ?? "");
    const looksBlocked = /captcha|verify|forbidden|access denied/i.test(bodyText);
    emitFail(looksBlocked ? "blocked" : "empty", shotPath ?? "no-items");
    return 1;
  } finally {
    await browser.close();
  }
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    log({ level: "error", msg: "unhandled error", error: String(err) });
    process.exit(1);
  });
