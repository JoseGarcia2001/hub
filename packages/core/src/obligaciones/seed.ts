// Catálogo semilla de obligaciones de Jose, derivado de la data real (Caja + calendario
// + cuentas-contrato de vida-adulta). Idempotente por proveedorKey → re-sembrar no duplica.
//
// - ENEL: única con factura por correo hoy (total + "pago oportuno") → match por MONTO exacto.
// - Resto de servicios: vencimiento fijo (día conocido) + match por comercio (ponytail: se
//   afinará con el parser de su factura/pago cuando se agregue).
// - Moto: anual, sin factura por correo → instancias sembradas con su fecha conocida.
import type { Cadencia, FuenteVencimiento, MatchStrategy } from "./types";

type ObligacionSeed = {
  proveedorKey: string; nombre: string; proveedor: string; categoria: string;
  cadencia: Cadencia; cuentaContrato: string | null; fuenteVencimiento: FuenteVencimiento;
  matchStrategy: MatchStrategy; matchKeywords: string[] | null; montoEsperado: number | null;
  diaVencimiento: number | null; mesVencimiento: number | null; activa: boolean;
};

export const CATALOGO: ObligacionSeed[] = [
  {
    proveedorKey: "enel", nombre: "Luz ENEL", proveedor: "ENEL Colombia", categoria: "Servicios",
    cadencia: "mensual", cuentaContrato: "7487178-4", fuenteVencimiento: "factura",
    matchStrategy: "monto", matchKeywords: null, montoEsperado: null, diaVencimiento: null, mesVencimiento: null, activa: true,
  },
  {
    proveedorKey: "vanti", nombre: "Gas Vanti", proveedor: "Grupo Vanti", categoria: "Servicios",
    cadencia: "mensual", cuentaContrato: "63257516", fuenteVencimiento: "fija",
    matchStrategy: "comercio", matchKeywords: ["vanti", "gas natural"], montoEsperado: 50000, diaVencimiento: 4, mesVencimiento: null, activa: true,
  },
  {
    proveedorKey: "eaab", nombre: "Agua EAAB", proveedor: "Acueducto de Bogotá", categoria: "Servicios",
    cadencia: "bimensual", cuentaContrato: "12525869", fuenteVencimiento: "fija",
    matchStrategy: "comercio", matchKeywords: ["acueducto", "alcantarillado", "eaab"], montoEsperado: 80000, diaVencimiento: 17, mesVencimiento: null, activa: true,
  },
  {
    proveedorKey: "etb", nombre: "Internet ETB", proveedor: "ETB", categoria: "Servicios",
    cadencia: "mensual", cuentaContrato: null, fuenteVencimiento: "fija",
    matchStrategy: "comercio", matchKeywords: ["etb", "une ", "internet", "epm telecomunic"], montoEsperado: 60000, diaVencimiento: 26, mesVencimiento: null, activa: true,
  },
  {
    proveedorKey: "moto-soat", nombre: "SOAT moto DVV22G", proveedor: "Aseguradora", categoria: "Vehículo",
    cadencia: "anual", cuentaContrato: null, fuenteVencimiento: "fija",
    matchStrategy: "comercio", matchKeywords: ["soat", "seguros", "suramericana", "mundial", "previsora", "axa", "mapfre", "solidaria"],
    montoEsperado: 450000, diaVencimiento: 2, mesVencimiento: 11, activa: true,
  },
  {
    proveedorKey: "moto-tecno", nombre: "Tecnomecánica moto DVV22G", proveedor: "CDA", categoria: "Vehículo",
    cadencia: "anual", cuentaContrato: null, fuenteVencimiento: "fija",
    matchStrategy: "comercio", matchKeywords: ["cda", "tecnomec", "revision", "diagnostic", "automas"],
    montoEsperado: 205000, diaVencimiento: 22, mesVencimiento: 2, activa: true,
  },
  {
    proveedorKey: "moto-impuesto", nombre: "Impuesto moto DVV22G", proveedor: "Gobernación de Cundinamarca", categoria: "Vehículo",
    cadencia: "anual", cuentaContrato: null, fuenteVencimiento: "fija",
    matchStrategy: "comercio", matchKeywords: ["gobernacion", "cundinamarca", "impuesto"],
    montoEsperado: 194000, diaVencimiento: 25, mesVencimiento: 5, activa: true,
  },
];

/** Instancias anuales conocidas (moto). El impuesto 2026 ya se pagó → reconcile lo casa. */
export const INSTANCIAS_SEMBRADAS: { proveedorKey: string; periodo: string; fechaVencimiento: string; monto: number }[] = [
  { proveedorKey: "moto-impuesto", periodo: "2026", fechaVencimiento: "2026-05-25", monto: 193700 },
  { proveedorKey: "moto-soat", periodo: "2026", fechaVencimiento: "2026-11-02", monto: 450000 },
  { proveedorKey: "moto-tecno", periodo: "2027", fechaVencimiento: "2027-02-22", monto: 205000 },
];
