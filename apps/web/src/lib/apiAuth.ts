import { timingSafeEqual } from "node:crypto";

/**
 * Auth máquina-a-máquina (cron, agentes) por bearer, contra INGEST_SECRET.
 * Constant-time. Sin el secret configurado, todo request se rechaza.
 */
export function bearerOk(req: Request): boolean {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
