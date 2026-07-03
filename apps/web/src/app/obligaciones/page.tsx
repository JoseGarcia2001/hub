import { CalendarClock } from "lucide-react";
import { obligaciones } from "@hub/core";
import { ObligacionesBoard } from "@/modules/obligaciones";
import { PageHeader, EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/session";

// La reconciliación y la ingesta cambian los datos fuera de las actions → no cachear.
export const dynamic = "force-dynamic";

export default async function ObligacionesPage() {
  const { user } = await requireSession();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const data = await obligaciones.overview(user.id, today);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="Obligaciones" back subtitle="Servicios y moto: qué debes, cuándo vence y si ya lo pagaste." />

      {data.items.length === 0 ? (
        <EmptyState tone="brass" icon={<CalendarClock size={20} />} title="Aún no hay obligaciones con datos">
          Siembra el catálogo (POST <span className="font-mono">/api/obligaciones/seed</span>) y deja que lleguen las
          facturas: esta vista se llena sola y te avisa antes de cada vencimiento.
        </EmptyState>
      ) : (
        <ObligacionesBoard overview={data} />
      )}
    </main>
  );
}
