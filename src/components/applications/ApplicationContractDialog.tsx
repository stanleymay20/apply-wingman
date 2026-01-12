import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Save,
  Lightbulb,
  MessageSquare,
  Target,
} from "lucide-react";
import { useApplicationContract, ApplicationContract } from "@/hooks/useApplicationContract";
import { useCVProfile } from "@/hooks/useCVProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ApplicationContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    id: string;
    title: string;
    company: string;
    description: string | null;
    requirements: string[] | null;
  };
  applicationId?: string;
  existingContract?: ApplicationContract;
}

export function ApplicationContractDialog({
  open,
  onOpenChange,
  job,
  applicationId,
  existingContract,
}: ApplicationContractDialogProps) {
  const { cvProfile } = useCVProfile();
  const { generateContract, isGenerating, saveContract, isSaving } = useApplicationContract();
  const [contract, setContract] = useState<ApplicationContract | null>(existingContract || null);

  const handleGenerate = () => {
    if (!cvProfile) {
      toast.error("Please upload your CV first on the Profile page");
      return;
    }

    generateContract(
      {
        title: job.title,
        company: job.company,
        description: job.description || "",
        requirements: job.requirements || [],
      },
      {
        onSuccess: (data) => setContract(data),
      }
    );
  };

  const handleSave = () => {
    if (!applicationId || !contract) return;
    saveContract({ applicationId, contract });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Application Contract
          </DialogTitle>
          <DialogDescription>
            Honest, skill-matched application materials for {job.title} at {job.company}
          </DialogDescription>
        </DialogHeader>

        {!contract ? (
          <div className="py-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Generate Tailored Application</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Creates an honest application package based on your actual skills and experience.
              No exaggeration, no hallucination - just authentic matching.
            </p>
            {!cvProfile && (
              <p className="text-sm text-destructive mb-4">
                ⚠️ Please upload your CV on the Profile page first
              </p>
            )}
            <Button onClick={handleGenerate} disabled={isGenerating || !cvProfile}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing skills...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Generate Contract
                </>
              )}
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 pr-4">
              {/* Fit Score */}
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <h4 className="font-medium">Overall Fit Score</h4>
                  <p className="text-sm text-muted-foreground">Based on honest skill matching</p>
                </div>
                <div className={cn("text-4xl font-bold", getScoreColor(contract.overallFitScore))}>
                  {contract.overallFitScore}%
                </div>
              </div>

              {/* Skill Match */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Skill Match Analysis
                </h4>
                
                <div className="grid gap-3">
                  {contract.skillMatch.matched.length > 0 && (
                    <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span className="font-medium text-success">Matched Skills</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {contract.skillMatch.matched.map((skill, i) => (
                          <Badge key={i} variant="outline" className="bg-success/10 border-success/30">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {contract.skillMatch.partialMatch.length > 0 && (
                    <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-warning" />
                        <span className="font-medium text-warning">Partial Match</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {contract.skillMatch.partialMatch.map((skill, i) => (
                          <Badge key={i} variant="outline" className="bg-warning/10 border-warning/30">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {contract.skillMatch.missing.length > 0 && (
                    <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="font-medium text-destructive">Skills to Develop</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {contract.skillMatch.missing.map((skill, i) => (
                          <Badge key={i} variant="outline" className="bg-destructive/10 border-destructive/30">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Honest Assessment */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Honest Assessment
                </h4>
                <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                  {contract.honestAssessment}
                </p>
              </div>

              <Separator />

              {/* Cover Letter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Tailored Cover Letter
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(contract.coverLetter, "Cover letter")}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="text-sm bg-secondary/50 p-4 rounded-lg whitespace-pre-wrap">
                  {contract.coverLetter}
                </div>
              </div>

              <Separator />

              {/* Talking Points */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Key Talking Points
                </h4>
                <ul className="space-y-2">
                  {contract.talkingPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Gaps to Address */}
              {contract.gapsToAddress.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-warning" />
                      Gaps to Address Honestly
                    </h4>
                    <ul className="space-y-2">
                      {contract.gapsToAddress.map((gap, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Interview Prep */}
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Interview Preparation
                </h4>
                <ul className="space-y-2">
                  {contract.interviewPrep.map((q, i) => (
                    <li key={i} className="text-sm bg-secondary/50 p-3 rounded-lg">
                      <span className="font-medium">Q{i + 1}:</span> {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollArea>
        )}

        {contract && (
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Regenerate"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {applicationId && (
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save to Application
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}