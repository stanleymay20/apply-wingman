/**
 * Application Method Detection & Prioritization
 * 
 * Priority Order:
 * 1. ATS forms (Greenhouse, Lever, Workday) - Confirmation expected
 * 2. LinkedIn Easy Apply - Confirmation expected  
 * 3. Company career page forms - Confirmation expected
 * 4. Email-only applications - Confirmation NOT expected (last resort)
 */

export type ApplicationMethodType = 
  | "ats_greenhouse"
  | "ats_lever" 
  | "ats_workday"
  | "ats_smartrecruiters"
  | "linkedin_easy_apply"
  | "company_form"
  | "email"
  | "assisted";

export interface DetectedMethod {
  type: ApplicationMethodType;
  priority: number;
  label: string;
  description: string;
  confirmationExpected: boolean;
  requiresEmail: boolean;
  canAutoSubmit: boolean;
}

const METHOD_DEFINITIONS: Record<ApplicationMethodType, Omit<DetectedMethod, "type">> = {
  ats_greenhouse: {
    priority: 1,
    label: "Greenhouse ATS",
    description: "Apply via Greenhouse form - confirmation email expected",
    confirmationExpected: true,
    requiresEmail: false,
    canAutoSubmit: true,
  },
  ats_lever: {
    priority: 1,
    label: "Lever ATS",
    description: "Apply via Lever form - confirmation email expected",
    confirmationExpected: true,
    requiresEmail: false,
    canAutoSubmit: true,
  },
  ats_workday: {
    priority: 2,
    label: "Workday ATS",
    description: "Apply via Workday - confirmation email expected",
    confirmationExpected: true,
    requiresEmail: false,
    canAutoSubmit: false,
  },
  ats_smartrecruiters: {
    priority: 2,
    label: "SmartRecruiters",
    description: "Apply via SmartRecruiters - confirmation email expected",
    confirmationExpected: true,
    requiresEmail: false,
    canAutoSubmit: false,
  },
  linkedin_easy_apply: {
    priority: 3,
    label: "LinkedIn Easy Apply",
    description: "Quick apply via LinkedIn - confirmation expected",
    confirmationExpected: true,
    requiresEmail: false,
    canAutoSubmit: false,
  },
  company_form: {
    priority: 4,
    label: "Company Application",
    description: "Apply on company website - confirmation may vary",
    confirmationExpected: true,
    requiresEmail: false,
    canAutoSubmit: false,
  },
  email: {
    priority: 5,
    label: "Email Application",
    description: "Send application via email - confirmation NOT expected",
    confirmationExpected: false,
    requiresEmail: true,
    canAutoSubmit: true,
  },
  assisted: {
    priority: 6,
    label: "Assisted Apply",
    description: "Manual application with copied data",
    confirmationExpected: false,
    requiresEmail: false,
    canAutoSubmit: false,
  },
};

/**
 * Detect the best application method based on job URL and platform
 */
export function detectApplicationMethod(
  sourceUrl: string,
  sourcePlatform: string,
  jobDescription?: string | null
): DetectedMethod {
  const url = sourceUrl.toLowerCase();
  const platform = sourcePlatform.toLowerCase();
  const description = (jobDescription || "").toLowerCase();

  // Priority 1: Greenhouse ATS
  if (url.includes("greenhouse.io") || url.includes("boards.greenhouse")) {
    return { type: "ats_greenhouse", ...METHOD_DEFINITIONS.ats_greenhouse };
  }

  // Priority 1: Lever ATS
  if (url.includes("lever.co") || url.includes("jobs.lever.co")) {
    return { type: "ats_lever", ...METHOD_DEFINITIONS.ats_lever };
  }

  // Priority 2: Workday
  if (url.includes("workday.com") || url.includes("myworkdayjobs.com")) {
    return { type: "ats_workday", ...METHOD_DEFINITIONS.ats_workday };
  }

  // Priority 2: SmartRecruiters
  if (url.includes("smartrecruiters.com") || url.includes("jobs.smartrecruiters.com")) {
    return { type: "ats_smartrecruiters", ...METHOD_DEFINITIONS.ats_smartrecruiters };
  }

  // Priority 3: LinkedIn Easy Apply
  if (platform === "linkedin" || url.includes("linkedin.com")) {
    // Check if it's an Easy Apply job
    if (url.includes("easy-apply") || url.includes("applyWithLinkedIn")) {
      return { type: "linkedin_easy_apply", ...METHOD_DEFINITIONS.linkedin_easy_apply };
    }
    // LinkedIn jobs that redirect to company sites
    return { type: "company_form", ...METHOD_DEFINITIONS.company_form };
  }

  // Priority 4: Company career pages with forms
  if (
    platform === "company_website" ||
    url.includes("/careers") ||
    url.includes("/jobs") ||
    url.includes("apply")
  ) {
    return { type: "company_form", ...METHOD_DEFINITIONS.company_form };
  }

  // Priority 4: Indeed jobs (usually have forms)
  if (platform === "indeed" || url.includes("indeed.com")) {
    return { type: "company_form", ...METHOD_DEFINITIONS.company_form };
  }

  // Check if job description explicitly requests email applications
  const emailRequestPattern = /send.*(resume|cv|application).*(email|to:|@)/i;
  const hasEmailRequest = emailRequestPattern.test(description);
  
  if (hasEmailRequest) {
    return { type: "email", ...METHOD_DEFINITIONS.email };
  }

  // Default to assisted apply for unknown sources
  return { type: "assisted", ...METHOD_DEFINITIONS.assisted };
}

/**
 * Check if email application should be used
 * Only use email if:
 * - No ATS or form is available
 * - Job explicitly requests email applications
 */
export function shouldUseEmail(
  sourceUrl: string,
  sourcePlatform: string,
  jobDescription?: string | null
): { shouldUse: boolean; reason: string } {
  const method = detectApplicationMethod(sourceUrl, sourcePlatform, jobDescription);
  
  if (method.type === "email") {
    const description = (jobDescription || "").toLowerCase();
    const emailRequestPattern = /send.*(resume|cv|application).*(email|to:|@)/i;
    
    if (emailRequestPattern.test(description)) {
      return { 
        shouldUse: true, 
        reason: "Job posting explicitly requests email applications" 
      };
    }
    
    return { 
      shouldUse: false, 
      reason: "Email is last resort - try ATS or form first" 
    };
  }
  
  return { 
    shouldUse: false, 
    reason: `Preferred method available: ${method.label}` 
  };
}

/**
 * Get all available methods for a job, sorted by priority
 */
export function getAvailableMethods(
  sourceUrl: string,
  sourcePlatform: string,
  jobDescription?: string | null
): DetectedMethod[] {
  const primary = detectApplicationMethod(sourceUrl, sourcePlatform, jobDescription);
  const methods: DetectedMethod[] = [primary];
  
  // Always offer email as fallback (but low priority)
  if (primary.type !== "email") {
    methods.push({ type: "email", ...METHOD_DEFINITIONS.email });
  }
  
  // Always offer assisted as last resort
  if (primary.type !== "assisted") {
    methods.push({ type: "assisted", ...METHOD_DEFINITIONS.assisted });
  }
  
  return methods.sort((a, b) => a.priority - b.priority);
}

/**
 * Get human-readable confirmation status
 */
export function getConfirmationStatus(method: DetectedMethod): {
  label: string;
  variant: "success" | "warning" | "muted";
  icon: "check" | "clock" | "alert";
} {
  if (method.confirmationExpected) {
    return {
      label: "Confirmation expected",
      variant: "success",
      icon: "check",
    };
  }
  return {
    label: "Confirmation not expected",
    variant: "warning", 
    icon: "alert",
  };
}
