import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface UploadProgress {
  progress: number;
  fileName: string;
  status: string;
}

interface UploadResult {
  url: string;
  path: string;
  fileName: string;
  extractedText?: string;
}

async function extractTextFromFile(file: File): Promise<string | null> {
  const type = file.type;
  const name = file.name.toLowerCase();

  // Plain text files - can read directly
  if (type.includes("text") || name.endsWith(".txt")) {
    return await file.text();
  }

  // PDF and DOC files cannot be parsed client-side without heavy libraries
  // Return null to indicate manual text paste is needed
  return null;
}

export function useFileUpload() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const uploadFile = useCallback(
    async (file: File, bucket: string = "cv-files"): Promise<UploadResult | null> => {
      if (!user) {
        toast.error("Please sign in to upload files");
        return null;
      }

      // Validate file size (10MB max for PDFs)
      const maxSize = file.type === "application/pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
        return null;
      }

      // Validate file type for CV files
      if (bucket === "cv-files") {
        const allowedTypes = [
          "application/pdf",
          "text/plain",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        const allowedExtensions = [".pdf", ".txt", ".doc", ".docx"];
        const hasValidType = allowedTypes.includes(file.type);
        const hasValidExtension = allowedExtensions.some(ext => 
          file.name.toLowerCase().endsWith(ext)
        );
        
        if (!hasValidType && !hasValidExtension) {
          toast.error("Please upload a PDF, DOC, DOCX, or TXT file");
          return null;
        }
      }

      setIsUploading(true);
      setUploadProgress({ progress: 10, fileName: file.name, status: "Uploading..." });

      try {
        // Create unique file path: userId/timestamp-filename
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${user.id}/${timestamp}-${sanitizedName}`;

        // Upload file
        setUploadProgress({ progress: 30, fileName: file.name, status: "Uploading to storage..." });
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) throw error;

        setUploadProgress({ progress: 50, fileName: file.name, status: "Processing file..." });

        // Extract text from file
        let extractedText: string | null = null;
        try {
          setUploadProgress({ progress: 60, fileName: file.name, status: "Extracting text..." });
          extractedText = await extractTextFromFile(file);
        } catch (extractError) {
          console.warn("Text extraction failed:", extractError);
          // Continue without extracted text
        }

        setUploadProgress({ progress: 80, fileName: file.name, status: "Generating URL..." });

        // Get signed URL for private buckets
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(data.path, 3600 * 24 * 7); // 7 days expiry

        setUploadProgress({ progress: 100, fileName: file.name, status: "Complete!" });

        toast.success("File uploaded successfully");

        return {
          url: signedError ? data.path : signedData.signedUrl,
          path: data.path,
          fileName: file.name,
          extractedText: extractedText || undefined,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        toast.error(`Upload failed: ${message}`);
        return null;
      } finally {
        setIsUploading(false);
        setTimeout(() => setUploadProgress(null), 1000);
      }
    },
    [user]
  );

  const deleteFile = useCallback(
    async (path: string, bucket: string = "cv-files"): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase.storage.from(bucket).remove([path]);
        if (error) throw error;
        toast.success("File deleted");
        return true;
      } catch (error) {
        toast.error("Failed to delete file");
        return false;
      }
    },
    [user]
  );

  return {
    uploadFile,
    deleteFile,
    isUploading,
    uploadProgress,
  };
}
