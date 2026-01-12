import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Briefcase, 
  BarChart3,
  Zap,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const { profile, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const automationStatus = profile?.automation_status || "paused";

  const statusConfig = {
    running: {
      bg: "bg-success/10",
      border: "border-success/20",
      dot: "pulse-dot",
      label: "Active",
      sublabel: "Automation running",
    },
    paused: {
      bg: "bg-warning/10",
      border: "border-warning/20",
      dot: "w-2 h-2 rounded-full bg-warning",
      label: "Paused",
      sublabel: "Automation paused",
    },
    stopped: {
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      dot: "w-2 h-2 rounded-full bg-destructive",
      label: "Stopped",
      sublabel: "Emergency stop",
    },
  };

  const status = statusConfig[automationStatus];

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

      {/* User Info */}
      {!collapsed && profile && (
        <div className="px-6 py-4 border-b border-sidebar-border">
          <p className="text-sm font-medium text-foreground truncate">
            {profile.full_name || profile.email}
          </p>
          <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
        </div>
      )}

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

      {/* Notifications */}
      <div className="px-4 pb-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative",
              collapsed && "justify-center"
            )}>
              <Bell className="w-5 h-5" />
              {!collapsed && <span>Notifications</span>}
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => markAllAsRead()}>
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No notifications</p>
              ) : (
                notifications.slice(0, 10).map((notif) => (
                  <div 
                    key={notif.id}
                    className={cn(
                      "p-4 border-b last:border-0 cursor-pointer hover:bg-secondary/50",
                      !notif.is_read && "bg-primary/5"
                    )}
                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                  >
                    <p className="font-medium text-sm">{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
          "flex items-center gap-3 p-3 rounded-lg border",
          status.bg,
          status.border,
          collapsed && "justify-center p-2"
        )}>
          <div className={status.dot} />
          {!collapsed && (
            <div className="animate-fade-in">
              <p className="text-sm font-medium text-foreground">{status.label}</p>
              <p className="text-xs text-muted-foreground">{status.sublabel}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
