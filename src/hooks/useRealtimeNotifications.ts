import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Notification } from "@/types/database";

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Subscribe to notifications
    const notificationsChannel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          
          // Show toast notification
          const toastType = notification.type === "error" ? "error" : 
                           notification.type === "interview" ? "success" :
                           notification.type === "offer" ? "success" : "info";
          
          if (toastType === "error") {
            toast.error(notification.title, { description: notification.message });
          } else if (toastType === "success") {
            toast.success(notification.title, { description: notification.message });
          } else {
            toast.info(notification.title, { description: notification.message });
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
        }
      )
      .subscribe();

    // Subscribe to application status changes
    const applicationsChannel = supabase
      .channel("applications-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "applications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;

          if (oldStatus !== newStatus) {
            const statusMessages: Record<string, { title: string; type: "success" | "info" | "warning" }> = {
              interview: { title: "Interview Scheduled! 🎉", type: "success" },
              offer: { title: "Job Offer Received! 🎊", type: "success" },
              rejected: { title: "Application Updated", type: "info" },
              submitted: { title: "Application Submitted", type: "success" },
            };

            const message = statusMessages[newStatus];
            if (message) {
              if (message.type === "success") {
                toast.success(message.title);
              } else {
                toast.info(message.title);
              }
            }
          }

          // Refresh application data
          queryClient.invalidateQueries({ queryKey: ["applications"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["today-applications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(applicationsChannel);
    };
  }, [user, queryClient]);
}
