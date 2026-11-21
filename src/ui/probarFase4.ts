// «Probar la fase 4» del menú de desarrollo (C1; docs/plan-fase4.md, sección
// 6): «Probar la fase 3b» (B1–B16, con su calentamiento la 1.ª vez), y
// después F1 (la medición de «Medir la copia (F1)»), F2 y F3, con la tabla
// para copiar y el grupo K de cada fila.
//
// F1, F2 y F3 usan la escena del banco de 2000 + 3030 cables, armada aparte:
// no tocan la hoja, su copia de recuperación, los recientes, el título ni
// «modificado». F2 y F3 no usan los comandos Guardar ni Abrir
// (medirArchivo.ts). En Tauri escriben un `.brn` con nombre único en la
// carpeta temporal del sistema, que se borra al terminar; en el navegador
// (humo), en memoria («sin disco»).
//
// El menú de desarrollo sale en desarrollo y en las prereleases
// (`mostrarMenuDesarrollo`): «Probar la fase 4» va en el `.msi` de la alpha.

import { isTauri } from "@tauri-apps/api/core";
import { join, tempDir } from "@tauri-apps/api/path";
import { exists, readFile, remove, rename, writeFile } from "@tauri-apps/plugin-fs";
import { serializar } from "../core/io";
import type { Documento } from "../core/model/documento";
import { documentoBancoCables } from "../editor/banco";
import { Editor } from "../editor/editor";
import { Camara } from "../render/camara";
import { Capas } from "../render/capas";
import { escribirSeguro, rutaTemporal } from "./archivos";
import { evaluar, type FilaEvaluada } from "./fase3b";
import { filaF1, filasArchivo, TOPE_ARCHIVO_PC_MS, textoFase4, VUELTAS_ARCHIVO } from "./fase4";
import { discoEnMemoria, medirArchivo, type DiscoMedicion } from "./medirArchivo";
import { COPIAS_DE_UNA_VEZ, COPIAS_F1, medirCopias, motor, resumirF1, TOPE_F1_PC_MS } from "./medirCopia";
import { fechaCorta, medirConCalentamiento } from "./probarFase3b";
import { SIMBOLOS_BANCO_CABLES } from "./escenas";
import { VERSION } from "./version";

const respirar = () => new Promise((r) => setTimeout(r, 0));
const unDecimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const ms = (n: number) => unDecimal.format(n);

/**
 * Un `.brn` con nombre único en la carpeta temporal del sistema, escrito como
 * Guardar (`.tmp` y renombrar). `borrar` quita el archivo y su `.tmp`.
 */
async function discoTemporal(): Promise<DiscoMedicion> {
  const nombre = `bornera-medicion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.brn`;
  const ruta = await join(await tempDir(), nombre);
  return {
    conDisco: true,
    escribir: (bytes) => escribirSeguro(ruta, bytes, { writeFile, rename, remove }),
    leer: () => readFile(ruta),
    borrar: async () => {
      for (const r of [ruta, rutaTemporal(ruta)]) if (await exists(r)) await remove(r);
    },
  };
}

/**
 * Lo que hace Abrir después de leer, en un lienzo aparte: el editor del
 * documento (su escena), la cámara encuadrada y el primer cuadro, rasterizado.
 */
function dibujarAbierto(ancho: number, alto: number): (doc: Documento) => void {
  return (doc) => {
    const ed = new Editor(doc);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Sin Canvas 2D.");
    const capas = new Capas(ctx);
    capas.contenido = ed.escena;
    const camara = new Camara();
    const caja = ed.escena.caja;
    if (caja) camara.encuadrar(caja, ancho, alto);
    capas.dibujar(camara, ancho, alto, 1);
    ctx.getImageData(0, 0, 1, 1); // fuerza el rasterizado, como el banco
  };
}

/** Lo medido por «Probar la fase 4», para su tabla y para la de la fase 5. */
export interface MedidoFase4 {
  filas: FilaEvaluada[];
  notas: string[];
  /** El encabezado sin el nombre de la prueba ni los segundos. */
  condiciones: string;
  /** La escena de F1–F3 (2000 + 3030 cables). */
  doc: Documento;
  ancho: number;
  alto: number;
}

/** Corre B1–B16, F1, F2 y F3, y devuelve la tabla para copiar. */
export async function probarFase4(progreso: (paso: string) => void = () => {}): Promise<string> {
  const inicio = performance.now();
  const m = await medirFase4(progreso);
  const segundos = Math.round((performance.now() - inicio) / 1000);
  return textoFase4(m.filas, `Probar la fase 4 · ${m.condiciones} · ${segundos} s`, [...m.notas, ""]);
}

/** Corre B1–B16, F1, F2 y F3. */
export async function medirFase4(progreso: (paso: string) => void = () => {}): Promise<MedidoFase4> {
  const b = await medirConCalentamiento(progreso);

  progreso("armando la escena de 2000 con cables");
  await respirar();
  const doc = documentoBancoCables(SIMBOLOS_BANCO_CABLES);
  let cables = 0;
  for (const h of doc.hojas) cables += h.cables.length;

  const copia = await medirCopias(doc, COPIAS_F1, (t) => progreso(`F1: ${t}`), COPIAS_DE_UNA_VEZ);
  const r1 = resumirF1(copia.muestras);

  const disco = isTauri() ? await discoTemporal() : discoEnMemoria();
  const archivo = await medirArchivo(doc, disco, {
    vueltas: VUELTAS_ARCHIVO,
    primerCuadro: dibujarAbierto(b.ancho, b.alto),
    progreso: (t) => progreso(`F2 y F3: ${t}`),
  });
  const abrir = archivo.muestras.map((m) => m.abrir);

  const filas = [...evaluar(b.medidas), filaF1(copia.muestras), ...filasArchivo(archivo.muestras)];
  const condiciones =
    `Bornera ${VERSION} · ${fechaCorta()} · ${motor()} · ${b.calentamiento}` +
    `lienzo ${b.ancho}×${b.alto} fuera de pantalla · ${disco.conDisco ? "con disco" : "sin disco"}`;
  const notas = [
    `F1, F2 y F3: escena de ${SIMBOLOS_BANCO_CABLES} símbolos + ${cables} cables (texto de ${serializar(doc).length} caracteres).`,
    `F1: ${r1.copias} copias por partes; después, ${r1.emergencia.veces} de una vez (salida de emergencia, no decide: máx. ${ms(r1.emergencia.maximo)} ms). ` +
      `La última copia, releída, ${copia.igual ? "es igual a serializar" : "NO es igual a serializar (MAL)"}.`,
    `F2 y F3: ${VUELTAS_ARCHIVO} vueltas sin los comandos Guardar ni Abrir, ` +
      `${disco.conDisco ? "en un .brn temporal (borrado al terminar)" : "sin disco (en memoria)"}, ${archivo.bytes} bytes con gzip. ` +
      `De F3, hasta el documento (leer, desempaquetar, deserializar): máx. ${ms(Math.max(...abrir))} ms. ` +
      `Lo abierto ${archivo.igual ? "es igual al documento" : "NO es igual al documento (MAL)"}.`,
    `Topes en la PC (C1): F1 ≤ ${TOPE_F1_PC_MS} ms; F2 y F3 ≤ ${TOPE_ARCHIVO_PC_MS} ms.`,
  ];
  return { filas, notas, condiciones, doc, ancho: b.ancho, alto: b.alto };
}
