export type AutomationStatus = "running" | "paused" | "stopped";

export type JobStatus = 
  | "discovered" 
  | "queued" 
  | "applied" 
  | "rejected" 
  | "interview" 
  | "offer" 
  | "withdrawn" 
  | "expired" 
  | "blacklisted";

export type ApplicationStatus =
  | "pending"
  | "queued"
  | "preparing"
  | "submitted"
  | "delivered"
  | "responded"
  | "failed"
  | "retrying"
  | "manual_action_required"
  | "interview"
  | "rejected"
  | "offer"
  | "withdrawn";

export type ApplicationMethod = 
  | "easy_apply" 
  | "form_submit" 
  | "email" 
  | "manual";

export type SourcePlatform = 
  | "linkedin" 
  | "indeed" 
  | "greenhouse" 
  | "lever" 
  | "company_website" 
  | "other";

export type NotificationType = 
  | "interview" 
  | "rejection" 
  | "offer" 
  | "error" 
  | "daily_summary" 
  | "system"
  | "jobs_discovered"
  | "high_match_job";

export type LogLevel = "info" | "warning" | "error" | "success";

export type SeniorityLevel = 
  | "junior" 
  | "mid" 
  | "senior" 
  | "lead" 
  | "principal" 
  | "executive";

export type ThemePreference = "navy" | "emerald" | "purple" | "sunset" | "midnight" | "ocean";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  visa_required: boolean;
  preferred_locations: string[];
  preferred_roles: string[];
  daily_application_cap: number;
  minimum_fit_score: number;
  notifications_enabled: boolean;
  email_notifications: boolean;
  manual_approval_mode: boolean;
  automation_status: AutomationStatus;
  theme_preference: ThemePreference;
  saved_search_frequency: string;
  bulk_apply_mode: string;
  job_details_view: string;
  delivery_mode: 'test' | 'production' | 'disabled';
  test_email_override: string | null;
  company_cooldown_days: number;
  max_apps_per_company: number;
  created_at: string;
  updated_at: string;
}

export interface Education {
  degree: string;
  field: string;
  institution: string;
  year: number | null;
}

export interface WorkHistory {
  title: string;
  company: string;
  duration: string;
  start_year: number | null;
  end_year: number | null;
  highlights: string[];
}

export interface CVProfile {
  id: string;
  user_id: string;
  cv_file_url: string | null;
  cv_file_name: string | null;
  parsed_data: Record<string, unknown>;
  skills: string[];
  experience_years: number;
  seniority_level: SeniorityLevel | null;
  languages: string[];
  education: Education[];
  work_history: WorkHistory[];
  summary: string | null;
  keywords: string[];
  last_parsed_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchBreakdown {
  skills_match: number;
  experience_match: number;
  seniority_match: number;
  location_match: number;
  language_match: number;
}

export interface MatchDetails {
  score: number;
  confidence: "high" | "medium" | "low";
  breakdown: MatchBreakdown;
  matching_skills: string[];
  missing_skills: string[];
  strengths: string[];
  concerns: string[];
  recommendation: "strong_apply" | "apply" | "consider" | "skip";
  summary: string;
}

export interface Job {
  id: string;
  user_id: string;
  title: string;
  company: string;
  company_logo_url: string | null;
  location: string | null;
  job_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  description: string | null;
  requirements: string[] | null;
  benefits: string[] | null;
  source_platform: SourcePlatform;
  source_url: string;
  external_id: string | null;
  posted_at: string | null;
  expires_at: string | null;
  is_remote: boolean;
  visa_sponsorship: boolean;
  match_score: number | null;
  match_details: MatchDetails | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  cv_profile_id: string | null;
  status: ApplicationStatus;
  application_method: ApplicationMethod | null;
  cover_letter: string | null;
  custom_responses: Record<string, unknown>;
  match_score: number;
  applied_at: string | null;
  response_received_at: string | null;
  notes: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  job?: Job;
}

export interface ApplicationLog {
  id: string;
  user_id: string;
  application_id: string | null;
  job_id: string | null;
  action: string;
  level: LogLevel;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DailyStats {
  id: string;
  user_id: string;
  date: string;
  applications_sent: number;
  applications_successful: number;
  applications_failed: number;
  interviews_received: number;
  rejections_received: number;
  jobs_discovered: number;
  jobs_matched: number;
  average_match_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformBlacklist {
  id: string;
  user_id: string;
  domain: string;
  reason: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  todayApplications: number;
  dailyCap: number;
  totalApplications: number;
  interviews: number;
  responseRate: number;
  averageMatchScore: number;
}
