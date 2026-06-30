"use client";

import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  return (
    <main className="flex-1 grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/15 p-8 text-center">
        <h1 className="text-xl font-semibold">Hub personal</h1>
        <p className="mt-2 text-sm text-neutral-500">Acceso privado.</p>
        <button
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
          className="mt-6 w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
        >
          Continuar con Google
        </button>
      </div>
    </main>
  );
}
