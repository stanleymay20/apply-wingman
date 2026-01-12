import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Briefcase, 
  Upload, 
  BarChart3,
  Zap,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/applications", icon: Briefcase, label: "Applications" },
  { path: "/profile", icon: FileText, label: "My Profile" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
          <Zap className="w-6 h-6 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-foreground">ApplyPilot</h1>
            <p className="text-xs text-muted-foreground">Job Automation</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "nav-link",
                isActive && "active"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="animate-fade-in">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Status Indicator */}
      <div className={cn(
        "p-4 border-t border-sidebar-border",
        collapsed && "flex justify-center"
      )}>
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20",
          collapsed && "justify-center p-2"
        )}>
          <div className="pulse-dot" />
          {!collapsed && (
            <div className="animate-fade-in">
              <p className="text-sm font-medium text-success">Active</p>
              <p className="text-xs text-muted-foreground">Automation running</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
