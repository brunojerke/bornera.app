// Punto de entrada del formato .brn (T15a): texto ↔ Documento, sin DOM.
// El gzip y el tope en bytes van fuera del núcleo (src/ui/brn.ts).
export { serializar } from "./serializar";
export {
  deserializar,
  LARGO_MAXIMO_TEXTO,
  MAXIMO_PROBLEMAS,
  RANGO_GRILLA,
  type ProblemaArchivo,
  type ResultadoAbrir,
} from "./deserializar";
