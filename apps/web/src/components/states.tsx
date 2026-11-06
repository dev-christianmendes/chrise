import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2 px-1">
        <Skeleton className="h-3 w-40 rounded-full" />
        <Skeleton className="h-8 w-52 rounded-full" />
      </div>
      <Skeleton className="h-64 rounded-[1.5rem]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="mt-2 space-y-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
      Não foi possível carregar os dados: {error instanceof Error ? error.message : String(error)}
    </div>
  );
}
