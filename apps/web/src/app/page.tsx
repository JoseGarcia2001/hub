import Link from "next/link";
import { LineChart, ListChecks, Wallet, Bike, HeartPulse, ArrowRight, type LucideIcon } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { requireSession } from "@/lib/session";

const MODULES: { href: string; title: string; desc: string; ready: boolean; icon: LucideIcon }[] = [
  { href: "/investments", title: "Inversiones", desc: "Portafolio IBKR en vivo: NAV, posiciones, P&L", ready: true, icon: LineChart },
  { href: "/pendientes", title: "Pendientes", desc: "Tareas con fecha límite", ready: true, icon: ListChecks },
  { href: "#", title: "Finanzas", desc: "Cuentas, tarjetas, gastos, presupuesto", ready: false, icon: Wallet },
  { href: "#", title: "Vehículos", desc: "Moto: SOAT, tecnomecánica, impuestos", ready: false, icon: Bike },
  { href: "#", title: "Salud", desc: "EPS, citas, tratamientos", ready: false, icon: HeartPulse },
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
        {MODULES.map((m) => {
          const Icon = m.icon;
          const chip = (
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-brass-dim text-brass">
              <Icon size={20} strokeWidth={1.75} />
            </div>
          );
          return m.ready ? (
            <Link key={m.title} href={m.href} className="group block">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-line-2">
                {chip}
                <div className="font-semibold">{m.title}</div>
                <div className="mt-1 text-sm text-muted">{m.desc}</div>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brass">
                  Abrir <ArrowRight size={14} strokeWidth={2} />
                </div>
              </Card>
            </Link>
          ) : (
            <Card key={m.title} className="h-full opacity-60">
              {chip}
              <div className="font-semibold">{m.title}</div>
              <div className="mt-1 text-sm text-muted">{m.desc}</div>
              <div className="mt-3 text-xs uppercase tracking-wide text-faint">Próximamente</div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
