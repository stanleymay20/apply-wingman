import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_TASKS = Math.max(1, Math.min(Number(process.env.MAX_TASKS || 5), 20));
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const NAV_TIMEOUT_MS = 45_000;
const SUBMIT_TIMEOUT_MS = 20_000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ATS worker is not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const workerId = `gha:${process.env.GITHUB_RUN_ID || crypto.randomUUID()}`;

class ManualActionRequired extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ManualActionRequired";
    this.code = code;
  }
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted-secret]")
    .slice(0, 800);
}

function splitName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function fetchCandidate(task) {
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id,user_id,job_id,cv_profile_id,cover_letter,tailored_cv_pdf_url,custom_responses,status")
    .eq("id", task.application_id)
    .single();
  if (appError || !app) throw new Error(`application_lookup_failed:${appError?.message || "missing"}`);

  const [{ data: job, error: jobError }, { data: profile, error: profileError }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,title,company,source_url,source_platform")
      .eq("id", app.job_id)
      .single(),
    supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("id", app.user_id)
      .single(),
  ]);

  if (jobError || !job) throw new Error(`job_lookup_failed:${jobError?.message || "missing"}`);
  if (profileError || !profile) throw new Error(`profile_lookup_failed:${profileError?.message || "missing"}`);

  let cvProfile = null;
  if (app.cv_profile_id) {
    const { data } = await supabase
      .from("cv_profiles")
      .select("id,cv_file_url")
      .eq("id", app.cv_profile_id)
      .maybeSingle();
    cvProfile = data || null;
  }

  return {
    app,
    job,
    profile,
    resumeUrl: app.tailored_cv_pdf_url || cvProfile?.cv_file_url || null,
  };
}

async function downloadResume(url) {
  if (!url) return null;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new ManualActionRequired("resume_unavailable", "Tailored CV could not be downloaded for browser submission.");
  const contentType = response.headers.get("content-type") || "application/pdf";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new ManualActionRequired("resume_empty", "Tailored CV file was empty.");
  return {
    name: contentType.includes("word") ? "resume.docx" : "resume.pdf",
    mimeType: contentType.split(";")[0],
    buffer,
  };
}

async function fillFirst(page, selectors, value) {
  if (!value) return false;
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;
    if (!(await locator.isVisible().catch(() => false))) continue;
    await locator.fill(String(value));
    return true;
  }
  return false;
}

async function attachResume(page, file) {
  if (!file) return false;
  const preferred = [
    'input[type="file"][name*="resume" i]',
    'input[type="file"][id*="resume" i]',
    'input[type="file"][aria-label*="resume" i]',
    'input[type="file"]',
  ];
  for (const selector of preferred) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;
    await locator.setInputFiles(file);
    return true;
  }
  return false;
}

async function hasCaptcha(page) {
  const selector = [
    'iframe[src*="recaptcha" i]',
    'iframe[src*="hcaptcha" i]',
    'iframe[src*="turnstile" i]',
    '[class*="captcha" i]',
    '[id*="captcha" i]',
  ].join(",");
  return (await page.locator(selector).count()) > 0;
}

async function unresolvedRequiredFields(page) {
  return page.locator('input[required]:visible, select[required]:visible, textarea[required]:visible, [aria-required="true"]:visible')
    .evaluateAll((elements) => elements.flatMap((el) => {
      const input = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ (el);
      const type = (input.getAttribute("type") || "").toLowerCase();
      if (["hidden", "submit", "button", "reset"].includes(type)) return [];
      if (type === "file") return input.files?.length ? [] : [{ type, name: input.getAttribute("name") || "file" }];
      if (type === "checkbox" || type === "radio") return input.checked ? [] : [{ type, name: input.getAttribute("name") || "choice" }];
      return String(input.value || "").trim() ? [] : [{ type: input.tagName.toLowerCase(), name: input.getAttribute("name") || input.getAttribute("id") || "field" }];
    }));
}

async function prepareCommonFields(page, candidate, resumeFile) {
  const { firstName, lastName } = splitName(candidate.profile.full_name);

  await fillFirst(page, ['input[name="first_name"]', '#first_name', 'input[autocomplete="given-name"]'], firstName);
  await fillFirst(page, ['input[name="last_name"]', '#last_name', 'input[autocomplete="family-name"]'], lastName);
  await fillFirst(page, ['input[name="name"]', '#name', 'input[autocomplete="name"]'], candidate.profile.full_name);
  await fillFirst(page, ['input[name="email"]', '#email', 'input[type="email"]', 'input[autocomplete="email"]'], candidate.profile.email);

  if (candidate.app.cover_letter) {
    await fillFirst(page, [
      'textarea[name*="cover_letter" i]',
      'textarea[id*="cover_letter" i]',
      'textarea[aria-label*="cover letter" i]',
    ], candidate.app.cover_letter);
  }

  await attachResume(page, resumeFile);
}

async function openLeverApplyPage(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  if (/\/apply(?:[/?#]|$)/i.test(page.url())) return;

  const applyLink = page.locator('a[href*="/apply"], a:has-text("Apply for this job"), a:has-text("Apply")').first();
  if ((await applyLink.count()) > 0 && (await applyLink.isVisible().catch(() => false))) {
    await Promise.all([
      page.waitForLoadState("domcontentloaded").catch(() => {}),
      applyLink.click(),
    ]);
    return;
  }

  const normalized = sourceUrl.replace(/[?#].*$/, "").replace(/\/$/, "");
  await page.goto(`${normalized}/apply`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
}

async function submitGreenhouse(page, candidate, resumeFile) {
  await page.goto(candidate.job.source_url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  if (await hasCaptcha(page)) throw new ManualActionRequired("captcha", "Greenhouse presented a CAPTCHA or anti-bot challenge.");

  await prepareCommonFields(page, candidate, resumeFile);

  const blockers = await unresolvedRequiredFields(page);
  if (blockers.length) {
    throw new ManualActionRequired("required_questions", `Greenhouse has ${blockers.length} required field(s) needing the applicant.`);
  }

  const submit = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit Application")').first();
  if ((await submit.count()) === 0 || !(await submit.isVisible().catch(() => false))) {
    throw new ManualActionRequired("submit_control_missing", "Greenhouse submit control was not found.");
  }

  await submit.click();
  return verifySubmission(page);
}

async function submitLever(page, candidate, resumeFile) {
  await openLeverApplyPage(page, candidate.job.source_url);
  if (await hasCaptcha(page)) throw new ManualActionRequired("captcha", "Lever presented a CAPTCHA or anti-bot challenge.");

  await prepareCommonFields(page, candidate, resumeFile);

  const blockers = await unresolvedRequiredFields(page);
  if (blockers.length) {
    throw new ManualActionRequired("required_questions", `Lever has ${blockers.length} required field(s) needing the applicant.`);
  }

  const submit = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit application"), button:has-text("Submit Application")').first();
  if ((await submit.count()) === 0 || !(await submit.isVisible().catch(() => false))) {
    throw new ManualActionRequired("submit_control_missing", "Lever submit control was not found.");
  }

  await submit.click();
  return verifySubmission(page);
}

async function verifySubmission(page) {
  const successText = /thank(s| you)|application (has been|was)?\s*submitted|application received|thanks for applying/i;
  const successUrl = /(thank|confirmation|submitted|success)/i;

  const deadline = Date.now() + SUBMIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (successUrl.test(page.url())) return { verified: true, proof: "success_url", finalUrl: page.url() };
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (successText.test(bodyText)) return { verified: true, proof: "success_text", finalUrl: page.url() };
    if (await hasCaptcha(page)) throw new ManualActionRequired("captcha_after_submit", "A CAPTCHA appeared during submission.");
    await page.waitForTimeout(750);
  }

  throw new ManualActionRequired("submission_unverified", "The form was submitted but no reliable confirmation state could be verified.");
}

async function markDelivered(task, candidate, verification) {
  const verifiedAt = new Date().toISOString();
  const providerContext = {
    adapter: task.adapter,
    proof: verification.proof,
    final_url: verification.finalUrl,
    worker: "playwright",
  };

  const { error: appError } = await supabase
    .from("applications")
    .update({
      status: "delivered",
      applied_at: verifiedAt,
      delivery_provider: "playwright_browser_worker",
      delivery_verified_at: verifiedAt,
      provider_context: providerContext,
      error_code: null,
      error_message: null,
      next_retry_at: null,
    })
    .eq("id", task.application_id);
  if (appError) throw new Error(`application_delivery_update_failed:${appError.message}`);

  await supabase.from("application_logs").insert({
    user_id: candidate.app.user_id,
    application_id: task.application_id,
    job_id: candidate.app.job_id,
    action: "lifecycle_browser_delivered",
    level: "info",
    message: "Browser worker verified ATS application submission.",
    details: providerContext,
  });

  const { error: taskError } = await supabase
    .from("browser_application_tasks")
    .update({
      status: "succeeded",
      lease_expires_at: null,
      last_error: null,
      result: { verified_at: verifiedAt, proof: verification.proof, final_url: verification.finalUrl },
      updated_at: verifiedAt,
    })
    .eq("id", task.id);
  if (taskError) throw new Error(`task_success_update_failed:${taskError.message}`);
}

async function markManual(task, candidate, error) {
  const message = safeError(error);
  const code = error instanceof ManualActionRequired ? error.code : "browser_manual_handoff";
  const now = new Date().toISOString();

  await supabase
    .from("browser_application_tasks")
    .update({
      status: "manual_action_required",
      lease_expires_at: null,
      last_error: message,
      result: { code },
      updated_at: now,
    })
    .eq("id", task.id);

  await supabase
    .from("applications")
    .update({
      status: "manual_action_required",
      error_code: code,
      error_message: message,
      provider_context: { adapter: task.adapter, worker: "playwright", reason: code },
      next_retry_at: null,
    })
    .eq("id", task.application_id);

  if (candidate) {
    await supabase.from("application_logs").insert({
      user_id: candidate.app.user_id,
      application_id: task.application_id,
      job_id: candidate.app.job_id,
      action: "lifecycle_browser_manual_required",
      level: "warning",
      message: "Browser worker stopped safely; applicant action is required.",
      details: { adapter: task.adapter, reason: code },
    });
  }
}

async function retryOrHandoff(task, candidate, error) {
  const message = safeError(error);
  const exhausted = Number(task.attempts || 0) >= Number(task.max_attempts || 3);
  const now = new Date().toISOString();

  if (exhausted) {
    await markManual(task, candidate, new ManualActionRequired("browser_retries_exhausted", message));
    return "manual_action_required";
  }

  await supabase
    .from("browser_application_tasks")
    .update({
      status: "pending",
      lease_expires_at: null,
      last_error: message,
      updated_at: now,
    })
    .eq("id", task.id);

  if (candidate) {
    await supabase.from("application_logs").insert({
      user_id: candidate.app.user_id,
      application_id: task.application_id,
      job_id: candidate.app.job_id,
      action: "browser_worker_retry_scheduled",
      level: "warning",
      message: "Browser worker hit a transient error; task returned to the queue.",
      details: { adapter: task.adapter, attempt: task.attempts, max_attempts: task.max_attempts },
    });
  }

  return "retrying";
}

async function processTask(task, browser) {
  let candidate = null;
  try {
    candidate = await fetchCandidate(task);
    const resumeFile = await downloadResume(candidate.resumeUrl);

    const context = await browser.newContext({
      locale: "en-GB",
      viewport: { width: 1365, height: 900 },
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36 ApplyWingman/1.0",
    });
    const page = await context.newPage();

    try {
      let verification;
      if (task.adapter === "greenhouse") {
        verification = await submitGreenhouse(page, candidate, resumeFile);
      } else if (task.adapter === "lever") {
        verification = await submitLever(page, candidate, resumeFile);
      } else {
        throw new ManualActionRequired("unsupported_adapter", "No browser adapter exists for this ATS.");
      }

      await markDelivered(task, candidate, verification);
      return "delivered";
    } finally {
      await context.close();
    }
  } catch (error) {
    if (error instanceof ManualActionRequired) {
      await markManual(task, candidate, error);
      return "manual_action_required";
    }
    return retryOrHandoff(task, candidate, error);
  }
}

async function claimTask() {
  const { data, error } = await supabase.rpc("claim_browser_application_task", {
    p_worker_id: workerId,
    p_lease_minutes: 10,
  });
  if (error) throw new Error(`claim_failed:${error.message}`);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  let processed = 0;
  let delivered = 0;
  let manual = 0;
  let retrying = 0;

  try {
    while (processed < MAX_TASKS) {
      const task = await claimTask();
      if (!task) break;

      const outcome = await processTask(task, browser);
      processed += 1;
      if (outcome === "delivered") delivered += 1;
      else if (outcome === "manual_action_required") manual += 1;
      else retrying += 1;

      // Intentionally log only opaque task IDs and outcome; no candidate PII.
      console.log(JSON.stringify({ task_id: task.id, adapter: task.adapter, outcome }));
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ processed, delivered, manual_action_required: manual, retrying }));
}

main().catch((error) => {
  console.error(`ATS worker fatal error: ${safeError(error)}`);
  process.exit(1);
});
