import assert from "node:assert/strict";
import { parse, parseCop } from "./parse";
import { classify } from "./classify";
import { decodeEntities } from "./gmail";

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

// Reglas de comercios afinadas con la data real.
const caffa = classify({ fuente: "RappiCard", tipo: "compra", monto: 40000, comercio: "CAFFA COFFEE HOUSE B", metodo: "*4418", ref: "1", fecha: "2026-04-01", hora: "" });
assert.equal(caffa.categoria, "Restaurantes");
const decathlon = classify({ fuente: "RappiCard", tipo: "compra", monto: 900000, comercio: "DECATHLON CL", metodo: "*4418", ref: "1", fecha: "2026-04-01", hora: "" });
assert.equal(decathlon.categoria, "Compras");
// Nu por PSE = pago de tarjeta, NO consumo.
const nu = classify({ fuente: "RappiPay", tipo: "PSE", monto: 800000, comercio: "NU COLOMBIA SA", metodo: "RappiCuenta", ref: "1", fecha: "2026-04-01", hora: "" });
assert.equal(nu.flujo, "pago_tarjeta");
assert.equal(nu.categoria, "Nu");

// --- entidades HTML: el sync de Gmail contra el Worker ---
// El Worker recibe el texto ya decodificado (PostalMime), pero la API de Gmail
// devuelve el HTML crudo con las tildes escapadas. Sin decodificar,
// "M&eacute;todo de pago" no matchea el label del parser y `metodo` queda vacío.
assert.equal(decodeEntities("M&eacute;todo de pago"), "Método de pago");
assert.equal(decodeEntities("transacci&oacute;n"), "transacción");
assert.equal(decodeEntities("N&uacute;mero &amp; a&ntilde;o"), "Número & año");
assert.equal(decodeEntities("&#191;qu&#233;?"), "¿qué?");        // numéricas decimales
assert.equal(decodeEntities("&#x41;&#x42;"), "AB");              // numéricas hex
assert.equal(decodeEntities("100% &sinnombre; ok"), "100% &sinnombre; ok"); // desconocida: intacta

const RAPPICARD_ESCAPADO = { subject: "RappiCard - Resumen de transacción", text: decodeEntities(
`Realizaste una compra con tu RappiCard.
Detalle de tu transacci&oacute;n:
Monto
$48.350
M&eacute;todo de pago
*4418
No. de autorizaci&oacute;n
044559
Comercio
RAPPI
Fecha de la transacci&oacute;n
2026-08-30 19:22:14`) };
const txEscapado = parse(RAPPICARD_ESCAPADO);
assert.ok(txEscapado, "el correo con entidades debe parsear");
assert.equal(txEscapado.metodo, "*4418"); // el campo que se perdía
assert.equal(txEscapado.monto, 48350);
assert.equal(txEscapado.fecha, "2026-08-30");
assert.equal(txEscapado.ref, "044559");

console.log("✓ caja.selfcheck: parseo COP + 3 formatos + clasificación por flujo + fix fideicomiso + reglas + entidades HTML OK");
