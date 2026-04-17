import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Response } from "playwright";

import { log } from "../lib/logger.ts";

export async function dumpXhr(responses: Response[], dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
    const index: string[] = [];
    let saved = 0;
    for (const [i, res] of responses.entries()) {
      const url = res.url();
      const status = res.status();
      const contentType = res.headers()["content-type"] ?? "";
      index.push(JSON.stringify({ i, url, status, contentType }));
      const looksInteresting =
        contentType.includes("application/json") &&
        (url.includes("/api/") || url.includes("/pacific/") || url.includes("top_ads"));
      if (looksInteresting && saved < 20) {
        try {
          const body = await res.text();
          await writeFile(resolve(dir, `${String(i).padStart(3, "0")}.json`), body);
          saved++;
        } catch (err) {
          log({ level: "warn", msg: "xhr body dump failed", i, url, error: String(err) });
        }
      }
    }
    await writeFile(resolve(dir, "_index.jsonl"), `${index.join("\n")}\n`);
    log({ level: "info", msg: "xhr dump saved", dir, total: responses.length, bodies: saved });
  } catch (err) {
    log({ level: "warn", msg: "xhr dump failed", error: String(err) });
  }
}
