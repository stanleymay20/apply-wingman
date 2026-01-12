import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface UploadProgress {
  progress: number;
  fileName: string;
}

interface UploadResult {
  url: string;
  path: string;
  fileName: string;
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

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
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
        if (!allowedTypes.includes(file.type)) {
          toast.error("Please upload a PDF, DOC, DOCX, or TXT file");
          return null;
        }
      }

      setIsUploading(true);
      setUploadProgress({ progress: 0, fileName: file.name });

      try {
        // Create unique file path: userId/timestamp-filename
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${user.id}/${timestamp}-${sanitizedName}`;

        // Upload file
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(data.path);

        setUploadProgress({ progress: 100, fileName: file.name });

        toast.success("File uploaded successfully");

        return {
          url: urlData.publicUrl,
          path: data.path,
          fileName: file.name,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        toast.error(`Upload failed: ${message}`);
        return null;
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
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
