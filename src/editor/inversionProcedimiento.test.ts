// La inversión de giro como la arma Bruno (cierre 3b, D2-A): desde la
// marcha-parada, los pasos de la hoja 2 de docs/netbook-fase3b.md sobre el
// Editor. Ctrl+D es `editor.accion("duplicar")`, la misma función que corre la
// tecla (recorte, lugar al lado y etiquetado de pegar): no se reimplementa.
// Lo demás va por los comandos que usan el panel y W: Mover, borrar, Colocar,
// cambiar la etiqueta y Cablear (con la validación de W antes de cada cable).
//
// Al final, el documento tiene las mismas redes que `inversion()` y nada que
// validar. Con el etiquetado de pegar roto a propósito (mutantes), las
// comprobaciones fallan: si el test pasara igual, no estaría probando Ctrl+D.
//
// También las cajas de las listas de K1 y K2, en la referencia y en lo que da
// el procedimiento: ninguna toca nada (condición 4 de docs/plan-T18.md).

import { describe, expect, it, vi } from "vitest";
import { compararRedes } from "../core/circuitos/compararRedes";
import { DX_RAMA_K2, inversion } from "../core/circuitos/inversion";
import { marchaParada } from "../core/circuitos/marchaParada";
import { indexarHoja, validarHoja } from "../core/model/cables";
import { cablear, colocar, Mover } from "../core/model/comandos";
import type { Documento, Extremo, Hoja } from "../core/model/documento";
import { referenciasCruzadas, textoFila } from "../core/model/referencias";
import { consultaHoja, geometriaComponente, prepararCable, problemasComponente } from "../core/model/trazado";
import { validar, type Aviso } from "../core/model/validaciones";
import { buscarSimbolo } from "../core/symbols";
import { Editor, type DestinoVista } from "./editor";
import { cajaLista, HOLGURA_MINIMA, obstaculos, revisar } from "./prueba-cajas";

class VistaFalsa implements DestinoVista {
  invalidarRegion(): void {}
  invalidar(): void {}
}

const borne = (comp: string, nombre: string): Extremo => ({ tipo: "borne", comp, borne: nombre });
const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

/** Lo que deja el procedimiento para comprobar. */
interface Procedimiento {
  doc: Documento;
  /** Los avisos del editor (la barra) durante todo el procedimiento. */
  avisos: string[];
  /** Ids de la rama de K1 antes de Ctrl+D. */
  rama: string[];
  /** Lo que aparece con Ctrl+D: "tipo etiqueta (x, y)", en el orden de la hoja. */
  copia: string[];
  /** Un deshacer quita toda la copia y un rehacer la devuelve igual (Ctrl+D es un paso). */
  unPaso: boolean;
  /** `validar` antes de colocar el NC, al colocarlo, justo después de Ctrl+D, al renombrar el NC de la copia y al final. */
  validarAntes: Aviso[];
  validarConNC: Aviso[];
  validarTrasDuplicar: Aviso[];
  validarTrasRenombrar: Aviso[];
  validarFinal: Aviso[];
  /** Id del NC de la copia (el que se renombra a "K1"). */
  ncCopia: string;
}

/**
 * Los pasos de la hoja 2 con el `Editor` que se pase (el de verdad o uno con
 * el etiquetado roto). Tira solo si algo no se puede hacer (un cable que W no
 * deja, un componente que no aparece); lo demás lo comprueba el test.
 */
function procedimiento(ClaseEditor: typeof Editor): Procedimiento {
  const mp = marchaParada();
  const editor = new ClaseEditor(mp.doc);
  editor.vista = new VistaFalsa();
  const avisos: string[] = [];
  editor.alAvisar = (t) => avisos.push(t);
  const hoja = (): Hoja => editor.documento.hojas[0]!;
  const { s1, k1Auxiliar, k1Bobina, h1, neutro } = mp.comp;
  const [, , w3, w4, , w6, w7, w8] = mp.cables as [string, string, string, string, string, string, string, string];

  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []): string => {
    const indice = indexarHoja(hoja());
    const { problemas } = prepararCable(indice, consultaHoja(hoja(), indice), { desde, hasta, codos });
    if (problemas.length > 0) throw new Error(`W no deja el cable ${JSON.stringify({ desde, hasta, codos })}: ${problemas.map((p) => p.mensaje).join(" ")}`);
    const cmd = cablear(editor.documento, { desde, hasta, codos });
    editor.ejecutar(cmd);
    return cmd.id;
  };

  // 1. Abrir: «Sin avisos».
  const validarAntes = validar(hoja());
  // 2. Hacer lugar: la bobina, H1 y N con sus cables (los de adentro del rectángulo) bajan 6.
  editor.seleccionarIds([k1Bobina, h1, neutro, w6, w8]);
  editor.ejecutar(new Mover(editor.seleccion, 0, 6));
  // 3. Borrar el cable S1·14–A1 y el de la T de H1. Borrar solo w4 deja w7
  //    con un extremo suelto en (0, 16), donde va el NC: se borran los dos.
  editor.seleccionarIds([w4, w7]);
  if (!editor.accion("borrar")) throw new Error("No se borraron w4 y w7.");
  // 4. Colocar el NC y ponerle "K2" (panel y Enter).
  const defNC = buscarSimbolo("contactor.auxiliar_nc")!;
  const datosNC = { tipo: defNC.tipo, x: 0, y: 17, rot: 0 as const, espejado: false, etiqueta: defNC.etiquetaInicial ?? "", params: {} };
  // Lo que revisa Colocar antes de soltar: nada encimado ni conexiones aparentes.
  const lugar = problemasComponente(geometriaComponente({ id: "nuevo", ...datosNC })!, consultaHoja(hoja()));
  if (lugar.length > 0) throw new Error(`Colocar no deja el NC en (0, 17): ${lugar.map((p) => p.mensaje).join(" ")}`);
  const colocarNC = colocar(editor.documento, datosNC);
  editor.ejecutar(colocarNC);
  const nc = colocarNC.id;
  if (!editor.cambiarEtiqueta(nc, "K2")) throw new Error("No se renombró el NC.");
  const validarConNC = validar(hoja());
  // 5. W: S1·14 → NC·21 y NC·22 → K1·A1.
  tender(borne(s1, "14"), borne(nc, "21"));
  const wNCA1 = tender(borne(nc, "22"), borne(k1Bobina, "A1"));
  // 6. H1 otra vez en paralelo con la bobina: una T sobre NC·22–A1.
  tender(enCable(wNCA1, 0, 22), borne(h1, "X1"), [[16, 22]]);

  // 7. La rama de K1 con todos los cables: `recortar` se queda con los de adentro.
  const rama = [s1, k1Auxiliar, nc, k1Bobina, h1];
  editor.seleccionarIds([...rama, ...hoja().cables.map((w) => w.id)]);
  const antes = new Set([...hoja().componentes, ...hoja().cables].map((k) => k.id));
  // 8. Ctrl+D.
  if (!editor.accion("duplicar")) throw new Error("Ctrl+D no hizo nada.");
  const ids = () => [...hoja().componentes, ...hoja().cables].map((k) => k.id);
  const despues = JSON.stringify(editor.documento);
  editor.deshacer();
  const sinCopia = ids().length === antes.size && ids().every((id) => antes.has(id));
  editor.rehacer();
  const unPaso = sinCopia && JSON.stringify(editor.documento) === despues;
  const nuevos = hoja().componentes.filter((c) => !antes.has(c.id));
  const copia = nuevos.map((c) => `${c.tipo} ${c.etiqueta} (${c.x}, ${c.y})`);
  const validarTrasDuplicar = validar(hoja());
  const de = (tipo: string) => {
    const c = nuevos.find((k) => k.tipo === tipo);
    if (!c) throw new Error(`La copia no tiene ${tipo}.`);
    return c.id;
  };
  const s2 = de("pulsador.na");
  const k2Auxiliar = de("contactor.auxiliar_na");
  const ncCopia = de("contactor.auxiliar_nc");
  const k2Bobina = de("contactor.bobina");
  const h2 = de("senalizacion.lampara");

  // 9. El NC de la copia pasa a "K1".
  if (!editor.cambiarEtiqueta(ncCopia, "K1")) throw new Error("No se renombró el NC de la copia.");
  const validarTrasRenombrar = validar(hoja());
  // 10. Arriba: S2·13 con K2·13, y ese cable con una T a w3 (la red común).
  const dx = DX_RAMA_K2;
  const wArriba = tender(borne(s2, "13"), borne(k2Auxiliar, "13"), [
    [dx, 7],
    [dx + 10, 7],
  ]);
  tender(enCable(w3, 10, 8), enCable(wArriba, dx, 8));
  // 11. Abajo: H2·X2 con una T al cable que baja al Neutro (w6, ya movido) y K2·A2 con una T a ese.
  const wAbajo = tender(borne(h2, "X2"), enCable(w6, 0, 36), [[dx + 16, 36]]);
  tender(borne(k2Bobina, "A2"), enCable(wAbajo, dx, 36));

  return {
    doc: editor.documento,
    avisos,
    rama,
    copia,
    unPaso,
    validarAntes,
    validarConNC,
    validarTrasDuplicar,
    validarTrasRenombrar,
    validarFinal: validar(hoja()),
    ncCopia,
  };
}

/** Hasta Ctrl+D, lo que no depende del etiquetado de pegar. Tira (con `expect`) en la primera diferencia. */
function comprobarAntes(p: Procedimiento): void {
  expect(p.validarAntes, "La marcha-parada abre «Sin avisos»").toEqual([]);
  // Con el NC "K2" colocado y sin cablear: R2 (todavía no hay bobina K2) y
  // R7 por cada borne suelto (A1 de K1 y X1 de H1, que quedaron sin cable
  // en el paso 3, y los dos del NC).
  expect(p.validarConNC).toEqual([
    { regla: "R7", severidad: "aviso", id: "c5", borne: "A1" },
    { regla: "R7", severidad: "aviso", id: "c6", borne: "X1" },
    { regla: "R2", severidad: "aviso", id: "c8", etiqueta: "K2" },
    { regla: "R7", severidad: "aviso", id: "c8", borne: "21" },
    { regla: "R7", severidad: "aviso", id: "c8", borne: "22" },
  ]);
  // Ctrl+D pegó al lado, sin la previa de «No hay lugar al lado», en un paso.
  expect(p.avisos).toEqual([]);
  expect(p.unPaso).toBe(true);
}

/** La copia que deja Ctrl+D (lo que decide el etiquetado de pegar). */
function comprobarCopia(p: Procedimiento): void {
  // S2, K2 (NA), K2 (bobina) y H2 renumerados y el NC conserva "K2", con dx = 21.
  expect(p.copia).toEqual(COPIA);
  // Antes de renombrar, R6 avisa ese NC; los R7 son los 4 bornes de la copia
  // que todavía no van a la red común ni al Neutro (S2·13, K2·13, K2·A2 y H2·X2).
  const sueltos: Aviso[] = [
    { regla: "R7", severidad: "aviso", id: "c9", borne: "13" },
    { regla: "R7", severidad: "aviso", id: "c10", borne: "13" },
    { regla: "R7", severidad: "aviso", id: "c11", borne: "A2" },
    { regla: "R7", severidad: "aviso", id: "c12", borne: "X2" },
  ];
  expect(p.ncCopia).toBe("c13");
  expect(p.validarTrasDuplicar).toEqual([...sueltos, { regla: "R6", severidad: "aviso", id: "c13", etiqueta: "K2" }]);
  // Con el NC renombrado a "K1", R6 se va y quedan los bornes sueltos.
  expect(p.validarTrasRenombrar).toEqual(sueltos);
}

/** Al final: las redes de la referencia y «Sin avisos». */
function comprobarFinal(p: Procedimiento): void {
  expect(compararRedes(p.doc, inversion().doc)).toEqual([]);
  expect(p.validarFinal).toEqual([]);
  expect(validarHoja(p.doc.hojas[0]!)).toEqual([]);
}

/** Lo que aparece con Ctrl+D, en el orden de la hoja. */
const COPIA = [
  `pulsador.na S2 (${DX_RAMA_K2}, 11)`,
  `contactor.auxiliar_na K2 (${DX_RAMA_K2 + 10}, 11)`,
  `contactor.bobina K2 (${DX_RAMA_K2}, 28)`,
  `senalizacion.lampara H2 (${DX_RAMA_K2 + 16}, 28)`,
  `contactor.auxiliar_nc K2 (${DX_RAMA_K2}, 17)`,
];

/** Las listas de K1 y K2 y lo que toca cada caja. */
function listas(doc: Documento) {
  const hoja = doc.hojas[0]!;
  const refs = referenciasCruzadas(hoja);
  const bobina = (etiqueta: string) => hoja.componentes.find((c) => c.tipo === "contactor.bobina" && c.etiqueta === etiqueta)!;
  return ["K1", "K2"].map((e) => {
    const b = bobina(e);
    const lineas = refs.get(b.id)!.map(textoFila);
    return { etiqueta: e, lineas, ...revisar(cajaLista(b, lineas), obstaculos(hoja, b.id)) };
  });
}

describe("inversión: el procedimiento de la hoja 2 con el Ctrl+D del editor (D2-A)", () => {
  it("desde la marcha-parada, Ctrl+D y el renombrado del NC dan las redes de inversion() y «Sin avisos»", () => {
    const p = procedimiento(Editor);
    comprobarAntes(p);
    comprobarCopia(p);
    comprobarFinal(p);
  });

  it("la copia queda donde la rama de K2 de inversion(): mismos tipos, etiquetas y lugares", () => {
    const p = procedimiento(Editor);
    const ref = inversion();
    const fila = (c: { tipo: string; etiqueta: string; x: number; y: number; rot: number; espejado: boolean }) => `${c.tipo} ${c.etiqueta} (${c.x}, ${c.y}) ${c.rot} ${c.espejado}`;
    expect(p.doc.hojas[0]!.componentes.map(fila).sort()).toEqual(ref.doc.hojas[0]!.componentes.map(fila).sort());
  });

  it("las listas de K1 y K2 tienen dos filas y no tocan nada, en la referencia y en lo que da el procedimiento", () => {
    for (const doc of [inversion().doc, procedimiento(Editor).doc]) {
      const [k1, k2] = listas(doc);
      expect(k1!.lineas).toEqual(["NA 13-14 (10, 11)", `NC 21-22 (${DX_RAMA_K2}, 17)`]);
      expect(k2!.lineas).toEqual([`NA 13-14 (${DX_RAMA_K2 + 10}, 11)`, "NC 21-22 (0, 17)"]);
      for (const l of [k1!, k2!]) {
        expect(l.tocados, `lista de ${l.etiqueta}`).toEqual([]);
        expect(l.holgura, `lista de ${l.etiqueta}`).toBeGreaterThanOrEqual(HOLGURA_MINIMA);
        // Medida (anotada en el plan): los cables de la propia bobina, a 1,4 en x, como la rama NC de T18.
        expect(l.holgura, `lista de ${l.etiqueta}`).toBeCloseTo(1.4, 6);
      }
    }
  });
});

describe("inversión: con el etiquetado de pegar roto a propósito, el procedimiento falla", () => {
  // `etiquetarLote` (núcleo) es lo que el editor llama al pegar y duplicar.
  // Se reemplaza solo para un Editor cargado de nuevo; el resto sigue igual.
  type Etiquetado = typeof import("../core/model/etiquetado");
  const MUTANTES: [string, (original: Etiquetado["etiquetarLote"]) => Etiquetado["etiquetarLote"]][] = [
    ["sin renumerar: la copia conserva S1, K1, K1 y H1", () => () => new Map()],
    [
      "los contactos no siguen a la bobina renumerada: el NA de la copia queda K1",
      (original) => (usadas, lote) => {
        const cambios = original(usadas, lote);
        for (const c of lote) if (c.tipo === "contactor.auxiliar_na") cambios.delete(c.id);
        return cambios;
      },
    ],
    [
      "cuenta la etiqueta del NC como usada: la bobina de la copia y su NA salen K3",
      (original) => (usadas, lote) => original([...usadas, "K2"], lote),
    ],
  ];

  it.each(MUTANTES)("%s", async (_n, mutar) => {
    vi.resetModules();
    vi.doMock("../core/model/etiquetado", async (importOriginal) => {
      const original = await importOriginal<Etiquetado>();
      return { ...original, etiquetarLote: mutar(original.etiquetarLote) };
    });
    try {
      const { Editor: EditorMutante } = await import("./editor");
      const p = procedimiento(EditorMutante);
      // Hasta Ctrl+D, todo igual: lo que se rompe es la copia y, con ella, las redes.
      comprobarAntes(p);
      expect(() => comprobarCopia(p)).toThrow();
      expect(p.copia).not.toEqual(COPIA);
      expect(compararRedes(p.doc, inversion().doc)).not.toEqual([]);
    } finally {
      vi.doUnmock("../core/model/etiquetado");
      vi.resetModules();
    }
  });
});
