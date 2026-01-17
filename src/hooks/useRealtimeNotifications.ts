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
                           notification.type === "offer" ? "success" :
                           notification.type === "high_match_job" ? "success" : "info";
          
          if (toastType === "error") {
            toast.error(notification.title, { description: notification.message });
          } else if (toastType === "success") {
            toast.success(notification.title, { description: notification.message, duration: 8000 });
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

    // Subscribe to job updates for high match score alerts
    const jobsChannel = supabase
      .channel("jobs-match-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const oldScore = payload.old?.match_score;
          const newScore = payload.new?.match_score;
          const jobTitle = payload.new?.title;
          const company = payload.new?.company;
          const jobId = payload.new?.id;

          // Alert for 80%+ match score when score is newly set or crosses threshold
          if (newScore && newScore >= 80 && (!oldScore || oldScore < 80)) {
            // Show immediate toast with high priority
            toast.success(
              `🎯 High Match: ${jobTitle}`,
              {
                description: `${company} - ${newScore}% match! This job is a great fit for your profile.`,
                duration: 10000,
                action: {
                  label: "View Job",
                  onClick: () => {
                    window.location.href = `/jobs?highlight=${jobId}`;
                  },
                },
              }
            );

            // Create persistent notification
            await supabase.from("notifications").insert({
              user_id: user.id,
              type: "high_match_job",
              title: `🎯 High Match Job Found!`,
              message: `${jobTitle} at ${company} has a ${newScore}% match score`,
              data: { jobId, matchScore: newScore, title: jobTitle, company },
            });

            // Refresh queries
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(applicationsChannel);
      supabase.removeChannel(jobsChannel);
    };
  }, [user, queryClient]);
}
