import { Wallet } from "lucide-react";
import { caja } from "@hub/core";
import { CajaBoard } from "@/modules/caja";
import { PageHeader, EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/session";

// Cada correo cambia la caja: no cachear la lectura.
export const dynamic = "force-dynamic";

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { user } = await requireSession();
  const { mes } = await searchParams;
  const view = await caja.monthlyView(user.id, mes);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="Caja" back subtitle="Ingresos y egresos, en automático desde tus correos." />

      {view.rows.length === 0 ? (
        <EmptyState tone="brass" icon={<Wallet size={20} />} title="Aún no hay transacciones">
          Cuando llegue el primer correo de Rappi (o corras el backfill histórico), esta vista se llena
          sola — sin que subas nada.
        </EmptyState>
      ) : (
        <CajaBoard view={view} />
      )}
    </main>
  );
}
