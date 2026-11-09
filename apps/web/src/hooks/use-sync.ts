import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IS_DEMO, syncPending } from "@/lib/repository";
import { keys } from "./use-finance";

/** Ao abrir o app ou voltar a rede, drena a fila offline e atualiza o extrato. */
export function useOutboxSync() {
  const qc = useQueryClient();

  useEffect(() => {
    if (IS_DEMO) return;

    let active = true;
    const run = async () => {
      try {
        const result = await syncPending();
        if (!active || result.synced === 0) return;
        await qc.invalidateQueries({ queryKey: keys.transactions });
        const plural = result.synced > 1 ? "s" : "";
        toast.success(`${result.synced} lançamento${plural} sincronizado${plural}`);
      } catch {
        /* storage/rede indisponível: tenta de novo no próximo evento online */
      }
    };

    void run();
    window.addEventListener("online", run);
    return () => {
      active = false;
      window.removeEventListener("online", run);
    };
  }, [qc]);
}
