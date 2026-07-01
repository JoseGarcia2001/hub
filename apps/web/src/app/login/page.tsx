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
    <main className="grid flex-1 place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-center font-display text-2xl font-bold tracking-tight">Hub personal</h1>
        <p className="mt-2 text-center text-sm text-muted">Acceso privado.</p>

        {/* Solo sign-in. El registro público está deshabilitado (disableSignUp en el
            server): las cuentas se provisionan fuera de banda. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            signIn();
          }}
          className="mt-6 space-y-3"
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
          <Button type="submit" disabled={pending} className="w-full">
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
          className="w-full"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
        >
          Continuar con Google
        </Button>
      </div>
    </main>
  );
}
