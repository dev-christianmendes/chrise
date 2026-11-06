import { cn } from "@/lib/utils";

/** Marca: um "C" que é também um cofre aberto, com a seta de crescimento em limão. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="100" height="100" rx="28" fill="hsl(30 7% 11%)" />
      <rect x="0.75" y="0.75" width="98.5" height="98.5" rx="27.25" fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth="1.5" />
      <path d="M72 33 A27 27 0 1 0 72 67" fill="none" stroke="hsl(45 25% 93%)" strokeWidth="11" strokeLinecap="round" />
      <path d="M44 57 L54 47 L60 52 L77 35" fill="none" stroke="hsl(76 92% 62%)" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M68 31 L81 31 L81 44" fill="none" stroke="hsl(76 92% 62%)" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={compact ? "h-8 w-8" : "h-10 w-10"} />
      <span className="leading-none">
        <span className={cn("block font-display font-semibold tracking-tight", compact ? "text-lg" : "text-xl")}>chrise</span>
        {!compact && <span className="mt-1 block text-[11px] text-muted-foreground">finanças sem crise</span>}
      </span>
    </span>
  );
}
