import { PageSkeleton } from "@/components/ui";

// Se prefetchea con el <Link> → feedback instantáneo mientras streamea la página dinámica.
export default function Loading() {
  return <PageSkeleton stats={2} rows={5} />;
}
