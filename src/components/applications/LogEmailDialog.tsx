import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2, Calendar } from "lucide-react";
import { useApplicationEmails } from "@/hooks/useApplicationEmails";

interface LogEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  companyName: string;
}

export function LogEmailDialog({
  open,
  onOpenChange,
  applicationId,
  companyName,
}: LogEmailDialogProps) {
  const { addEmail, isAdding } = useApplicationEmails(applicationId);
  
  const [formData, setFormData] = useState({
    fromEmail: "",
    subject: "",
    snippet: "",
    emailType: "response" as "response" | "interview" | "rejection" | "offer",
    receivedAt: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    addEmail(
      {
        applicationId,
        fromEmail: formData.fromEmail,
        subject: formData.subject,
        snippet: formData.snippet || undefined,
        emailType: formData.emailType,
        receivedAt: new Date(formData.receivedAt).toISOString(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setFormData({
            fromEmail: "",
            subject: "",
            snippet: "",
            emailType: "response",
            receivedAt: new Date().toISOString().split("T")[0],
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Log Email Response
          </DialogTitle>
          <DialogDescription>
            Record an email you received from {companyName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email Type</Label>
            <Select
              value={formData.emailType}
              onValueChange={(v) => setFormData({ ...formData, emailType: v as typeof formData.emailType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="response">General Response</SelectItem>
                <SelectItem value="interview">Interview Invitation 🎉</SelectItem>
                <SelectItem value="offer">Job Offer 🎊</SelectItem>
                <SelectItem value="rejection">Rejection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>From Email</Label>
            <Input
              type="email"
              placeholder="recruiter@company.com"
              value={formData.fromEmail}
              onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
              required
              className="bg-secondary"
            />
          </div>

          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input
              placeholder="RE: Your Application for..."
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              className="bg-secondary"
            />
          </div>

          <div className="space-y-2">
            <Label>Email Snippet (Optional)</Label>
            <Textarea
              placeholder="Key points from the email..."
              value={formData.snippet}
              onChange={(e) => setFormData({ ...formData, snippet: e.target.value })}
              rows={3}
              className="bg-secondary"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Received
            </Label>
            <Input
              type="date"
              value={formData.receivedAt}
              onChange={(e) => setFormData({ ...formData, receivedAt: e.target.value })}
              required
              className="bg-secondary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Log Email
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}