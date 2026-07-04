/** Placeholder de carga (loading.tsx). Solo tokens: superficie inset + pulso. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

/** Esqueleto de página estándar: título + subtítulo + grid de stats + card de lista.
 *  Cubre la anatomía común de las pantallas del hub; los loading.tsx lo parametrizan. */
export function PageSkeleton({ stats = 3, rows = 5 }: { stats?: number; rows?: number }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-2 h-9 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      {stats > 0 && (
        <div className={`grid gap-3 ${stats >= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
          {Array.from({ length: stats }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    </main>
  );
}
