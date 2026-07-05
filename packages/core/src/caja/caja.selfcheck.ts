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

// Reglas de comercios afinadas con la data real.
const caffa = classify({ fuente: "RappiCard", tipo: "compra", monto: 40000, comercio: "CAFFA COFFEE HOUSE B", metodo: "*4418", ref: "1", fecha: "2026-04-01", hora: "" });
assert.equal(caffa.categoria, "Restaurantes");
const decathlon = classify({ fuente: "RappiCard", tipo: "compra", monto: 900000, comercio: "DECATHLON CL", metodo: "*4418", ref: "1", fecha: "2026-04-01", hora: "" });
assert.equal(decathlon.categoria, "Compras");
// Nu por PSE = pago de tarjeta, NO consumo.
const nu = classify({ fuente: "RappiPay", tipo: "PSE", monto: 800000, comercio: "NU COLOMBIA SA", metodo: "RappiCuenta", ref: "1", fecha: "2026-04-01", hora: "" });
assert.equal(nu.flujo, "pago_tarjeta");
assert.equal(nu.categoria, "Nu");

// --- categorías nuevas (Vehículo, Educación, Mascotas, Vestuario, Hogar) ---
const card = (comercio: string) => classify({ fuente: "RappiCard" as const, tipo: "compra", monto: 50000, comercio, metodo: "*4418", ref: "1", fecha: "2026-04-01", hora: "" });
// Mascotas gana sobre Compras: "Laika" llega como "MERCADO PAGO LAIKA".
assert.equal(card("MERCADO PAGO LAIKA").categoria, "Mascotas");
// Gasolina/parqueo salen de Transporte → Vehículo.
assert.equal(card("TERPEL ESTACION 123").categoria, "Vehículo");
assert.equal(card("CITY PARKING NIZA").categoria, "Vehículo");
// Compras se abre en Vestuario y Hogar.
assert.equal(card("VELEZ CENTRO MAYOR").categoria, "Vestuario");
assert.equal(card("ONLY MUEBLES").categoria, "Hogar"); // "muebles"
assert.equal(card("HOME SENTRY CALLE 80").categoria, "Hogar");
// Educación por comercio, y también un PSE grande (Universidad) que antes caía en "Por clasificar".
assert.equal(card("DLO PLATZI COLOMBIA").categoria, "Educación");
const uni = classify({ fuente: "RappiPay", tipo: "PSE", monto: 9_035_000, comercio: "Universidad Antonio Nariño", metodo: "RappiCuenta", ref: "1", fecha: "2026-04-01", hora: "" });
assert.equal(uni.flujo, "consumo");
assert.equal(uni.categoria, "Educación");
// GLOBAL COLOMBIA 81 (razón social Nu) = pago de tarjeta, no gasto — aunque sea PSE grande.
const nuEntity = classify({ fuente: "RappiPay", tipo: "PSE", monto: 5_000_000, comercio: "GLOBAL COLOMBIA 81 SA", metodo: "RappiCuenta", ref: "1", fecha: "2026-04-01", hora: "" });
assert.equal(nuEntity.flujo, "pago_tarjeta");
assert.equal(nuEntity.categoria, "Nu");
// Domicilios sigue ganando a Transporte para DiDi Food.
assert.equal(card("DIDI FOOD").categoria, "Domicilios");

// Arriendo: transferencia mensual ~$2.8M a Nequi = Vivienda (no movimiento propio).
const arriendo = classify({ fuente: "RappiPay", tipo: "movimiento", monto: 2_800_000, comercio: "Nequi", metodo: "RappiCuenta", ref: "1", fecha: "2026-05-01", hora: "" });
assert.equal(arriendo.flujo, "consumo");
assert.equal(arriendo.categoria, "Vivienda");
// Un Nequi fuera del rango del canon sigue siendo movimiento propio.
const nequiMov = classify({ fuente: "RappiPay", tipo: "movimiento", monto: 1_500_000, comercio: "Nequi", metodo: "RappiCuenta", ref: "1", fecha: "2026-05-01", hora: "" });
assert.equal(nequiMov.flujo, "movimiento_propio");

console.log("✓ caja.selfcheck: parseo COP + 3 formatos + clasificación por flujo + fix fideicomiso + categorías nuevas OK");
