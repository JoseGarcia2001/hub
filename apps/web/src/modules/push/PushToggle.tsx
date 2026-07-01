"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Send, Smartphone, BellMinus } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { subscribePush, unsubscribePush, sendTestPush } from "./actions";

// La clave pública VAPID llega en base64url; el navegador la exige como Uint8Array
// respaldado por un ArrayBuffer (no ArrayBufferLike, que incluiría SharedArrayBuffer).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState("unsupported");

      // iOS: el push solo existe cuando la PWA corre instalada (standalone).
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isIOS && !standalone) return setState("needs-install");

      const reg = await navigator.serviceWorker.register("/sw.js");
      if (Notification.permission === "denied") return setState("denied");
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })().catch((e) => setMsg(e instanceof Error ? e.message : "Error"));
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await subscribePush(sub.toJSON());
      if (!res.ok) return setMsg(res.error ?? "No se pudo activar");
      setState("on");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error activando");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    const r = await sendTestPush();
    setMsg(r.ok ? `Enviado a ${r.sent} dispositivo(s).` : r.error ?? "Error");
    setBusy(false);
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brass-dim text-brass">
          <BellRing size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Notificaciones</div>

          {state === "loading" && <p className="mt-1 text-sm text-muted">Comprobando…</p>}

          {state === "unsupported" && (
            <p className="mt-1 text-sm text-muted">
              Este navegador no soporta notificaciones push.
            </p>
          )}

          {state === "needs-install" && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Smartphone size={15} strokeWidth={1.75} className="shrink-0 text-faint" />
              Instala el Hub en tu pantalla de inicio (Compartir → Añadir a inicio) y ábrelo
              desde ahí para activar el push.
            </p>
          )}

          {state === "denied" && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-down">
              <BellMinus size={15} strokeWidth={1.75} className="shrink-0" />
              Bloqueadas. Habilítalas para el Hub en los ajustes del navegador.
            </p>
          )}

          {state === "off" && (
            <>
              <p className="mt-1 text-sm text-muted">Recibe avisos del Hub en este dispositivo.</p>
              <Button onClick={enable} disabled={busy} className="mt-3">
                <BellRing size={16} strokeWidth={2} />
                {busy ? "Activando…" : "Activar notificaciones"}
              </Button>
            </>
          )}

          {state === "on" && (
            <>
              <p className="mt-1 text-sm text-muted">Activas en este dispositivo.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={test} disabled={busy}>
                  <Send size={16} strokeWidth={2} />
                  {busy ? "…" : "Probar"}
                </Button>
                <Button variant="quiet" onClick={disable} disabled={busy}>
                  <BellOff size={16} strokeWidth={2} />
                  Desactivar
                </Button>
              </div>
            </>
          )}

          {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
        </div>
      </div>
    </Card>
  );
}
