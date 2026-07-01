import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WorkHistoryItem {
  title?: string;
  company?: string;
  duration?: string;
  responsibilities?: string[];
}

interface EducationItem {
  degree?: string;
  institution?: string;
  year?: string;
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

function buildResumeHTML(cv: CVProfile, user: UserProfile): string {
  const name = user.full_name || "Your Name";
  const email = user.email || "";
  const summary = cv.summary || "";
  const skills = (cv.skills || []).join(" • ");
  const workHistory = Array.isArray(cv.work_history) ? cv.work_history : [];
  const education = Array.isArray(cv.education) ? cv.education : [];

  const workSection = workHistory
    .map(
      (w) => `
      <div class="job">
        <div class="job-header">
          <span class="job-title">${w.title || ""}</span>
          <span class="job-company">${w.company || ""}${w.duration ? ` · ${w.duration}` : ""}</span>
        </div>
        ${
          Array.isArray(w.responsibilities) && w.responsibilities.length
            ? `<ul>${w.responsibilities.map((r) => `<li>${r}</li>`).join("")}</ul>`
            : ""
        }
      </div>`
    )
    .join("");

  const eduSection = education
    .map(
      (e) => `
      <div class="edu">
        <strong>${e.degree || ""}</strong> — ${e.institution || ""}${e.year ? ` (${e.year})` : ""}
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #1a1a1a; padding: 36px 48px; line-height: 1.5; }
  h1 { font-size: 22pt; font-weight: bold; letter-spacing: -0.5px; }
  .contact { font-size: 10pt; color: #555; margin-top: 2px; }
  .divider { border: none; border-top: 2px solid #1a1a1a; margin: 12px 0 10px; }
  .section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; color: #1a1a1a; }
  .section { margin-bottom: 18px; }
  .summary { font-size: 10.5pt; color: #333; }
  .skills { font-size: 10pt; color: #333; }
  .job { margin-bottom: 12px; }
  .job-header { display: flex; justify-content: space-between; }
  .job-title { font-weight: bold; font-size: 10.5pt; }
  .job-company { color: #555; font-size: 10pt; }
  ul { padding-left: 16px; margin-top: 4px; }
  li { font-size: 10pt; color: #333; margin-bottom: 2px; }
  .edu { font-size: 10pt; color: #333; margin-bottom: 4px; }
  @media print {
    body { padding: 0; }
    @page { margin: 2cm; }
  }
</style>
</head>
<body>
  <h1>${name}</h1>
  <div class="contact">${email}</div>
  <hr class="divider"/>

  ${summary ? `<div class="section"><div class="section-title">Summary</div><div class="summary">${summary}</div></div>` : ""}

  ${skills ? `<div class="section"><div class="section-title">Skills</div><div class="skills">${skills}</div></div>` : ""}

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

      // Open a hidden iframe, write the HTML, then trigger print-to-PDF
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error("Could not create print frame");

      doc.open();
      doc.write(html);
      doc.close();

      // Give styles time to render
      await new Promise((r) => setTimeout(r, 400));

      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Clean up after a delay
      setTimeout(() => document.body.removeChild(iframe), 2000);
      toast.success("Resume sent to printer / Save as PDF in the print dialog");
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
