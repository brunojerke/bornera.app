// Migraciones del formato (T22, D3-A de docs/plan-fase4.md). El formato real
// sigue en la versión 1, sin migraciones: estos tests inyectan migraciones de
// prueba con `deserializarCon`. El corpus congelado pasa por una 1 → 2 en
// tests/circuitos/formato-v1.test.ts.
import { describe, expect, it } from "vitest";
import { VERSION_FORMATO, type Documento } from "../model/documento";
import { deserializar, deserializarCon, type ResultadoAbrir } from "./deserializar";
import { FORMATO_ACTUAL, MIGRACIONES, migrar, revisarFormato, type FormatoLectura, type Migracion } from "./migraciones";
import { docCables, docTextos, documentosDePrueba } from "./prueba-documentos";
import { serializar } from "./serializar";

type Objeto = { readonly [clave: string]: unknown };

function esObjeto(v: unknown): v is Objeto {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 1 → 2 de prueba: `meta.fecha` de dd/mm/aaaa a aaaa-mm-dd. Si no tiene esa forma, la deja. */
const fechaIso: Migracion = (d) => {
  const meta = d["meta"];
  if (!esObjeto(meta) || typeof meta["fecha"] !== "string") return { ...d, version: 2 };
  const f = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(meta["fecha"]);
  return { ...d, version: 2, meta: f ? { ...meta, fecha: `${f[3]}-${f[2]}-${f[1]}` } : meta };
};

const F2: FormatoLectura = { version: 2, migraciones: [fechaIso] };

/** Una migración que hace `cambiar` sobre una copia del JSON y deja la versión siguiente. */
function migracion(version: number, cambiar: (d: Record<string, unknown>) => void = () => {}): Migracion {
  return (d) => {
    const copia = JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
    cambiar(copia);
    copia["version"] = version;
    return copia;
  };
}

/** El texto .brn de un documento con otra versión. */
function textoVersion(doc: Documento, version: number): string {
  return serializar({ ...doc, version });
}

function avisoFormato(desde: number, hasta: number) {
  return { donde: "version", mensaje: `El archivo es del formato ${desde}: al guardarlo pasa al formato ${hasta}` };
}

/** Lee con `formato` y comprueba que no tira. */
function leerSinTirar(texto: string, formato: FormatoLectura): ResultadoAbrir {
  let r: ResultadoAbrir | undefined;
  expect(() => (r = deserializarCon(texto, formato))).not.toThrow();
  return r!;
}

function congelar<T>(v: T): T {
  if (typeof v === "object" && v !== null) {
    for (const x of Object.values(v)) congelar(x);
    Object.freeze(v);
  }
  return v;
}

describe("las migraciones reales (T22)", () => {
  it("hoy no hay ninguna: hacen falta VERSION_FORMATO − 1", () => {
    expect(VERSION_FORMATO).toBe(1);
    expect(MIGRACIONES).toHaveLength(VERSION_FORMATO - 1);
    expect(FORMATO_ACTUAL).toEqual({ version: VERSION_FORMATO, migraciones: MIGRACIONES });
    expect(revisarFormato(FORMATO_ACTUAL)).toBeNull();
  });

  it.each(documentosDePrueba())("%s: deserializar es deserializarCon con el formato actual, sin aviso de formato", (_nombre, doc) => {
    const texto = serializar(doc);
    const r = deserializar(texto);
    expect(r).toEqual(deserializarCon(texto, FORMATO_ACTUAL));
    expect(r.ok && r.avisos.some((a) => a.donde === "version")).toBe(false);
  });
});

describe("una migración 1 → 2 inyectada", () => {
  it("convierte, avisa y lo migrado se guarda como formato 2, que abre sin migrar", () => {
    const doc = docTextos();
    expect(doc.meta.fecha).toBe("12/11/2026");
    const r = leerSinTirar(serializar(doc), F2);
    expect(r.ok ? [] : r.errores).toEqual([]);
    if (!r.ok) return;
    expect(r.avisos).toEqual([avisoFormato(1, 2)]);
    expect(r.documento).toEqual({ ...doc, version: 2, meta: { ...doc.meta, fecha: "2026-11-12" } });

    const guardado = serializar(r.documento);
    expect(JSON.parse(guardado).version).toBe(2);
    expect(deserializarCon(guardado, F2)).toEqual({ ok: true, documento: r.documento, avisos: [] });
  });

  it("lo que no tiene la forma que busca la migración pasa igual", () => {
    const doc = docCables();
    expect(doc.meta.fecha).toBe("2026-11-12");
    const r = deserializarCon(serializar(doc), F2);
    expect(r).toEqual({ ok: true, documento: { ...doc, version: 2 }, avisos: [avisoFormato(1, 2)] });
  });

  it("el aviso de formato va primero, antes del de varias hojas", () => {
    const doc = docCables();
    doc.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [] });
    const r = deserializarCon(serializar(doc), F2);
    expect(r.ok && r.avisos).toEqual([avisoFormato(1, 2), { donde: "hojas", mensaje: "Tiene 2 hojas: solo se ve la primera" }]);
  });

  it("migrar no cambia lo que recibe", () => {
    const datos = congelar(JSON.parse(serializar(docTextos())) as Objeto);
    const antes = JSON.stringify(datos);
    const r = migrar(datos, 1, F2);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(datos)).toBe(antes);
    // Sin migraciones que correr, devuelve lo mismo, sin copiarlo.
    const sinMigrar = migrar(datos, 2, F2);
    expect(sinMigrar.ok && sinMigrar.datos).toBe(datos);
  });
});

describe("una cadena 1 → 2 → 3", () => {
  /** Cada paso suma su versión al título y anota lo que recibió. */
  function cadena() {
    const recibidos: Objeto[] = [];
    const salidas: unknown[] = [];
    const paso = (version: number): Migracion => {
      const m = migracion(version, (d) => {
        const meta = d["meta"] as Record<string, unknown>;
        meta["titulo"] = `${String(meta["titulo"])}·${version}`;
      });
      return (d) => {
        recibidos.push(d);
        const r = m(d);
        salidas.push(r);
        return r;
      };
    };
    const formato: FormatoLectura = { version: 3, migraciones: [paso(2), paso(3)] };
    return { formato, recibidos, salidas };
  }

  it("un archivo del formato 1 pasa por las dos, en orden, cada una con lo que dejó la anterior", () => {
    const { formato, recibidos, salidas } = cadena();
    const doc = docCables();
    const r = deserializarCon(serializar(doc), formato);
    expect(r).toEqual({ ok: true, documento: { ...doc, version: 3, meta: { ...doc.meta, titulo: "Prueba·2·3" } }, avisos: [avisoFormato(1, 3)] });
    expect(recibidos.map((d) => d["version"])).toEqual([1, 2]);
    expect(recibidos[1]).toBe(salidas[0]);
  });

  it("un archivo del formato 2 pasa solo por la segunda", () => {
    const { formato, recibidos } = cadena();
    const doc = docCables();
    const r = deserializarCon(textoVersion(doc, 2), formato);
    expect(r).toEqual({ ok: true, documento: { ...doc, version: 3, meta: { ...doc.meta, titulo: "Prueba·3" } }, avisos: [avisoFormato(2, 3)] });
    expect(recibidos.map((d) => d["version"])).toEqual([2]);
  });

  it("un archivo del formato 3 no pasa por ninguna", () => {
    const { formato, recibidos } = cadena();
    const doc = { ...docCables(), version: 3 };
    expect(deserializarCon(serializar(doc), formato)).toEqual({ ok: true, documento: doc, avisos: [] });
    expect(recibidos).toEqual([]);
  });

  it("si falla la segunda, el error dice entre qué formatos", () => {
    const formato: FormatoLectura = {
      version: 3,
      migraciones: [
        migracion(2),
        () => {
          throw new Error("no hay datos");
        },
      ],
    };
    expect(leerSinTirar(serializar(docCables()), formato)).toEqual({
      ok: false,
      errores: [{ donde: "", mensaje: "No se pudo pasar del formato 2 al 3: la migración falló (no hay datos)" }],
    });
  });
});

describe("el formato futuro se sigue rechazando", () => {
  it.each([
    ["el real (1)", FORMATO_ACTUAL, 2],
    ["uno de prueba (2)", F2, 3],
  ] as const)("%s rechaza el siguiente", (_nombre, formato, version) => {
    expect(leerSinTirar(textoVersion(docCables(), version), formato)).toEqual({
      ok: false,
      errores: [{ donde: "", mensaje: `El archivo está hecho con una versión más nueva de Bornera (formato ${version}; esta lee hasta el ${formato.version})` }],
    });
  });
});

describe("una migración que falla da error sin tirar", () => {
  const largo = "x".repeat(200);
  const casos: [string, Migracion, string][] = [
    [
      "tira un Error",
      () => {
        throw new Error("se rompió");
      },
      "la migración falló (se rompió)",
    ],
    [
      "tira un texto",
      () => {
        throw "texto suelto";
      },
      "la migración falló (texto suelto)",
    ],
    [
      "tira un mensaje larguísimo",
      () => {
        throw new Error(largo);
      },
      `la migración falló (${"x".repeat(79)}…)`,
    ],
    ["devuelve null", () => null, "la migración no devolvió un documento"],
    ["devuelve undefined", () => undefined, "la migración no devolvió un documento"],
    ["devuelve una lista", () => [], "la migración no devolvió un documento"],
    ["devuelve un número", () => 2, "la migración no devolvió un documento"],
    ["no sube la versión", (d) => ({ ...d }), 'la migración no dejó "formato": "bornera" y "version": 2'],
    ["salta una versión", (d) => ({ ...d, version: 3 }), 'la migración no dejó "formato": "bornera" y "version": 2'],
    ["deja la versión como texto", (d) => ({ ...d, version: "2" }), 'la migración no dejó "formato": "bornera" y "version": 2'],
    ["borra el formato", ({ formato: _formato, ...resto }) => ({ ...resto, version: 2 }), 'la migración no dejó "formato": "bornera" y "version": 2'],
  ];

  it.each(casos)("%s", (_nombre, m, mensaje) => {
    expect(leerSinTirar(serializar(docCables()), { version: 2, migraciones: [m] })).toEqual({
      ok: false,
      errores: [{ donde: "", mensaje: `No se pudo pasar del formato 1 al 2: ${mensaje}` }],
    });
  });

  it("un formato con migraciones de menos o de más da error sin tirar", () => {
    const texto = serializar(docCables());
    const error = (mensaje: string) => ({ ok: false, errores: [{ donde: "", mensaje }] });
    expect(leerSinTirar(texto, { version: 2, migraciones: [] })).toEqual(
      error("Bornera no puede leer: la lista de migraciones no corresponde al formato 2 (tiene 0; tendría que tener 1)"),
    );
    expect(leerSinTirar(texto, { version: 1, migraciones: [fechaIso] })).toEqual(
      error("Bornera no puede leer: la lista de migraciones no corresponde al formato 1 (tiene 1; tendría que tener 0)"),
    );
    expect(leerSinTirar(texto, { version: 0, migraciones: [] })).toEqual(error("Bornera no puede leer: su versión del formato es 0"));
  });
});

describe("lo migrado pasa la validación estricta", () => {
  const leer = (cambiar: (d: Record<string, unknown>) => void) =>
    leerSinTirar(serializar(docCables()), { version: 2, migraciones: [migracion(2, cambiar)] });
  const hoja0 = (d: Record<string, unknown>) => (d["hojas"] as Record<string, unknown>[])[0]!;

  it("una clave de más se rechaza", () => {
    expect(leer((d) => (d["zoom"] = 2))).toEqual({ ok: false, errores: [{ donde: "zoom", mensaje: "sobra: Bornera no conoce esta clave" }] });
  });

  it("una coordenada fuera de la grilla se rechaza", () => {
    const r = leer((d) => ((hoja0(d)["componentes"] as Record<string, unknown>[])[0]!["x"] = 10_001));
    expect(r.ok ? [] : r.errores.map((e) => e.donde)).toEqual(["hojas[0].componentes[0].x"]);
  });

  it("un cable a un componente que no existe se rechaza", () => {
    const r = leer((d) => (((hoja0(d)["cables"] as Record<string, unknown>[])[0]!["desde"] as Record<string, unknown>)["comp"] = "c99"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores[0]!.donde).toBe("hojas[0].cables[0]");
  });
});
