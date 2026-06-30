import Link from "next/link";
import {
  getPortfolioSnapshot,
  PortfolioOverview,
  InvestmentsSourceError,
} from "@/modules/investments";
import { requireSession } from "@/lib/session";

// Datos en vivo del bróker: no cachear.
export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  await requireSession();
  let content;
  // Solo la llamada async va en el try; el JSX se construye fuera para no romper la
  // regla react-hooks/error-boundaries (React no renderiza el componente aquí, así que
  // un try/catch no atraparía errores de su render — los de la *carga* de datos sí).
  let snapshot;
  try {
    snapshot = await getPortfolioSnapshot();
  } catch (e) {
    const unauth = e instanceof InvestmentsSourceError && e.kind === "unauthenticated";
    content = (
      <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-5 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          {unauth ? "Sesión IBKR no autenticada" : "No se pudo leer el portafolio"}
        </p>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          {e instanceof InvestmentsSourceError ? e.message : String(e)}
        </p>
        <ol className="mt-3 list-decimal list-inside text-neutral-600 dark:text-neutral-400 space-y-1">
          <li>Arranca el gateway: <code>./cpgateway-run.sh</code> (en vida-adulta/finanzas/inversiones)</li>
          <li>Abre <a className="underline" href="https://localhost:5055" target="_blank" rel="noreferrer">https://localhost:5055</a> y loguéate</li>
          <li>Recarga esta página</li>
        </ol>
      </div>
    );
  }
  content ??= <PortfolioOverview snapshot={snapshot!} />;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">← Hub</Link>
          <h1 className="text-2xl font-semibold mt-1">Inversiones</h1>
        </div>
      </div>
      {content}
    </main>
  );
}
