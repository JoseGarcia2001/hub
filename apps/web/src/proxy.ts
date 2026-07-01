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
  // api/cron, api/portfolio y api/caja/ingest van protegidos por su propio bearer
  // secret, no por sesión. manifest + íconos son públicos: el navegador los pide
  // sin cookie (instalación/splash).
  matcher: [
    "/((?!login|api/auth|api/cron|api/portfolio|api/caja/ingest|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|apple-icon.png|icon-192.png|icon-512.png|sw.js).*)",
  ],
};
