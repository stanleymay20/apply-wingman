import { z } from "zod";

// Common validation schemas
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Invalid email address")
  .max(255, "Email must be less than 255 characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be less than 100 characters");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters");

export const urlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .url("Invalid URL format")
  .max(2000, "URL must be less than 2000 characters");

export const domainSchema = z
  .string()
  .trim()
  .min(1, "Domain is required")
  .max(255, "Domain must be less than 255 characters")
  .regex(
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/,
    "Invalid domain format"
  );

// Job validation
export const jobSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Job title is required")
    .max(200, "Job title must be less than 200 characters"),
  company: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name must be less than 200 characters"),
  source_url: urlSchema,
  source_platform: z.enum([
    "linkedin",
    "indeed",
    "greenhouse",
    "lever",
    "company_website",
    "other",
  ]),
});

// Profile settings validation
export const profileSettingsSchema = z.object({
  full_name: nameSchema.optional().or(z.literal("")),
  daily_application_cap: z
    .number()
    .int()
    .min(10, "Minimum 10 applications per day")
    .max(100, "Maximum 100 applications per day"),
  minimum_fit_score: z
    .number()
    .int()
    .min(50, "Minimum fit score is 50%")
    .max(95, "Maximum fit score is 95%"),
  notifications_enabled: z.boolean(),
  email_notifications: z.boolean(),
  manual_approval_mode: z.boolean(),
});

// CV text validation
export const cvTextSchema = z
  .string()
  .trim()
  .min(100, "CV text must be at least 100 characters")
  .max(50000, "CV text must be less than 50,000 characters");

// Skill validation
export const skillSchema = z
  .string()
  .trim()
  .min(1, "Skill cannot be empty")
  .max(50, "Skill must be less than 50 characters")
  .regex(/^[a-zA-Z0-9\s\-\+\#\.]+$/, "Invalid characters in skill name");

// Location validation
export const locationSchema = z
  .string()
  .trim()
  .min(1, "Location cannot be empty")
  .max(100, "Location must be less than 100 characters");

// Role validation
export const roleSchema = z
  .string()
  .trim()
  .min(1, "Role cannot be empty")
  .max(100, "Role must be less than 100 characters");

// Helper function to safely validate
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || "Validation failed" };
}
