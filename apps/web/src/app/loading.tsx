import { Skeleton } from "@/components/ui";

// Home: grid de cards de módulos.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
