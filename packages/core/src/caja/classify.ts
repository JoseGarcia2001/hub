// Clasificador puro: transacción cruda + reglas aprendidas → flujo + categoría.
// Único clasificador del sistema (lo llama la ingesta y el reclasificado).
//
// Orden: (1) regla aprendida de Jose (keyword en comercio) manda sobre todo;
// (2) si no, la lógica fija de abajo, calibrada con los rails/cuentas reales.
// Las tablas REGLAS/CONTRAPARTES son conocimiento de dominio (la "perilla de
// calibración" ponytail): se afinan con lo que caiga en "Otros".
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
  ["global colombia 81", ["pago_tarjeta", "Nu"]], // razón social de la cuenta Nu (ver productos.md)
  ["daviplata", ["movimiento_propio", "Daviplata"]], // cuentas propias: reabastecer ≠ ingreso nuevo
  ["nequi", ["movimiento_propio", "Nequi"]],
  ["bancolombia", ["movimiento_propio", "Bancolombia"]],
];
const CONTRAPARTES_EXACTAS: Record<string, [Flujo, string]> = {
  nu: ["pago_tarjeta", "Nu"], // comercio == 'NU' exacto (no substring de otras)
};
const RAIL_KEYWORDS = ["fideicomiso", "fiduciaria"]; // arriendo/administración = consumo Vivienda
const ARRIENDO = { min: 2_750_000, max: 3_100_000 }; // canon mensual a Aleida vía Nequi (rango del canon 2025-2026)

// Categorías de CONSUMO por keyword en el comercio. El ORDEN importa: primer
// match gana. Por eso Mascotas va antes que Compras/Domicilios (Laika llega como
// "mercado pago laika") y Domicilios antes que Transporte ("didi food" vs "didi").
// Esta tabla es la perilla de calibración ponytail: se afina con lo que caiga en
// "Otros".
export const REGLAS: [string, string[]][] = [
  ["Mascotas", ["laika", "veterinar", "mascota", "petshop", "pet shop", "kanu", "agility", "petco"]],
  ["Domicilios", ["rappi", "ifood", "didi food"]],
  ["Transporte", ["uber", "didi", "cabify", "beat ", "indriver", "taxi", "transmilenio", "terminal de transporte", "movilidad", "sitp"]],
  // Vehículo = costos de la moto (TCO): gasolina, parqueo, peaje, RTM, lavado.
  ["Vehículo", ["terpel", "primax", "biomax", "texaco", "petrobras", "esso", "gazel", "combuscol", "eds ", "estacion de servicio", "peaje", "city parking", "parking", "parqueadero", "aparcar", "si parq", "cda ", "tecnomecanica", "tecno mecanica", "automas", "polish car", "autolavado", "montallantas", "serviteca", "llantas", "lubricantes", "metrokia"]],
  ["Mercado", ["carulla", "exito", "éxito", "d1", "tiendas ara", "olimpica", "jumbo", "makro", "oxxo", "fruver", "citrus", "justo", "surtimax", "merqueo", "supermercado", "premiun", "frutas y verduras", "carnes king", "merquetienda"]],
  ["Restaurantes", ["restaurante", "rest ", "butchery", "mcdonald", "kfc", "crepes", "juan valdez", "starbucks", "cafe", "café", "capuchino", "pizz", "burger", "bratwurst", "bold ", "bicono", "tm chico", "frisby", "corral", "sushi", "bar ", "caffa", "insurgentes", "la nueva perla", "mil delicias", "chorilongo", "del salto", "ribbera", "bogota beer", "bbc ", "azahar", "buena suerte pescador", "sol de napoles", "gastronomia paisa", "mondongos", "venezuela bistro", "sipote", "sarku", "tostao", "mal de ojo", "la kasta", "poke", "asadero", "parrilla", "cevicheria", "gourmet", "sandwich", "coffee", "heladeria", "ventolini", "dunkin", "subway", "grill", "cazuelitas", "semolina", "mamasita", "panisse", "coffipan", "migueria", "hop dog", "birrreria", "roada di pasta", "el oriente", "club del vino", "varietale", "turquesa"]],
  ["Salud", ["farmacia", "cruz verde", "farmatodo", "drogueria", "droguería", "eps", "colsanitas", "medicina", "medplus", "colmedica", "clinica", "clínica", "laboratorio", "odont", "ortodon", "compensa", "cafam", "profamilia", "colcan", "ortopedic", "optica", "dental", "dentix", "sonria", "sonría", "audifarma", "locatel", "pasteur", "bella piel"]],
  ["Educación", ["platzi", "universidad", "coursera", "udemy", "devtalles", "refactorin", "bootcamp", "politecnico"]],
  ["Suscripciones", ["netflix", "spotify", "youtube", "hbo", "disney", "apple", "google", "openai", "chatgpt", "claude", "anthropic", "icloud", "microsoft", "prime video", "primevideo", "cursor", "read meeting", "namecheap", "name cheap", "posthog", "vercel", "notion"]],
  ["Servicios", ["enel", "vanti", "eaab", "etb", "acueducto", "energia", "energía", "tigo", "epm telecomunicaciones", "fullcarga", "internet", "movistar", "claro "]],
  // Vestuario y Hogar antes que Compras: abren el cajón genérico de retail.
  ["Vestuario", ["velez", "gef", "koaj", "croydon", "seven seven", "totto", "zara", "h&m", "levis", "skechers", "pasarela colombia", "prochampions", "arturo calle", "bosi", "spring step", "punto blanco", "studio f", "americanino", "chevignon", "naf naf", "pilatos"]],
  ["Hogar", ["homecenter", "ikea", "muebles", "home sentry", "easy", "casaideas", "sodimac", "jamar", "tugo", "ferreteria", "decoracion"]],
  ["Compras", ["mercadolibre", "mercado libre", "mercado pago", "mercadopago", "mercadoli", "falabella", "alkosto", "ktronix", "amazon", "decathlon", "panamericana", "dollarcity", "mallplaza", "titan plaza", "trendy", "temu", "pepe ganga", "shein"]],
  ["Ocio", ["cinemark", "cinecolombia", "cine", "teatro", "escalada", "gran pared", "gym", "smartfit", "smart fit", "bodytech", "theatron", "multiplex", "trepa", "paintball", "paint ball", "funjungle", "playstation", "futbolera", "al agua patos", "centro turistico", "karting", "bolera", "zona cardio", "distr dep"]],
  ["Viajes", ["holafly", "avianca", "latam", "airbnb", "booking", "despegar", "wingo", "aerovias", "clic air", "jetsmart", "satena", "easyfly", "viva air", "hotel", "hostal"]],
];

// "Otros" = consumo real cuyo comercio no reconocemos (o viene vacío). No es un
// error: es la cola honesta que Jose afina 1×1 en "Requieren atención".
function consumoCat(comercio: string): string {
  const c = (comercio || "").toLowerCase();
  if (!c) return "Otros";
  for (const [cat, kws] of REGLAS) if (kws.some((k) => c.includes(k))) return cat;
  return "Otros";
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
  // Arriendo: transferencia mensual fija a Nequi (a Aleida). El correo de Nequi
  // saliente NO trae el beneficiario, así que se reconoce por el patrón del canon
  // (~$2.8-3M). Va ANTES del loop porque "nequi" lo marcaría como movimiento propio.
  // ponytail: heurística por monto; si sube el canon, ampliar ARRIENDO.max; un
  // movimiento propio que caiga en el rango, Jose lo reetiqueta 1×.
  if (low.includes("nequi") && tx.tipo !== "transferencia_in" && tx.monto >= ARRIENDO.min && tx.monto <= ARRIENDO.max) {
    return { ...tx, flujo: "consumo", categoria: "Vivienda" };
  }
  for (const [kw, [flujo, categoria]] of CONTRAPARTES) {
    if (low.includes(kw)) return { ...tx, flujo, categoria };
  }

  // Entrante de tercero no reconocido = ingreso real.
  if (tx.tipo === "transferencia_in") return { ...tx, flujo: "ingreso", categoria: "Otros ingresos" };
  // Saliente PSE grande: primero intenta reconocer el comercio (Universidad→Educación,
  // etc.); solo si es desconocido cae en la red de seguridad (Jose lo etiqueta 1 vez).
  if (tx.tipo === "PSE" && tx.monto >= 1_000_000) {
    const cat = consumoCat(com);
    return cat === "Otros"
      ? { ...tx, flujo: "por_clasificar", categoria: "Por clasificar" }
      : { ...tx, flujo: "consumo", categoria: cat };
  }
  if (tx.tipo === "transferencia_out") return { ...tx, flujo: "consumo", categoria: "Transferencias" };
  // PSE pequeño a comercio/servicio real = consumo.
  return { ...tx, flujo: "consumo", categoria: consumoCat(com) };
}
