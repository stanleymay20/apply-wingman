// Generic adapter: works for Greenhouse, Lever, Ashby, Workable, Recruitee and
// most plain company forms. Anything it cannot answer becomes manual action.
import type { Page } from "playwright";
import { detectBlockers } from "../guards.js";
import type { AttemptResult } from "../types.js";
import {
  attachCv,
  fillIfPresent,
  resolveRemainingRequiredFields,
  verifySubmission,
  type FillContext,
} from "./common.js";

const APPLY_TRIGGERS = [
  "button:has-text('Apply for this job')",
  "a:has-text('Apply for this job')",
  "button:has-text('Apply now')",
  "a:has-text('Apply now')",
  "button:has-text('Apply')",
];

const SUBMIT_BUTTONS = [
  "button[type='submit']:not([disabled])",
  "input[type='submit']",
  "button:has-text('Submit application')",
  "button:has-text('Submit')",
];

export async function applyGeneric(ctx: FillContext): Promise<AttemptResult> {
  const { page, payload, coverLetter, cvPath } = ctx;

  const blocker = await detectBlockers(page);
  if (blocker) return { outcome: "manual_action_required", manualReason: blocker.reason, detail: blocker.detail };

  await openApplyForm(page);

  const [firstName, lastName] = splitName(payload);

  await fillIfPresent(page.locator("input[name*='first' i], input[id*='first' i]"), firstName);
  await fillIfPresent(page.locator("input[name*='last' i], input[id*='last' i]"), lastName);
  await fillIfPresent(
    page.locator("input[name='name'], input[id='full_name'], input[name*='fullname' i]"),
    payload.fullName,
  );
  await fillIfPresent(page.locator("input[type='email'], input[name*='email' i]"), payload.email);
  await fillIfPresent(page.locator("input[type='tel'], input[name*='phone' i]"), payload.phone);
  await fillIfPresent(page.locator("input[name*='location' i], input[id*='location' i]"), payload.location);
  await fillIfPresent(page.locator("input[name*='linkedin' i], input[id*='linkedin' i]"), payload.linkedinUrl);
  await fillIfPresent(page.locator("input[name*='website' i], input[name*='portfolio' i]"), payload.websiteUrl);

  if (coverLetter) {
    await fillIfPresent(
      page.locator("textarea[name*='cover' i], textarea[id*='cover' i], textarea[name*='comments' i], textarea"),
      coverLetter,
    );
  }

  const attached = await attachCv(page, cvPath);
  if (!attached && cvPath) {
    return { outcome: "manual_action_required", manualReason: "file_upload_failed", detail: "No CV upload field found" };
  }

  const unresolved = await resolveRemainingRequiredFields(ctx);
  if (unresolved) return unresolved;

  const postFillBlocker = await detectBlockers(page);
  if (postFillBlocker) {
    return {
      outcome: "manual_action_required",
      manualReason: postFillBlocker.reason,
      detail: postFillBlocker.detail,
    };
  }

  const submitted = await clickSubmit(page);
  if (!submitted) {
    return { outcome: "manual_action_required", manualReason: "unsupported_form", detail: "No submit control found" };
  }

  const proof = await verifySubmission(page);
  if (!proof) {
    return {
      outcome: "manual_action_required",
      manualReason: "unsupported_form",
      detail: "No confirmation state observed after submit — treating as unverified",
    };
  }
  return { outcome: "submitted", proof };
}

async function openApplyForm(page: Page): Promise<void> {
  if ((await page.locator("input[type='file']").count()) > 0) return;
  for (const selector of APPLY_TRIGGERS) {
    const trigger = page.locator(selector).first();
    if ((await trigger.count()) > 0 && (await trigger.isVisible().catch(() => false))) {
      await trigger.click().catch(() => undefined);
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }
  }
}

async function clickSubmit(page: Page): Promise<boolean> {
  for (const selector of SUBMIT_BUTTONS) {
    const button = page.locator(selector).first();
    if ((await button.count()) > 0 && (await button.isVisible().catch(() => false))) {
      await button.click();
      return true;
    }
  }
  return false;
}

function splitName(payload: { fullName?: string; firstName?: string; lastName?: string }): [string?, string?] {
  if (payload.firstName || payload.lastName) return [payload.firstName, payload.lastName];
  const parts = (payload.fullName ?? "").trim().split(/\s+/);
  if (parts.length < 2) return [payload.fullName, undefined];
  return [parts[0], parts.slice(1).join(" ")];
}
