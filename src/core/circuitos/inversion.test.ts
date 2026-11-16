// La inversión de giro de referencia (cierre 3b, etapa 1): componentes,
// cables, redes, uniones, validaciones, listas de referencias, deshacer y
// rehacer, y guardar y abrir. Las cajas de las listas (que no tapen nada)
// usan las del dibujo, que `src/core` no puede importar: están en
// `src/editor/inversionProcedimiento.test.ts`, con el procedimiento a mano.

import { describe, expect, it } from "vitest";
import { deserializar, serializar } from "../io";
import { invariantes } from "../io/prueba-invariantes";
import { borneDe, indexarHoja, nodoExtremo, recorridoCable, validarHoja } from "../model/cables";
import { crearDocumento, type Hoja } from "../model/documento";
import { redes, type Red } from "../model/redes";
import { referenciasCruzadas, textoFila } from "../model/referencias";
import { consultaHoja, prepararCableExistente } from "../model/trazado";
import { uniones } from "../model/uniones";
import { validar } from "../model/validaciones";
import { buscarSimbolo } from "../symbols";
import { compararRedes } from "./compararRedes";
import { DX_RAMA_K2, inversion, META_INVERSION } from "./inversion";
import { marchaParada } from "./marchaParada";

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Las redes escritas como en la tabla del plan: "etiqueta·borne" ("K1·13" es el NA de K1; "K1·A1", su bobina). */
function legibles(hoja: Hoja, lista: Red[]): string[][] {
  const etiqueta = new Map(hoja.componentes.map((c) => [c.id, c.etiqueta]));
  return lista.map((r) => r.bornes.map((x) => `${etiqueta.get(x.comp)}·${x.borne}`));
}

/** Pasos de deshacer del armado: 13 Colocar, 11 CambiarEtiqueta (L y N quedan con la inicial) y 17 Cablear. */
const PASOS = 13 + 11 + 17;

describe("inversión: armado", () => {
  it("componentes: tipo, etiqueta, lugar y bornes como en la tabla del plan", () => {
    const { doc } = inversion();
    const filas = doc.hojas[0]!.componentes.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      etiqueta: c.etiqueta,
      lugar: [c.x, c.y, c.rot, c.espejado],
      bornes: buscarSimbolo(c.tipo)!.bornes.map((d) => {
        const p = borneDe(c, d.nombre)!;
        return `${d.nombre} (${p.x}, ${p.y})`;
      }),
    }));
    expect(DX_RAMA_K2).toBe(21);
    expect(filas).toEqual([
      { id: "c1", tipo: "fuente.fase", etiqueta: "L", lugar: [0, 0, 0, false], bornes: ["L (0, 1)"] },
      { id: "c2", tipo: "pulsador.nc", etiqueta: "S0", lugar: [0, 5, 0, false], bornes: ["11 (0, 3)", "12 (0, 7)"] },
      { id: "c3", tipo: "pulsador.na", etiqueta: "S1", lugar: [0, 11, 0, false], bornes: ["13 (0, 9)", "14 (0, 13)"] },
      { id: "c4", tipo: "contactor.auxiliar_na", etiqueta: "K1", lugar: [10, 11, 0, false], bornes: ["13 (10, 9)", "14 (10, 13)"] },
      { id: "c5", tipo: "contactor.auxiliar_nc", etiqueta: "K2", lugar: [0, 17, 0, false], bornes: ["21 (0, 15)", "22 (0, 19)"] },
      { id: "c6", tipo: "contactor.bobina", etiqueta: "K1", lugar: [0, 28, 0, false], bornes: ["A1 (0, 26)", "A2 (0, 30)"] },
      { id: "c7", tipo: "senalizacion.lampara", etiqueta: "H1", lugar: [16, 28, 0, false], bornes: ["X1 (16, 26)", "X2 (16, 30)"] },
      { id: "c8", tipo: "pulsador.na", etiqueta: "S2", lugar: [21, 11, 0, false], bornes: ["13 (21, 9)", "14 (21, 13)"] },
      { id: "c9", tipo: "contactor.auxiliar_na", etiqueta: "K2", lugar: [31, 11, 0, false], bornes: ["13 (31, 9)", "14 (31, 13)"] },
      { id: "c10", tipo: "contactor.auxiliar_nc", etiqueta: "K1", lugar: [21, 17, 0, false], bornes: ["21 (21, 15)", "22 (21, 19)"] },
      { id: "c11", tipo: "contactor.bobina", etiqueta: "K2", lugar: [21, 28, 0, false], bornes: ["A1 (21, 26)", "A2 (21, 30)"] },
      { id: "c12", tipo: "senalizacion.lampara", etiqueta: "H2", lugar: [37, 28, 0, false], bornes: ["X1 (37, 26)", "X2 (37, 30)"] },
      { id: "c13", tipo: "fuente.neutro", etiqueta: "N", lugar: [0, 39, 180, false], bornes: ["N (0, 38)"] },
    ]);
  });

  it("cables: a qué conecta cada extremo (borne o T) y su recorrido, como en la tabla del plan", () => {
    const { doc } = inversion();
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    expect(hoja.cables.map((w) => [w.id, nodoExtremo(w.desde), nodoExtremo(w.hasta), recorridoCable(indice, w)])).toEqual([
      // Rama de K1.
      ["w1", "borne:c1:L", "borne:c2:11", [0, 1, 0, 3]],
      ["w2", "borne:c2:12", "borne:c3:13", [0, 7, 0, 9]],
      ["w3", "borne:c2:12", "borne:c4:13", [0, 7, 10, 7, 10, 9]],
      ["w4", "borne:c3:14", "borne:c5:21", [0, 13, 0, 15]],
      ["w5", "borne:c4:14", "borne:c3:14", [10, 13, 0, 13]],
      ["w6", "borne:c5:22", "borne:c6:A1", [0, 19, 0, 26]],
      ["w7", "borne:c6:A2", "borne:c13:N", [0, 30, 0, 38]],
      ["w8", "cable:w6", "borne:c7:X1", [0, 22, 16, 22, 16, 26]],
      ["w9", "cable:w7", "borne:c7:X2", [0, 34, 16, 34, 16, 30]],
      // Rama de K2: los de la copia.
      ["w10", "borne:c8:14", "borne:c10:21", [21, 13, 21, 15]],
      ["w11", "borne:c9:14", "borne:c8:14", [31, 13, 21, 13]],
      ["w12", "borne:c10:22", "borne:c11:A1", [21, 19, 21, 26]],
      ["w13", "cable:w12", "borne:c12:X1", [21, 22, 37, 22, 37, 26]],
      // La copia arriba (a la red común, con una T sobre w3) y abajo (al Neutro, con una T sobre w7).
      ["w14", "borne:c8:13", "borne:c9:13", [21, 9, 21, 7, 31, 7, 31, 9]],
      ["w15", "cable:w3", "cable:w14", [10, 8, 21, 8]],
      ["w16", "borne:c12:X2", "cable:w7", [37, 30, 37, 36, 0, 36]],
      ["w17", "borne:c11:A2", "cable:w16", [21, 30, 21, 36]],
    ]);
  });

  it("cada cable pasa la validación de W también con la hoja terminada, y la hoja es válida", () => {
    const hoja = inversion().doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const consulta = consultaHoja(hoja, indice);
    for (const w of hoja.cables) expect(prepararCableExistente(indice, consulta, w).problemas, w.id).toEqual([]);
    expect(validarHoja(hoja)).toEqual([]);
  });

  it("solo con comandos; deshacer todo deja la hoja vacía y rehacer todo, igual", () => {
    const { doc, historial } = inversion();
    const armado = copia(doc);
    const hoja = armado.hojas[0]!;
    let deshechos = 0;
    while (historial.deshacer()) deshechos++;
    expect(deshechos).toBe(PASOS);
    // Los contadores quedan arriba: `generarId` es la excepción a la regla de los comandos.
    expect(doc).toEqual({ ...crearDocumento(META_INVERSION), contadores: armado.contadores });
    expect(armado.contadores).toEqual({ c: hoja.componentes.length + 1, w: hoja.cables.length + 1 });
    while (historial.rehacer()) deshechos--;
    expect(deshechos).toBe(0);
    expect(doc).toEqual(armado);
  });
});

describe("inversión: conectividad", () => {
  it("7 redes con los 24 bornes, como en la tabla del plan (R1 a R7)", () => {
    const { doc } = inversion();
    const hoja = doc.hojas[0]!;
    const lista = redes(hoja);
    // En el orden de `redes` (el de los componentes): R1, R2, R3, R4, R7, R5, R6 del plan.
    expect(legibles(hoja, lista)).toEqual([
      ["L·L", "S0·11"],
      ["S0·12", "S1·13", "K1·13", "S2·13", "K2·13"],
      ["S1·14", "K1·14", "K2·21"],
      ["K2·22", "K1·A1", "H1·X1"],
      ["K1·A2", "H1·X2", "K2·A2", "H2·X2", "N·N"],
      ["S2·14", "K2·14", "K1·21"],
      ["K1·22", "K2·A1", "H2·X1"],
    ]);
    expect(lista.map((r) => r.nombres)).toEqual([["L"], [], [], [], ["N"], [], []]);
    expect(lista.map((r) => r.cables)).toEqual([
      ["w1"],
      ["w2", "w3", "w14", "w15"],
      ["w4", "w5"],
      ["w6", "w8"],
      ["w7", "w9", "w16", "w17"],
      ["w10", "w11"],
      ["w12", "w13"],
    ]);
    // Cada borne en una sola red, ninguna red sin cable, y unir por nombre no cambia nada.
    const todos = hoja.componentes.flatMap((c) => buscarSimbolo(c.tipo)!.bornes.map((d) => `${c.id}:${d.nombre}`));
    expect(todos).toHaveLength(24);
    expect(lista.flatMap((r) => r.bornes.map((x) => `${x.comp}:${x.borne}`)).sort()).toEqual(todos.sort());
    expect(lista.filter((r) => r.cables.length === 0)).toEqual([]);
    expect(redes(hoja, { unirPorNombre: true })).toEqual(lista);
  });

  it("10 puntos de unión: los tres bornes con dos cables y las siete T", () => {
    expect(uniones(inversion().doc.hojas[0]!)).toEqual([
      { x: 0, y: 7, cables: ["w2", "w3"], componentes: ["c2"] },
      { x: 10, y: 8, cables: ["w15", "w3"], componentes: [] },
      { x: 21, y: 8, cables: ["w14", "w15"], componentes: [] },
      { x: 0, y: 13, cables: ["w4", "w5"], componentes: ["c3"] },
      { x: 21, y: 13, cables: ["w10", "w11"], componentes: ["c8"] },
      { x: 0, y: 22, cables: ["w6", "w8"], componentes: [] },
      { x: 21, y: 22, cables: ["w12", "w13"], componentes: [] },
      { x: 0, y: 34, cables: ["w7", "w9"], componentes: [] },
      { x: 0, y: 36, cables: ["w16", "w7"], componentes: [] },
      { x: 21, y: 36, cables: ["w16", "w17"], componentes: [] },
    ]);
  });

  it("compararRedes: contra sí misma, 0 diferencias; contra la marcha-parada, las hay", () => {
    expect(compararRedes(inversion().doc, inversion().doc)).toEqual([]);
    expect(compararRedes(inversion().doc, marchaParada().doc)).not.toEqual([]);
  });
});

describe("inversión: validaciones y referencias (criterios de la fase 3b)", () => {
  it("«nada naranja»: R1 a R9 dan cero", () => {
    expect(validar(inversion().doc.hojas[0]!)).toEqual([]);
  });

  it("las listas de K1 y K2 (condiciones 1 a 3 de T18): exactamente sus contactos, con clase, bornes y el centro del contacto", () => {
    const { doc, comp: c } = inversion();
    const refs = referenciasCruzadas(doc.hojas[0]!);
    // Nadie más tiene lista.
    expect([...refs.keys()]).toEqual([c.k1Bobina, c.k2Bobina]);
    expect(refs.get(c.k1Bobina)).toEqual([
      { contacto: c.k1Auxiliar, clase: "NA", bornes: ["13", "14"], ubicacion: { hoja: 0, x: 10, y: 11 } },
      { contacto: c.k1AuxiliarNC, clase: "NC", bornes: ["21", "22"], ubicacion: { hoja: 0, x: 21, y: 17 } },
    ]);
    expect(refs.get(c.k2Bobina)).toEqual([
      { contacto: c.k2Auxiliar, clase: "NA", bornes: ["13", "14"], ubicacion: { hoja: 0, x: 31, y: 11 } },
      { contacto: c.k2AuxiliarNC, clase: "NC", bornes: ["21", "22"], ubicacion: { hoja: 0, x: 0, y: 17 } },
    ]);
    expect(refs.get(c.k1Bobina)!.map(textoFila)).toEqual(["NA 13-14 (10, 11)", "NC 21-22 (21, 17)"]);
    expect(refs.get(c.k2Bobina)!.map(textoFila)).toEqual(["NA 13-14 (31, 11)", "NC 21-22 (0, 17)"]);
  });
});

describe("inversión: guardar y abrir", () => {
  it("vuelve igual, sin avisos y con las mismas redes", () => {
    const { doc } = inversion();
    expect(invariantes(doc)).toEqual([]);
    const r = deserializar(serializar(doc));
    if (!r.ok) throw new Error(JSON.stringify(r.errores));
    expect(r.avisos).toEqual([]);
    expect(r.documento).toEqual(doc);
    expect(invariantes(r.documento)).toEqual([]);
    expect(redes(r.documento.hojas[0]!)).toEqual(redes(doc.hojas[0]!));
  });

  it("dos armados dan el mismo archivo", () => {
    expect(serializar(inversion().doc)).toBe(serializar(inversion().doc));
  });
});
