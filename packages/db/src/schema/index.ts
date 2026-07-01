// Barrel del esquema: cada dominio añade su archivo y lo re-exporta aquí.
// `schema.ts` (auth) lo genera Better Auth y no se edita a mano; los dominios
// son archivos hechos a mano como `pendientes.ts`.
export * from "./auth";
export * from "./pendientes";
export * from "./investments";
export * from "./push";
