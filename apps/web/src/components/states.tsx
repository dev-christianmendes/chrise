import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
      Não foi possível carregar os dados: {error instanceof Error ? error.message : String(error)}
    </div>
  );
}
