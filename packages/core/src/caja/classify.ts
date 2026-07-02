// Clasificador puro: transacción cruda + reglas aprendidas → flujo + categoría.
// Único clasificador del sistema (lo llama la ingesta y el reclasificado).
//
// Orden: (1) regla aprendida de Jose (keyword en comercio) manda sobre todo;
// (2) si no, la lógica fija de abajo, calibrada con los rails/cuentas reales.
// Las tablas REGLAS/CONTRAPARTES son conocimiento de dominio (la "perilla de
// calibración" ponytail): se afinan con lo que caiga en "Sin categorizar".
import type { ClassifiedTx, Flujo, ParsedTx, Rule } from "./types";

// Contrapartes de RappiPay por keyword en comercio/banco → semántica de flujo correcta.
const CONTRAPARTES: [string, [Flujo, string]][] = [
  ["bogot", ["ingreso", "Nómina"]], // nómina de Habi vía Banco de Bogotá (siempre entrante)
  // DolarApp cobra vía razones sociales rotativas (Pexto, Novatec…); la red PSE>1M atrapa nuevas.
  ["pexto", ["inversion", "DolarApp → IBKR"]],
  ["dolarapp", ["inversion", "DolarApp → IBKR"]],
  ["novatec", ["inversion", "DolarApp → IBKR"]],
  ["occidente", ["pago_tarjeta", "Visa LATAM Occidente"]],
  ["davivienda", ["pago_tarjeta", "Davivienda"]],
  ["nu colombia", ["pago_tarjeta", "Nu"]], // PSE a Nu = pago de tarjeta (no consumo)
  ["nu compa", ["pago_tarjeta", "Nu"]], // "NU Compañía de Financiamiento"
  ["daviplata", ["movimiento_propio", "Daviplata"]], // cuentas propias: reabastecer ≠ ingreso nuevo
  ["nequi", ["movimiento_propio", "Nequi"]],
  ["bancolombia", ["movimiento_propio", "Bancolombia"]],
];
const CONTRAPARTES_EXACTAS: Record<string, [Flujo, string]> = {
  nu: ["pago_tarjeta", "Nu"], // comercio == 'NU' exacto (no substring de otras)
};
const RAIL_KEYWORDS = ["fideicomiso", "fiduciaria"]; // arriendo/administración = consumo Vivienda

// Categorías de CONSUMO por keyword en el comercio.
export const REGLAS: [string, string[]][] = [
  ["Transporte", ["uber", "didi", "cabify", "city parking", "parking", "parqueadero", "terpel", "primax", "biomax", "peaje", "estacion", "terminal de transporte", "combuscol", "eds ", "movilidad"]],
  ["Mercado", ["carulla", "exito", "éxito", "d1", "ara", "olimpica", "jumbo", "makro", "oxxo", "fruver", "citrus", "justo", "surtimax", "merqueo", "supermercado", "premiun", "frutas y verduras", "carnes king"]],
  ["Domicilios", ["rappi", "ifood", "didi food"]],
  ["Restaurantes", ["restaurante", "butchery", "mcdonald", "kfc", "crepes", "juan valdez", "starbucks", "cafe", "café", "capuchino", "pizz", "burger", "bratwurst", "bold ", "bicono", "tm chico", "frisby", "corral", "sushi", "bar ", "caffa", "insurgentes", "la nueva perla", "mil delicias", "chorilongo", "del salto", "ribbera", "bogota beer", "bbc bodega", "azahar", "buena suerte pescador", "sol de napoles", "gastronomia paisa", "mondongos", "venezuela bistro", "sipote", "sarku", "tostao", "mal de ojo", "la kasta", "poke"]],
  ["Salud", ["farmacia", "cruz verde", "farmatodo", "drogueria", "droguería", "eps", "colsanitas", "medicina", "medplus", "colmedica", "clinica", "clínica", "laboratorio", "odont", "ortodon", "compensa", "cafam"]],
  ["Suscripciones", ["netflix", "spotify", "youtube", "hbo", "disney", "apple", "google", "openai", "chatgpt", "claude", "anthropic", "icloud", "microsoft", "prime video", "primevideo", "cursor", "devtalles", "read meeting"]],
  ["Servicios", ["enel", "vanti", "eaab", "etb", "acueducto", "energia", "energía", "tigo", "epm telecomunicaciones", "fullcarga", "internet"]],
  ["Compras", ["mercadolibre", "mercado libre", "mercado pago", "mercadopago", "mercadoli", "falabella", "only", "zara", "h&m", "homecenter", "alkosto", "ktronix", "amazon", "koaj", "decathlon", "ikea", "levis", "skechers", "panamericana", "dollarcity", "mallplaza", "titan plaza", "trendy"]],
  ["Ocio", ["cinemark", "cinecolombia", "cine", "teatro", "escalada", "gran pared", "gym", "smartfit", "bodytech", "theatron", "multiplex"]],
  ["Viajes", ["holafly", "avianca", "latam", "airbnb", "booking", "despegar", "wingo", "aerovias"]],
];

function consumoCat(comercio: string): string {
  const c = (comercio || "").toLowerCase();
  if (!c) return "Sin comercio";
  for (const [cat, kws] of REGLAS) if (kws.some((k) => c.includes(k))) return cat;
  return "Sin categorizar";
}

/** Fija flujo + categoría. RappiCard = siempre consumo; RappiPay = según contraparte. */
export function classify(tx: ParsedTx, rules: Rule[] = []): ClassifiedTx {
  const com = (tx.comercio || "").trim();
  const low = com.toLowerCase();

  // 1. Regla aprendida de Jose: manda sobre todo.
  const learned = rules.find((r) => low.includes(r.keyword));
  if (learned) return { ...tx, flujo: learned.flujo, categoria: learned.categoria };

  // 2. RappiCard = siempre consumo.
  if (tx.fuente === "RappiCard") return { ...tx, flujo: "consumo", categoria: consumoCat(com) };

  // 3. RappiPay: reconocer rails/cuentas propias primero.
  if (low in CONTRAPARTES_EXACTAS) {
    const [flujo, categoria] = CONTRAPARTES_EXACTAS[low];
    return { ...tx, flujo, categoria };
  }
  // Vivienda (fideicomiso/fiduciaria = arriendo/administración) ANTES que las
  // contrapartes: "FIDUCIARIA DE OCCIDENTE" contiene "occidente" pero NO es pago
  // de la Visa Occidente. El rail manda sobre el substring del banco.
  if (RAIL_KEYWORDS.some((k) => low.includes(k))) return { ...tx, flujo: "consumo", categoria: "Vivienda" };
  for (const [kw, [flujo, categoria]] of CONTRAPARTES) {
    if (low.includes(kw)) return { ...tx, flujo, categoria };
  }

  // Entrante de tercero no reconocido = ingreso real.
  if (tx.tipo === "transferencia_in") return { ...tx, flujo: "ingreso", categoria: "Otros ingresos" };
  // Saliente PSE grande a entidad desconocida → red de seguridad (Jose lo etiqueta 1 vez).
  if (tx.tipo === "PSE" && tx.monto >= 1_000_000) return { ...tx, flujo: "por_clasificar", categoria: "Por clasificar" };
  if (tx.tipo === "transferencia_out") return { ...tx, flujo: "consumo", categoria: "Transferencias" };
  // PSE pequeño a comercio/servicio real = consumo.
  return { ...tx, flujo: "consumo", categoria: consumoCat(com) };
}
