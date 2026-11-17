// Serializar por partes (T23, etapa 1b; docs/plan-T23.md): el mismo texto
// que `serializar`, entregado en piezas, para que la copia de recuperación
// lo escriba en pasos cortos y no trabe la página (F1).
//
// La unión de las piezas es `serializar(doc)`, carácter por carácter: se
// usan los mismos escritores de cada objeto. Las piezas son:
// - la cabeza, hasta `"hojas":[`;
// - la apertura de cada hoja, hasta `"componentes":[`;
// - cada componente, con la coma que lo separa del anterior;
// - el paso a los cables, `],"cables":[`;
// - cada cable, con su coma;
// - el cierre de cada hoja, `]}`, y el cierre final, `]}`.
//
// Lee el documento vivo, pieza por pieza: si el documento cambia entre dos
// piezas, el texto mezclaría dos estados. Quien lo usa tiene que notarlo (la
// copia mira el contador de cambios del editor antes de cada paso) y tirar
// el generador sin reanudarlo.

import type { Documento } from "../model/documento";
import { cable, componente, mapa, meta, valor } from "./serializar";

/** Las piezas del texto .brn de `doc`; unidas, dan `serializar(doc)`. */
export function* serializarPorPartes(doc: Documento): Generator<string, void, undefined> {
  // La cabeza, como la escribe `objeto` en `serializar`: cada clave por `valor`.
  yield (
    `{${valor("formato")}:${valor(doc.formato)},${valor("version")}:${valor(doc.version)},` +
    `${valor("meta")}:${meta(doc.meta)},${valor("contadores")}:${mapa(doc.contadores)},${valor("hojas")}:[`
  );
  for (let i = 0; i < doc.hojas.length; i++) {
    const h = doc.hojas[i]!;
    yield `${i > 0 ? "," : ""}{${valor("nombre")}:${valor(h.nombre)},${valor("componentes")}:[`;
    for (let j = 0; j < h.componentes.length; j++) yield (j > 0 ? "," : "") + componente(h.componentes[j]!);
    yield `],${valor("cables")}:[`;
    for (let j = 0; j < h.cables.length; j++) yield (j > 0 ? "," : "") + cable(h.cables[j]!);
    yield "]}";
  }
  yield "]}";
}
