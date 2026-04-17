import type { Page } from "playwright";

import type { TopAdItem } from "./extract-from-xhr.ts";

// "1.2M" / "12.3K" / "1,234" 形式を number に直す。
// 表記が想定外なら undefined を返す（呼び側で捨てる）。
export function parseCompactNumber(input: string): number | undefined {
  const s = input.trim().replace(/,/g, "");
  const match = /^(\d+(?:\.\d+)?)([KkMmBb])?$/.exec(s);
  if (!match) {
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  const numPart = match[1];
  const suffix = match[2];
  if (numPart === undefined) return undefined;
  const base = Number(numPart);
  if (!Number.isFinite(base)) return undefined;
  const multiplier =
    suffix === "K" || suffix === "k"
      ? 1_000
      : suffix === "M" || suffix === "m"
        ? 1_000_000
        : suffix === "B" || suffix === "b"
          ? 1_000_000_000
          : 1;
  return Math.round(base * multiplier);
}

const CARD_SELECTOR_CANDIDATES = [
  "[data-testid='creative-card']",
  "[class*='CcCard']",
  "[class*='creative-card']",
  "[class*='TopadsItem']",
  "[class*='VideoCard']",
  "[class*='MaterialCard']",
];

async function waitForAnyCard(page: Page): Promise<string | null> {
  for (const selector of CARD_SELECTOR_CANDIDATES) {
    try {
      await page.waitForSelector(selector, { timeout: 5_000, state: "attached" });
      return selector;
    } catch {
      continue;
    }
  }
  return null;
}

export async function extractFromDom(page: Page): Promise<TopAdItem[]> {
  const selector = await waitForAnyCard(page);
  if (!selector) return [];

  const rawItems = await page.$$eval(selector, (nodes) => {
    function pickText(root: Element, selectors: string[]): string | undefined {
      for (const sel of selectors) {
        const el = root.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text) return text;
      }
      return undefined;
    }
    function pickAttr(root: Element, attr: string, selectors: string[]): string | undefined {
      for (const sel of selectors) {
        const el = root.querySelector(sel);
        const v = el?.getAttribute(attr);
        if (v) return v;
      }
      return undefined;
    }

    return nodes.map((node) => {
      const videoEl = node.querySelector("video");
      const videoSrc =
        videoEl?.getAttribute("src") ??
        videoEl?.querySelector("source")?.getAttribute("src") ??
        pickAttr(node, "data-video-url", ["[data-video-url]"]) ??
        pickAttr(node, "href", ["a[href*='video']"]);

      const playCountText = pickText(node, [
        "[class*='PlayCount']",
        "[class*='play-count']",
        "[data-testid='play-count']",
        "[class*='Views']",
        "[class*='views']",
      ]);

      const title = pickText(node, [
        "[class*='Title']",
        "[class*='title']",
        "[data-testid='ad-title']",
      ]);

      const advertiser = pickText(node, [
        "[class*='Advertiser']",
        "[class*='advertiser']",
        "[class*='BrandName']",
        "[class*='brand-name']",
      ]);

      return { videoSrc, playCountText, title, advertiser };
    });
  });

  const out: TopAdItem[] = [];
  for (const raw of rawItems) {
    if (!raw.videoSrc || !raw.playCountText) continue;
    const playCount = parseCompactNumber(raw.playCountText);
    if (playCount === undefined) continue;
    const entry: TopAdItem = { videoUrl: raw.videoSrc, playCount };
    if (raw.title) entry.title = raw.title;
    if (raw.advertiser) entry.advertiser = raw.advertiser;
    out.push(entry);
  }
  return out;
}
