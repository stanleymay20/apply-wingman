// Safety guards. Every one of these hands control back to the human instead of
// guessing. Nothing here attempts to defeat a CAPTCHA or an anti-bot control.
import type { Page } from "playwright";
import type { ManualReason } from "./types.js";

const CAPTCHA_SELECTORS = [
  "iframe[src*='recaptcha']",
  "iframe[src*='hcaptcha']",
  "iframe[title*='challenge' i]",
  "div.g-recaptcha",
  "div#cf-challenge-running",
  "[data-sitekey]",
  "iframe[src*='turnstile']",
  "iframe[src*='arkoselabs']",
  "#px-captcha",
];

const LOGIN_SELECTORS = [
  "input[type='password']",
  "form[action*='login' i]",
  "a[href*='/login' i][class*='btn' i]",
];

const ANTI_BOT_TEXT = [
  "verify you are human",
  "are you a robot",
  "access denied",
  "unusual traffic",
  "enable javascript and cookies to continue",
  "request blocked",
];

/** Question types that always require a real human decision. */
const JUDGEMENT_PATTERNS: Array<{ re: RegExp; reason: ManualReason }> = [
  { re: /salary|compensation|rate expectation|expected pay|desired pay/i, reason: "salary_expectation_question" },
  { re: /sponsor|visa|work authoriz|work authoris|right to work|security clearance/i, reason: "uncertain_screening_question" },
  { re: /gender|race|ethnic|veteran|disabilit|eeo|equal opportunit/i, reason: "consent_or_legal_attestation" },
  { re: /consent|privacy policy|terms|declaration|i certify|i agree|gdpr/i, reason: "consent_or_legal_attestation" },
];

export interface GuardHit {
  reason: ManualReason;
  detail: string;
}

export async function detectBlockers(page: Page): Promise<GuardHit | null> {
  for (const selector of CAPTCHA_SELECTORS) {
    if ((await page.locator(selector).count()) > 0) {
      return { reason: "captcha", detail: "CAPTCHA or bot challenge present — stopping" };
    }
  }

  const bodyText = ((await page.locator("body").innerText().catch(() => "")) || "").toLowerCase();
  for (const phrase of ANTI_BOT_TEXT) {
    if (bodyText.includes(phrase)) {
      return { reason: "captcha", detail: "Anti-bot interstitial detected — stopping" };
    }
  }

  if (/two-factor|verification code|one-time code|authenticator app/i.test(bodyText)) {
    return { reason: "mfa_required", detail: "Multi-factor prompt detected" };
  }

  for (const selector of LOGIN_SELECTORS) {
    if ((await page.locator(selector).count()) > 0) {
      return { reason: "login_required", detail: "Sign-in wall detected" };
    }
  }

  return null;
}

/**
 * Classifies a question that has no stored answer. Every unknown required
 * question is a stop condition — the worker never invents a value.
 */
export function classifyQuestion(label: string): ManualReason {
  for (const { re, reason } of JUDGEMENT_PATTERNS) {
    if (re.test(label)) return reason;
  }
  return "uncertain_screening_question";
}

/** True only when the user has explicitly consented to this declaration. */
export function hasExplicitConsent(
  label: string,
  answers: Array<{ questionKey: string; label?: string | null; consent?: boolean | null }>,
): boolean {
  const normalized = normalize(label);
  return answers.some(
    (a) =>
      a.consent === true &&
      (normalize(a.questionKey) === normalized ||
        (a.label ? normalize(a.label) === normalized : false) ||
        (a.label ? normalized.includes(normalize(a.label)) : false)),
  );
}

/** Returns a stored answer for a field label, or null when none exists. */
export function findStoredAnswer(
  label: string,
  answers: Array<{ questionKey: string; label?: string | null; answer?: string | null }>,
): string | null {
  const normalized = normalize(label);
  if (!normalized) return null;
  const hit = answers.find(
    (a) =>
      normalize(a.questionKey) === normalized ||
      (a.label ? normalize(a.label) === normalized : false) ||
      (a.label ? normalized.includes(normalize(a.label)) && normalize(a.label).length > 6 : false),
  );
  const value = hit?.answer?.trim();
  return value ? value : null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s*:?_-]+/g, " ").trim();
}
