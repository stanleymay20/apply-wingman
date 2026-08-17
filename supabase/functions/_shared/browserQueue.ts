// Shared contract for the external browser (Playwright) worker.
//
// Form-based ATS applications (Greenhouse, Lever, Workday, SmartRecruiters,
// Ashby, LinkedIn, generic company forms) cannot be completed from inside a
// Supabase Edge Function — they need a real browser session. Those
// applications are enqueued here and are only ever reported as *queued*
// until the worker sends back proof of submission.

export const BROWSER_ATS_PATTERNS: Array<{ match: string; ats: string }> = [
  { match: "greenhouse.io", ats: "greenhouse" },
  { match: "boards.greenhouse", ats: "greenhouse" },
  { match: "job-boards.greenhouse", ats: "greenhouse" },
  { match: "lever.co", ats: "lever" },
  { match: "myworkdayjobs.com", ats: "workday" },
  { match: "workday.com", ats: "workday" },
  { match: "smartrecruiters.com", ats: "smartrecruiters" },
  { match: "ashbyhq.com", ats: "ashby" },
  { match: "jobvite.com", ats: "jobvite" },
  { match: "icims.com", ats: "icims" },
  { match: "successfactors", ats: "successfactors" },
  { match: "taleo.net", ats: "taleo" },
  { match: "bamboohr.com", ats: "bamboohr" },
  { match: "recruitee.com", ats: "recruitee" },
  { match: "personio.de", ats: "personio" },
  { match: "workable.com", ats: "workable" },
  { match: "linkedin.com", ats: "linkedin" },
];

export function detectAtsType(sourceUrl: string): string | null {
  const url = (sourceUrl || "").toLowerCase();
  for (const { match, ats } of BROWSER_ATS_PATTERNS) {
    if (url.includes(match)) return ats;
  }
  return null;
}

/** Reasons a browser worker MUST hand control back to the human. */
export const MANUAL_ACTION_REASONS = [
  "captcha",
  "mfa_required",
  "login_required",
  "session_expired",
  "consent_or_legal_attestation",
  "salary_expectation_question",
  "uncertain_screening_question",
  "unsupported_form",
  "file_upload_failed",
  "other",
] as const;

export type ManualActionReason = (typeof MANUAL_ACTION_REASONS)[number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UNUSABLE_LOCAL_PARTS = ["noreply", "no-reply", "donotreply", "postmaster", "abuse"];

/** A recipient is only usable when it is a real, non-automated mailbox. */
export function isUsableRecruiterEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const value = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(value)) return false;
  if (UNUSABLE_LOCAL_PARTS.some((p) => value.startsWith(p))) return false;
  if (value.endsWith("example.com")) return false;
  return true;
}

export interface EnqueueBrowserApplicationParams {
  userId: string;
  applicationId: string;
  jobId: string;
  targetUrl: string;
  platform?: string | null;
  tailoredCvUrl?: string | null;
  coverLetter?: string | null;
  candidatePayload?: Record<string, unknown>;
  runId?: string | null;
  correlationId?: string | null;
  priority?: number;
}

/**
 * Idempotently enqueues a form application for the browser worker.
 * One row per application (unique constraint on application_id).
 */
export async function enqueueBrowserApplication(
  supabase: any,
  params: EnqueueBrowserApplicationParams,
): Promise<{ queued: boolean; error?: string; atsType: string | null }> {
  const atsType = detectAtsType(params.targetUrl);

  const { error } = await supabase
    .from("browser_application_queue")
    .upsert(
      {
        user_id: params.userId,
        application_id: params.applicationId,
        job_id: params.jobId,
        target_url: params.targetUrl,
        platform: params.platform ?? null,
        ats_type: atsType,
        tailored_cv_url: params.tailoredCvUrl ?? null,
        cover_letter: params.coverLetter ?? null,
        candidate_payload: params.candidatePayload ?? {},
        run_id: params.runId ?? null,
        correlation_id: params.correlationId ?? null,
        priority: params.priority ?? 0,
      },
      { onConflict: "application_id", ignoreDuplicates: true },
    );

  if (error) return { queued: false, error: error.message, atsType };
  return { queued: true, atsType };
}
