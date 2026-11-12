import { describe, expect, it } from "vitest";
import { deserializar, serializar } from "../io";
import { invariantes } from "../io/prueba-invariantes";
import { borneDe, indexarHoja, nodoExtremo, recorridoCable, validarHoja } from "../model/cables";
import { CambiarEtiqueta } from "../model/comandos";
import { crearDocumento, type Documento, type Hoja } from "../model/documento";
import { porNombre, redes, type BorneRed, type Red } from "../model/redes";
import { consultaHoja, prepararCableExistente } from "../model/trazado";
import { uniones } from "../model/uniones";
import { buscarSimbolo } from "../symbols";
import { META_MARCHA_PARADA, marchaParada } from "./marchaParada";

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const b = (comp: string, borne: string): BorneRed => ({ comp, borne });
const red = (bornes: BorneRed[], cables: string[] = [], nombres: string[] = []): Red => ({ bornes, cables, nombres });

/** Las redes escritas como en la tabla del plan: "etiqueta·borne" ("K1·13" es el auxiliar; "K1·A1", la bobina). */
function legibles(hoja: Hoja, lista: Red[]): string[][] {
  const etiqueta = new Map(hoja.componentes.map((c) => [c.id, c.etiqueta]));
  return lista.map((r) => r.bornes.map((x) => `${etiqueta.get(x.comp)}·${x.borne}`));
}

/** La partición de los bornes ("comp:borne" por red), sin los bornes de `sin`. */
function particion(lista: Red[], sin?: string): string[][] {
  return lista.map((r) => r.bornes.filter((x) => x.comp !== sin).map((x) => `${x.comp}:${x.borne}`));
}

const CASOS: [string, boolean, number][] = [
  // nombre, dosNeutros, pasos de deshacer (colocar + CambiarEtiqueta + cablear)
  ["base", false, 7 + 5 + 8],
  ["con dos Neutro", true, 8 + 5 + 8],
];

describe("marcha-parada: armado", () => {
  it("componentes: tipo, etiqueta, lugar y bornes como en la tabla del plan", () => {
    const { doc } = marchaParada();
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
    expect(filas).toEqual([
      { id: "c1", tipo: "fuente.fase", etiqueta: "L", lugar: [0, 0, 0, false], bornes: ["L (0, 1)"] },
      { id: "c2", tipo: "pulsador.nc", etiqueta: "S0", lugar: [0, 5, 0, false], bornes: ["11 (0, 3)", "12 (0, 7)"] },
      { id: "c3", tipo: "pulsador.na", etiqueta: "S1", lugar: [0, 11, 0, false], bornes: ["13 (0, 9)", "14 (0, 13)"] },
      { id: "c4", tipo: "contactor.auxiliar_na", etiqueta: "K1", lugar: [10, 11, 0, false], bornes: ["13 (10, 9)", "14 (10, 13)"] },
      { id: "c5", tipo: "contactor.bobina", etiqueta: "K1", lugar: [0, 22, 0, false], bornes: ["A1 (0, 20)", "A2 (0, 24)"] },
      { id: "c6", tipo: "senalizacion.lampara", etiqueta: "H1", lugar: [16, 22, 0, false], bornes: ["X1 (16, 20)", "X2 (16, 24)"] },
      { id: "c7", tipo: "fuente.neutro", etiqueta: "N", lugar: [0, 33, 180, false], bornes: ["N (0, 32)"] },
    ]);
  });

  it("cables: a qué conecta cada extremo (borne o T) y su recorrido, como en la tabla del plan", () => {
    const { doc } = marchaParada();
    const hoja = doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const filas = hoja.cables.map((w) => [w.id, nodoExtremo(w.desde), nodoExtremo(w.hasta), recorridoCable(indice, w)]);
    expect(filas).toEqual([
      ["w1", "borne:c1:L", "borne:c2:11", [0, 1, 0, 3]],
      ["w2", "borne:c2:12", "borne:c3:13", [0, 7, 0, 9]],
      ["w3", "borne:c2:12", "borne:c4:13", [0, 7, 10, 7, 10, 9]],
      ["w4", "borne:c3:14", "borne:c5:A1", [0, 13, 0, 20]],
      ["w5", "borne:c4:14", "borne:c3:14", [10, 13, 0, 13]],
      ["w6", "borne:c5:A2", "borne:c7:N", [0, 24, 0, 32]],
      // Las dos T: sobre w4 en (0, 16) y sobre w6 en (0, 28).
      ["w7", "cable:w4", "borne:c6:X1", [0, 16, 16, 16, 16, 20]],
      ["w8", "cable:w6", "borne:c6:X2", [0, 28, 16, 28, 16, 24]],
    ]);
  });

  it.each(CASOS)("%s: cada cable pasa la validación de W también con la hoja terminada", (_n, dosNeutros) => {
    const hoja = marchaParada({ dosNeutros }).doc.hojas[0]!;
    const indice = indexarHoja(hoja);
    const consulta = consultaHoja(hoja, indice);
    for (const w of hoja.cables) expect(prepararCableExistente(indice, consulta, w).problemas, w.id).toEqual([]);
    expect(validarHoja(hoja)).toEqual([]);
  });

  it.each(CASOS)("%s: solo con comandos; deshacer todo deja la hoja vacía y rehacer todo, igual", (_n, dosNeutros, pasos) => {
    const { doc, historial } = marchaParada({ dosNeutros });
    const armado = copia(doc);
    let deshechos = 0;
    while (historial.deshacer()) deshechos++;
    expect(deshechos).toBe(pasos);
    // Los contadores quedan arriba: `generarId` es la excepción a la regla de los comandos.
    expect(doc).toEqual({ ...crearDocumento(META_MARCHA_PARADA), contadores: armado.contadores });
    expect(armado.contadores).toEqual({ c: dosNeutros ? 9 : 8, w: 9 });
    while (historial.rehacer()) deshechos--;
    expect(deshechos).toBe(0);
    expect(doc).toEqual(armado);
  });
});

describe("marcha-parada: conectividad", () => {
  it("4 redes, por borne compartido (S0·12, S1·14) y por cable (las T)", () => {
    const { doc, comp: c, cables: w } = marchaParada();
    const hoja = doc.hojas[0]!;
    const lista = redes(hoja);
    expect(lista).toEqual([
      red([b(c.fase, "L"), b(c.s0, "11")], [w[0]!], ["L"]),
      red([b(c.s0, "12"), b(c.s1, "13"), b(c.k1Auxiliar, "13")], [w[1]!, w[2]!]),
      red([b(c.s1, "14"), b(c.k1Auxiliar, "14"), b(c.k1Bobina, "A1"), b(c.h1, "X1")], [w[3]!, w[4]!, w[6]!]),
      red([b(c.k1Bobina, "A2"), b(c.h1, "X2"), b(c.neutro, "N")], [w[5]!, w[7]!], ["N"]),
    ]);
    expect(legibles(hoja, lista)).toEqual([
      ["L·L", "S0·11"],
      ["S0·12", "S1·13", "K1·13"],
      ["S1·14", "K1·14", "K1·A1", "H1·X1"],
      ["K1·A2", "H1·X2", "N·N"],
    ]);
    // Unir por nombre no cambia nada: hay una sola red con cada nombre.
    expect(redes(hoja, { unirPorNombre: true })).toEqual(lista);
  });

  it.each(CASOS)("%s: cada borne está en una sola red y ninguna red queda sin cable", (_n, dosNeutros) => {
    const hoja = marchaParada({ dosNeutros }).doc.hojas[0]!;
    const lista = redes(hoja);
    const todos = hoja.componentes.flatMap((c) => buscarSimbolo(c.tipo)!.bornes.map((d) => `${c.id}:${d.nombre}`));
    expect(particion(lista).flat().sort()).toEqual(todos.sort());
    expect(lista.filter((r) => r.cables.length === 0)).toEqual([]);
  });

  it("4 puntos de unión: los dos bornes con dos cables y las dos T", () => {
    expect(uniones(marchaParada().doc.hojas[0]!)).toEqual([
      { x: 0, y: 7, cables: ["w2", "w3"], componentes: ["c2"] },
      { x: 0, y: 13, cables: ["w4", "w5"], componentes: ["c3"] },
      { x: 0, y: 16, cables: ["w4", "w7"], componentes: [] },
      { x: 0, y: 28, cables: ["w6", "w8"], componentes: [] },
    ]);
  });
});

describe("marcha-parada con dos Neutro", () => {
  it("la lámpara va derecho a su propio Neutro, sin T en w6", () => {
    const { doc, comp } = marchaParada({ dosNeutros: true });
    const hoja = doc.hojas[0]!;
    const n2 = hoja.componentes.find((k) => k.id === comp.neutro2)!;
    expect([n2.id, n2.tipo, n2.etiqueta, n2.x, n2.y, n2.rot]).toEqual(["c8", "fuente.neutro", "N", 16, 33, 180]);
    const w8 = hoja.cables.find((w) => w.id === "w8")!;
    expect([nodoExtremo(w8.desde), nodoExtremo(w8.hasta), recorridoCable(indexarHoja(hoja), w8)]).toEqual(["borne:c6:X2", "borne:c8:N", [16, 24, 16, 32]]);
    expect(uniones(hoja).map((u) => [u.x, u.y])).toEqual([
      [0, 7],
      [0, 13],
      [0, 16],
    ]);
  });

  it("por cables, 5 redes; por nombre se unirían las dos de N (anotado, sin simular)", () => {
    const { doc, comp: c, cables: w } = marchaParada({ dosNeutros: true });
    const hoja = doc.hojas[0]!;
    const lista = redes(hoja);
    expect(lista).toEqual([
      red([b(c.fase, "L"), b(c.s0, "11")], [w[0]!], ["L"]),
      red([b(c.s0, "12"), b(c.s1, "13"), b(c.k1Auxiliar, "13")], [w[1]!, w[2]!]),
      red([b(c.s1, "14"), b(c.k1Auxiliar, "14"), b(c.k1Bobina, "A1"), b(c.h1, "X1")], [w[3]!, w[4]!, w[6]!]),
      red([b(c.k1Bobina, "A2"), b(c.neutro, "N")], [w[5]!], ["N"]),
      red([b(c.h1, "X2"), b(c.neutro2!, "N")], [w[7]!], ["N"]),
    ]);
    expect(porNombre(lista)).toEqual(
      new Map([
        ["L", [0]],
        ["N", [3, 4]],
      ]),
    );
  });

  it("unidas por nombre, la partición de los bornes es la de la base (con el segundo N en la red de N)", () => {
    const { doc, comp: c, cables: w } = marchaParada({ dosNeutros: true });
    const unidas = redes(doc.hojas[0]!, { unirPorNombre: true });
    expect(unidas[3]).toEqual(red([b(c.k1Bobina, "A2"), b(c.h1, "X2"), b(c.neutro, "N"), b(c.neutro2!, "N")], [w[5]!, w[7]!], ["N"]));
    const base = redes(marchaParada().doc.hojas[0]!);
    expect(particion(unidas, c.neutro2)).toEqual(particion(base));
  });

  it("con el segundo Neutro escrito «n », se normaliza y se une igual con N", () => {
    const { doc, historial, comp } = marchaParada({ dosNeutros: true });
    const hoja = doc.hojas[0]!;
    const conN = redes(hoja, { unirPorNombre: true });
    historial.ejecutar(new CambiarEtiqueta(comp.neutro2!, "n "));
    // El documento guarda lo escrito; la red compara normalizado.
    expect(hoja.componentes.find((k) => k.id === comp.neutro2)!.etiqueta).toBe("n ");
    const lista = redes(hoja);
    expect(lista[4]!.nombres).toEqual(["N"]);
    expect(porNombre(lista)).toEqual(
      new Map([
        ["L", [0]],
        ["N", [3, 4]],
      ]),
    );
    expect(redes(hoja, { unirPorNombre: true })).toEqual(conN);
  });
});

describe("marcha-parada: guardar y abrir", () => {
  it.each(CASOS)("%s: vuelve igual, sin avisos y con las mismas redes", (_n, dosNeutros) => {
    const { doc } = marchaParada({ dosNeutros });
    expect(invariantes(doc)).toEqual([]);
    const r = deserializar(serializar(doc));
    if (!r.ok) throw new Error(JSON.stringify(r.errores));
    expect(r.avisos).toEqual([]);
    expect(r.documento).toEqual(doc);
    expect(invariantes(r.documento)).toEqual([]);
    const hoja = r.documento.hojas[0]!;
    expect(redes(hoja)).toEqual(redes(doc.hojas[0]!));
    expect(redes(hoja, { unirPorNombre: true })).toEqual(redes(doc.hojas[0]!, { unirPorNombre: true }));
  });

  it("dos armados dan el mismo archivo", () => {
    const texto = (d: Documento) => serializar(d);
    expect(texto(marchaParada().doc)).toBe(texto(marchaParada().doc));
    expect(texto(marchaParada({ dosNeutros: true }).doc)).toBe(texto(marchaParada({ dosNeutros: true }).doc));
  });
});
