import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface DocumentUpload {
  file: File;
  documentType: string;
  applicationId?: string;
}

interface UploadedDocument {
  url: string;
  path: string;
  fileName: string;
  documentType: string;
}

export function useDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const uploadDocument = useCallback(
    async ({ file, documentType, applicationId }: DocumentUpload): Promise<UploadedDocument | null> => {
      if (!user) {
        toast.error("Please sign in to upload documents");
        return null;
      }

      // Validate file size (10MB max for documents)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return null;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${user.id}/${documentType}/${timestamp}-${sanitizedName}`;

        const { data, error } = await supabase.storage
          .from("documents")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) throw error;

        setUploadProgress(100);

        // If applicationId provided, update the application's documents_uploaded array
        if (applicationId) {
          const { data: appData } = await supabase
            .from("applications")
            .select("documents_uploaded")
            .eq("id", applicationId)
            .single();

          const currentDocs = appData?.documents_uploaded || [];
          const updatedDocs = [...currentDocs, documentType];

          await supabase
            .from("applications")
            .update({ documents_uploaded: updatedDocs })
            .eq("id", applicationId);

          queryClient.invalidateQueries({ queryKey: ["applications"] });
        }

        toast.success(`${documentType} uploaded successfully`);

        return {
          url: data.path,
          path: data.path,
          fileName: file.name,
          documentType,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        toast.error(`Upload failed: ${message}`);
        return null;
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [user, queryClient]
  );

  const getSignedUrl = useCallback(
    async (path: string, bucket: string = "documents"): Promise<string | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (error) throw error;
        return data.signedUrl;
      } catch (error) {
        console.error("Failed to get signed URL:", error);
        return null;
      }
    },
    [user]
  );

  const requestDocumentsMutation = useMutation({
    mutationFn: async ({
      applicationId,
      documentsRequired,
    }: {
      applicationId: string;
      documentsRequired: string[];
    }) => {
      const { error } = await supabase
        .from("applications")
        .update({
          documents_required: documentsRequired,
          status: "documents_needed",
        })
        .eq("id", applicationId);

      if (error) throw error;

      // Create a notification for the user
      if (user) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "document_request",
          title: "Documents Required",
          message: `Additional documents needed: ${documentsRequired.join(", ")}`,
          data: { applicationId, documentsRequired },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Document request sent");
    },
  });

  return {
    uploadDocument,
    getSignedUrl,
    requestDocuments: requestDocumentsMutation.mutate,
    isRequesting: requestDocumentsMutation.isPending,
    isUploading,
    uploadProgress,
  };
}
