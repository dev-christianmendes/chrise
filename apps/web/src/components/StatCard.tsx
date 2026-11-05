import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "danger" | "info" | "warning";
}

const tone = {
  default: "text-primary",
  success: "text-success",
  danger: "text-danger",
  info: "text-info",
  warning: "text-warning",
};

export function StatCard({ title, value, hint, icon: Icon, variant = "default" }: StatCardProps) {
  return (
    <Card className="p-3 sm:p-4 md:p-5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground">{title}</p>
          <p className={cn("text-lg sm:text-xl 2xl:text-2xl font-bold tabular-nums tracking-tight whitespace-nowrap", variant !== "default" && tone[variant])}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={cn("hidden sm:block p-2 rounded-lg bg-muted shrink-0", tone[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}
