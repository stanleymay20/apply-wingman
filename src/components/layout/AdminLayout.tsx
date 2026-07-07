import { ReactNode } from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { Layout } from "./Layout";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { cn } from "@/lib/utils";
import { Activity, AlertTriangle, Mail, HeartPulse, BrainCircuit } from "lucide-react";

const TABS = [
  { to: "/admin/runs", label: "Runs", icon: Activity },
  { to: "/admin/failures", label: "Failures", icon: AlertTriangle },
  { to: "/admin/delivery", label: "Delivery", icon: Mail },
  { to: "/admin/system-health", label: "System Health", icon: HeartPulse },
  { to: "/admin/ai-provider", label: "AI Provider", icon: BrainCircuit },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();
  const location = useLocation();

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Verifying admin access..." />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Observability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Truthful, real-time view of automation runs, failures, and delivery health.
          </p>
        </div>
        <nav className="flex gap-1 border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = location.pathname === tab.to;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
        <div>{children}</div>
      </div>
    </Layout>
  );
}
