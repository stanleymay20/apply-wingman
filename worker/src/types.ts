export interface QueueItem {
  id: string;
  user_id: string;
  application_id: string;
  job_id: string;
  target_url: string;
  platform: string | null;
  ats_type: string | null;
  tailored_cv_url: string | null;
  cover_letter: string | null;
  candidate_payload: CandidatePayload;
  attempts: number;
  max_attempts: number;
  correlation_id: string | null;
}

export interface StoredAnswer {
  /** Stable key, e.g. "work_authorisation_eu" or "consent_privacy_policy". */
  questionKey: string;
  label?: string | null;
  answer?: string | null;
  /** Explicit user consent for legal/privacy/EEO declarations. */
  consent?: boolean | null;
}

export interface CandidatePayload {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  jobTitle?: string;
  company?: string;
  /** Only answers the user explicitly stored. Never generated. */
  answers?: StoredAnswer[];
}

export type ManualReason =
  | "captcha"
  | "mfa_required"
  | "login_required"
  | "session_expired"
  | "consent_or_legal_attestation"
  | "salary_expectation_question"
  | "uncertain_screening_question"
  | "unsupported_form"
  | "file_upload_failed"
  | "other";

export interface SubmissionProof {
  confirmationText?: string;
  confirmationUrl?: string;
  externalApplicationId?: string;
  screenshotUrl?: string;
}

export type AttemptResult =
  | { outcome: "submitted"; proof: SubmissionProof }
  | { outcome: "manual_action_required"; manualReason: ManualReason; detail?: string }
  | { outcome: "failed"; error: string };
