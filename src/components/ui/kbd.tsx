import { cn } from "@/lib/utils";

interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5",
        "rounded border border-border bg-muted",
        "text-xs font-medium text-muted-foreground",
        "shadow-[0_1px_0_1px_hsl(var(--border))]",
        className
      )}
    >
      {children}
    </kbd>
  );
}
