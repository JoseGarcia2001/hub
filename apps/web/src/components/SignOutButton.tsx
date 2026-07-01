"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="quiet"
      onClick={() => authClient.signOut().then(() => location.assign("/login"))}
    >
      Salir
    </Button>
  );
}
