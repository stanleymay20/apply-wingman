import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AuthError {
  code?: string;
  status?: number;
  message: string;
  timestamp: Date;
}

interface AuthDiagnosticsPanelProps {
  lastError: AuthError | null;
  className?: string;
}

export function AuthDiagnosticsPanel({ lastError, className }: AuthDiagnosticsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!lastError) return null;

  const getErrorExplanation = (error: AuthError) => {
    const code = error.code?.toLowerCase() || "";
    const message = error.message.toLowerCase();

    if (message.includes("invalid login credentials") || code === "invalid_credentials") {
      return {
        icon: XCircle,
        color: "text-destructive",
        title: "Invalid Credentials",
        explanation: "The email or password you entered is incorrect. Double-check your credentials or use the 'Forgot password?' link to reset.",
        suggestion: "Try the password recovery flow if you've forgotten your password.",
      };
    }

    if (message.includes("email not confirmed") || code === "email_not_confirmed") {
      return {
        icon: AlertTriangle,
        color: "text-warning",
        title: "Email Not Confirmed",
        explanation: "Your email address hasn't been verified yet. Check your inbox for a confirmation link.",
        suggestion: "Request a new confirmation email if you didn't receive one.",
      };
    }

    if (message.includes("user not found") || code === "user_not_found") {
      return {
        icon: Info,
        color: "text-muted-foreground",
        title: "Account Not Found",
        explanation: "No account exists with this email address.",
        suggestion: "Create a new account using the 'Sign Up' tab.",
      };
    }

    if (message.includes("already registered") || code === "user_already_exists") {
      return {
        icon: AlertTriangle,
        color: "text-warning",
        title: "Account Already Exists",
        explanation: "An account with this email already exists.",
        suggestion: "Use the 'Sign In' tab to log in, or reset your password if forgotten.",
      };
    }

    if (message.includes("rate limit") || code === "rate_limit") {
      return {
        icon: AlertTriangle,
        color: "text-warning",
        title: "Too Many Attempts",
        explanation: "You've made too many login attempts. Please wait before trying again.",
        suggestion: "Wait a few minutes before trying again.",
      };
    }

    if (message.includes("network") || message.includes("fetch")) {
      return {
        icon: AlertTriangle,
        color: "text-warning",
        title: "Network Error",
        explanation: "Unable to connect to the authentication server.",
        suggestion: "Check your internet connection and try again.",
      };
    }

    return {
      icon: XCircle,
      color: "text-destructive",
      title: "Authentication Error",
      explanation: error.message,
      suggestion: "If this persists, try clearing your browser cache or contact support.",
    };
  };

  const errorInfo = getErrorExplanation(lastError);
  const Icon = errorInfo.icon;

  return (
    <div className={cn("rounded-lg border bg-background/50 overflow-hidden", className)}>
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between p-3 h-auto"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", errorInfo.color)} />
          <span className="text-sm font-medium">{errorInfo.title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </Button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">{errorInfo.explanation}</p>
            <p className="text-primary font-medium">{errorInfo.suggestion}</p>
          </div>

          <div className="rounded bg-muted/50 p-2 space-y-1 font-mono text-xs">
            {lastError.code && (
              <div className="flex gap-2">
                <span className="text-muted-foreground">Code:</span>
                <span className="text-foreground">{lastError.code}</span>
              </div>
            )}
            {lastError.status && (
              <div className="flex gap-2">
                <span className="text-muted-foreground">Status:</span>
                <span className="text-foreground">{lastError.status}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-muted-foreground">Time:</span>
              <span className="text-foreground">
                {lastError.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { AuthError };
