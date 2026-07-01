import { useState } from "react";
import { Wand2, Loader2, CheckCircle, Copy, Save, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCVProfile } from "@/hooks/useCVProfile";
import { useResumeTailor } from "@/hooks/useResumeTailor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Job {
  id: string;
  title: string;
  company: string;
  description?: string | null;
  requirements?: string[] | null;
}

interface ResumeTailorButtonProps {
  job: Job;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function ResumeTailorButton({ job, variant = "outline", size = "default" }: ResumeTailorButtonProps) {
  const { cvProfile } = useCVProfile();
  const { tailorResume, isTailoring, tailorResult, reset } = useResumeTailor();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    if (!tailorResult) {
      await tailorResume(cvProfile as Record<string, unknown>, job as Record<string, unknown>);
    }
  };

  const handleClose = () => {
    setOpen(false);
    reset();
    setShowFullText(false);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!tailorResult?.tailored_cv_text) return;
    await navigator.clipboard.writeText(tailorResult.tailored_cv_text);
    setCopied(true);
    toast.success("Tailored resume copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAsProfile = async () => {
    if (!tailorResult || !user || !cvProfile) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("cv_profiles").insert({
        user_id: user.id,
        profile_name: `${job.company} – ${job.title}`,
        cv_text: tailorResult.tailored_cv_text,
        summary: tailorResult.tailored_summary,
        skills: cvProfile.skills,
        experience_years: cvProfile.experience_years,
        seniority_level: cvProfile.seniority_level,
        work_history: cvProfile.work_history,
        is_active: false,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["cv-profiles-list"] });
      toast.success(`Saved as "${job.company} – ${job.title}" profile`);
      handleClose();
    } catch (err) {
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (!cvProfile) return null;

  return (
    <>
      <Button variant={variant} size={size} onClick={handleOpen} disabled={isTailoring}>
        {isTailoring ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Wand2 className="w-4 h-4 mr-2" />
        )}
        Tailor Resume
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Resume Tailored for {job.title}
            </DialogTitle>
            <DialogDescription>
              Optimized for {job.company} — keywords added, bullets strengthened, summary rewritten.
            </DialogDescription>
          </DialogHeader>

          {isTailoring && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Tailoring your resume to this job...</p>
            </div>
          )}

          {tailorResult && (
            <ScrollArea className="flex-1 mt-2">
              <div className="space-y-5 pr-2">
                {/* Keywords added */}
                {tailorResult.keywords_added?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-success" />
                      Keywords Added
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {tailorResult.keywords_added.map((kw) => (
                        <Badge key={kw} variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key changes */}
                {tailorResult.key_changes?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">What Changed</p>
                    <ul className="space-y-1">
                      {tailorResult.key_changes.map((change, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-primary shrink-0">•</span>
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tailored summary */}
                {tailorResult.tailored_summary && (
                  <div>
                    <p className="text-sm font-medium mb-2">New Summary</p>
                    <div className="p-3 bg-secondary/50 rounded-lg text-sm text-muted-foreground">
                      {tailorResult.tailored_summary}
                    </div>
                  </div>
                )}

                {/* Full tailored CV */}
                {tailorResult.tailored_cv_text && (
                  <div>
                    <button
                      className="text-sm font-medium flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => setShowFullText((v) => !v)}
                    >
                      {showFullText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {showFullText ? "Hide" : "Show"} Full Tailored Resume
                    </button>
                    {showFullText && (
                      <pre className="mt-2 p-3 bg-secondary/50 rounded-lg text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                        {tailorResult.tailored_cv_text}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {tailorResult && (
            <DialogFooter className="mt-4 gap-2 flex-wrap">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                {copied ? <CheckCircle className="w-4 h-4 mr-2 text-success" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied!" : "Copy Text"}
              </Button>
              <Button onClick={handleSaveAsProfile} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save as CV Profile
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
