// Shared form-filling primitives used by every ATS adapter.
import type { Locator, Page } from "playwright";
import { classifyQuestion, findStoredAnswer, hasExplicitConsent } from "../guards.js";
import type { AttemptResult, CandidatePayload, StoredAnswer, SubmissionProof } from "../types.js";

export const SUCCESS_PATTERNS = [
  /thank you for applying/i,
  /application (has been )?(received|submitted|sent)/i,
  /we(?:'| ha)ve received your application/i,
  /your application was submitted/i,
  /application complete/i,
];

export interface FillContext {
  page: Page;
  payload: CandidatePayload;
  answers: StoredAnswer[];
  cvPath: string | null;
  coverLetter: string | null;
}

/** Fills a text-like input if we have a real value for it. */
export async function fillIfPresent(locator: Locator, value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  if ((await locator.count()) === 0) return false;
  const field = locator.first();
  if (!(await field.isVisible().catch(() => false))) return false;
  await field.fill(value);
  return true;
}

export async function attachCv(page: Page, cvPath: string | null): Promise<boolean> {
  if (!cvPath) return false;
  const input = page.locator("input[type='file']").first();
  if ((await input.count()) === 0) return false;
  await input.setInputFiles(cvPath);
  return true;
}

/**
 * Walks every required field left unfilled. Returns a manual-action result as
 * soon as one cannot be answered from stored data — never a fabricated value.
 */
export async function resolveRemainingRequiredFields(ctx: FillContext): Promise<AttemptResult | null> {
  const { page, answers } = ctx;
  const required = page.locator(
    "input[required]:not([type=hidden]):not([type=file]), select[required], textarea[required], [aria-required='true']",
  );
  const count = Math.min(await required.count(), 60);

  for (let i = 0; i < count; i++) {
    const field = required.nth(i);
    if (!(await field.isVisible().catch(() => false))) continue;

    const type = (await field.getAttribute("type")) ?? "";
    const label = await labelFor(field, page);

    if (type === "checkbox" || type === "radio") {
      if ((await field.isChecked().catch(() => false))) continue;
      // Legal / privacy / EEO / consent boxes: only with explicit stored consent.
      if (!hasExplicitConsent(label, answers)) {
        return {
          outcome: "manual_action_required",
          manualReason: classifyQuestion(label),
          detail: `Declaration needs your explicit consent: "${label.slice(0, 120)}"`,
        };
      }
      await field.check();
      continue;
    }

    const current = (await field.inputValue().catch(() => "")) ?? "";
    if (current.trim()) continue;

    const stored = findStoredAnswer(label, answers);
    if (!stored) {
      return {
        outcome: "manual_action_required",
        manualReason: classifyQuestion(label),
        detail: `No stored answer for required question: "${label.slice(0, 120)}"`,
      };
    }
    await field.fill(stored).catch(() => undefined);
  }

  return null;
}

export async function labelFor(field: Locator, page: Page): Promise<string> {
  const aria = await field.getAttribute("aria-label");
  if (aria?.trim()) return aria.trim();

  const id = await field.getAttribute("id");
  if (id) {
    const label = page.locator(`label[for="${cssEscape(id)}"]`);
    if ((await label.count()) > 0) {
      const text = (await label.first().innerText().catch(() => "")) ?? "";
      if (text.trim()) return text.trim();
    }
  }

  const wrapped = await field
    .locator("xpath=ancestor::label[1]")
    .innerText()
    .catch(() => "");
  if (wrapped?.trim()) return wrapped.trim();

  return (await field.getAttribute("name")) ?? (await field.getAttribute("placeholder")) ?? "";
}

function cssEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}

/** Only a real success state counts as a submission. */
export async function verifySubmission(page: Page): Promise<SubmissionProof | null> {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  const body = ((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 8000);

  for (const pattern of SUCCESS_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      return { confirmationText: match[0].slice(0, 200), confirmationUrl: page.url() };
    }
  }

  if (/\/(confirmation|thank[-_]?you|application[-_]?submitted)\b/i.test(page.url())) {
    return { confirmationUrl: page.url() };
  }

  return null;
}
