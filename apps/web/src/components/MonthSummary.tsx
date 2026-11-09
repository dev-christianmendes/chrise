import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { buildMonthSummary, type MonthSummaryInput } from "@chrise/core";
import { Button } from "@/components/ui/button";
import { requestExplanation } from "@/lib/explain";
import { IS_DEMO } from "@/lib/repository";

/**
 * O resumo é sempre calculado localmente. A IA só pode reescrevê-lo em
 * produção: na demo o botão nem aparece, para não prometer o que não roda.
 */
export function MonthSummary({ input }: { input: MonthSummaryInput }) {
  const calculated = useMemo(() => buildMonthSummary(input), [input]);
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setRewritten(null), [calculated]);

  async function rewrite() {
    setLoading(true);
    const text = await requestExplanation(input);
    setLoading(false);

    if (!text) {
      toast.info("A IA não respondeu; mantivemos o resumo calculado.");
      return;
    }
    setRewritten(text);
  }

  return (
    <section className="surface animate-rise p-4 [animation-delay:150ms]" aria-label="Resumo do mês">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Resumo do mês</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rewritten ? "Reescrito pela IA a partir dos números calculados." : "Calculado a partir dos seus números."}
          </p>
        </div>
        {!IS_DEMO && (
          <Button size="sm" variant="ghost" onClick={rewrite} disabled={loading} className="shrink-0">
            <Sparkles />
            {loading ? "Reescrevendo…" : "Reescrever com IA"}
          </Button>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{rewritten ?? calculated}</p>
    </section>
  );
}
