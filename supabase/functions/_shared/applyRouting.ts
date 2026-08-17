// Decides HOW an application is submitted.
//
// Hard rule: email is only ever chosen when a usable recruiter/application
// address has actually been discovered and stored for the job. Everything else
// — known ATS forms, company career pages without a mailbox — goes to the
// browser worker queue, which reports real submission proof.
import { detectAtsType, isUsableRecruiterEmail } from "./browserQueue.ts";

export type ApplyRoute =
  | { mode: "email"; recipientEmail: string; confidence: string | null }
  | { mode: "browser"; atsType: string | null; reason: string };

export async function resolveApplyRoute(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  params: { jobId: string; sourceUrl: string },
): Promise<ApplyRoute> {
  const atsType = detectAtsType(params.sourceUrl);
  if (atsType) {
    return { mode: "browser", atsType, reason: `form_based_ats:${atsType}` };
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("recruiter_email, recruiter_email_confidence")
    .eq("id", params.jobId)
    .maybeSingle();

  let email: string | null = job?.recruiter_email ?? null;
  let confidence: string | null = job?.recruiter_email_confidence ?? null;

  // Attempt extraction exactly once per job.
  if (!isUsableRecruiterEmail(email) && !confidence) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/extract-recruiter-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ jobId: params.jobId }),
      });
      if (res.ok) {
        const data = await res.json();
        email = data?.email ?? null;
        confidence = data?.confidence ?? null;
      }
    } catch (error) {
      console.warn("extract-recruiter-email failed:", String(error));
    }
  }

  if (isUsableRecruiterEmail(email)) {
    return { mode: "email", recipientEmail: email, confidence };
  }

  return { mode: "browser", atsType: null, reason: "no_usable_recruiter_email" };
}
