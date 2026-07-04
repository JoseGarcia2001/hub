import { Skeleton } from "@/components/ui";

// Silueta del board de Caja: header + tendencia + KPIs + lista (sin salto de layout).
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-2 h-9 w-32" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </main>
  );
}
