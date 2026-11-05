import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { Insight, InsightLevel } from "@chrise/core";
import { cn } from "@/lib/utils";

const styles: Record<InsightLevel, { icon: typeof Info; className: string }> = {
  danger: { icon: OctagonAlert, className: "border-danger/30 bg-danger/10 text-danger" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning/10 text-warning" },
  info: { icon: Info, className: "border-info/30 bg-info/10 text-info" },
  positive: { icon: CheckCircle2, className: "border-success/30 bg-success/10 text-success" },
};

export function InsightList({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const items = limit ? insights.slice(0, limit) : insights;
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((ins) => {
        const { icon: Icon, className } = styles[ins.level];
        return (
          <li key={ins.id} className={cn("flex gap-3 rounded-lg border p-3", className)}>
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-sm">{ins.title}</p>
              <p className="text-sm text-foreground/80">{ins.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
