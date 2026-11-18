// F2 y F3 de «Probar la fase 4» (C1; docs/plan-fase4.md, sección 6).
//
// No usan los comandos Guardar ni Abrir (Bruno, 2026-11-18): no tocan
// recientes, autoguardado, título ni «modificado». Cada vuelta:
// - F2: `serializar` + gzip (`empaquetar`) + escribir el `.brn`.
// - F3: leer + `desempaquetar` + `deserializar` + armar la escena y dibujar el
//   primer cuadro (`primerCuadro`, que inyecta probarFase4.ts).
// El disco se inyecta: en Tauri, un `.brn` con nombre único en la carpeta
// temporal, escrito como Guardar (`.tmp` y renombrar), que se borra en un
// `finally`; en el navegador (humo), la memoria («sin disco»).

import { deserializar, serializar } from "../core/io";
import type { Documento } from "../core/model/documento";
import { desempaquetar, empaquetar } from "./brn";
import type { MuestraArchivo } from "./fase4";

/** Dónde escribe y lee la medición. */
export interface DiscoMedicion {
  /** True si escribe en un archivo de verdad. */
  readonly conDisco: boolean;
  escribir(bytes: Uint8Array): Promise<void>;
  leer(): Promise<Uint8Array>;
  /** Borra lo que haya escrito. Se llama siempre, también si falla. */
  borrar(): Promise<void>;
}

/** La memoria: para el navegador y los tests. */
export function discoEnMemoria(): DiscoMedicion {
  let guardado: Uint8Array | null = null;
  return {
    conDisco: false,
    escribir: async (bytes) => {
      guardado = bytes;
    },
    leer: async () => {
      if (!guardado) throw new Error("No hay nada escrito.");
      return guardado;
    },
    borrar: async () => {
      guardado = null;
    },
  };
}

export interface OpcionesMedirArchivo {
  vueltas: number;
  /** Arma la escena del documento abierto y dibuja su primer cuadro. */
  primerCuadro(doc: Documento): void;
  ahora?: () => number;
  progreso?: (texto: string) => void;
}

/**
 * Mide `vueltas` veces guardar y abrir `doc`. `igual`: el documento abierto
 * en la última vuelta vuelve a dar el mismo texto (fuera de lo medido).
 * Siempre borra lo escrito al terminar.
 */
export async function medirArchivo(
  doc: Documento,
  disco: DiscoMedicion,
  { vueltas, primerCuadro, ahora = () => performance.now(), progreso = () => {} }: OpcionesMedirArchivo,
): Promise<{ muestras: MuestraArchivo[]; igual: boolean; bytes: number }> {
  const muestras: MuestraArchivo[] = [];
  let igual = false;
  let bytes = 0;
  try {
    for (let i = 0; i < vueltas; i++) {
      progreso(`guardar y abrir, vuelta ${i + 1} de ${vueltas}`);
      // Que se vea el progreso y no se pegue a la vuelta anterior.
      await new Promise((r) => setTimeout(r, 0));

      const t0 = ahora();
      const texto = serializar(doc);
      const paquete = await empaquetar(texto);
      await disco.escribir(paquete.bytes);
      const guardar = ahora() - t0;

      const t1 = ahora();
      const leidos = await disco.leer();
      const abierto = await desempaquetar(leidos);
      if (!abierto.ok) throw new Error(abierto.error);
      const r = deserializar(abierto.texto);
      if (!r.ok) throw new Error(`El archivo no abre: ${r.errores.map((e) => e.mensaje).join("; ")}`);
      const abrir = ahora() - t1;
      primerCuadro(r.documento);
      const hastaCuadro = ahora() - t1;

      muestras.push({ guardar, abrir, hastaCuadro });
      bytes = paquete.bytes.length;
      if (i === vueltas - 1) igual = serializar(r.documento) === texto;
    }
  } finally {
    await disco.borrar();
  }
  return { muestras, igual, bytes };
}
