import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
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
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        title="Hub personal"
        subtitle="Todo lo tuyo, en un solo lugar."
        action={<SignOutButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((m) =>
          m.ready ? (
            <Link key={m.title} href={m.href} className="group block">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-line-2">
                <div className="font-semibold">{m.title}</div>
                <div className="mt-1 text-sm text-muted">{m.desc}</div>
                <div className="mt-3 text-sm font-medium text-brass">Abrir →</div>
              </Card>
            </Link>
          ) : (
            <Card key={m.title} className="h-full opacity-60">
              <div className="font-semibold">{m.title}</div>
              <div className="mt-1 text-sm text-muted">{m.desc}</div>
              <div className="mt-3 text-xs uppercase tracking-wide text-faint">Próximamente</div>
            </Card>
          ),
        )}
      </div>
    </main>
  );
}
