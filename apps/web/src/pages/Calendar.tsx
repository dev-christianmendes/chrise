import { useMemo } from "react";
import { CalendarDays, FileText, Landmark, type LucideIcon } from "lucide-react";
import {
  buildFiscalCalendar,
  simplesForMonth,
  type FiscalEvent,
  type FiscalEventKind,
  type FiscalEventStatus,
} from "@chrise/core";
import { Money, PageTitle } from "@/components/kit";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useSnapshot } from "@/hooks/use-finance";
import { monthName, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND: Record<FiscalEventKind, { icon: LucideIcon; label: string; tone: string }> = {
  das: { icon: Landmark, label: "DAS", tone: "text-[hsl(var(--g-impostos))]" },
  defis: { icon: FileText, label: "DEFIS", tone: "text-warning" },
  irpf: { icon: FileText, label: "IRPF", tone: "text-info" },
};

const STATUS_STYLE: Record<FiscalEventStatus, string> = {
  overdue: "bg-danger/15 text-danger",
  today: "bg-warning/15 text-warning",
  upcoming: "bg-muted text-muted-foreground",
};

const MONTH_SHORT = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

const dateLabel = (iso: string) => DAY_MONTH.format(new Date(`${iso}T12:00:00`)).replace(".", "");

function statusLabel(event: FiscalEvent): string {
  if (event.status === "overdue") {
    return event.daysUntil === -1 ? "atrasado há 1 dia" : `atrasado há ${Math.abs(event.daysUntil)} dias`;
  }
  if (event.status === "today") return "vence hoje";
  return event.daysUntil === 1 ? "amanhã" : `em ${event.daysUntil} dias`;
}

function groupLabel(ym: string): string {
  return `${monthName(ym)} de ${ym.slice(0, 4)}`;
}

export default function Calendar() {
  const { snapshot, isLoading, error } = useSnapshot();

  const model = useMemo(() => {
    if (!snapshot) return null;
    const today = todayISO();
    const events = buildFiscalCalendar({
      today,
      months: 12,
      lookbackDays: 30,
      dasAmountFor: (referenceMonth) => {
        const das = simplesForMonth(snapshot, referenceMonth).das;
        return das > 0 ? das : undefined;
      },
    });

    const grouped = new Map<string, FiscalEvent[]>();
    for (const event of events) {
      const key = event.dueDate.slice(0, 7);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }

    return { today, events, groups: [...grouped.entries()] };
  }, [snapshot]);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !model || !snapshot) return <PageSkeleton />;

  const { today, events, groups } = model;
  const overdue = events.filter((event) => event.status === "overdue").length;
  const next = events.find((event) => event.status !== "overdue");
  const thisMonth = events.filter((event) => event.dueDate.slice(0, 7) === today.slice(0, 7)).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle eyebrow={`Simples Nacional · ${groupLabel(today.slice(0, 7))}`} title="Calendário fiscal" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <section className="surface animate-rise p-4" aria-label="Próximo vencimento">
          <p className="text-xs text-muted-foreground">Próximo vencimento</p>
          <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {next ? `${KIND[next.kind].label} · ${dateLabel(next.dueDate)}` : "Nada à vista"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{next ? statusLabel(next) : "Sem eventos no horizonte."}</p>
        </section>

        <section className="surface animate-rise p-4 [animation-delay:60ms]" aria-label="Vencimentos atrasados">
          <p className="text-xs text-muted-foreground">Em atraso</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", overdue > 0 ? "text-danger" : "text-foreground")}>{overdue}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{overdue === 1 ? "evento nos últimos 30 dias" : "eventos nos últimos 30 dias"}</p>
        </section>

        <section className="surface animate-rise p-4 [animation-delay:120ms]" aria-label="Vencimentos deste mês">
          <p className="text-xs text-muted-foreground">Neste mês</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{thisMonth}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{thisMonth === 1 ? "evento até o fim do mês" : "eventos até o fim do mês"}</p>
        </section>
      </div>

      <section className="mt-8 animate-rise [animation-delay:180ms]">
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="text-lg font-semibold">Próximos vencimentos</h2>
          <span className="text-xs text-muted-foreground">próximos 12 meses</span>
        </div>

        {groups.length === 0 ? (
          <p className="surface p-6 text-center text-sm text-muted-foreground">Nenhum vencimento no horizonte.</p>
        ) : (
          <div className="space-y-6">
            {groups.map(([ym, items]) => (
              <section key={ym}>
                <h3 className="mb-2 px-1 text-sm font-semibold capitalize text-muted-foreground">{groupLabel(ym)}</h3>
                <ul className="surface divide-y divide-border">
                  {items.map((event) => (
                    <FiscalRow key={event.id} event={event} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <p className="mt-6 px-1 text-xs leading-relaxed text-muted-foreground">
        Datas de referência: DAS no dia 20 do mês seguinte; DEFIS em 31/03 e IRPF em 30/04. Feriados, prorrogações e mudanças de calendário não são
        considerados — confirme no portal oficial.
      </p>
    </div>
  );
}

function FiscalRow({ event }: { event: FiscalEvent }) {
  const meta = KIND[event.kind];
  const Icon = meta.icon;
  const [, month, day] = event.dueDate.split("-");

  return (
    <li className="flex gap-3 p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted text-center">
        <span className="text-lg font-semibold leading-none tabular-nums">{day}</span>
        <span className="text-[10px] uppercase text-muted-foreground">
          {MONTH_SHORT.format(new Date(`${event.dueDate}T12:00:00`)).replace(".", "")}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Icon className={cn("h-4 w-4 shrink-0", meta.tone)} />
              {event.title}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {event.referenceLabel} · {event.note}
            </p>
          </div>
          {event.amount !== undefined && <Money value={event.amount} className="shrink-0 text-sm font-semibold" />}
        </div>
        <span className={cn("mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[event.status])}>
          {statusLabel(event)}
        </span>
      </div>
    </li>
  );
}
