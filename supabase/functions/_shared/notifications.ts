// Lifecycle → notification rules engine helper.
// Reads notification_rules, enforces per-user/event/application cooldown,
// writes to notification_events (ledger) + notifications (in-app feed), and
// optionally dispatches email via Resend. Never throws — notification failures
// must not break application lifecycle.
//
// deno-lint-ignore-file no-explicit-any

export interface LifecycleNotifyParams {
  userId: string;
  applicationId?: string | null;
  runId?: string | null;
  jobTitle?: string;
  company?: string;
  status: string; // e.g. delivered, manual_action_required, failed, retrying, responded
  eventType?: string; // default 'lifecycle'
  errorMessage?: string;
  extra?: Record<string, unknown>;
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

async function sendEmail(toEmail: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return { ok: false, error: "missing_email_config" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ApplyPilot <onboarding@resend.dev>",
        to: [toEmail],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `resend_${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "email_send_failed" };
  }
}

export async function notifyFromLifecycle(
  supabase: any,
  params: LifecycleNotifyParams,
): Promise<void> {
  try {
    const eventType = params.eventType ?? "lifecycle";

    // 1. Load matching rule.
    const { data: rule } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("event_type", eventType)
      .eq("status", params.status)
      .eq("enabled", true)
      .maybeSingle();

    if (!rule) return; // No rule = no notification (silent by design).

    // 2. Cooldown / dedup check.
    if (rule.cooldown_minutes > 0 && params.applicationId) {
      const cutoff = new Date(Date.now() - rule.cooldown_minutes * 60_000).toISOString();
      const { data: recent } = await supabase
        .from("notification_events")
        .select("id")
        .eq("user_id", params.userId)
        .eq("event_type", eventType)
        .eq("application_id", params.applicationId)
        .eq("status", params.status)
        .gte("created_at", cutoff)
        .limit(1);
      if (recent && recent.length > 0) return; // suppressed by cooldown
    }

    // 3. Render templates.
    const vars: Record<string, string> = {
      company: params.company ?? "the company",
      job_title: params.jobTitle ?? "the role",
      error_message: params.errorMessage ?? "",
      status: params.status,
    };
    const title = render(rule.template_title, vars);
    const body = render(rule.template_body, vars);

    // 4. Write event ledger row.
    const { data: eventRow } = await supabase
      .from("notification_events")
      .insert({
        user_id: params.userId,
        application_id: params.applicationId ?? null,
        run_id: params.runId ?? null,
        event_type: eventType,
        status: params.status,
        severity: rule.severity,
        channel: rule.channel,
        payload: { ...vars, ...(params.extra ?? {}) },
      })
      .select("id")
      .single();

    // 5. In-app notification (always written for in_app/both).
    if (rule.channel === "in_app" || rule.channel === "both") {
      const typeMap: Record<string, string> = {
        success: "system",
        info: "system",
        warning: "system",
        error: "error",
      };
      // Map known lifecycle statuses to richer notification types where possible.
      let notifType = typeMap[rule.severity] ?? "system";
      if (params.status === "responded") notifType = "system";
      await supabase.from("notifications").insert({
        user_id: params.userId,
        type: notifType,
        title,
        message: body,
        data: {
          event_id: eventRow?.id,
          severity: rule.severity,
          status: params.status,
          application_id: params.applicationId ?? null,
          event_type: eventType,
        },
      });
    }

    // 6. Email dispatch (best-effort, never blocks).
    if (rule.channel === "email" || rule.channel === "both") {
      // Look up email.
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, email_notifications")
        .eq("id", params.userId)
        .maybeSingle();
      if (!profile?.email || profile.email_notifications === false) {
        await supabase
          .from("notification_events")
          .update({ delivery_error: "email_disabled_or_missing" })
          .eq("id", eventRow?.id);
      } else {
        const html = `<p>${body}</p>`;
        const result = await sendEmail(profile.email, title, html);
        if (result.ok) {
          await supabase
            .from("notification_events")
            .update({ delivered_at: new Date().toISOString() })
            .eq("id", eventRow?.id);
        } else {
          await supabase
            .from("notification_events")
            .update({ delivery_error: result.error })
            .eq("id", eventRow?.id);
          await supabase.from("application_logs").insert({
            user_id: params.userId,
            application_id: params.applicationId ?? null,
            action: "notification_delivery_skipped",
            level: "warning",
            message: `Email notification skipped: ${result.error}`,
            details: { event_id: eventRow?.id, status: params.status },
          });
        }
      }
    } else {
      // Mark in-app as "delivered" immediately.
      if (eventRow?.id) {
        await supabase
          .from("notification_events")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", eventRow.id);
      }
    }
  } catch (err: any) {
    // Notifications must never break lifecycle.
    console.error("[notifyFromLifecycle] suppressed error:", err?.message ?? err);
  }
}
