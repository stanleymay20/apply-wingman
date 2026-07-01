import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WorkHistoryItem {
  title?: string;
  company?: string;
  location?: string;
  duration?: string;
  responsibilities?: string[];
  highlights?: string[];    // legacy field name — normalized below
  technologies?: string[];
}

interface EducationItem {
  degree?: string;
  field?: string;
  institution?: string;
  year?: string | number;
}

interface CVProfile {
  profile_name?: string | null;
  summary?: string | null;
  skills?: string[] | null;
  work_history?: WorkHistoryItem[] | null;
  education?: EducationItem[] | null;
  experience_years?: number | null;
  seniority_level?: string | null;
}

interface UserProfile {
  full_name?: string | null;
  email?: string | null;
}

interface ResumePDFExportProps {
  cvProfile: CVProfile;
  userProfile: UserProfile;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildResumeHTML(cv: CVProfile, user: UserProfile): string {
  const name = esc(user.full_name || "Your Name");
  const email = esc(user.email || "");
  const summary = esc(cv.summary || "");
  const skills = cv.skills || [];
  const workHistory = Array.isArray(cv.work_history) ? cv.work_history : [];
  const education = Array.isArray(cv.education) ? cv.education : [];

  const workSection = workHistory
    .map((w) => {
      const bullets = (w.responsibilities || w.highlights || []);
      const techLine = w.technologies?.length
        ? `<div class="tech">Technologies: ${esc(w.technologies.join(", "))}</div>`
        : "";
      const locationStr = w.location ? ` · ${esc(w.location)}` : "";
      return `
      <div class="job">
        <div class="job-title">${esc(w.title || "")}</div>
        <div class="job-meta">${esc(w.company || "")}${locationStr}${w.duration ? ` · ${esc(w.duration)}` : ""}</div>
        ${bullets.length ? `<ul>${bullets.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
        ${techLine}
      </div>`;
    })
    .join("");

  const eduSection = education
    .map((e) => {
      const degree = [e.degree, e.field].filter(Boolean).map(esc).join(" in ");
      return `<div class="edu"><strong>${degree}</strong> — ${esc(e.institution || "")}${e.year ? ` (${e.year})` : ""}</div>`;
    })
    .join("");

  // Group skills into rows of ~6 for readability
  const skillChunks: string[][] = [];
  for (let i = 0; i < skills.length; i += 6) skillChunks.push(skills.slice(i, i + 6));
  const skillsHTML = skillChunks
    .map((chunk) => `<div class="skill-row">${chunk.map((s) => `<span class="skill">${esc(s)}</span>`).join("")}</div>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${name} — Resume</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 10.5pt;
    color: #111;
    background: #fff;
    padding: 48px 56px;
    line-height: 1.55;
    max-width: 780px;
    margin: 0 auto;
  }
  h1 { font-size: 26pt; font-weight: bold; letter-spacing: -0.5px; color: #111; }
  .contact { font-size: 10pt; color: #555; margin-top: 3px; }
  .divider { border: none; border-top: 2px solid #111; margin: 14px 0 16px; }
  .section { margin-bottom: 20px; }
  .section-title {
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #111;
    border-bottom: 1px solid #ccc;
    padding-bottom: 3px;
    margin-bottom: 10px;
  }
  .summary { font-size: 10.5pt; color: #222; }
  /* Skills */
  .skill-row { margin-bottom: 4px; }
  .skill {
    display: inline-block;
    font-size: 9.5pt;
    color: #333;
    background: #f4f4f4;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: 1px 7px;
    margin: 2px 3px 2px 0;
  }
  /* Work */
  .job { margin-bottom: 14px; page-break-inside: avoid; }
  .job-title { font-weight: bold; font-size: 10.5pt; color: #111; }
  .job-meta { font-size: 10pt; color: #555; margin-top: 1px; margin-bottom: 4px; }
  ul { padding-left: 18px; margin-top: 4px; }
  li { font-size: 10pt; color: #222; margin-bottom: 3px; line-height: 1.5; }
  .tech { font-size: 9pt; color: #666; margin-top: 4px; font-style: italic; }
  /* Education */
  .edu { font-size: 10pt; color: #222; margin-bottom: 6px; }
  /* Print: suppress browser-added date/URL header+footer */
  @media print {
    html, body { padding: 0; margin: 0; }
    @page {
      size: A4;
      margin: 1.8cm 1.8cm 1.8cm 1.8cm;
      /* Blank out browser header/footer lines */
      @top-center { content: ""; }
      @bottom-center { content: ""; }
    }
  }
</style>
</head>
<body>
  <h1>${name}</h1>
  <div class="contact">${email}</div>
  <hr class="divider"/>

  ${summary ? `<div class="section"><div class="section-title">Summary</div><div class="summary">${summary}</div></div>` : ""}

  ${skillsHTML ? `<div class="section"><div class="section-title">Skills</div>${skillsHTML}</div>` : ""}

  ${workSection ? `<div class="section"><div class="section-title">Experience</div>${workSection}</div>` : ""}

  ${eduSection ? `<div class="section"><div class="section-title">Education</div>${eduSection}</div>` : ""}
</body>
</html>`;
}

export function ResumePDFExport({ cvProfile, userProfile }: ResumePDFExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const html = buildResumeHTML(cvProfile, userProfile);

      // Open a blank new window — no URL, no browser-chrome header/footer in print dialog
      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) {
        toast.error("Pop-up blocked — allow pop-ups for this site and try again");
        return;
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      // Wait for styles + fonts to render before triggering print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          // Close after print dialog dismisses (slight delay)
          setTimeout(() => printWindow.close(), 1000);
        }, 300);
      };

      toast.success('Print dialog opened — choose "Save as PDF" to download');
    } catch (err) {
      toast.error("Export failed — try again");
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
      {isExporting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      Export PDF
    </Button>
  );
}
