import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Briefcase, 
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Bell,
  Menu,
  X,
  Command,
  Search,
  Activity,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import logoImage from "@/assets/logo.png";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/jobs", icon: Search, label: "Jobs" },
  { path: "/applications", icon: Briefcase, label: "Applications" },
  { path: "/activity", icon: Activity, label: "Activity Log" },
  { path: "/profile", icon: FileText, label: "My Profile" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile]);

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

  const status = statusConfig[automationStatus as keyof typeof statusConfig] || statusConfig.paused;

  // Logo Component
  const Logo = ({ showText = true }: { showText?: boolean }) => (
    <div className="flex items-center gap-3">
      <img 
        src={logoImage} 
        alt="ApplyPilot" 
        className="w-10 h-10 object-contain"
      />
      {showText && (
        <div className="animate-fade-in">
          <h1 className="text-xl font-bold">
            <span className="text-foreground">Apply</span>
            <span className="text-primary">Pilot</span>
          </h1>
          <p className="text-xs text-muted-foreground">Job Automation</p>
        </div>
      )}
    </div>
  );

  // Mobile hamburger button
  if (isMobile) {
    return (
      <>
        {/* Mobile Header Bar */}
        <header className="fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImage} alt="ApplyPilot" className="w-8 h-8 object-contain" />
            <span className="text-lg font-bold">
              <span className="text-foreground">Apply</span>
              <span className="text-primary">Pilot</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <NotificationsContent 
                  notifications={notifications}
                  unreadCount={unreadCount}
                  markAsRead={markAsRead}
                  markAllAsRead={markAllAsRead}
                />
              </PopoverContent>
            </Popover>

            {/* Menu Toggle */}
            <button 
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 pt-16"
            onClick={() => setMobileOpen(false)}
          >
            <aside 
              className="absolute top-16 right-0 w-64 h-[calc(100vh-4rem)] bg-sidebar border-l border-sidebar-border flex flex-col animate-in slide-in-from-right"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User Info */}
              {profile && (
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
                      className={cn("nav-link", isActive && "active")}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Status */}
              <div className="p-4 border-t border-sidebar-border">
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  status.bg,
                  status.border
                )}>
                  <div className={status.dot} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{status.label}</p>
                    <p className="text-xs text-muted-foreground">{status.sublabel}</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Spacer for fixed header */}
        <div className="h-16" />
      </>
    );
  }

  // Desktop Sidebar
  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
        <Link to="/">
          <Logo showText={!collapsed} />
        </Link>
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
                isActive && "active",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="animate-fade-in">{item.label}</span>
              )}
            </Link>
          );
        })}

        {/* Quick Actions Hint */}
        {!collapsed && (
          <button
            onClick={() => {
              const event = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
            }}
            className="nav-link mt-4 border border-dashed border-border/50 hover:border-primary/50"
          >
            <Command className="w-4 h-4" />
            <span className="flex-1">Quick Actions</span>
            <div className="flex items-center gap-0.5">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </div>
          </button>
        )}
      </nav>

      {/* Notifications */}
      <div className="px-4 pb-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative",
              collapsed && "justify-center px-2"
            )}>
              <Bell className="w-5 h-5" />
              {!collapsed && <span>Notifications</span>}
              {unreadCount > 0 && (
                <span className={cn(
                  "absolute w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center",
                  collapsed ? "top-0 right-1" : "top-1 right-1"
                )}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <NotificationsContent 
              notifications={notifications}
              unreadCount={unreadCount}
              markAsRead={markAsRead}
              markAllAsRead={markAllAsRead}
            />
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

// Extracted notification content component
function NotificationsContent({ 
  notifications, 
  unreadCount, 
  markAsRead, 
  markAllAsRead 
}: {
  notifications: any[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}) {
  return (
    <>
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
          notifications.slice(0, 15).map((notif) => {
            const sev = (notif.data?.severity as string) || "info";
            const appId = notif.data?.application_id as string | undefined;
            const sevDot =
              sev === "error" ? "bg-destructive" :
              sev === "warning" ? "bg-yellow-500" :
              sev === "success" ? "bg-green-500" : "bg-muted-foreground";
            return (
              <div
                key={notif.id}
                className={cn(
                  "p-4 border-b last:border-0 cursor-pointer hover:bg-secondary/50 transition-colors",
                  !notif.is_read && "bg-primary/5"
                )}
                onClick={() => {
                  if (!notif.is_read) markAsRead(notif.id);
                  if (appId) window.location.href = `/applications?app=${appId}`;
                }}
              >
                <div className="flex items-start gap-2">
                  <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", sevDot)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {notif.created_at
                        ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })
                        : "Recently"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
