import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2, CheckCircle } from "lucide-react";
import { useDocuments } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";

interface DocumentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  requiredDocuments: string[];
  uploadedDocuments: string[];
  mode: "request" | "upload";
  onDocumentsUploaded?: () => void;
}

const DOCUMENT_TYPES = [
  { id: "portfolio", label: "Portfolio", description: "Showcase your work samples" },
  { id: "certificate", label: "Certificates", description: "Professional certifications" },
  { id: "reference", label: "References", description: "Letters of recommendation" },
  { id: "transcript", label: "Transcript", description: "Academic transcripts" },
  { id: "cover_letter", label: "Cover Letter", description: "Personalized cover letter" },
  { id: "writing_sample", label: "Writing Sample", description: "Writing or documentation samples" },
];

export function DocumentRequestDialog({
  open,
  onOpenChange,
  applicationId,
  requiredDocuments,
  uploadedDocuments,
  mode,
  onDocumentsUploaded,
}: DocumentRequestDialogProps) {
  const { requestDocuments, uploadDocument, isRequesting, isUploading } = useDocuments();
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(requiredDocuments);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleRequestDocuments = () => {
    if (selectedDocuments.length === 0) return;
    requestDocuments({ applicationId, documentsRequired: selectedDocuments });
    onOpenChange(false);
  };

  const handleFileUpload = async (docType: string, file: File) => {
    const result = await uploadDocument({
      file,
      documentType: docType,
      applicationId,
    });
    if (result && onDocumentsUploaded) {
      onDocumentsUploaded();
    }
  };

  const toggleDocument = (docId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(docId) ? prev.filter((d) => d !== docId) : [...prev, docId]
    );
  };

  const isDocumentUploaded = (docId: string) => uploadedDocuments.includes(docId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "request" ? "Request Additional Documents" : "Upload Required Documents"}
          </DialogTitle>
          <DialogDescription>
            {mode === "request"
              ? "Select the documents you need from the applicant"
              : "Upload the required documents to complete your application"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {mode === "request" ? (
            // Request mode - checkboxes to select which docs to request
            <div className="space-y-3">
              {DOCUMENT_TYPES.map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border border-border/50 transition-colors",
                    selectedDocuments.includes(doc.id) && "bg-primary/10 border-primary/30"
                  )}
                >
                  <Checkbox
                    id={doc.id}
                    checked={selectedDocuments.includes(doc.id)}
                    onCheckedChange={() => toggleDocument(doc.id)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={doc.id} className="font-medium cursor-pointer">
                      {doc.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{doc.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Upload mode - file upload for each required doc
            <div className="space-y-3">
              {requiredDocuments.map((docId) => {
                const doc = DOCUMENT_TYPES.find((d) => d.id === docId);
                const uploaded = isDocumentUploaded(docId);

                return (
                  <div
                    key={docId}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border border-border/50",
                      uploaded && "bg-success/10 border-success/30"
                    )}
                  >
                    <input
                      type="file"
                      ref={(el) => { fileInputRefs.current[docId] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(docId, file);
                      }}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    />

                    <div className="flex-1">
                      <p className="font-medium text-foreground">{doc?.label || docId}</p>
                      <p className="text-sm text-muted-foreground">{doc?.description}</p>
                    </div>

                    {uploaded ? (
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Uploaded</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[docId]?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === "request" && (
            <Button
              onClick={handleRequestDocuments}
              disabled={selectedDocuments.length === 0 || isRequesting}
            >
              {isRequesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Request Documents
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
