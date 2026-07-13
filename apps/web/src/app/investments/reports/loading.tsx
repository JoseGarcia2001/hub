import { PageSkeleton } from "@/components/ui";

/** Esqueleto prefetcheable: feedback instantáneo al navegar (regla Latón). */
export default function Loading() {
  return <PageSkeleton stats={4} rows={6} />;
}
