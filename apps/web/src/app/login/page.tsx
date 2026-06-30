"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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

  const field =
    "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm";

  return (
    <main className="flex-1 grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/15 p-8">
        <h1 className="text-xl font-semibold text-center">Hub personal</h1>
        <p className="mt-2 text-sm text-neutral-500 text-center">Acceso privado.</p>

        {/* Solo sign-in. El registro público está deshabilitado (disableSignUp en el
            server): las cuentas se provisionan fuera de banda. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            signIn();
          }}
          className="mt-6 space-y-3"
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "…" : "Entrar"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-neutral-400">
          <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />o
          <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
        </div>

        <button
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
          className="w-full rounded-lg border border-black/10 dark:border-white/15 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
        >
          Continuar con Google
        </button>
      </div>
    </main>
  );
}
