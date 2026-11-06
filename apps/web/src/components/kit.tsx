import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Category, Cents } from "@chrise/core";
import { categoryIcon, groupColor } from "@/lib/category-style";
import { splitBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Valor monetário: inteiro em destaque, centavos menores. */
export function Money({
  value,
  sign,
  className,
  centsClassName,
}: {
  value: Cents;
  sign?: "+" | "−" | "auto";
  className?: string;
  centsClassName?: string;
}) {
  const prefix = sign === "auto" ? (value < 0 ? "−" : "") : (sign ?? "");
  const [int, cents] = splitBRL(Math.abs(value));
  return (
    <span className={cn("money whitespace-nowrap", className)}>
      {prefix}
      {int}
      <span className={cn("text-[0.62em] opacity-60", centsClassName)}>{cents}</span>
    </span>
  );
}

/** Ícone da categoria num "selo" com a cor do grupo. */
export function CategoryBadge({ category, size = "md", className }: { category?: Category; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = categoryIcon(category);
  const box = { sm: "h-8 w-8 rounded-[0.7rem]", md: "h-10 w-10 rounded-[0.85rem]", lg: "h-12 w-12 rounded-2xl" }[size];
  const icon = { sm: "h-4 w-4", md: "h-[1.15rem] w-[1.15rem]", lg: "h-5 w-5" }[size];
  return (
    <span
      className={cn("grid shrink-0 place-items-center", box, className)}
      style={{ background: groupColor(category?.group, 0.14), color: groupColor(category?.group) }}
    >
      <Icon className={icon} strokeWidth={2.2} />
    </span>
  );
}

/** Anel de progresso (SVG). `value` 0–1+; acima de 1 o anel fica cheio e na cor de alerta. */
export function Ring({
  value,
  size = 44,
  stroke = 5,
  color = "hsl(var(--income))",
  track = "hsl(var(--muted))",
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center">{children}</span>}
    </span>
  );
}

/** Minigráfico de linha, sem eixos: só a forma da tendência. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = "currentColor",
  dashedFrom,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Índice a partir do qual a linha é tracejada (previsão). */
  dashedFrom?: number;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const path = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join("");
  const split = dashedFrom ?? values.length - 1;
  const [lx, ly] = pts[pts.length - 1]!;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={path(0, split)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {split < values.length - 1 && (
        <path d={path(split, values.length - 1)} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.8} />
      )}
      <circle cx={lx} cy={ly} r={2.6} fill={color} />
    </svg>
  );
}

/** Cabeçalho de seção: título curto + link opcional "ver tudo". */
export function SectionTitle({ title, to, action = "Ver tudo", className }: { title: string; to?: string; action?: string; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3 px-1", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {to && (
        <Link to={to} className="inline-flex items-center gap-0.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          {action}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/** Cabeçalho de página: no celular é grande e "editorial"; o eyebrow dá contexto. */
export function PageTitle({ eyebrow, title, action, className }: { eyebrow?: string; title: string; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("mb-5 flex items-end justify-between gap-4 animate-rise", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-[1.9rem] font-semibold leading-none md:text-4xl">{title}</h1>
      </div>
      {action}
    </header>
  );
}
