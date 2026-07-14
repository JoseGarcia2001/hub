import { PageSkeleton } from "@/components/ui";

/** Esqueleto prefetcheable: feedback instantáneo al navegar (regla Latón). */
export default function Loading() {
  return <PageSkeleton stats={0} rows={5} />;
}
