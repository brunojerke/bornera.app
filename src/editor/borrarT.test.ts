// Borrar un cable con T colgando, en el editor (T26, D7-A): Supr y Cortar se
// llevan los cables en T en el mismo paso, la barra lo avisa una vez y Ctrl+Z
// los trae. Después de cada paso, las uniones, los avisos y las referencias
// del editor tienen que dar lo mismo que calcularlos de cero.

import { afterEach, describe, expect, it } from "vitest";
import { marchaParada } from "../core/circuitos/marchaParada";
import { Borrar } from "../core/model/comandos";
import type { Documento } from "../core/model/documento";
import { referenciasCruzadas, textoFila } from "../core/model/referencias";
import { uniones } from "../core/model/uniones";
import { contarAvisos, validar } from "../core/model/validaciones";
import { AVISO_RECORTE_VACIO, Editor, textoCascada } from "./editor";
import { recorteGuardado, vaciarPortapapeles } from "./portapapeles";

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

afterEach(() => {
  vaciarPortapapeles();
});

/**
 * La marcha-parada con la rama del NC: w4 va de S1·14 a K1·A1 y w7 cuelga de
 * w4 en T y llega a H1·X1 (el paso 3 de la hoja 2).
 */
function armar() {
  const mp = marchaParada({ ramaNC: true });
  const editor = new Editor(mp.doc);
  const avisos: string[] = [];
  editor.alAvisar = (t) => avisos.push(t);
  const [, , , w4, , , w7] = mp.cables as [string, string, string, string, string, string, string];
  return { mp, editor, avisos, w4, w7 };
}

/** Lo derivado del editor contra un cálculo de cero. Devuelve las diferencias. */
function diferencias(editor: Editor): string[] {
  const hoja = editor.documento.hojas[0]!;
  const salida: string[] = [];
  if (JSON.stringify(editor.uniones.todas()) !== JSON.stringify(uniones(hoja))) salida.push("uniones");
  const esperado = validar(hoja);
  if (JSON.stringify(editor.avisos.lista()) !== JSON.stringify(esperado)) salida.push("avisos");
  if (JSON.stringify(editor.avisos.cuenta) !== JSON.stringify(contarAvisos(esperado))) salida.push("cuenta");
  const refs = new Map([...referenciasCruzadas(hoja)].map(([id, filas]) => [id, filas.map(textoFila)]));
  if (JSON.stringify([...editor.referencias.todas()]) !== JSON.stringify([...refs])) salida.push("referencias");
  return salida;
}

const ids = (doc: Documento) => doc.hojas[0]!.cables.map((w) => w.id);

describe("borrar un cable con T colgando (T26)", () => {
  it("el texto del aviso, en singular y en plural", () => {
    expect(textoCascada(1)).toBe("Se borró también 1 cable en T.");
    expect(textoCascada(3)).toBe("Se borraron también 3 cables en T.");
  });

  it("Supr sobre w4 se lleva w7 en un paso, con un aviso; Ctrl+Z los trae a su lugar; Ctrl+Y los vuelve a borrar sin otro aviso", () => {
    const { mp, editor, avisos, w4, w7 } = armar();
    const antes = copia(editor.documento);
    expect(editor.historial.puedeDeshacer).toBe(false);
    expect(diferencias(editor)).toEqual([]);

    editor.seleccionarIds([w4]);
    expect(editor.accion("borrar")).toBe(true);
    expect(editor.historial.siguienteDeshacer).toBeInstanceOf(Borrar);
    expect(ids(editor.documento)).not.toContain(w4);
    expect(ids(editor.documento)).not.toContain(w7);
    expect(ids(editor.documento)).toHaveLength(mp.cables.length - 2);
    // H1 queda igual: w7 no se suelta, se va entero.
    expect(editor.documento.hojas[0]!.componentes).toEqual(antes.hojas[0]!.componentes);
    expect(avisos).toEqual([textoCascada(1)]);
    expect(diferencias(editor)).toEqual([]);
    const borrado = copia(editor.documento);

    // Un solo paso: un Ctrl+Z vuelve al principio.
    editor.deshacer();
    expect(editor.historial.puedeDeshacer).toBe(false);
    expect(editor.documento).toEqual(antes);
    const w = editor.documento.hojas[0]!.cables.find((k) => k.id === w7)!;
    expect(w.desde).toMatchObject({ tipo: "cable", cable: w4 });
    expect(w.hasta).toEqual({ tipo: "borne", comp: mp.comp.h1, borne: "X1" });
    expect(diferencias(editor)).toEqual([]);

    editor.rehacer();
    expect(editor.documento).toEqual(borrado);
    expect(diferencias(editor)).toEqual([]);
    expect(avisos).toEqual([textoCascada(1)]);
  });

  it("w4 y w7 elegidos juntos (Mayús+clic, como la hoja 2): el mismo resultado, sin aviso", () => {
    const { editor, avisos, w4, w7 } = armar();
    editor.seleccionarIds([w4, w7]);
    editor.accion("borrar");
    expect(ids(editor.documento)).not.toContain(w7);
    expect(avisos).toEqual([]);
    expect(diferencias(editor)).toEqual([]);
  });

  it("Cortar también borra en cascada: el cable en T no entra al recorte, se avisa y Ctrl+Z lo trae", () => {
    const { mp, editor, avisos, w4, w7 } = armar();
    const antes = copia(editor.documento);
    // Un cable solo no se puede cortar (recorte vacío): S1, K1 y w4.
    editor.seleccionarIds([w4]);
    expect(editor.accion("cortar")).toBe(false);
    expect(avisos).toEqual([AVISO_RECORTE_VACIO]);
    avisos.length = 0;

    editor.seleccionarIds([mp.comp.s1, mp.comp.k1Bobina, w4]);
    expect(editor.accion("cortar")).toBe(true);
    const r = recorteGuardado()!;
    expect(r.cables.map((w) => w.id)).toEqual([w4]);
    expect(ids(editor.documento)).not.toContain(w7);
    expect(avisos).toEqual([textoCascada(1)]);
    expect(diferencias(editor)).toEqual([]);

    editor.deshacer();
    expect(editor.documento).toEqual(antes);
    expect(diferencias(editor)).toEqual([]);
  });

  it("borrar solo componentes no avisa", () => {
    const { mp, editor, avisos } = armar();
    editor.seleccionarIds([mp.comp.h1]);
    editor.accion("borrar");
    expect(avisos).toEqual([]);
    expect(diferencias(editor)).toEqual([]);
  });
});
