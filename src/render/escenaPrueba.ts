// TEMPORAL: escena de prueba para revisar los símbolos a ojo.
// Una fila por símbolo y una columna por rotación (0°, 90°, 180°, 270°), con
// cada borne marcado: punto en su posición y un trazo hacia donde sale el cable.
// Borrar cuando el documento tenga componentes de verdad.

import { SIMBOLOS, type Rotacion } from "../core/symbols";
import type { Caja } from "./camara";
import { Escena, type ComponenteEscena, type Contenido, type InfoDibujo } from "./escena";
import type { Renderer } from "./renderer";

const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

/** Distancia entre centros, en unidades de grilla. */
const PASO_X = 9;
const PASO_Y = 9;

/** Etiqueta según el tipo: S pulsadores, K contactor, H señalización (IEC 81346). */
const ETIQUETAS: Record<string, string> = {
  "pulsador.na": "S1",
  "pulsador.nc": "S2",
  "contactor.bobina": "K1",
  "contactor.auxiliar_na": "K1",
  "senalizacion.lampara": "H1",
};

/** Caja que ocupa la escena, para encuadrarla con la tecla F. */
export const CAJA_ESCENA_PRUEBA: Caja = {
  x: -11, // nombres de las filas
  y: -5, // encabezados
  ancho: 11 + PASO_X * (ROTACIONES.length - 1) + 3,
  alto: 5 + PASO_Y * (SIMBOLOS.length - 1) + 3,
};

const componentes: ComponenteEscena[] = SIMBOLOS.flatMap((def, fila) =>
  ROTACIONES.map((rotacion, col) => ({
    def,
    x: col * PASO_X,
    y: fila * PASO_Y,
    rotacion,
    espejado: false,
    etiqueta: ETIQUETAS[def.tipo],
  })),
);

const simbolos = new Escena(componentes);

export const ESCENA_PRUEBA: Contenido = {
  caja: CAJA_ESCENA_PRUEBA,
  cantidad: simbolos.cantidad,

  dibujar(r: Renderer, info: InfoDibujo): number {
    if (info.detalle.textos) {
      r.estilo({ relleno: info.colores.simbolo });
      // Encabezado de cada columna y nombre de cada fila.
      ROTACIONES.forEach((rotacion, i) => r.texto(i * PASO_X, -4, `${rotacion}°`, 0.8, "centro"));
      SIMBOLOS.forEach((def, fila) => r.texto(-5, fila * PASO_Y, def.nombre, 0.7, "derecha"));
    }
    return simbolos.dibujar(r, info);
  },
};
