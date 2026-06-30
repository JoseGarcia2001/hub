import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/SignOutButton";
import { requireSession } from "@/lib/session";

const MODULES: { href: string; title: string; desc: string; ready: boolean }[] = [
  { href: "/investments", title: "Inversiones", desc: "Portafolio IBKR en vivo: NAV, posiciones, P&L", ready: true },
  { href: "/pendientes", title: "Pendientes", desc: "Tareas con fecha límite", ready: true },
  { href: "#", title: "Finanzas", desc: "Cuentas, tarjetas, gastos, presupuesto", ready: false },
  { href: "#", title: "Vehículos", desc: "Moto: SOAT, tecnomecánica, impuestos", ready: false },
  { href: "#", title: "Salud", desc: "EPS, citas, tratamientos", ready: false },
];

export default async function Home() {
  await requireSession();
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Hub personal</h1>
          <p className="mt-1 text-neutral-500">Todo lo tuyo, en un solo lugar.</p>
        </div>
        <SignOutButton />
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {MODULES.map((m) =>
          m.ready ? (
            <Link key={m.title} href={m.href} className="block transition hover:scale-[1.01]">
              <Card className="h-full">
                <div className="font-medium">{m.title}</div>
                <div className="mt-1 text-sm text-neutral-500">{m.desc}</div>
                <div className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">Abrir →</div>
              </Card>
            </Link>
          ) : (
            <Card key={m.title} className="h-full opacity-60">
              <div className="font-medium">{m.title}</div>
              <div className="mt-1 text-sm text-neutral-500">{m.desc}</div>
              <div className="mt-3 text-xs uppercase tracking-wide text-neutral-400">Próximamente</div>
            </Card>
          ),
        )}
      </div>
    </main>
  );
}
