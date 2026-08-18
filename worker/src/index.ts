// Apply Wingman external browser worker.
//
// Claims queued form applications, attempts them in a real browser, and reports
// the outcome back. Hard rules, enforced in code:
//   • never bypasses CAPTCHA / anti-bot controls — it stops instead
//   • never fabricates an answer to a required question
//   • never accepts legal / privacy / EEO / consent declarations without an
//     explicit stored user consent
//   • only reports "submitted" when a real confirmation state was observed
//   • redacts PII and tokens from every log line
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { claim, heartbeat, report } from "./api.js";
import { routeAts } from "./ats/index.js";
import { log } from "./redact.js";
import type { AttemptResult, QueueItem } from "./types.js";

const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random().toString(36).slice(2, 8)}`;
const BATCH_SIZE = clamp(Number(process.env.WORKER_BATCH_SIZE) || 3, 1, 10);
const LEASE_SECONDS = clamp(Number(process.env.WORKER_LEASE_SECONDS) || 900, 120, 3600);
const NAV_TIMEOUT_MS = 45_000;
const PER_ITEM_TIMEOUT_MS = clamp(Number(process.env.WORKER_ITEM_TIMEOUT_MS) || 180_000, 30_000, 600_000);

async function main(): Promise<void> {
  const items = await claim(WORKER_ID, BATCH_SIZE, LEASE_SECONDS);
  log.info(`claimed ${items.length} item(s) as ${WORKER_ID}`);
  if (items.length === 0) return;

  const browser = await chromium.launch({ headless: true });
  try {
    for (const item of items) {
      const result = await withTimeout(processItem(browser, item), PER_ITEM_TIMEOUT_MS).catch(
        (error): AttemptResult => ({ outcome: "failed", error: String(error) }),
      );
      await report(item.id, WORKER_ID, result);
      log.info(`item ${item.id} -> ${result.outcome}`);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function processItem(browser: Browser, item: QueueItem): Promise<AttemptResult> {
  const route = routeAts(item.ats_type);
  if (!route.supported || !route.run) {
    return { outcome: "manual_action_required", manualReason: "unsupported_form", detail: route.reason };
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1800 },
    acceptDownloads: false,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  const beat = setInterval(() => void heartbeat(item.id, WORKER_ID, LEASE_SECONDS), 60_000);

  try {
    await page.goto(item.target_url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

    const cvPath = await downloadCv(item.tailored_cv_url);

    return await route.run({
      page,
      payload: item.candidate_payload ?? {},
      answers: item.candidate_payload?.answers ?? [],
      cvPath,
      coverLetter: item.cover_letter,
    });
  } catch (error) {
    return { outcome: "failed", error: String(error).slice(0, 400) };
  } finally {
    clearInterval(beat);
    await context.close().catch(() => undefined);
  }
}

async function downloadCv(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const dir = await mkdtemp(join(tmpdir(), "apply-cv-"));
    const path = join(dir, "resume.pdf");
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
    return path;
  } catch (error) {
    log.warn("CV download failed", error);
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

main().catch((error) => {
  log.error("worker run failed", error);
  process.exitCode = 1;
});
