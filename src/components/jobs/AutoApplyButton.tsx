import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Rocket,
  Mail,
  ExternalLink,
  Zap,
  ChevronDown,
  Loader2,
  Clipboard,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useAutoApply } from "@/hooks/useAutoApply";
import { useAuth } from "@/hooks/useAuth";
import { useCVProfile } from "@/hooks/useCVProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectApplicationMethod, getAvailableMethods } from "@/lib/applicationMethods";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  title: string;
  company: string;
  source_url: string;
  source_platform: string;
  description?: string | null;
  application?: {
    id: string;
    cover_letter?: string;
  } | null;
}

interface AutoApplyButtonProps {
  job: Job;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function AutoApplyButton({ job, variant = "default", size = "default" }: AutoApplyButtonProps) {
  const { autoApply, isApplying, checkEmailUsage } = useAutoApply();
  const { user, profile } = useAuth();
  const { cvProfile } = useCVProfile();

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [coverLetter, setCoverLetter] = useState(job.application?.cover_letter || "");
  const [applicationId, setApplicationId] = useState<string | null>(job.application?.id ?? null);
  const [ensuring, setEnsuring] = useState(false);

  // Ensure an application record exists for this job, creating one on demand.
  const ensureApplicationId = async (): Promise<string | null> => {
    if (applicationId) return applicationId;
    if (!user) {
      toast.error("You must be signed in to apply");
      return null;
    }
    setEnsuring(true);
    try {
      // Reuse an existing application if one already exists for this job.
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("user_id", user.id)
        .eq("job_id", job.id)
        .maybeSingle();

      if (existing?.id) {
        setApplicationId(existing.id);
        return existing.id;
      }

      const { data: created, error } = await supabase
        .from("applications")
        .insert({
          user_id: user.id,
          job_id: job.id,
          match_score: 0,
          status: "pending",
        })
        .select("id")
        .single();

      if (error || !created?.id) {
        throw new Error(error?.message || "Failed to create application");
      }
      setApplicationId(created.id);
      return created.id;
    } catch (err) {
      toast.error(
        `Could not start application: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      return null;
    } finally {
      setEnsuring(false);
    }
  };


  // Get detected method and all available methods
  const detectedMethod = detectApplicationMethod(
    job.source_url, 
    job.source_platform,
    job.description
  );
  const availableMethods = getAvailableMethods(
    job.source_url, 
    job.source_platform,
    job.description
  );

  const handleApply = async (method: "email" | "ats_api" | "assisted") => {
    // Warn if using email when ATS is available
    if (method === "email" && !detectedMethod.requiresEmail) {
      const emailCheck = checkEmailUsage(job.source_url, job.source_platform, job.description);
      if (!emailCheck.shouldUse) {
        toast.warning(`Email is not recommended: ${emailCheck.reason}`, {
          description: "Consider using the recommended method instead.",
        });
      }
    }

    if (method === "email") {
      setEmailDialogOpen(true);
      return;
    }

    // Create the application record on demand if it doesn't exist yet.
    const appId = await ensureApplicationId();
    if (!appId) return;

    if (method === "assisted") {
      // Copy application data to clipboard
      const clipboardText = `
Name: ${profile?.full_name || profile?.email || ""}
Email: ${profile?.email || ""}
Position: ${job.title}
Company: ${job.company}

${coverLetter || ""}
      `.trim();

      await navigator.clipboard.writeText(clipboardText);
      toast.success("Application details copied to clipboard!");
    }

    autoApply({
      applicationId: appId,
      jobId: job.id,
      method,
      jobTitle: job.title,
      company: job.company,
      sourceUrl: job.source_url,
      sourcePlatform: job.source_platform,
      coverLetter,
    });
  };

  const handleEmailSubmit = async () => {
    if (!recipientEmail) {
      toast.error("Please enter the recipient email");
      return;
    }

    const appId = await ensureApplicationId();
    if (!appId) return;

    autoApply({
      applicationId: appId,
      jobId: job.id,
      method: "email",
      recipientEmail,
      jobTitle: job.title,
      company: job.company,
      sourceUrl: job.source_url,
      sourcePlatform: job.source_platform,
      coverLetter,
    });

    setEmailDialogOpen(false);
    setRecipientEmail("");
  };

  const methodConfig = {
    ats_greenhouse: { icon: Zap, label: "Greenhouse ATS", color: "text-green-500" },
    ats_lever: { icon: Zap, label: "Lever ATS", color: "text-purple-500" },
    ats_workday: { icon: Zap, label: "Workday", color: "text-blue-500" },
    ats_smartrecruiters: { icon: Zap, label: "SmartRecruiters", color: "text-orange-500" },
    linkedin_easy_apply: { icon: Zap, label: "LinkedIn Easy Apply", color: "text-info" },
    company_form: { icon: ExternalLink, label: "Company Form", color: "text-primary" },
    email: { icon: Mail, label: "Email Application", color: "text-warning" },
    assisted: { icon: Clipboard, label: "Assisted Apply", color: "text-muted-foreground" },
  };

  const recommendedConfig = methodConfig[detectedMethod.type] || methodConfig.assisted;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={isApplying}>
            {isApplying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4 mr-2" />
            )}
            Auto Apply
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Recommended: {recommendedConfig.label}
            </span>
            {detectedMethod.confirmationExpected ? (
              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                <CheckCircle className="w-3 h-3 mr-1" />
                Confirmation expected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                <AlertTriangle className="w-3 h-3 mr-1" />
                No confirmation
              </Badge>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Recommended Method (highlighted) */}
          {detectedMethod.type.startsWith("ats_") || detectedMethod.type === "company_form" ? (
            <DropdownMenuItem 
              onClick={() => handleApply("ats_api")} 
              className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md m-1"
            >
              <recommendedConfig.icon className={cn("w-4 h-4 mt-0.5", recommendedConfig.color)} />
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {recommendedConfig.label}
                  <Badge variant="secondary" className="text-xs">Best</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {detectedMethod.description}
                </div>
              </div>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />

          {/* Other Methods */}
          <DropdownMenuItem onClick={() => handleApply("ats_api")} className="flex items-start gap-3 p-3">
            <Zap className="w-4 h-4 mt-0.5 text-yellow-500" />
            <div className="flex-1">
              <div className="font-medium">Quick Apply (ATS)</div>
              <div className="text-xs text-muted-foreground">
                Open pre-filled form (Greenhouse/Lever)
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleApply("assisted")} className="flex items-start gap-3 p-3">
            <Clipboard className="w-4 h-4 mt-0.5 text-blue-500" />
            <div className="flex-1">
              <div className="font-medium">Assisted Apply</div>
              <div className="text-xs text-muted-foreground">
                Copy details to clipboard & open page
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={() => handleApply("email")} 
            className={cn(
              "flex items-start gap-3 p-3",
              !detectedMethod.requiresEmail && "opacity-70"
            )}
          >
            <Mail className="w-4 h-4 mt-0.5 text-warning" />
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                Send Email
                {!detectedMethod.requiresEmail && (
                  <Badge variant="outline" className="text-xs text-warning border-warning/30">
                    Last resort
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Email with CV attached (no confirmation expected)
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Email Application Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Application
            </DialogTitle>
            <DialogDescription>
              Send your application to {job.company} for {job.title}
            </DialogDescription>
          </DialogHeader>

          {/* Warning about email applications */}
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Email applications don't receive confirmations</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Unlike ATS submissions, email applications typically don't trigger automated confirmation emails from companies.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Email *</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="hiring@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the HR or hiring manager's email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cover">Cover Letter (Optional)</Label>
              <Textarea
                id="cover"
                placeholder="Your cover letter..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate a professional email
              </p>
            </div>

            {cvProfile?.cv_file_url && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                  📄
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium">{cvProfile.cv_file_name || "Resume"}</div>
                  <div className="text-xs text-muted-foreground">Will be attached</div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEmailSubmit} disabled={!recipientEmail || isApplying}>
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Application
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
