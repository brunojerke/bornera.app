import { describe, expect, it } from "vitest";
import { indexarHoja, recorridoCable, seApoyaEn, validarHoja } from "../model/cables";
import type { Documento } from "../model/documento";
import { deserializar, LARGO_MAXIMO_TEXTO, MAXIMO_PROBLEMAS, RANGO_GRILLA, serializar, type ProblemaArchivo, type ResultadoAbrir } from ".";

// JSON a mano: los tests cambian el archivo campo por campo.
type Json = any;

/**
 * Documento chico (pocos KB) y válido: bornes, codos, una T, una T sobre un
 * cable que es T, extremos libres, params y contadores.
 *
 *   w1: c1·14 (0, 2) → (0, 4) → (10, 4) → c2·A2 (10, 2)
 *   w2: c1·13 (0, −2) → libre (0, −6)
 *   w3: T sobre w1 en (5, 4) → libre (5, 8)
 *   w4: T sobre w3 en (5, 6) → libre (8, 6)
 *   w5: libre (30, 0) → libre (30, 5)
 *   c3: lámpara sin cables
 */
function base(): Documento {
  return {
    formato: "bornera",
    version: 1,
    meta: { titulo: "Base", autor: "", fecha: "2026-11-12" },
    contadores: { c: 4, w: 6 },
    hojas: [
      {
        nombre: "Hoja 1",
        componentes: [
          { id: "c1", tipo: "pulsador.na", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "S1", params: {} },
          { id: "c2", tipo: "contactor.bobina", x: 10, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: { tension: "220V" } },
          { id: "c3", tipo: "senalizacion.lampara", x: 20, y: 0, rot: 90, espejado: true, etiqueta: "H1", params: {} },
        ],
        cables: [
          {
            id: "w1",
            desde: { tipo: "borne", comp: "c1", borne: "14" },
            hasta: { tipo: "borne", comp: "c2", borne: "A2" },
            codos: [
              [0, 4],
              [10, 4],
            ],
          },
          { id: "w2", desde: { tipo: "borne", comp: "c1", borne: "13" }, hasta: { tipo: "libre", x: 0, y: -6 }, codos: [] },
          { id: "w3", desde: { tipo: "cable", cable: "w1", x: 5, y: 4 }, hasta: { tipo: "libre", x: 5, y: 8 }, codos: [] },
          { id: "w4", desde: { tipo: "cable", cable: "w3", x: 5, y: 6 }, hasta: { tipo: "libre", x: 8, y: 6 }, codos: [] },
          { id: "w5", desde: { tipo: "libre", x: 30, y: 0 }, hasta: { tipo: "libre", x: 30, y: 5 }, codos: [] },
        ],
      },
    ],
  };
}

const BASE = serializar(base());

/** El archivo base con un cambio hecho sobre su JSON. */
function cambiar(f: (raiz: Json) => void): string {
  const raiz = JSON.parse(BASE) as Json;
  f(raiz);
  return JSON.stringify(raiz);
}

/** Contenedor y clave de una ruta como "hojas[0].cables[2].desde". */
function lugar(raiz: Json, ruta: string): [Json, string | number] {
  const partes = ruta.match(/[^.[\]]+/g)!.map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  let v = raiz;
  for (const p of partes.slice(0, -1)) v = v[p];
  return [v, partes[partes.length - 1]!];
}

function poner(ruta: string, valor: unknown): string {
  return cambiar((r) => {
    const [c, k] = lugar(r, ruta);
    c[k] = valor;
  });
}

function borrar(ruta: string): string {
  return cambiar((r) => {
    const [c, k] = lugar(r, ruta);
    if (Array.isArray(c)) c.splice(k as number, 1);
    else delete c[k];
  });
}

/** Un cable más en la hoja 0 (con su contador al día). */
function conCable(...cables: Json[]): string {
  return cambiar((r) => {
    r.hojas[0].cables.push(...cables);
    r.contadores.w = 6 + cables.length;
  });
}

function errores(texto: string): ProblemaArchivo[] {
  const r = deserializar(texto);
  if (r.ok) throw new Error("abrió y tenía que rechazarse");
  // Todo error dice dónde (un texto) y qué (no vacío).
  for (const e of r.errores) {
    expect(typeof e.donde).toBe("string");
    expect(e.mensaje.length).toBeGreaterThan(0);
  }
  return r.errores;
}

function abre(texto: string): Extract<ResultadoAbrir, { ok: true }> {
  const r = deserializar(texto);
  if (!r.ok) throw new Error(`no abrió: ${JSON.stringify(r.errores)}`);
  expect(invariantes(r.documento)).toEqual([]);
  return r;
}

function rechazaCon(texto: string, donde: string, parte: string): void {
  expect(errores(texto)).toContainEqual({ donde, mensaje: expect.stringContaining(parte) });
}

/** Invariantes de un documento que abre: cada hoja válida, sin ciclos de apoyos y sin T en el extremo de su anfitrión. */
function invariantes(doc: Documento): string[] {
  const fallas: string[] = [];
  doc.hojas.forEach((hoja, h) => {
    for (const p of validarHoja(hoja)) fallas.push(`hoja ${h}, ${p.id}: ${p.mensaje}`);
    const indice = indexarHoja(hoja);
    for (const w of hoja.cables) {
      if (seApoyaEn(indice, w.id, w.id)) fallas.push(`hoja ${h}, ${w.id}: ciclo de apoyos`);
      for (const e of [w.desde, w.hasta]) {
        if (e.tipo !== "cable") continue;
        const anfitrion = indice.cables.get(e.cable);
        const p = anfitrion && recorridoCable(indice, anfitrion);
        if (!p) continue;
        const n = p.length;
        if ((p[0] === e.x && p[1] === e.y) || (p[n - 2] === e.x && p[n - 1] === e.y)) fallas.push(`hoja ${h}, ${w.id}: T en el extremo de ${e.cable}`);
      }
    }
  });
  return fallas;
}

it("el documento base abre igual y es chico (pocos KB)", () => {
  expect(abre(BASE)).toEqual({ ok: true, documento: base(), avisos: [] });
  expect(BASE.length).toBeLessThan(4096);
});

// ── Etapas 0 a 3 ───────────────────────────────────────────────────────────

describe("texto y JSON", () => {
  it("JSON roto: dice que no es JSON y, si la da, la posición", () => {
    expect(errores('{"formato" "bornera"}')).toEqual([{ donde: "", mensaje: expect.stringMatching(/^No se puede leer: el texto no es JSON válido \(posición \d+\)$/) }]);
    expect(errores(BASE.slice(0, 60))).toEqual([{ donde: "", mensaje: expect.stringContaining("no es JSON válido") }]);
  });

  it("texto vacío o solo con espacios", () => {
    for (const t of ["", "   \n\t"]) expect(errores(t)).toEqual([{ donde: "", mensaje: "El archivo está vacío" }]);
  });

  it("texto que pasa el largo máximo: se rechaza sin leerlo; el largo justo se lee", () => {
    expect(errores("x".repeat(LARGO_MAXIMO_TEXTO + 1))).toEqual([{ donde: "", mensaje: expect.stringContaining("demasiado grande") }]);
    expect(errores(" ".repeat(LARGO_MAXIMO_TEXTO))).toEqual([{ donde: "", mensaje: "El archivo está vacío" }]);
  });

  it("un BOM al principio se quita y abre; dos no", () => {
    expect(abre(`﻿${BASE}`).documento).toEqual(base());
    errores(`﻿﻿${BASE}`);
  });
});

describe("formato y versión", () => {
  it("raíz que no es un objeto", () => {
    for (const t of ["[]", "null", "5", '"bornera"', "true", `[${BASE}]`]) {
      expect(errores(t), t.slice(0, 20)).toEqual([{ donde: "", mensaje: "No es un archivo de Bornera" }]);
    }
  });

  it("formato ajeno o sin formato", () => {
    expect(errores(poner("formato", "otro"))).toEqual([{ donde: "", mensaje: "No es un archivo de Bornera" }]);
    expect(errores(poner("formato", "Bornera"))).toEqual([{ donde: "", mensaje: "No es un archivo de Bornera" }]);
    expect(errores(borrar("formato"))).toEqual([{ donde: "", mensaje: "No es un archivo de Bornera" }]);
  });

  it("version 2: hecho con una versión más nueva (D4-A), aunque el resto no se entienda", () => {
    expect(errores(poner("version", 2))).toEqual([{ donde: "", mensaje: expect.stringContaining("hecho con una versión más nueva de Bornera") }]);
    expect(errores(JSON.stringify({ formato: "bornera", version: 7, otra: "cosa" }))[0]!.mensaje).toContain("versión más nueva");
  });

  it.each([
    [0, "0"],
    [1.5, "1.5"],
    ["1", '"1"'],
    [null, "null"],
  ])("version %j se rechaza", (v, es) => {
    expect(errores(poner("version", v))).toEqual([{ donde: "version", mensaje: `tiene que ser un entero mayor o igual a 1 (es ${es})` }]);
  });

  it("sin version", () => {
    expect(errores(borrar("version"))).toEqual([{ donde: "version", mensaje: "falta" }]);
  });
});

// ── Etapa 4: estructura ────────────────────────────────────────────────────

describe("estructura", () => {
  it.each([
    "meta",
    "contadores",
    "hojas",
    "meta.titulo",
    "meta.autor",
    "meta.fecha",
    "hojas[0].nombre",
    "hojas[0].componentes",
    "hojas[0].cables",
    // Componente: todos, también los de valor por defecto.
    "hojas[0].componentes[0].id",
    "hojas[0].componentes[0].tipo",
    "hojas[0].componentes[0].x",
    "hojas[0].componentes[0].y",
    "hojas[0].componentes[0].rot",
    "hojas[0].componentes[0].espejado",
    "hojas[0].componentes[0].etiqueta",
    "hojas[0].componentes[0].params",
    // Cable.
    "hojas[0].cables[0].id",
    "hojas[0].cables[0].desde",
    "hojas[0].cables[0].hasta",
    "hojas[0].cables[0].codos",
    // Extremos: en borne, en T y libre.
    "hojas[0].cables[0].desde.tipo",
    "hojas[0].cables[0].desde.comp",
    "hojas[0].cables[0].desde.borne",
    "hojas[0].cables[2].desde.cable",
    "hojas[0].cables[2].desde.x",
    "hojas[0].cables[2].desde.y",
    "hojas[0].cables[1].hasta.x",
    "hojas[0].cables[1].hasta.y",
  ])("campo que falta: %s", (ruta) => {
    expect(errores(borrar(ruta))).toContainEqual({ donde: ruta, mensaje: "falta" });
  });

  it.each<[string, unknown, string]>([
    ["meta", [], "tiene que ser un objeto (es una lista)"],
    ["meta.titulo", 5, "tiene que ser un texto (es 5)"],
    ["contadores", [], "tiene que ser un objeto (es una lista)"],
    ["contadores.c", 0, "tiene que ser un entero mayor o igual a 1 (es 0)"],
    ["contadores.c", 4.5, "tiene que ser un entero mayor o igual a 1 (es 4.5)"],
    ["contadores.c", "4", 'tiene que ser un entero mayor o igual a 1 (es "4")'],
    ["hojas", {}, "tiene que ser una lista (es un objeto)"],
    ["hojas[0]", "Hoja 1", 'tiene que ser un objeto (es "Hoja 1")'],
    ["hojas[0].nombre", null, "tiene que ser un texto (es null)"],
    ["hojas[0].componentes", {}, "tiene que ser una lista (es un objeto)"],
    ["hojas[0].componentes[0]", 7, "tiene que ser un objeto (es 7)"],
    ["hojas[0].componentes[0].id", 1, "tiene que ser un texto (es 1)"],
    ["hojas[0].componentes[0].tipo", ["pulsador.na"], "tiene que ser un texto (es una lista)"],
    ["hojas[0].componentes[0].x", "3", 'tiene que ser un número entero (es "3")'],
    ["hojas[0].componentes[0].rot", "90", 'tiene que ser 0, 90, 180 o 270 (es "90")'],
    ["hojas[0].componentes[0].espejado", "no", 'tiene que ser true o false (es "no")'],
    ["hojas[0].componentes[0].espejado", 0, "tiene que ser true o false (es 0)"],
    ["hojas[0].componentes[0].etiqueta", null, "tiene que ser un texto (es null)"],
    ["hojas[0].componentes[0].params", [], "tiene que ser un objeto (es una lista)"],
    ["hojas[0].componentes[1].params.tension", 220, "tiene que ser un texto (es 220)"],
    ["hojas[0].cables", "w1", 'tiene que ser una lista (es "w1")'],
    ["hojas[0].cables[0].desde", 5, "tiene que ser un objeto (es 5)"],
    ["hojas[0].cables[0].desde.tipo", "otro", 'tiene que ser "borne", "cable" o "libre" (es "otro")'],
    ["hojas[0].cables[0].desde.comp", false, "tiene que ser un texto (es false)"],
    ["hojas[0].cables[2].desde.cable", {}, "tiene que ser un texto (es un objeto)"],
    ["hojas[0].cables[0].codos", {}, "tiene que ser una lista (es un objeto)"],
    ["hojas[0].cables[0].codos[0]", 5, "tiene que ser un par [x, y] (es 5)"],
    ["hojas[0].cables[0].codos[0][1]", "4", 'tiene que ser un número entero (es "4")'],
  ])("campo de otro tipo: %s = %j", (ruta, valor, mensaje) => {
    expect(errores(poner(ruta, valor))).toContainEqual({ donde: ruta, mensaje });
  });

  it("0 hojas", () => {
    expect(errores(poner("hojas", []))).toEqual([{ donde: "hojas", mensaje: "tiene que tener al menos una hoja" }]);
  });

  it.each([
    ["raíz", ""],
    ["meta", "meta"],
    ["hoja", "hojas[0]"],
    ["componente", "hojas[0].componentes[0]"],
    ["cable", "hojas[0].cables[0]"],
    ["extremo en borne", "hojas[0].cables[0].desde"],
    ["extremo en T", "hojas[0].cables[2].desde"],
    ["extremo libre", "hojas[0].cables[1].hasta"],
  ])("clave sobrante en %s (D3-A)", (_nombre, ruta) => {
    const texto = cambiar((r) => {
      const objeto = ruta === "" ? r : (() => {
        const [c, k] = lugar(r, ruta);
        return c[k];
      })();
      objeto.extra = 1;
    });
    const donde = ruta === "" ? "extra" : `${ruta}.extra`;
    expect(errores(texto)).toContainEqual({ donde, mensaje: "sobra: Bornera no conoce esta clave" });
  });

  it("una clave que el componente no tiene, aunque la tenga otro objeto, sobra", () => {
    expect(errores(poner("hojas[0].componentes[0].codos", []))).toContainEqual({ donde: "hojas[0].componentes[0].codos", mensaje: "sobra: Bornera no conoce esta clave" });
    expect(errores(poner("hojas[0].cables[1].hasta.comp", "c1"))).toContainEqual({ donde: "hojas[0].cables[1].hasta.comp", mensaje: "sobra: Bornera no conoce esta clave" });
  });

  it("__proto__ en la raíz, en un componente y en params se rechaza, y no toca el prototipo", () => {
    const enRaiz = BASE.replace('{"formato"', '{"__proto__":{"contaminado":1},"formato"');
    const enComponente = BASE.replace('{"id":"c1"', '{"__proto__":{"contaminado":1},"id":"c1"');
    const enParams = BASE.replace('"params":{}', '"params":{"__proto__":"x"}');
    expect(enRaiz).not.toBe(BASE);
    expect(enComponente).not.toBe(BASE);
    expect(enParams).not.toBe(BASE);
    expect(errores(enRaiz)).toContainEqual({ donde: "__proto__", mensaje: "sobra: Bornera no conoce esta clave" });
    expect(errores(enComponente)).toContainEqual({ donde: "hojas[0].componentes[0].__proto__", mensaje: "sobra: Bornera no conoce esta clave" });
    expect(errores(enParams)).toContainEqual({ donde: "hojas[0].componentes[0].params.__proto__", mensaje: expect.stringContaining("nombre reservado") });
    expect(({} as Json).contaminado).toBeUndefined();
  });

  it("params y contadores: constructor, prototype y claves con mayúsculas, tildes o espacios se rechazan", () => {
    for (const k of ["constructor", "prototype"]) {
      rechazaCon(poner(`hojas[0].componentes[0].params.${k}`, "x"), `hojas[0].componentes[0].params.${k}`, "nombre reservado");
      rechazaCon(poner(`contadores.${k}`, 3), `contadores.${k}`, "nombre reservado");
    }
    rechazaCon(poner("hojas[0].componentes[0].params.Tension", "x"), "hojas[0].componentes[0].params.Tension", "solo puede tener minúsculas");
    rechazaCon(poner("contadores.C", 3), "contadores.C", "solo puede tener minúsculas");
    rechazaCon(poner("hojas[0].componentes[0].params.tensión", "x"), 'hojas[0].componentes[0].params["tensión"]', "solo puede tener minúsculas");
    rechazaCon(poner("hojas[0].componentes[0].params.a b", "x"), 'hojas[0].componentes[0].params["a b"]', "solo puede tener minúsculas");
  });

  it("params y contadores con claves válidas, también las que parecen números, abren", () => {
    const r = abre(
      cambiar((raiz) => {
        raiz.hojas[0].componentes[0].params = { "10": "a", "2": "b", a_1: "c" };
        raiz.contadores.k = 3;
      }),
    );
    expect(r.documento.hojas[0]!.componentes[0]!.params).toEqual({ "10": "a", "2": "b", a_1: "c" });
    expect(r.documento.contadores).toEqual({ c: 4, w: 6, k: 3 });
  });

  it.each<[string, string]>([
    ["2^53", String(2 ** 53)],
    ["1.5", "1.5"],
    ["1e400", "1e400"],
  ])("x = %s: tiene que ser un entero", (_nombre, numero) => {
    const texto = BASE.replace('"x":20,', `"x":${numero},`);
    expect(texto).not.toBe(BASE);
    const es = numero === "1e400" ? "un número fuera de rango" : numero === "1.5" ? "1.5" : "9007199254740992";
    expect(errores(texto)).toContainEqual({ donde: "hojas[0].componentes[2].x", mensaje: `tiene que ser un número entero (es ${es})` });
  });

  describe(`rango de la grilla: ±${RANGO_GRILLA}, inclusivo (D21-A)`, () => {
    it("10 000 y −10 000 abren: componente, extremo libre, extremo en T y codo", () => {
      for (const v of [RANGO_GRILLA, -RANGO_GRILLA]) {
        abre(poner("hojas[0].componentes[2].x", v));
        abre(poner("hojas[0].componentes[2].y", v));
        abre(
          cambiar((r) => {
            r.hojas[0].cables[4] = { id: "w5", desde: { tipo: "libre", x: v, y: 0 }, hasta: { tipo: "libre", x: v, y: v }, codos: [] };
          }),
        );
        // Un codo en el borde, y una T sobre el tramo que llega a él.
        abre(
          cambiar((r) => {
            r.hojas[0].cables[4] = { id: "w5", desde: { tipo: "libre", x: 30, y: 0 }, hasta: { tipo: "libre", x: v, y: 5 }, codos: [[v, 0]] };
            r.hojas[0].cables.push({ id: "w6", desde: { tipo: "cable", cable: "w5", x: v, y: 0 }, hasta: { tipo: "libre", x: v, y: -5 }, codos: [] });
            r.contadores.w = 7;
          }),
        );
      }
    });

    it("10 001 y −10 001 se rechazan, con el lugar", () => {
      for (const v of [RANGO_GRILLA + 1, -RANGO_GRILLA - 1]) {
        const mensaje = `está fuera de la grilla: tiene que estar entre -10000 y 10000 (es ${v})`;
        expect(errores(poner("hojas[0].componentes[2].x", v))).toContainEqual({ donde: "hojas[0].componentes[2].x", mensaje });
        expect(errores(poner("hojas[0].cables[4].hasta.y", v))).toContainEqual({ donde: "hojas[0].cables[4].hasta.y", mensaje });
        expect(errores(poner("hojas[0].cables[2].desde.x", v))).toContainEqual({ donde: "hojas[0].cables[2].desde.x", mensaje });
        expect(errores(poner("hojas[0].cables[0].codos[1][0]", v))).toContainEqual({ donde: "hojas[0].cables[0].codos[1][0]", mensaje });
      }
    });
  });

  it("rot 45", () => {
    expect(errores(poner("hojas[0].componentes[0].rot", 45))).toEqual([{ donde: "hojas[0].componentes[0].rot", mensaje: "tiene que ser 0, 90, 180 o 270 (es 45)" }]);
  });

  it("codo de tres números", () => {
    expect(errores(poner("hojas[0].cables[0].codos[0]", [0, 4, 1]))).toEqual([{ donde: "hojas[0].cables[0].codos[0]", mensaje: "tiene que ser un par [x, y] (es una lista de 3)" }]);
  });

  it(`lista todos los errores de la etapa hasta ${MAXIMO_PROBLEMAS} y después "y N más"`, () => {
    const texto = cambiar((r) => {
      for (let i = 0; i < 30; i++) r[`extra${i}`] = i;
    });
    const e = errores(texto);
    expect(e).toHaveLength(MAXIMO_PROBLEMAS + 1);
    expect(e[0]).toEqual({ donde: "extra0", mensaje: "sobra: Bornera no conoce esta clave" });
    expect(e[MAXIMO_PROBLEMAS]).toEqual({ donde: "", mensaje: "y 10 más" });
  });

  it("junta los errores de toda la etapa, no solo el primero", () => {
    const texto = cambiar((r) => {
      r.hojas[0].componentes[0].rot = 45;
      r.hojas[0].cables[0].codos[0] = [1];
      delete r.meta.autor;
    });
    expect(errores(texto).map((e) => e.donde)).toEqual(["meta.autor", "hojas[0].componentes[0].rot", "hojas[0].cables[0].codos[0]"]);
  });
});

// ── Etapas 5 y 6: ids y contadores ─────────────────────────────────────────

describe("ids y contadores", () => {
  it("id vacío", () => {
    expect(errores(poner("hojas[0].componentes[2].id", ""))).toEqual([{ donde: "hojas[0].componentes[2].id", mensaje: "no puede estar vacío" }]);
    expect(errores(poner("hojas[0].cables[4].id", ""))).toEqual([{ donde: "hojas[0].cables[4].id", mensaje: "no puede estar vacío" }]);
  });

  it("id repetido en una hoja (entre componentes, y entre un componente y un cable)", () => {
    expect(errores(poner("hojas[0].componentes[2].id", "c1"))).toEqual([
      { donde: "hojas[0].componentes[2].id", mensaje: 'el id "c1" está repetido (ya está en hojas[0].componentes[0].id)' },
    ]);
    expect(errores(poner("hojas[0].cables[4].id", "c3"))).toEqual([
      { donde: "hojas[0].cables[4].id", mensaje: 'el id "c3" está repetido (ya está en hojas[0].componentes[2].id)' },
    ]);
  });

  it("id repetido entre dos hojas", () => {
    const texto = cambiar((r) => {
      r.hojas.push({ nombre: "Hoja 2", componentes: [{ ...r.hojas[0].componentes[2] }], cables: [] });
    });
    expect(errores(texto)).toEqual([{ donde: "hojas[1].componentes[0].id", mensaje: 'el id "c3" está repetido (ya está en hojas[0].componentes[2].id)' }]);
  });

  it("contador atrasado (D7-A)", () => {
    expect(errores(poner("contadores.c", 3))).toEqual([{ donde: "hojas[0].componentes[2].id", mensaje: '"c3" pide que contadores.c sea mayor que 3 (es 3)' }]);
    // Con w = 2, también w2 queda atrasado: el próximo id sería "w2".
    expect(errores(poner("contadores.w", 2)).map((e) => e.donde)).toEqual(["hojas[0].cables[1].id", "hojas[0].cables[2].id", "hojas[0].cables[3].id", "hojas[0].cables[4].id"]);
  });

  it("contador que falta con un c1 adentro", () => {
    const e = errores(borrar("contadores.c"));
    expect(e[0]).toEqual({ donde: "hojas[0].componentes[0].id", mensaje: '"c1" pide que contadores.c sea mayor que 1 (falta)' });
    expect(e).toHaveLength(3);
  });

  it("ids sin forma de contador no piden contador; un contador adelantado abre", () => {
    for (const id of ["lampara", "K1", "c0", "c01", "c", "C3", "constructor5x"]) abre(poner("hojas[0].componentes[2].id", id));
    abre(poner("contadores.c", 1000));
    // Un prefijo que es un nombre de Object.prototype no lee el prototipo: pide su contador.
    rechazaCon(poner("hojas[0].componentes[2].id", "constructor5"), "hojas[0].componentes[2].id", "(falta)");
  });
});

// ── Etapa 7: símbolos ──────────────────────────────────────────────────────

describe("símbolos (D5-A)", () => {
  it("desconocido sin cables: abre con aviso, conserva el tipo y se guarda igual", () => {
    const texto = poner("hojas[0].componentes[2].tipo", "motor.trifasico");
    const r = abre(texto);
    expect(r.avisos).toEqual([{ donde: "hojas[0].componentes[2].tipo", mensaje: "El símbolo «motor.trifasico» de «c3» no está en la biblioteca: se dibuja con «?»" }]);
    expect(r.documento.hojas[0]!.componentes[2]!.tipo).toBe("motor.trifasico");
    expect(serializar(r.documento)).toBe(texto);
  });

  it("desconocido con cables en sus bornes: rechaza", () => {
    expect(errores(poner("hojas[0].componentes[0].tipo", "motor.trifasico"))).toEqual([
      { donde: "hojas[0].componentes[0].tipo", mensaje: "el símbolo «motor.trifasico» de «c1» no está en la biblioteca y tiene cables en sus bornes" },
    ]);
  });
});

// ── Etapa 8: cables ────────────────────────────────────────────────────────

describe("cables (D6-A)", () => {
  it("hacia un componente inexistente", () => {
    expect(errores(poner("hojas[0].cables[1].desde.comp", "c9"))).toEqual([{ donde: "hojas[0].cables[1]", mensaje: 'desde: no existe el componente "c9"' }]);
  });

  it("hacia un cable inexistente", () => {
    expect(errores(poner("hojas[0].cables[2].desde.cable", "w9"))).toContainEqual({ donde: "hojas[0].cables[2]", mensaje: 'desde: no existe el cable "w9"' });
  });

  it("a un borne que el símbolo no tiene", () => {
    expect(errores(poner("hojas[0].cables[1].desde.borne", "99"))).toEqual([{ donde: "hojas[0].cables[1]", mensaje: 'desde: "c1" no tiene el borne "99"' }]);
  });

  it("T fuera de su anfitrión", () => {
    expect(errores(poner("hojas[0].cables[2].desde.y", 3))).toEqual([{ donde: "hojas[0].cables[2]", mensaje: 'desde: el punto (5, 3) no está sobre "w1"' }]);
  });

  it("tramo diagonal", () => {
    expect(errores(poner("hojas[0].cables[4].hasta.x", 31))).toEqual([{ donde: "hojas[0].cables[4]", mensaje: "El tramo 1 no es horizontal ni vertical" }]);
  });

  it("un cable de otra hoja no sirve de referencia", () => {
    const texto = cambiar((r) => {
      r.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [{ id: "w6", desde: { tipo: "borne", comp: "c1", borne: "13" }, hasta: { tipo: "libre", x: 0, y: -9 }, codos: [] }] });
      r.contadores.w = 7;
    });
    expect(errores(texto)).toEqual([{ donde: "hojas[1].cables[0]", mensaje: 'desde: no existe el componente "c1"' }]);
  });
});

// ── Etapa 9: apoyos y T ────────────────────────────────────────────────────

describe("apoyos y T", () => {
  it("ciclo de apoyos (D8-A): w6 termina en T sobre w7 y w7 sobre w6", () => {
    const texto = conCable(
      { id: "w6", desde: { tipo: "libre", x: 40, y: 0 }, hasta: { tipo: "cable", cable: "w7", x: 50, y: 0 }, codos: [] },
      {
        id: "w7",
        desde: { tipo: "libre", x: 50, y: -5 },
        hasta: { tipo: "cable", cable: "w6", x: 45, y: 0 },
        codos: [
          [50, 5],
          [45, 5],
        ],
      },
    );
    expect(errores(texto)).toEqual([
      { donde: "hojas[0].cables[5]", mensaje: expect.stringContaining("ciclo de apoyos") },
      { donde: "hojas[0].cables[6]", mensaje: expect.stringContaining("ciclo de apoyos") },
    ]);
  });

  it.each<[string, Json, string]>([
    // w2 termina libre en (0, −6).
    ["libre", { id: "w6", desde: { tipo: "cable", cable: "w2", x: 0, y: -6 }, hasta: { tipo: "libre", x: 5, y: -6 }, codos: [] }, "w2"],
    // w1 empieza en el borne c1·14, en (0, 2).
    ["en borne", { id: "w6", desde: { tipo: "cable", cable: "w1", x: 0, y: 2 }, hasta: { tipo: "libre", x: -5, y: 2 }, codos: [] }, "w1"],
    // w3 empieza en T sobre w1, en (5, 4).
    ["en T", { id: "w6", desde: { tipo: "cable", cable: "w3", x: 5, y: 4 }, hasta: { tipo: "libre", x: 12, y: 4 }, codos: [] }, "w3"],
  ])("T en el extremo de su anfitrión, que es %s (D9-A)", (_nombre, cable, anfitrion) => {
    expect(errores(conCable(cable))).toEqual([{ donde: "hojas[0].cables[5].desde", mensaje: expect.stringContaining(`la T cae en un extremo de «${anfitrion}»`) }]);
  });

  it("una T sobre un codo de su anfitrión (no es un extremo) abre", () => {
    abre(conCable({ id: "w6", desde: { tipo: "cable", cable: "w1", x: 0, y: 4 }, hasta: { tipo: "libre", x: -5, y: 4 }, codos: [] }));
  });
});

// ── Varias hojas ───────────────────────────────────────────────────────────

describe("varias hojas (D18)", () => {
  function dosHojas(): Documento {
    const doc = base();
    doc.hojas.push({
      nombre: "Hoja 2",
      componentes: [{ id: "c4", tipo: "pulsador.nc", x: 0, y: 0, rot: 180, espejado: false, etiqueta: "S2", params: {} }],
      cables: [{ id: "w6", desde: { tipo: "borne", comp: "c4", borne: "11" }, hasta: { tipo: "libre", x: 0, y: 6 }, codos: [] }],
    });
    doc.contadores = { c: 5, w: 7 };
    return doc;
  }

  it("abre con aviso, conserva las dos hojas y las vuelve a guardar", () => {
    const texto = serializar(dosHojas());
    const r = abre(texto);
    expect(r).toEqual({ ok: true, documento: dosHojas(), avisos: [{ donde: "hojas", mensaje: "Tiene 2 hojas: solo se ve la primera" }] });
    expect(serializar(r.documento)).toBe(texto);
  });

  it("valida todas las hojas, no solo la primera", () => {
    const doc = dosHojas();
    doc.hojas[1]!.cables[0]!.hasta = { tipo: "libre", x: 1, y: 6 };
    expect(errores(serializar(doc))).toEqual([{ donde: "hojas[1].cables[0]", mensaje: "El tramo 1 no es horizontal ni vertical" }]);
  });
});

// ── Nunca tira ─────────────────────────────────────────────────────────────

/** Generador pseudoaleatorio mulberry32: reproducible con la semilla. */
function mulberry32(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VALORES: readonly unknown[] = [
  0, 1, -1, 2, 4, 5, 6, 8, 10, 45, 90, 180, 270, 1.5, 10_000, 10_001, -10_001, 2 ** 53, null, true, false, "", "c1", "c2", "c3", "w1", "w2", "w3",
  "13", "14", "A2", "borne", "cable", "libre", "pulsador.na", "motor.trifasico", "__proto__", [], {}, [1, 2], [1, 2, 3], { tipo: "libre", x: 0, y: 0 },
];
const CLAVES_EXTRA: readonly string[] = ["extra", "__proto__", "constructor", "x", "tipo", "id"];

/** Cambia algo al azar en el JSON: un valor, un número ±1, una clave de más o de menos, un elemento repetido o intercambiado. */
function mutar(raiz: Json, azar: () => number): void {
  const lugares: [Json, string | number][] = [];
  const juntar = (v: Json): void => {
    if (Array.isArray(v)) v.forEach((x, i) => (lugares.push([v, i]), juntar(x)));
    else if (v !== null && typeof v === "object") for (const k of Object.keys(v)) (lugares.push([v, k]), juntar(v[k]));
  };
  juntar(raiz);
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;
  const [c, k] = elegir(lugares);
  const op = azar();
  if (op < 0.4) c[k] = JSON.parse(JSON.stringify(elegir(VALORES)));
  else if (op < 0.65) {
    if (typeof c[k] === "number") c[k] += azar() < 0.5 ? 1 : -1;
    else c[k] = JSON.parse(JSON.stringify(elegir(VALORES)));
  } else if (op < 0.75) {
    if (Array.isArray(c)) c.splice(k as number, 1);
    else delete c[k];
  } else if (op < 0.85) {
    const v = c[k];
    // `defineProperty`: así "__proto__" queda como clave propia, como la deja JSON.parse.
    const valor: unknown = JSON.parse(JSON.stringify(elegir(VALORES)));
    if (v !== null && typeof v === "object" && !Array.isArray(v)) Object.defineProperty(v, elegir(CLAVES_EXTRA), { value: valor, enumerable: true, configurable: true, writable: true });
    else c[k] = valor;
  } else if (op < 0.93) {
    if (Array.isArray(c)) c.push(JSON.parse(JSON.stringify(c[k as number])));
    else c[k] = JSON.parse(JSON.stringify(elegir(VALORES)));
  } else {
    const [c2, k2] = elegir(lugares);
    [c[k], c2[k2]] = [c2[k2], c[k]];
  }
}

describe("nunca tira", () => {
  it("el archivo base cortado en cada largo: siempre un error con mensaje, nunca una excepción", () => {
    const tiradas: number[] = [];
    const abiertos: number[] = [];
    for (let n = 0; n < BASE.length; n++) {
      try {
        const r = deserializar(BASE.slice(0, n));
        if (r.ok) abiertos.push(n);
        else if (r.errores.length === 0 || r.errores.some((e) => e.mensaje === "")) tiradas.push(n);
      } catch {
        tiradas.push(n);
      }
    }
    expect(tiradas).toEqual([]);
    expect(abiertos).toEqual([]);
  });

  it("2000 mutaciones al azar (semilla fija): nunca tira; lo que abre cumple las invariantes y se guarda igual", () => {
    const azar = mulberry32(15);
    const fallas: string[] = [];
    let abiertos = 0;
    let rechazados = 0;
    for (let i = 0; i < 2000; i++) {
      const raiz = JSON.parse(BASE) as Json;
      const cambios = 1 + Math.floor(azar() * 3);
      for (let j = 0; j < cambios; j++) mutar(raiz, azar);
      const texto = JSON.stringify(raiz);
      let r: ResultadoAbrir;
      try {
        r = deserializar(texto);
      } catch (e) {
        fallas.push(`${i}: tiró ${String(e)}`);
        continue;
      }
      if (!r.ok) {
        rechazados++;
        if (r.errores.length === 0 || r.errores.some((e) => typeof e.donde !== "string" || e.mensaje === "")) fallas.push(`${i}: error sin mensaje`);
        continue;
      }
      abiertos++;
      for (const f of invariantes(r.documento)) fallas.push(`${i}: ${f}`);
      // Lo que abre se guarda y vuelve a abrir igual.
      const guardado = serializar(r.documento);
      const r2 = deserializar(guardado);
      if (!r2.ok) fallas.push(`${i}: lo guardado no abre`);
      else {
        if (serializar(r2.documento) !== guardado) fallas.push(`${i}: no es idempotente`);
        expect(r2.documento).toEqual(r.documento);
      }
    }
    expect(fallas).toEqual([]);
    // Que la prueba pruebe algo de los dos lados.
    expect(abiertos).toBeGreaterThan(50);
    expect(rechazados).toBeGreaterThan(1000);
  });
});
