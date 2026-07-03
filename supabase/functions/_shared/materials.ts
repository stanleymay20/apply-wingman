/**
 * Shared application-materials generator for the automation pipeline.
 *
 * Produces, for one application:
 *   1. A job-tailored CV (AI-rewritten text, rendered to PDF with pdf-lib,
 *      uploaded to the private `cv-files` bucket, exposed via signed URL)
 *   2. A job-specific cover letter (used as the application email body)
 *
 * Results are persisted on the applications row (cover_letter, tailored_cv_*)
 * so retries and the rescue/drain workers reuse them instead of re-paying AI
 * calls. Every step is best-effort: a failure downgrades gracefully (generic
 * email body + original CV attachment) and NEVER blocks the apply itself.
 */
import { callAI, callAIJson } from "./aiClient.ts";
import {
  PDFDocument,
  PDFFont,
  StandardFonts,
  rgb,
} from "https://esm.sh/pdf-lib@1.17.1";

export interface MaterialsJob {
  id: string;
  title: string;
  company: string;
  description?: string | null;
  requirements?: string[] | string | null;
  location?: string | null;
}

export interface MaterialsCvProfile {
  id: string;
  summary?: string | null;
  skills?: string[] | null;
  cv_text?: string | null;
  cv_file_url?: string | null;
  experience_years?: number | null;
  seniority_level?: string | null;
  work_history?: Array<{
    title: string;
    company: string;
    duration?: string;
    responsibilities?: string[];
  }> | null;
}

export interface ApplicationMaterials {
  coverLetter: string | null;
  tailoredCvText: string | null;
  tailoredCvPdfUrl: string | null;
}

const CV_BUCKET = "cv-files";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches useFileUpload
// Regenerate materials only if older than this (signed URL expiry minus margin).
const REUSE_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
// auto-apply rejects cover letters > 10000 chars.
const COVER_LETTER_MAX_CHARS = 9500;

function tailoredPdfPath(userId: string, applicationId: string): string {
  return `${userId}/tailored/${applicationId}.pdf`;
}

/**
 * Generate (or reuse) the tailored CV + cover letter for an application.
 * Never throws — on total failure returns all-null materials so callers can
 * fall back to the original CV and the generic email body.
 */
export async function prepareApplicationMaterials(
  supabase: any,
  params: {
    userId: string;
    applicationId: string;
    userName: string;
    job: MaterialsJob;
    cvProfile: MaterialsCvProfile;
  },
): Promise<ApplicationMaterials> {
  const { userId, applicationId, userName, job, cvProfile } = params;
  const materials: ApplicationMaterials = {
    coverLetter: null,
    tailoredCvText: null,
    tailoredCvPdfUrl: null,
  };

  try {
    // ── Reuse previously generated materials when still fresh ──────────────
    const { data: existing } = await supabase
      .from("applications")
      .select("cover_letter, tailored_cv_text, tailored_cv_pdf_url, tailored_cv_generated_at")
      .eq("id", applicationId)
      .maybeSingle();

    const generatedAt = existing?.tailored_cv_generated_at
      ? new Date(existing.tailored_cv_generated_at).getTime()
      : 0;
    const fresh = generatedAt > 0 && Date.now() - generatedAt < REUSE_WINDOW_MS;

    if (existing?.cover_letter) materials.coverLetter = existing.cover_letter;
    if (existing?.tailored_cv_text) materials.tailoredCvText = existing.tailored_cv_text;
    if (fresh && existing?.tailored_cv_pdf_url) {
      materials.tailoredCvPdfUrl = existing.tailored_cv_pdf_url;
    }

    if (materials.coverLetter && materials.tailoredCvText && materials.tailoredCvPdfUrl) {
      return materials;
    }

    const updates: Record<string, unknown> = {};

    // ── 1. Tailored CV text ────────────────────────────────────────────────
    if (!materials.tailoredCvText) {
      try {
        const tailored = await generateTailoredCvText(userName, job, cvProfile);
        if (tailored?.tailored_cv_text) {
          materials.tailoredCvText = tailored.tailored_cv_text;
          updates.tailored_cv_text = tailored.tailored_cv_text;
          updates.tailored_cv_keywords = tailored.keywords_added ?? null;
          updates.tailored_cv_changes = tailored.key_changes ?? null;
        }
      } catch (e) {
        console.warn(`[materials] tailor CV failed for app ${applicationId}:`, e);
      }
    }

    // ── 2. Cover letter ────────────────────────────────────────────────────
    if (!materials.coverLetter) {
      try {
        const letter = await generateCoverLetter(userName, job, cvProfile);
        if (letter) {
          materials.coverLetter = letter.slice(0, COVER_LETTER_MAX_CHARS);
          updates.cover_letter = materials.coverLetter;
        }
      } catch (e) {
        console.warn(`[materials] cover letter failed for app ${applicationId}:`, e);
      }
    }

    // ── 3. Render + upload the tailored CV PDF ─────────────────────────────
    if (!materials.tailoredCvPdfUrl && materials.tailoredCvText) {
      try {
        const pdfBytes = await renderCvPdf(materials.tailoredCvText, {
          name: userName,
          jobTitle: job.title,
          company: job.company,
        });
        const path = tailoredPdfPath(userId, applicationId);
        const { error: uploadError } = await supabase.storage
          .from(CV_BUCKET)
          .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
        if (uploadError) throw uploadError;

        const { data: signed, error: signError } = await supabase.storage
          .from(CV_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (signError) throw signError;

        materials.tailoredCvPdfUrl = signed?.signedUrl ?? null;
        if (materials.tailoredCvPdfUrl) {
          updates.tailored_cv_pdf_url = materials.tailoredCvPdfUrl;
        }
      } catch (e) {
        console.warn(`[materials] PDF render/upload failed for app ${applicationId}:`, e);
      }
    }

    // ── Persist whatever succeeded ─────────────────────────────────────────
    if (Object.keys(updates).length > 0) {
      if (updates.tailored_cv_text || updates.tailored_cv_pdf_url) {
        updates.tailored_cv_generated_at = new Date().toISOString();
      }
      const { error: updateError } = await supabase
        .from("applications")
        .update(updates)
        .eq("id", applicationId);
      if (updateError) {
        console.warn(`[materials] persist failed for app ${applicationId}:`, updateError.message);
      }

      await supabase.from("application_logs").insert({
        user_id: userId,
        application_id: applicationId,
        job_id: job.id,
        action: "materials_generated",
        level: "info",
        message: `Prepared application materials for ${job.title} at ${job.company}` +
          ` (cover letter: ${materials.coverLetter ? "yes" : "no"},` +
          ` tailored CV: ${materials.tailoredCvText ? "yes" : "no"},` +
          ` PDF: ${materials.tailoredCvPdfUrl ? "yes" : "no"})`,
        details: {
          coverLetter: Boolean(materials.coverLetter),
          tailoredCvText: Boolean(materials.tailoredCvText),
          tailoredCvPdf: Boolean(materials.tailoredCvPdfUrl),
        },
      });
    }
  } catch (e) {
    console.error(`[materials] unexpected failure for app ${applicationId}:`, e);
  }

  return materials;
}

async function generateTailoredCvText(
  userName: string,
  job: MaterialsJob,
  cvProfile: MaterialsCvProfile,
): Promise<{ tailored_cv_text?: string; key_changes?: string[]; keywords_added?: string[] } | null> {
  const systemPrompt = `You are an expert resume writer. Tailor the candidate's resume to the specific job description to maximize ATS compatibility and relevance.

Rules:
- Rewrite the summary to directly address the role and company
- Reorder and rewrite work experience bullets to emphasize skills/achievements matching the job
- Use keywords from the job description naturally throughout
- Strengthen action verbs (replace weak verbs like "helped", "worked on" with strong ones like "drove", "architected", "delivered")
- Do NOT fabricate experience, companies, dates, or metrics
- Output the resume as plain text: candidate name on the first line, then sections with UPPERCASE headings (SUMMARY, SKILLS, EXPERIENCE, EDUCATION), bullets prefixed with "- "
- Return a JSON object:
  {
    "tailored_cv_text": "full tailored resume text",
    "key_changes": ["change 1", ...],
    "keywords_added": ["keyword1", ...]
  }`;

  const requirements = Array.isArray(job.requirements)
    ? job.requirements.join(", ")
    : job.requirements || "Not specified";

  const workHistory = (cvProfile.work_history || [])
    .map((w) =>
      `- ${w.title} at ${w.company}${w.duration ? ` (${w.duration})` : ""}\n  ${(w.responsibilities || []).join("\n  ")}`
    )
    .join("\n") || "Not provided";

  const userPrompt = `Tailor this resume for the following job:

JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description || "Not provided"}
Requirements: ${requirements}

CANDIDATE: ${userName}
Summary: ${cvProfile.summary || "Not provided"}
Skills: ${cvProfile.skills?.join(", ") || "Not specified"}
Experience: ${cvProfile.experience_years || 0} years (${cvProfile.seniority_level || "unspecified"} level)
Work History:
${workHistory}

Full CV Text:
${cvProfile.cv_text || "Not provided"}`;

  return await callAIJson({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
  });
}

async function generateCoverLetter(
  userName: string,
  job: MaterialsJob,
  cvProfile: MaterialsCvProfile,
): Promise<string | null> {
  const systemPrompt = `You are an expert cover letter writer. Create a compelling, personalized cover letter for the candidate applying to the specified job. It will be sent as the body of an application email.

Guidelines:
- Keep it concise (200-300 words)
- Highlight relevant skills and experience that match the job requirements
- Show enthusiasm for the role and company
- Include a strong opening hook and end with a clear call to action
- Do not use clichés, generic phrases, or placeholders like [Company]
- Sign off with the candidate's name

Return ONLY the cover letter text, no additional formatting or explanation.`;

  const requirements = Array.isArray(job.requirements)
    ? job.requirements.join(", ")
    : job.requirements || "Not specified";

  const userPrompt = `Create a cover letter for this application:

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Description: ${job.description || "Not provided"}
Requirements: ${requirements}

CANDIDATE:
Name: ${userName}
Skills: ${cvProfile.skills?.join(", ") || "Not specified"}
Experience: ${cvProfile.experience_years || 0} years
Seniority: ${cvProfile.seniority_level || "Not specified"}
Summary: ${cvProfile.summary || "Not provided"}
Recent Role: ${cvProfile.work_history?.[0]?.title || "Not specified"} at ${cvProfile.work_history?.[0]?.company || "Unknown"}`;

  const letter = await callAI({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });
  return letter?.trim() || null;
}

// ── PDF rendering (pdf-lib, pure JS — validated by test-pdf-generation) ─────

const PAGE_WIDTH = 595; // A4 @ 72dpi
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const BODY_SIZE = 10.5;
const HEADING_SIZE = 12.5;
const LINE_HEIGHT = 15;

/** Replace characters Helvetica/WinAnsi cannot encode. */
function sanitizeForPdf(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•●▪‣⁃]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/\t/g, "  ")
    // deno-lint-ignore no-control-regex
    .replace(/[^\x20-\x7E¡-ÿ\n]/g, "");
}

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (t.endsWith(":")) return true;
  return /^[A-Z][A-Z0-9\s&/,.\-']+$/.test(t) && t === t.toUpperCase();
}

function wrapLine(line: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = line.split(" ");
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      out.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out.length ? out : [""];
}

export async function renderCvPdf(
  cvText: string,
  meta: { name: string; jobTitle: string; company: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${meta.name} — Resume`);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const lines = sanitizeForPdf(cvText).split("\n");

  // If the AI already put the candidate's name on the first line, don't repeat it.
  const firstLine = (lines[0] || "").trim().toLowerCase();
  const hasNameHeader = firstLine && firstLine === meta.name.trim().toLowerCase();
  if (!hasNameHeader) {
    page.drawText(sanitizeForPdf(meta.name), {
      x: MARGIN, y, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.1),
    });
    y -= 26;
    page.drawLine({
      start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1, color: rgb(0.75, 0.75, 0.75),
    });
    y -= 18;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      y -= LINE_HEIGHT * 0.6;
      continue;
    }

    const isName = !hasNameHeader ? false : i === 0;
    const heading = isName || isHeadingLine(trimmed);
    const font = heading ? fontBold : fontReg;
    const size = isName ? 20 : heading ? HEADING_SIZE : BODY_SIZE;

    if (heading && !isName) {
      // Space before section headings
      y -= 4;
    }

    for (const wrapped of wrapLine(trimmed, font, size, maxWidth)) {
      newPageIfNeeded(LINE_HEIGHT);
      page.drawText(wrapped, {
        x: trimmed.startsWith("-") ? MARGIN + 6 : MARGIN,
        y,
        size,
        font,
        color: heading ? rgb(0.1, 0.1, 0.1) : rgb(0.2, 0.2, 0.2),
      });
      y -= isName ? 26 : LINE_HEIGHT;
    }
  }

  return await doc.save();
}
