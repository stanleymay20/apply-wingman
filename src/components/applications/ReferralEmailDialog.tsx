import { useState } from "react";
import { Mail, Loader2, Send, Copy, ExternalLink, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReferralEmails } from "@/hooks/useReferralEmails";
import { useCVProfile } from "@/hooks/useCVProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ReferralEmailDialogProps {
  jobId?: string;
  applicationId?: string;
  company: string;
  jobTitle: string;
  trigger?: React.ReactNode;
}

export function ReferralEmailDialog({
  jobId,
  applicationId,
  company,
  jobTitle,
  trigger,
}: ReferralEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  
  const { generateEmail, isGenerating, createEmail, isCreating } = useReferralEmails();
  const { cvProfile } = useCVProfile();
  const { profile } = useAuth();

  const handleGenerate = async () => {
    if (!recipientName) {
      toast.error("Please enter recipient name");
      return;
    }

    try {
      const result = await generateEmail({
        recipientName,
        recipientTitle,
        company,
        jobTitle,
        userName: profile?.full_name || "Job Seeker",
        userSkills: cvProfile?.skills || [],
        userExperience: cvProfile?.experience_years || undefined,
        userSummary: cvProfile?.summary || undefined,
      });

      setSubject(result.subject);
      setBody(result.body);

      if (result.tips?.length) {
        toast.info(`Tip: ${result.tips[0]}`);
      }
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSave = () => {
    if (!recipientName || !recipientEmail || !subject || !body) {
      toast.error("Please fill in all required fields");
      return;
    }

    createEmail({
      job_id: jobId,
      application_id: applicationId,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      recipient_title: recipientTitle,
      company,
      subject,
      body,
    });

    setOpen(false);
    resetForm();
  };

  const handleCopy = () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullEmail);
    toast.success("Email copied to clipboard");
  };

  const handleOpenInEmail = () => {
    const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
  };

  const resetForm = () => {
    setRecipientName("");
    setRecipientEmail("");
    setRecipientTitle("");
    setSubject("");
    setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Mail className="w-4 h-4 mr-2" />
            Referral Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Generate Referral Email
          </DialogTitle>
          <DialogDescription>
            Create a personalized referral request email for {jobTitle} at {company}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Recipient Name *</Label>
              <Input
                placeholder="John Smith"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div>
              <Label>Recipient Title</Label>
              <Input
                placeholder="Senior Engineer"
                value={recipientTitle}
                onChange={(e) => setRecipientTitle(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Recipient Email *</Label>
            <Input
              type="email"
              placeholder="john.smith@company.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !recipientName}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Email with AI
              </>
            )}
          </Button>

          {(subject || body) && (
            <>
              <div>
                <Label>Subject *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Body *</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleOpenInEmail}
                  disabled={!recipientEmail}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Email
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Save & Track
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
