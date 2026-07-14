import Link from "next/link";
import { FileBarChart, ArrowRight } from "lucide-react";
import { documents } from "@hub/core";
import { Card, EmptyState, Pill, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { since } from "@/lib/format";

// Los documentos llegan por m2m (POST del productor): no cachear la lista.
export const dynamic = "force-dynamic";

/** Etiqueta legible por familia de documento; cae al slug si es un kind nuevo. */
const KIND_LABEL: Record<string, string> = {
  superinvestors: "Superinversores",
  "informe-semanal": "Informe semanal",
  analysis: "Análisis",
};

export default async function AnalisisPage() {
  const session = await requireSession();
  const docs = await documents.list(session.user.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="Análisis" back />

      {docs.length > 0 ? (
        <div className="space-y-3">
          {docs.map((d) => (
            <Link key={d.slug} href={`/investments/analisis/${d.slug}`} className="group block">
              <Card className="transition group-hover:-translate-y-0.5 group-hover:border-line-2">
                <div className="flex items-center gap-2">
                  <Pill tone="ghost">{KIND_LABEL[d.kind] ?? d.kind}</Pill>
                  <span className="ml-auto font-mono text-xs text-faint">
                    {since(d.generatedAt.toISOString())}
                  </span>
                </div>
                <h2 className="mt-2 text-balance font-display text-lg font-semibold">{d.title}</h2>
                <p className="mt-1 text-sm text-muted">{d.summary}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brass">
                  Abrir <ArrowRight size={14} strokeWidth={2} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState tone="brass" icon={<FileBarChart size={20} />} title="Aún no hay análisis">
          Los análisis y documentos los publica una sesión del asesor por m2m y aparecen aquí. Cuando
          corra el primero, esta lista se llena sola.
        </EmptyState>
      )}
    </main>
  );
}
