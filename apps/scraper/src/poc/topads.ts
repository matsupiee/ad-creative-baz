import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Response } from "playwright";

import { env } from "../env.ts";
import { log } from "../lib/logger.ts";
import { dumpXhr } from "./dump-xhr.ts";
import { extractFromDom } from "./extract-from-dom.ts";
import { collectXhrCandidates, type TopAdItem } from "./extract-from-xhr.ts";
import { normalizeMaterial, parseListResponse, type NormalizedMaterial } from "./fetch-api.ts";

const ARTIFACTS_DIR = resolve(import.meta.dirname, "..", "..", "artifacts");

const COUNTRIES = ["US", "GB", "KR", "DE", "JP"] as const;
const PERIODS = [7, 30, 180] as const;

type XhrOkPayload = {
  country: string;
  period: number;
  order: string;
  items: NormalizedMaterial[];
};

function buildTargetUrl(region: string, period: number): string {
  const locale = env.TIKTOK_LOCALE;
  return `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/${locale}?region=${region}&period=${period}`;
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
  log({ level: "info", msg: "launching browser", headless: env.PLAYWRIGHT_HEADLESS });

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

    const allResponses: Response[] = [];
    page.on("response", (response) => {
      allResponses.push(response);
    });

    // Route A (primary): navigate で region/period を切り替え、ブラウザ自身が
    // 署名付きで叩く /top_ads/v2/list の response body を捕捉する。
    // 裸 fetch だと CSRF/署名ヘッダ不足で 40101 になるため、navigate 経由が唯一の路線。
    for (const country of COUNTRIES) {
      for (const period of PERIODS) {
        const url = buildTargetUrl(country, period);
        log({ level: "info", msg: "navigating", url });

        const listResponsePromise = page
          .waitForResponse(
            (res) =>
              res.url().includes("/creative_radar_api/v1/top_ads/v2/list") && res.status() === 200,
            { timeout: 20_000 },
          )
          .catch(() => undefined);

        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        } catch (err) {
          log({ level: "warn", msg: "goto soft-failed", url, error: String(err) });
        }

        const listRes = await listResponsePromise;
        if (!listRes) {
          log({ level: "debug", msg: "no /list response", country, period });
          continue;
        }
        let body: unknown;
        try {
          body = await listRes.json();
        } catch (err) {
          log({ level: "debug", msg: "json parse failed", country, period, error: String(err) });
          continue;
        }
        const parsed = parseListResponse(body);
        if (!parsed.ok) {
          log({ level: "debug", msg: "parse miss", country, period, reason: parsed.reason });
          continue;
        }
        if (parsed.materials.length === 0) {
          log({ level: "debug", msg: "empty", country, period });
          continue;
        }
        const items = parsed.materials.map(normalizeMaterial);
        emitXhrOk({ country, period, order: "for_you", items });
        return 0;
      }
    }

    log({
      level: "info",
      msg: "navigation route yielded no items, falling back to passive xhr sniff",
      captured: allResponses.length,
    });

    // Route A' (legacy): 受動的に観測した XHR から候補を探す（診断目的で残す）。
    const xhrItems = await collectXhrCandidates(allResponses);
    if (xhrItems.length > 0) {
      emitLegacyOk("xhr", xhrItems);
      return 0;
    }

    const dumpDir = resolve(ARTIFACTS_DIR, `xhr-${Date.now()}`);
    await dumpXhr(allResponses, dumpDir);

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
