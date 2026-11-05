import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-lg font-bold tracking-tight">Chrise</span>
          <span className="block text-[11px] text-muted-foreground">finanças sem crise</span>
        </span>
      )}
    </span>
  );
}
