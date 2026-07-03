import assert from "node:assert/strict";
import { parseFactura } from "./parseFactura";
import { matchPago, ventana } from "./match";

/**
 * Self-check del parser de facturas + el matcher (sin DB ni red). Fixture = texto real
 * de la factura digital de ENEL. Cubre lo no trivial: monto/vencimiento/cuenta, y la
 * correlación por monto exacto que desenmascara el gateway.
 * Correr:  pnpm --filter @hub/core selfcheck:obligaciones
 */

const ENEL_FACTURA = { subject: "Enel Colombia - Factura Digital", text:
`Enel Colombia
Tu número de Cliente 7487178 - 4
N° Factura: 400008379-9 Fecha: 26 JUN/2026
¡Hola, Jose Anibal Garcia Giraldo!
Tu total a pagar:
$148.730
$103.280
$45.450
Pago oportuno
10 JUL /2026
Tu consumo este mes fue de 123 kWh` };

// --- parseo de factura ENEL ---
const f = parseFactura(ENEL_FACTURA)!;
assert.equal(f.proveedorKey, "enel");
assert.equal(f.monto, 148730); // total a pagar, NO los subtotales de abajo
assert.equal(f.fechaVencimiento, "2026-07-10"); // "10 JUL /2026"
assert.equal(f.fechaEmision, "2026-06-26"); // "26 JUN/2026"
assert.equal(f.cuentaContrato, "7487178-4");
assert.equal(f.periodo, "2026-06"); // mes de emisión

// no-parse: correo que no es factura reconocida
assert.equal(parseFactura({ subject: "Promo", text: "Aprovecha nuestros seguros" }), null);

// --- ventana de correlación ---
const inst = { montoEsperado: 148730, fechaEmision: "2026-06-26", fechaVencimiento: "2026-07-10" };
const [ini, fin] = ventana(inst);
assert.equal(ini, "2026-06-26"); // desde la emisión
assert.equal(fin, "2026-07-30"); // vencimiento + 20 días de gracia

// --- match por MONTO exacto: desenmascara el gateway ---
const gateway = [
  { id: "otra", monto: 999999, comercio: "AVAL VALOR COMPARTIDO S.A", fecha: "2026-07-05" },
  { id: "enel-pago", monto: 148730, comercio: "Banco de Occidente S.A. (ATH)", fecha: "2026-07-09" },
];
assert.equal(matchPago("monto", null, inst, gateway), "enel-pago"); // el monto exacto lo delata
// monto que no cuadra → sin pago (justo el aviso de corte)
assert.equal(matchPago("monto", null, inst, [{ id: "x", monto: 104851, comercio: "Banco de Occidente", fecha: "2026-07-01" }]), null);
// fuera de ventana → no cuenta
assert.equal(matchPago("monto", null, inst, [{ id: "y", monto: 148730, comercio: "ATH", fecha: "2026-08-15" }]), null);

// --- match por COMERCIO (servicios fijos, moto) ---
const instAgua = { montoEsperado: 80000, fechaEmision: null, fechaVencimiento: "2026-07-17" };
const caja = [{ id: "eaab1", monto: 176160, comercio: "Empresa de Acueducto y Alcantarillado de Bogotá", fecha: "2026-07-20" }];
assert.equal(matchPago("comercio", ["acueducto"], instAgua, caja), "eaab1");
assert.equal(matchPago("comercio", ["gas natural"], instAgua, caja), null); // keyword que no aparece
// `usados` evita doble-link de la misma tx
assert.equal(matchPago("comercio", ["acueducto"], instAgua, caja, new Set(["eaab1"])), null);
// manual nunca auto-casa
assert.equal(matchPago("manual", ["acueducto"], instAgua, caja), null);

console.log("✓ obligaciones.selfcheck: parseo factura ENEL + match por monto (gateway) + match por comercio OK");
