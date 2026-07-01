import assert from "node:assert/strict";
import { parse, parseCop } from "./parse";
import { classify } from "./classify";

/**
 * Self-check del parser + clasificador de Caja (sin DB ni red). Fixtures = texto
 * real de correos Rappi. Cubre lo no trivial: formato COP colombiano, las tres
 * formas (RappiCard, PSE, transferencia entrante) y la clasificación por flujo
 * —incluida la corrección fideicomiso→Vivienda que "occidente" pisaba antes.
 * Correr:  pnpm --filter @hub/core selfcheck:caja
 */

// --- parseo de montos COP ---
assert.equal(parseCop("$24.789"), 24789);
assert.equal(parseCop("$266.400,00"), 266400); // coma = decimales
assert.equal(parseCop("$2.294.000"), 2294000);
assert.equal(parseCop("$6.000.000"), 6000000);

const RAPPICARD = { subject: "RappiCard - Resumen de transacción", text:
`¡Hola, JOSE ANIBAL GARCIA GIRALDO!
Realizaste una compra con tu RappiCard.
Monto
$24.789
Método de pago
*4418
No. de autorización
453793
Comercio
Uber
Fecha de la transacción
2026-06-27 17:59:36` };

const RAPPIPAY_PSE_FIDEICOMISO = { subject: "Resumen compra con Pse", text:
`¡Hola, Jose Anibal!
Producto de RappiPay. Tu RappiCuenta.
Monto
$266.400,00
CUS (Código de transacción)
432673945
Comercio
FIDEICOMISOS SOCIEDAD FIDUCIARIA DE OCCIDENTE SA
Tipo de transacción
PSE
Fecha de la transacción
30 de junio de 2026
Hora de la transacción
10:19 am` };

const RAPPIPAY_IN_NEQUI = { subject: "Tu dinero ya está disponible.", text:
`¡Hola, Jose Anibal!
Recibiste una transferencia en tu RappiCuenta.
Monto recibido
$2.294.000
Banco
Nequi
Nro. de transacción
2316726
Fecha de la transacción
30 de junio de 2026` };

// --- parseo ---
const a = parse(RAPPICARD)!;
assert.equal(a.fuente, "RappiCard");
assert.equal(a.monto, 24789);
assert.equal(a.comercio, "Uber");
assert.equal(a.fecha, "2026-06-27");
assert.equal(a.hora, "17:59");

const b = parse(RAPPIPAY_PSE_FIDEICOMISO)!;
assert.equal(b.tipo, "PSE");
assert.equal(b.monto, 266400);

const c = parse(RAPPIPAY_IN_NEQUI)!;
assert.equal(c.tipo, "transferencia_in");
assert.equal(c.monto, 2294000);
assert.equal(c.comercio, "Nequi");

// no-parse: correo que no es de transacción
assert.equal(parse({ subject: "Promo Rappi", text: "Aprovecha 2x1 en domicilios" }), null);

// --- clasificación (sin reglas aprendidas) ---
const cardUber = classify(a);
assert.equal(cardUber.flujo, "consumo");
assert.equal(cardUber.categoria, "Transporte"); // "uber"

// Fideicomiso/fiduciaria = Vivienda, NO pago Visa Occidente (el fix de orden).
const fideicomiso = classify(b);
assert.equal(fideicomiso.flujo, "consumo");
assert.equal(fideicomiso.categoria, "Vivienda");

// Transferencia entrante de una cuenta propia (Nequi) = movimiento, no ingreso.
const nequiIn = classify(c);
assert.equal(nequiIn.flujo, "movimiento_propio");
assert.equal(nequiIn.categoria, "Nequi");

// Nómina: transferencia entrante desde Banco de Bogotá = ingreso.
const nomina = classify({ fuente: "RappiPay", tipo: "transferencia_in", monto: 15_000_000, comercio: "Banco de Bogota", metodo: "RappiCuenta", ref: "1", fecha: "2026-06-30", hora: "" });
assert.equal(nomina.flujo, "ingreso");
assert.equal(nomina.categoria, "Nómina");

// Inversión DolarApp (recolector Novatec) por PSE.
const dolarapp = classify({ fuente: "RappiPay", tipo: "PSE", monto: 6_000_000, comercio: "NOVATEC SOLUTIONS S.A.S", metodo: "RappiCuenta", ref: "1", fecha: "2026-07-01", hora: "" });
assert.equal(dolarapp.flujo, "inversion");

// Red de seguridad: PSE grande a entidad desconocida → por_clasificar.
const desconocido = classify({ fuente: "RappiPay", tipo: "PSE", monto: 3_000_000, comercio: "ENTIDAD RARA SAS", metodo: "RappiCuenta", ref: "1", fecha: "2026-07-01", hora: "" });
assert.equal(desconocido.flujo, "por_clasificar");

// Regla aprendida: manda sobre todo.
const conRegla = classify(
  { fuente: "RappiCard", tipo: "compra", monto: 50000, comercio: "PANADERIA LA ESQUINA", metodo: "*4418", ref: "1", fecha: "2026-07-01", hora: "" },
  [{ keyword: "panaderia la esquina", flujo: "consumo", categoria: "Mercado" }],
);
assert.equal(conRegla.categoria, "Mercado");

console.log("✓ caja.selfcheck: parseo COP + 3 formatos + clasificación por flujo + fix fideicomiso + reglas OK");
