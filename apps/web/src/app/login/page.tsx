"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button, Input } from "@/components/ui";

// Logo oficial "G" de Google (multicolor). Un solo uso → vive aquí.
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

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
        <p className="mt-5 flex items-center justify-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-brass">
          <Lock size={11} strokeWidth={2.5} />
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
          <GoogleG />
          Continuar con Google
        </Button>
      </div>
    </main>
  );
}
