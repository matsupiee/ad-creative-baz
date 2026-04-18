import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Response } from "playwright";

import { env } from "../env.ts";
import { log } from "../lib/logger.ts";
import { dumpXhr } from "./dump-xhr.ts";
import { extractFromDom } from "./extract-from-dom.ts";
import { collectXhrCandidates, type TopAdItem } from "./extract-from-xhr.ts";
import { fetchTopAds, normalizeMaterial, type NormalizedMaterial } from "./fetch-api.ts";

const ARTIFACTS_DIR = resolve(import.meta.dirname, "..", "..", "artifacts");

const COUNTRIES = ["JP", "US", "GB", "KR", "DE"] as const;
const PERIODS = [7, 30, 180] as const;
const ORDERS = ["for_you", "ctr", "like", "play"] as const;

type XhrOkPayload = {
  country: string;
  period: number;
  order: string;
  items: NormalizedMaterial[];
};

function buildTargetUrl(): string {
  const locale = env.TIKTOK_LOCALE;
  // 実際の Creative Center Top Ads Dashboard。
  // https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?region=JP&period=7
  return `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/${locale}?region=JP&period=7`;
}

function emitXhrOk(payload: XhrOkPayload): void {
  process.stdout.write(`${JSON.stringify({ status: "ok", source: "xhr", ...payload })}\n`);
}

function emitLegacyOk(source: "xhr" | "dom", items: TopAdItem[]): void {
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

    // cookie 発行待ち
    await page.waitForTimeout(2_000);

    // Route A (primary): creative_radar_api を context.request.get で直叩き。
    // session cookie は context が保持しているぶんが自動付与される。
    // country × period × order を順に試し、最初に materials 非空だったものを採用。
    for (const country of COUNTRIES) {
      for (const period of PERIODS) {
        for (const order of ORDERS) {
          const result = await fetchTopAds(context, {
            countryCode: country,
            period,
            orderBy: order,
          });
          if (!result.ok) {
            log({
              level: "debug",
              msg: "fetch miss",
              country,
              period,
              order,
              reason: result.reason,
            });
            continue;
          }
          if (result.materials.length === 0) {
            log({ level: "debug", msg: "empty", country, period, order });
            continue;
          }
          const items = result.materials.map(normalizeMaterial);
          // video_url の構造が未確定のため videoUrl 有無で絞り込まず、
          // materials が取れた時点で成功扱い（完了条件: items.length >= 1）。
          emitXhrOk({ country, period, order, items });
          return 0;
        }
      }
    }

    log({
      level: "info",
      msg: "direct api route yielded no items, falling back to passive xhr sniff",
      captured: xhrResponses.length,
    });

    // Route A' (legacy): 受動的に観測した XHR から候補を探す（診断目的で残す）。
    const xhrItems = await collectXhrCandidates(xhrResponses);
    if (xhrItems.length > 0) {
      emitLegacyOk("xhr", xhrItems);
      return 0;
    }

    // XHR 空振り時の診断 dump
    const dumpDir = resolve(ARTIFACTS_DIR, `xhr-${Date.now()}`);
    await dumpXhr(xhrResponses, dumpDir);

    // Route B: DOM パース
    const domItems = await extractFromDom(page);
    if (domItems.length > 0) {
      emitLegacyOk("dom", domItems);
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
