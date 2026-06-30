import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next 16: "proxy" reemplaza a "middleware" (mismo comportamiento).
export function proxy(request: NextRequest) {
  // ponytail: chequeo optimista de cookie (sin tocar DB en edge), solo para el redirect.
  // La validación real de la sesión la hace requireSession() en el server.
  const session = getSessionCookie(request);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // api/cron va protegido por su propio bearer secret, no por sesión de navegador.
  matcher: ["/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
