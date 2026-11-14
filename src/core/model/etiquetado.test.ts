// Etiquetado automático (T17): reglas del núcleo y `CambiarEtiquetas`.
// Casos de docs/plan-T17.md, sección 3.

import { describe, expect, it } from "vitest";
import { marchaParada } from "../circuitos/marchaParada";
import { buscarSimbolo, esFuente, SIMBOLOS } from "../symbols";
import { validarHoja } from "./cables";
import { Borrar, CambiarEtiquetas, colocar, Grupo } from "./comandos";
import { crearDocumento, type Componente, type Documento, type Hoja } from "./documento";
import {
  conEtiquetas,
  esTitular,
  etiquetarLote,
  etiquetarVacios,
  etiquetasDeTitulares,
  menorLibre,
  planRenombrarBobina,
  prefijoDe,
} from "./etiquetado";
import { normalizarEtiqueta } from "./etiquetas";
import { Historial } from "./historial";
import { pegar, recortar, type Recorte } from "./portapapeles";

const BOBINA = "contactor.bobina";
const AUXILIAR = "contactor.auxiliar_na";
const PULSADOR_NA = "pulsador.na";
const PULSADOR_NC = "pulsador.nc";
const LAMPARA = "senalizacion.lampara";
const FASE = "fuente.fase";
const NEUTRO = "fuente.neutro";
/** Un tipo que no está en la biblioteca, como el de un .brn de otra versión. */
const DESCONOCIDO = "inventado.motor";

const META = { titulo: "", autor: "", fecha: "2026-11-14" };

function comp(id: string, tipo: string, etiqueta: string, x = 0, y = 0): Componente {
  return { id, tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} };
}

function hoja(...componentes: Componente[]): Hoja {
  return { nombre: "Hoja 1", componentes, cables: [] };
}

/** Copia de las hojas, para comparar antes y después (los contadores solo suben y deshacer no los baja). */
function foto(doc: Documento): Hoja[] {
  return JSON.parse(JSON.stringify(doc.hojas)) as Hoja[];
}

function etiquetaDe(doc: Documento, id: string): string {
  return doc.hojas[0]!.componentes.find((c) => c.id === id)!.etiqueta;
}

// ── Clases ─────────────────────────────────────────────────────────────────

describe("titular y prefijo", () => {
  it("se numeran la bobina (K), los pulsadores (S) y la lámpara (H); las fuentes y el auxiliar, no", () => {
    expect(SIMBOLOS.map((s) => [s.tipo, esTitular(s), prefijoDe(s)])).toEqual([
      [FASE, false, null],
      [NEUTRO, false, null],
      [PULSADOR_NA, true, "S"],
      [PULSADOR_NC, true, "S"],
      [BOBINA, true, "K"],
      [AUXILIAR, false, null],
      [LAMPARA, true, "H"],
    ]);
  });

  it("un símbolo desconocido es titular sin prefijo (D2)", () => {
    expect(esTitular(buscarSimbolo(DESCONOCIDO))).toBe(true);
    expect(prefijoDe(buscarSimbolo(DESCONOCIDO))).toBeNull();
  });

  it("etiquetasDeTitulares: normalizadas, sin las vacías, sin seguidores ni fuentes y con los desconocidos", () => {
    const h = hoja(
      comp("a", BOBINA, " k1 "),
      comp("b", AUXILIAR, "K7"),
      comp("c", FASE, "L"),
      comp("d", PULSADOR_NA, ""),
      comp("e", DESCONOCIDO, "m1"),
      comp("f", LAMPARA, "H1"),
    );
    expect([...etiquetasDeTitulares(h)].sort()).toEqual(["H1", "K1", "M1"]);
  });
});

// ── menorLibre ─────────────────────────────────────────────────────────────

describe("menorLibre", () => {
  it("sin nada usado da 1", () => {
    expect(menorLibre([], "K")).toBe("K1");
  });

  it("rellena huecos: borro K2 y el próximo es K2", () => {
    expect(menorLibre(["K1", "K2", "K3"], "K")).toBe("K4");
    expect(menorLibre(["K1", "K3"], "K")).toBe("K2");
  });

  it('"K01" ocupa el 1: se comparan los números, no los textos', () => {
    expect(menorLibre(["K01", "K002"], "K")).toBe("K3");
  });

  it('"k1 " normalizada ocupa el 1', () => {
    expect(menorLibre(etiquetasDeTitulares(hoja(comp("a", BOBINA, "k1 "))), "K")).toBe("K2");
    expect(menorLibre(["k1 "], "K")).toBe("K2");
  });

  it("S0 no cambia nada: los números empiezan en 1", () => {
    expect(menorLibre(["S0"], "S")).toBe("S1");
    expect(menorLibre(["S0", "S1"], "S")).toBe("S2");
  });

  it("otra letra no cuenta", () => {
    expect(menorLibre(["KA1", "KM1", "H1", "1", "K", "K1A"], "K")).toBe("K1");
  });

  it('con contactos "K2" sin bobina y K1 ocupada, la próxima bobina colocada es K2', () => {
    const doc = crearDocumento(META);
    const historial = new Historial(doc);
    const proxima = () => menorLibre(etiquetasDeTitulares(doc.hojas[0]!), "K");
    const poner = (tipo: string, etiqueta: string, x: number): string => {
      const cmd = colocar(doc, { tipo, x, y: 0, rot: 0, espejado: false, etiqueta, params: {} });
      historial.ejecutar(cmd);
      return cmd.id;
    };
    const k1 = poner(BOBINA, proxima(), 0);
    const contactos = [poner(AUXILIAR, "K2", 5), poner(AUXILIAR, "K2", 10)];
    expect(etiquetaDe(doc, k1)).toBe("K1");
    // Los contactos no cuentan como choque: K2 sigue libre para una bobina.
    expect(proxima()).toBe("K2");
    const k2 = poner(BOBINA, proxima(), 15);
    expect(etiquetaDe(doc, k2)).toBe("K2");
    // Los contactos quedan como estaban y ahora siguen a la bobina nueva.
    expect(contactos.map((id) => etiquetaDe(doc, id))).toEqual(["K2", "K2"]);
    expect(proxima()).toBe("K3");
  });
});

// ── Pegar y duplicar ───────────────────────────────────────────────────────

describe("etiquetarLote", () => {
  it("la rama de K1 duplicada da S2, K2 (auxiliar), K2 (bobina) y H2; otra vez, S3, K3, K3 y H3", () => {
    const { doc, comp: m } = marchaParada();
    const h = doc.hojas[0]!;
    const historial = new Historial(doc);
    const recorte = recortar(h, [m.s1, m.k1Auxiliar, m.k1Bobina, m.h1]);
    expect(recorte.componentes.map((c) => c.tipo)).toEqual([PULSADOR_NA, AUXILIAR, BOBINA, LAMPARA]);

    const duplicar = (dx: number): string[] => {
      const cambios = etiquetarLote(etiquetasDeTitulares(h), recorte.componentes);
      historial.ejecutar(pegar(doc, conEtiquetas(recorte, cambios), dx, 0));
      return h.componentes.slice(-4).map((c) => c.etiqueta);
    };
    expect(duplicar(30)).toEqual(["S2", "K2", "K2", "H2"]);
    expect(duplicar(60)).toEqual(["S3", "K3", "K3", "H3"]);
    // El recorte no cambia, y rehacer repite las mismas etiquetas.
    expect(recorte.componentes.map((c) => c.etiqueta)).toEqual(["S1", "K1", "K1", "H1"]);
    historial.deshacer();
    historial.rehacer();
    expect(h.componentes.slice(-4).map((c) => c.etiqueta)).toEqual(["S3", "K3", "K3", "H3"]);
    expect(validarHoja(h)).toEqual([]);
  });

  it("dos bobinas que chocan, K1 y K3, dan K2 y K4", () => {
    const h = hoja(comp("a", BOBINA, "K1"), comp("b", BOBINA, "K3"));
    const lote = [comp("x", BOBINA, "K1", 0, 0), comp("y", BOBINA, "K3", 0, 10)];
    expect(Object.fromEntries(etiquetarLote(etiquetasDeTitulares(h), lote))).toEqual({ x: "K2", y: "K4" });
  });

  it("un contacto sin su bobina en el lote conserva: es otro contacto del mismo contactor", () => {
    const h = hoja(comp("a", BOBINA, "K1"), comp("b", AUXILIAR, "K1"));
    expect(etiquetarLote(etiquetasDeTitulares(h), [comp("x", AUXILIAR, "K1")]).size).toBe(0);
  });

  it("un titular que no choca conserva y reserva su número", () => {
    const h = hoja(comp("a", PULSADOR_NA, "S1"), comp("b", PULSADOR_NC, "S2"));
    // S3 va después en (y, x), pero igual queda reservado antes de repartir.
    const lote = [comp("x", PULSADOR_NA, "S1", 0, 0), comp("y", PULSADOR_NC, "S3", 0, 10)];
    expect(Object.fromEntries(etiquetarLote(etiquetasDeTitulares(h), lote))).toEqual({ x: "S4" });
  });

  it("dos bobinas K1 con contactos K1, pegadas en una hoja con K1: ningún contacto pegado queda en K1 (D3)", () => {
    const h = hoja(comp("a", BOBINA, "K1"), comp("b", AUXILIAR, "K1"));
    const lote = [
      comp("c1", AUXILIAR, "K1", 10, 0),
      comp("b2", BOBINA, "K1", 0, 20),
      comp("c2", AUXILIAR, "k1", 20, 0),
      // La primera en (y, x), aunque es la última del lote: encabeza el grupo.
      comp("b1", BOBINA, "K1", 0, 10),
    ];
    const cambios = etiquetarLote(etiquetasDeTitulares(h), lote);
    expect(Object.fromEntries(cambios)).toEqual({ b1: "K2", c1: "K2", c2: "K2", b2: "K3" });
    const pegadas = lote.map((c) => cambios.get(c.id) ?? c.etiqueta);
    expect(pegadas.filter((e) => normalizarEtiqueta(e) === "K1")).toEqual([]);

    // Sin K1 en la hoja, todo conserva.
    expect(etiquetarLote(etiquetasDeTitulares(hoja(comp("z", BOBINA, "K5"))), lote).size).toBe(0);
  });

  it("los vacíos quedan vacíos", () => {
    const h = hoja(comp("a", BOBINA, "K1"));
    const lote = [comp("x", BOBINA, ""), comp("y", PULSADOR_NA, "  "), comp("z", AUXILIAR, "")];
    expect(etiquetarLote(etiquetasDeTitulares(h), lote).size).toBe(0);
  });

  it("Fase y Neutro intactas", () => {
    const h = hoja(comp("a", FASE, "L"), comp("b", NEUTRO, "N"));
    const lote = [comp("x", FASE, "L"), comp("y", NEUTRO, "N"), comp("z", FASE, "L1")];
    expect(etiquetarLote(etiquetasDeTitulares(h), lote).size).toBe(0);
  });

  it("el orden (y, x) decide el reparto, no el orden del recorte; a igualdad, el del recorte", () => {
    const h = hoja(comp("a", PULSADOR_NA, "S1"), comp("b", PULSADOR_NA, "S2"));
    const lote = [
      comp("abajo", PULSADOR_NA, "S1", 0, 10),
      comp("derecha", PULSADOR_NA, "S2", 5, 0),
      comp("izquierda", PULSADOR_NA, "S1", 0, 0),
      comp("empate", PULSADOR_NC, "S2", 0, 0),
    ];
    expect([...etiquetarLote(etiquetasDeTitulares(h), lote)]).toEqual([
      ["izquierda", "S3"],
      ["empate", "S4"],
      ["derecha", "S5"],
      ["abajo", "S6"],
    ]);
  });

  it("un símbolo desconocido conserva y reserva su etiqueta (D2)", () => {
    const h = hoja(comp("a", BOBINA, "K1"), comp("m", DESCONOCIDO, "K2"));
    // "y" choca pero no tiene prefijo: conserva. K2 sigue reservada: la bobina recibe K3.
    const lote = [comp("x", BOBINA, "K1"), comp("y", DESCONOCIDO, "K2", 0, 5), comp("z", DESCONOCIDO, "K9", 0, 6)];
    expect(Object.fromEntries(etiquetarLote(etiquetasDeTitulares(h), lote))).toEqual({ x: "K3" });
  });
});

describe("conEtiquetas", () => {
  it("cambia solo las etiquetas pedidas y no toca el recorte original", () => {
    const { doc, comp: m } = marchaParada();
    const recorte = recortar(doc.hojas[0]!, [m.s1, m.h1]);
    const antes = JSON.stringify(recorte);
    const otro = conEtiquetas(recorte, new Map([[m.h1, "H7"]]));
    expect(otro.componentes.map((c) => c.etiqueta)).toEqual(["S1", "H7"]);
    expect(otro.cables).toBe(recorte.cables);
    expect(otro.caja).toEqual(recorte.caja);
    expect(JSON.stringify(recorte)).toBe(antes);
    expect(conEtiquetas(recorte, new Map())).toBe(recorte);
  });
});

// ── Etiquetar los vacíos ───────────────────────────────────────────────────

describe("etiquetarVacios", () => {
  it("solo los titulares vacíos, en orden (y, x); ni seguidores, ni fuentes, ni desconocidos", () => {
    const h = hoja(
      comp("k1", BOBINA, "K1", 0, 0),
      comp("bobina", BOBINA, "", 0, 10),
      comp("p2", PULSADOR_NC, " ", 5, 0),
      comp("p1", PULSADOR_NA, "", 0, 0),
      comp("auxiliar", AUXILIAR, "", 0, 20),
      comp("fase", FASE, "", 0, 30),
      comp("lampara", LAMPARA, "", 0, 40),
      comp("motor", DESCONOCIDO, "", 0, 50),
      comp("s2", PULSADOR_NA, "S2", 9, 9),
    );
    expect([...etiquetarVacios(h)]).toEqual([
      ["p1", "S1"],
      ["p2", "S3"],
      ["bobina", "K2"],
      ["lampara", "H1"],
    ]);
  });

  it("sin vacíos, nada", () => {
    expect(etiquetarVacios(marchaParada().doc.hojas[0]!).size).toBe(0);
  });
});

// ── Renombrar una bobina ───────────────────────────────────────────────────

describe("planRenombrarBobina", () => {
  it("arrastra a los contactos cuando se cumplen las tres condiciones", () => {
    const { doc, comp: m } = marchaParada();
    expect(planRenombrarBobina(doc.hojas[0]!, m.k1Bobina, "k5 ")).toEqual({
      cambios: new Map([
        [m.k1Bobina, "K5"],
        [m.k1Auxiliar, "K5"],
      ]),
      arrastre: true,
      motivo: null,
    });
  });

  it("renombrar una bobina vacía no arrastra a los contactos vacíos", () => {
    const h = hoja(comp("b", BOBINA, ""), comp("c", AUXILIAR, ""));
    expect(planRenombrarBobina(h, "b", "K1")).toEqual({ cambios: new Map([["b", "K1"]]), arrastre: false, motivo: null });
  });

  it("renombrar a una etiqueta que ya tiene otra bobina no arrastra", () => {
    const h = hoja(comp("b1", BOBINA, "K1"), comp("b2", BOBINA, "K2"), comp("c", AUXILIAR, "K1"));
    expect(planRenombrarBobina(h, "b1", "K2")).toEqual({
      cambios: new Map([["b1", "K2"]]),
      arrastre: false,
      motivo: "otra_bobina_nueva",
    });
  });

  it("con dos bobinas de la etiqueta vieja no arrastra", () => {
    const h = hoja(comp("b1", BOBINA, "K1"), comp("b2", BOBINA, "k1"), comp("c", AUXILIAR, "K1"));
    expect(planRenombrarBobina(h, "b1", "K3")).toEqual({
      cambios: new Map([["b1", "K3"]]),
      arrastre: false,
      motivo: "otra_bobina_vieja",
    });
  });

  it("sin contactos, o si no es una bobina, cambia solo el componente y no hay motivo", () => {
    const h = hoja(comp("b", BOBINA, "K1"), comp("p", PULSADOR_NA, "S1"), comp("c", AUXILIAR, "S1"));
    expect(planRenombrarBobina(h, "b", "K2")).toEqual({ cambios: new Map([["b", "K2"]]), arrastre: false, motivo: null });
    expect(planRenombrarBobina(h, "p", "S9")).toEqual({ cambios: new Map([["p", "S9"]]), arrastre: false, motivo: null });
  });

  it("lo que no cambia no entra al mapa", () => {
    const { doc, comp: m } = marchaParada();
    expect(planRenombrarBobina(doc.hojas[0]!, m.k1Bobina, "K1").cambios.size).toBe(0);
    // La bobina "k1" pasa a "K1": el contacto que ya dice "K1" no entra, el que dice "k1" sí.
    const h = hoja(comp("b", BOBINA, "k1"), comp("c1", AUXILIAR, "K1"), comp("c2", AUXILIAR, "k1"));
    expect(planRenombrarBobina(h, "b", "K1")).toEqual({
      cambios: new Map([
        ["b", "K1"],
        ["c2", "K1"],
      ]),
      arrastre: true,
      motivo: null,
    });
  });

  it("tira si el componente no está en la hoja", () => {
    expect(() => planRenombrarBobina(hoja(), "x", "K1")).toThrow('No existe el componente "x".');
  });
});

// ── CambiarEtiquetas ───────────────────────────────────────────────────────

describe("CambiarEtiquetas", () => {
  it("aplicar, deshacer y rehacer exactos, en un solo paso", () => {
    const { doc, comp: m } = marchaParada();
    const historial = new Historial(doc);
    const antes = foto(doc);
    expect(historial.ejecutar(new CambiarEtiquetas([[m.s1, "S7"], [m.h1, "H9"]]))).toEqual({
      componentes: [m.s1, m.h1],
      cables: [],
    });
    expect([etiquetaDe(doc, m.s1), etiquetaDe(doc, m.h1)]).toEqual(["S7", "H9"]);
    const despues = foto(doc);
    historial.deshacer();
    expect(foto(doc)).toEqual(antes);
    expect(historial.puedeDeshacer).toBe(false);
    historial.rehacer();
    expect(foto(doc)).toEqual(despues);
  });

  it("valida y normaliza cada etiqueta con las reglas de etiquetas.ts", () => {
    const { doc, comp: m } = marchaParada();
    new CambiarEtiquetas([[m.s1, " s7 "]]).aplicar(doc);
    expect(etiquetaDe(doc, m.s1)).toBe("S7");
    expect(new CambiarEtiquetas(new Map([[m.s1, "k2"]])).cambios).toEqual(new Map([[m.s1, "K2"]]));
    expect(() => new CambiarEtiquetas([[m.s1, "S 7"]])).toThrow("Sin espacios");
    expect(() => new CambiarEtiquetas([[m.s1, "S#"]])).toThrow("Carácter no permitido");
    expect(() => new CambiarEtiquetas([[m.s1, "X".repeat(13)]])).toThrow("Máximo 12 caracteres");
  });

  it("una fuente no puede quedar sin nombre de red: tira al aplicar y no cambia nada", () => {
    const { doc, comp: m } = marchaParada();
    const antes = foto(doc);
    expect(() => new CambiarEtiquetas([[m.s1, "S7"], [m.fase, ""]]).aplicar(doc)).toThrow("necesita un nombre de red");
    expect(foto(doc)).toEqual(antes);
    new CambiarEtiquetas([[m.fase, "l1"]]).aplicar(doc);
    expect(etiquetaDe(doc, m.fase)).toBe("L1");
  });

  it("un id que no existe tira y no cambia nada", () => {
    const { doc, comp: m } = marchaParada();
    const antes = foto(doc);
    expect(() => new CambiarEtiquetas([[m.s1, "S7"], ["c999", "X1"]]).aplicar(doc)).toThrow('No existe el componente "c999".');
    expect(foto(doc)).toEqual(antes);
  });

  it("un id repetido o una lista vacía tiran al construir; deshacer sin aplicar tira", () => {
    expect(() => new CambiarEtiquetas([["c1", "K1"], ["c1", "K2"]])).toThrow("repetido");
    expect(() => new CambiarEtiquetas([])).toThrow("no hay etiquetas");
    expect(() => new CambiarEtiquetas([["c1", "K1"]]).deshacer(crearDocumento(META))).toThrow("no se aplicó");
  });

  it("2000 componentes en un solo paso, con deshacer y rehacer exactos, y no es un Grupo", () => {
    const doc = crearDocumento(META);
    const h = doc.hojas[0]!;
    for (let i = 0; i < 2000; i++) h.componentes.push(comp(`c${i + 1}`, BOBINA, "", (i % 50) * 4, Math.floor(i / 50) * 6));
    const historial = new Historial(doc);
    const antes = foto(doc);

    const cambios = etiquetarVacios(h);
    expect(cambios.size).toBe(2000);
    const cmd = new CambiarEtiquetas(cambios);
    expect(cmd).toBeInstanceOf(CambiarEtiquetas);
    expect(cmd).not.toBeInstanceOf(Grupo);

    expect(historial.ejecutar(cmd).componentes).toHaveLength(2000);
    expect(new Set(h.componentes.map((c) => c.etiqueta)).size).toBe(2000);
    expect([h.componentes[0]!.etiqueta, h.componentes[1999]!.etiqueta]).toEqual(["K1", "K2000"]);
    const despues = foto(doc);

    historial.deshacer();
    expect(foto(doc)).toEqual(antes);
    expect(historial.puedeDeshacer).toBe(false);
    historial.rehacer();
    expect(foto(doc)).toEqual(despues);
  });
});

// ── Al azar ────────────────────────────────────────────────────────────────

/** Generador de números con semilla (mulberry32), como en seguir.test.ts. */
function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEMILLA = 20261114;
const OPERACIONES = 400;

// PROVISORIO (etapa 1): estos dos ayudantes arman los comandos como lo va a
// hacer el editor (src/editor/armarEtiquetas.ts, etapa 2). En la etapa 2 este
// test pasa por armarEtiquetas.ts y se muda fuera de src/core, que no puede
// importar el editor.

/** La etiqueta con que se coloca: el menor libre del prefijo, la inicial de la fuente o vacía. */
function etiquetaAlColocar(h: Hoja, tipo: string): string {
  const def = buscarSimbolo(tipo)!;
  if (esFuente(def)) return def.etiquetaInicial ?? "";
  const prefijo = prefijoDe(def);
  return prefijo === null ? "" : menorLibre(etiquetasDeTitulares(h), prefijo);
}

/**
 * El Pegar con las etiquetas de `etiquetarLote`, calculadas con la hoja de
 * este momento. También devuelve cuántos titulares se renumeraron y cuántos
 * contactos siguieron a su bobina, para ver que la secuencia los probó.
 */
function armarPegado(doc: Documento, recorte: Recorte, dx: number, dy: number) {
  const cambios = etiquetarLote(etiquetasDeTitulares(doc.hojas[0]!), recorte.componentes);
  let arrastrados = 0;
  for (const [id, etiqueta] of cambios) {
    const c = recorte.componentes.find((k) => k.id === id)!;
    expect(c.etiqueta, "solo entra lo que cambia").not.toBe(etiqueta);
    if (c.tipo === AUXILIAR) arrastrados++;
  }
  return { comando: pegar(doc, conEtiquetas(recorte, cambios), dx, dy), renumerados: cambios.size - arrastrados, arrastrados };
}

/** Lo que tiene que valer después de cada paso; vacío si todo está bien. */
function problemas(h: Hoja): string[] {
  const salida: string[] = [];
  const vistas = new Map<string, string>();
  for (const c of h.componentes) {
    const def = buscarSimbolo(c.tipo)!;
    if (esFuente(def)) {
      if (c.etiqueta !== def.etiquetaInicial) salida.push(`La fuente ${c.id} dice "${c.etiqueta}".`);
      continue;
    }
    const e = normalizarEtiqueta(c.etiqueta);
    if (!esTitular(def) || e === "") continue;
    const otro = vistas.get(e);
    if (otro !== undefined) salida.push(`${otro} y ${c.id} dicen "${e}".`);
    vistas.set(e, c.id);
  }
  for (const p of validarHoja(h)) salida.push(p.mensaje);
  return salida;
}

describe("al azar, con semilla fija", () => {
  it(`${OPERACIONES} operaciones (semilla ${SEMILLA}): nunca dos titulares con la misma etiqueta no vacía, fuentes intactas, hoja válida, y deshacer todo y rehacer todo exactos`, () => {
    const azar = generador(SEMILLA);
    const entero = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
    const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;

    const { doc } = marchaParada();
    const h = doc.hojas[0]!;
    const historial = new Historial(doc);
    const inicial = foto(doc);
    const tipos = SIMBOLOS.map((s) => s.tipo);
    let portapapeles: Recorte | null = null;
    const hechas = {
      colocar: 0,
      colocarVacio: 0,
      contactoDeBobina: 0,
      borrar: 0,
      copiar: 0,
      pegar: 0,
      duplicar: 0,
      renumerados: 0,
      arrastrados: 0,
      etiquetarVacios: 0,
      deshacer: 0,
      rehacer: 0,
    };

    const bobinasConEtiqueta = () => h.componentes.filter((c) => c.tipo === BOBINA && c.etiqueta !== "");

    /**
     * Lo que se copia, se borra o se duplica. A veces, una bobina con todos sus
     * contactos (la rama de un contactor); si no, de 1 a 6 componentes al azar.
     * A veces suma un cable.
     */
    const algunos = (): string[] => {
      const ids = new Set<string>();
      const bobinas = bobinasConEtiqueta();
      if (bobinas.length > 0 && azar() < 0.4) {
        const bobina = elegir(bobinas);
        ids.add(bobina.id);
        for (const c of h.componentes) if (c.tipo === AUXILIAR && c.etiqueta === bobina.etiqueta) ids.add(c.id);
        if (azar() < 0.5) ids.add(elegir(h.componentes).id);
      } else {
        const n = entero(1, Math.min(6, h.componentes.length));
        while (ids.size < n) ids.add(elegir(h.componentes).id);
      }
      if (h.cables.length > 0 && azar() < 0.5) ids.add(elegir(h.cables).id);
      return [...ids];
    };

    const contar = (p: ReturnType<typeof armarPegado>) => {
      hechas.renumerados += p.renumerados;
      hechas.arrastrados += p.arrastrados;
      return p.comando;
    };

    for (let k = 0; k < OPERACIONES; k++) {
      const r = azar();
      const vacia = h.componentes.length === 0;
      if (r < 0.3) {
        const tipo = elegir(tipos);
        const bobinas = bobinasConEtiqueta();
        // Uno de cada cuatro titulares entra vacío, como en un .brn viejo: lo
        // rellena "Etiquetar los vacíos". Un auxiliar, a veces, con la etiqueta
        // de una bobina que ya está, como la escribiría el usuario: la
        // etiqueta de un seguidor nunca cuenta como choque.
        const sinEtiqueta = esTitular(buscarSimbolo(tipo)) && azar() < 0.25;
        const deBobina = tipo === AUXILIAR && bobinas.length > 0 && azar() < 0.7;
        const etiqueta = sinEtiqueta ? "" : deBobina ? elegir(bobinas).etiqueta : etiquetaAlColocar(h, tipo);
        historial.ejecutar(colocar(doc, { tipo, x: entero(-60, 60), y: entero(-60, 60), rot: 0, espejado: false, etiqueta, params: {} }));
        if (sinEtiqueta) hechas.colocarVacio++;
        else if (deBobina) hechas.contactoDeBobina++;
        else hechas.colocar++;
      } else if (r < 0.42) {
        if (vacia) continue;
        historial.ejecutar(new Borrar(algunos()));
        hechas.borrar++;
      } else if (r < 0.5) {
        if (vacia) continue;
        portapapeles = recortar(h, algunos());
        hechas.copiar++;
      } else if (r < 0.62) {
        if (!portapapeles) continue;
        historial.ejecutar(contar(armarPegado(doc, portapapeles, entero(-40, 40), entero(-40, 40))));
        hechas.pegar++;
      } else if (r < 0.72) {
        if (vacia) continue;
        historial.ejecutar(contar(armarPegado(doc, recortar(h, algunos()), 3, 3)));
        hechas.duplicar++;
      } else if (r < 0.77) {
        const cambios = etiquetarVacios(h);
        if (cambios.size === 0) continue;
        historial.ejecutar(new CambiarEtiquetas(cambios));
        hechas.etiquetarVacios++;
      } else if (r < 0.9) {
        if (historial.deshacer()) hechas.deshacer++;
      } else if (historial.rehacer()) {
        hechas.rehacer++;
      }
      expect(problemas(h), `semilla ${SEMILLA}, operación ${k}`).toEqual([]);
    }

    // La secuencia probó de todo: también renumerar al pegar y contactos que siguen a su bobina.
    for (const [operacion, n] of Object.entries(hechas)) expect(n, operacion).toBeGreaterThan(0);

    const final = foto(doc);
    while (historial.deshacer());
    expect(foto(doc)).toEqual(inicial);
    while (historial.rehacer());
    expect(foto(doc)).toEqual(final);
  });
});
