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
import {
  Rocket,
  Mail,
  ExternalLink,
  Zap,
  ChevronDown,
  Loader2,
  Clipboard,
} from "lucide-react";
import { useAutoApply } from "@/hooks/useAutoApply";
import { useAuth } from "@/hooks/useAuth";
import { useCVProfile } from "@/hooks/useCVProfile";
import { toast } from "sonner";

interface Job {
  id: string;
  title: string;
  company: string;
  source_url: string;
  source_platform: string;
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
  const { autoApply, isApplying, detectApplyMethod } = useAutoApply();
  const { profile } = useAuth();
  const { cvProfile } = useCVProfile();
  
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [coverLetter, setCoverLetter] = useState(job.application?.cover_letter || "");

  const suggestedMethod = detectApplyMethod(job.source_url, job.source_platform);

  const handleApply = async (method: "email" | "ats_api" | "assisted") => {
    if (!job.application?.id) {
      toast.error("Please create an application first");
      return;
    }

    if (method === "email") {
      setEmailDialogOpen(true);
      return;
    }

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
      applicationId: job.application.id,
      jobId: job.id,
      method,
      jobTitle: job.title,
      company: job.company,
      sourceUrl: job.source_url,
      sourcePlatform: job.source_platform,
      coverLetter,
    });
  };

  const handleEmailSubmit = () => {
    if (!recipientEmail) {
      toast.error("Please enter the recipient email");
      return;
    }

    if (!job.application?.id) {
      toast.error("Please create an application first");
      return;
    }

    autoApply({
      applicationId: job.application.id,
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

  const methodLabels = {
    email: { icon: Mail, label: "Send Application Email", description: "Sends professional email with CV" },
    ats_api: { icon: Zap, label: "Quick Apply (ATS)", description: "Opens pre-filled application form" },
    assisted: { icon: ExternalLink, label: "Assisted Apply", description: "Copies details & opens job page" },
  };

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
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Recommended: {methodLabels[suggestedMethod].label}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => handleApply("email")} className="flex items-start gap-3 p-3">
            <Mail className="w-4 h-4 mt-0.5 text-primary" />
            <div className="flex-1">
              <div className="font-medium">Send Email</div>
              <div className="text-xs text-muted-foreground">
                Professional email with CV attached
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleApply("ats_api")} className="flex items-start gap-3 p-3">
            <Zap className="w-4 h-4 mt-0.5 text-yellow-500" />
            <div className="flex-1">
              <div className="font-medium">Quick Apply</div>
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
