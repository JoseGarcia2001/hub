import { FileText } from "lucide-react";
import { reports } from "@hub/core";
import { ReportView, WeekPicker } from "@/modules/investments";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";

// Los informes llegan por m2m (POST del agente asesor): no cachear la lectura.
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await requireSession();
  const { week } = await searchParams;

  const [weeks, report] = await Promise.all([
    reports.listWeeks(session.user.id),
    week ? reports.getByWeek(session.user.id, week) : reports.getLatest(session.user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="Informe semanal" back />

      {report ? (
        <>
          <WeekPicker weeks={weeks} current={report.week} />
          <ReportView report={report} />
        </>
      ) : (
        <EmptyState tone="brass" icon={<FileText size={20} />} title="Aún no hay informes">
          El informe lo genera la sesión del asesor de inversiones (skill{" "}
          <code className="font-mono">informe-portafolio</code>) y lo publica aquí. Corre el primero
          y esta página se llena sola.
        </EmptyState>
      )}
    </main>
  );
}
