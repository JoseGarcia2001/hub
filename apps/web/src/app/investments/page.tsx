import { investments } from "@hub/core";
import { PortfolioOverview } from "@/modules/investments";
import { Inbox } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/session";

// El snapshot cambia con cada ingesta: no cachear la lectura.
export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const session = await requireSession();
  const snapshot = await investments.getLatestSnapshot(session.user.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="Inversiones" back />

      {snapshot ? (
        <PortfolioOverview snapshot={snapshot} />
      ) : (
        <EmptyState tone="brass" icon={<Inbox size={20} />} title="Aún no hay datos del portafolio">
          La ingesta automática (Flex) todavía no ha corrido o falta configurarla. Cuando corra,
          esta vista se llena sola con el último snapshot — sin depender de ningún equipo encendido.
        </EmptyState>
      )}
    </main>
  );
}
