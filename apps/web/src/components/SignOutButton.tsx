"use client";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      onClick={() => authClient.signOut().then(() => location.assign("/login"))}
      className="text-sm text-neutral-500 hover:underline"
    >
      Salir
    </button>
  );
}
