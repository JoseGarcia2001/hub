"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    const res = await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "No se pudo entrar.");
      return;
    }
    router.push("/");
  }

  return (
    <main className="relative grid flex-1 place-items-center overflow-hidden px-4 py-10">
      {/* Colorimetría: luz cálida de latón desde arriba + resplandor difuso.
          Solo análogos del acento — nada que pelee con el ground cálido. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_55%_at_50%_-10%,var(--brass-dim),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--brass-dim),transparent_62%)] opacity-70 blur-3xl"
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-line-2 bg-surface/90 p-6 shadow-2xl ring-1 ring-brass/10 backdrop-blur-sm sm:p-8">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-brass font-display text-lg font-bold text-ink shadow-lg shadow-brass/20">
          H
        </div>
        <p className="mt-5 text-center font-mono text-xs uppercase tracking-[0.2em] text-brass">
          Acceso privado
        </p>
        <h1 className="mt-1 text-center font-display text-2xl font-bold tracking-tight">
          Hub personal
        </h1>

        {/* Solo sign-in. El registro público está deshabilitado (disableSignUp en el
            server): las cuentas se provisionan fuera de banda. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            signIn();
          }}
          className="mt-7 space-y-3"
        >
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-down">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full py-3">
            {pending ? "…" : "Entrar"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" />o
          <span className="h-px flex-1 bg-line" />
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full py-3"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
        >
          Continuar con Google
        </Button>
      </div>
    </main>
  );
}
