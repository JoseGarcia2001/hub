import Link from "next/link";
import { investments } from "@hub/core";
import { PortfolioOverview } from "@/modules/investments";
import { requireSession } from "@/lib/session";

// El snapshot cambia con cada ingesta: no cachear la lectura.
export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const session = await requireSession();
  const snapshot = await investments.getLatestSnapshot(session.user.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Hub
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Inversiones</h1>
      </div>

      {snapshot ? (
        <PortfolioOverview snapshot={snapshot} />
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-5 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Aún no hay datos del portafolio
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            La ingesta automática (Flex) todavía no ha corrido o falta configurarla. Cuando corra,
            esta vista se llena sola con el último snapshot — sin depender de ningún equipo encendido.
          </p>
        </div>
      )}
    </main>
  );
}
