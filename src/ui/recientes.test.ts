// Abrir reciente (T24): la lista, sin DOM.
import { describe, expect, it } from "vitest";
import {
  agregarReciente,
  CLAVE_RECIENTES,
  entraEnRecientes,
  escribirRecientes,
  esWindows,
  leerRecientes,
  mismaRuta,
  quitarReciente,
  Recientes,
  TOPE_RECIENTES,
  type AlmacenRecientes,
} from "./recientes";

/** Un `localStorage` de mentira; con `falla`, leer y escribir tiran. */
class AlmacenFalso implements AlmacenRecientes {
  datos = new Map<string, string>();
  falla = false;
  getItem(clave: string): string | null {
    if (this.falla) throw new Error("SecurityError");
    return this.datos.get(clave) ?? null;
  }
  setItem(clave: string, valor: string): void {
    if (this.falla) throw new Error("QuotaExceededError");
    this.datos.set(clave, valor);
  }
}

describe("mismaRuta", () => {
  it("en Windows: sin mirar mayúsculas y con / igual a \\", () => {
    expect(mismaRuta("C:\\a\\Marcha.brn", "c:\\A\\MARCHA.BRN", true)).toBe(true);
    expect(mismaRuta("C:\\a\\Marcha.brn", "C:/a/Marcha.brn", true)).toBe(true);
    expect(mismaRuta("C:\\a\\Marcha.brn", "C:\\b\\Marcha.brn", true)).toBe(false);
  });

  it("en Linux: solo iguales letra por letra", () => {
    expect(mismaRuta("/home/b/Marcha.brn", "/home/b/Marcha.brn", false)).toBe(true);
    expect(mismaRuta("/home/b/Marcha.brn", "/home/b/marcha.brn", false)).toBe(false);
    expect(mismaRuta("/home/b/a\\b.brn", "/home/b/a/b.brn", false)).toBe(false);
  });
});

describe("esWindows", () => {
  it("WebView2 sí; WebKitGTK no", () => {
    expect(esWindows("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/131.0")).toBe(true);
    expect(esWindows("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)")).toBe(false);
  });
});

describe("agregarReciente y quitarReciente", () => {
  it("la nueva va primero; hasta 8, se cae la más vieja", () => {
    let lista: string[] = [];
    for (let i = 1; i <= TOPE_RECIENTES + 2; i++) lista = agregarReciente(lista, `C:\\a\\${i}.brn`, true);
    expect(TOPE_RECIENTES).toBe(8);
    expect(lista).toHaveLength(8);
    expect(lista[0]).toBe("C:\\a\\10.brn");
    expect(lista.at(-1)).toBe("C:\\a\\3.brn");
  });

  it("Windows: un repetido con otras mayúsculas sube arriba con la forma nueva, sin duplicarse", () => {
    const lista = agregarReciente(["C:\\a\\x.brn", "C:\\a\\Marcha.brn", "C:\\a\\y.brn"], "c:/a/MARCHA.brn", true);
    expect(lista).toEqual(["c:/a/MARCHA.brn", "C:\\a\\x.brn", "C:\\a\\y.brn"]);
  });

  it("Linux: otras mayúsculas son otro archivo; el mismo exacto sube", () => {
    const base = ["/h/x.brn", "/h/Marcha.brn"];
    expect(agregarReciente(base, "/h/marcha.brn", false)).toEqual(["/h/marcha.brn", "/h/x.brn", "/h/Marcha.brn"]);
    expect(agregarReciente(base, "/h/Marcha.brn", false)).toEqual(["/h/Marcha.brn", "/h/x.brn"]);
  });

  it("solo entran .brn y .brn.json, sin mirar mayúsculas", () => {
    expect(entraEnRecientes("C:\\a\\X.BRN")).toBe(true);
    expect(entraEnRecientes("C:\\a\\x.Brn.Json")).toBe(true);
    expect(entraEnRecientes("C:\\a\\x.json")).toBe(false);
    expect(entraEnRecientes("C:\\a\\x.brn.tmp")).toBe(false);
    expect(agregarReciente(["C:\\a\\x.brn"], "C:\\a\\notas.txt", true)).toEqual(["C:\\a\\x.brn"]);
  });

  it("quitar saca la ruta y sus otras formas (Windows) o solo la exacta (Linux)", () => {
    expect(quitarReciente(["C:\\a\\x.brn", "C:\\a\\y.brn"], "c:/A/X.BRN", true)).toEqual(["C:\\a\\y.brn"]);
    expect(quitarReciente(["/h/x.brn", "/h/X.brn"], "/h/X.brn", false)).toEqual(["/h/x.brn"]);
  });
});

describe("leerRecientes y escribirRecientes", () => {
  it("lo escrito se lee igual", () => {
    const a = new AlmacenFalso();
    expect(escribirRecientes(a, ["C:\\a\\x.brn", "C:\\a\\y.brn.json"])).toBe(true);
    expect(leerRecientes(a, true)).toEqual(["C:\\a\\x.brn", "C:\\a\\y.brn.json"]);
  });

  it("sin nada guardado, vacía", () => {
    expect(leerRecientes(new AlmacenFalso(), true)).toEqual([]);
    expect(leerRecientes(null, true)).toEqual([]);
  });

  it("JSON roto o que no es una lista: vacía", () => {
    const a = new AlmacenFalso();
    for (const t of ["{", '{"a":1}', '"x.brn"', "null", "3"]) {
      a.datos.set(CLAVE_RECIENTES, t);
      expect(leerRecientes(a, true), t).toEqual([]);
    }
  });

  it("se descarta lo que no es una ruta; repetidos y lo que pasa del tope se quitan (gana el más nuevo)", () => {
    const a = new AlmacenFalso();
    const muchas = Array.from({ length: 10 }, (_, i) => `C:\\a\\${i}.brn`);
    a.datos.set(CLAVE_RECIENTES, JSON.stringify(["C:\\a\\X.brn", 3, "", null, "c:\\a\\x.brn", "C:\\a\\x.txt", ...muchas]));
    const lista = leerRecientes(a, true);
    expect(lista[0]).toBe("C:\\a\\X.brn");
    expect(lista).toHaveLength(8);
    expect(lista.filter((r) => mismaRuta(r, "C:\\a\\x.brn", true))).toHaveLength(1);
  });

  it("un almacén que tira: leer da vacía, escribir da false", () => {
    const a = new AlmacenFalso();
    a.falla = true;
    expect(leerRecientes(a, true)).toEqual([]);
    expect(escribirRecientes(a, ["C:\\a\\x.brn"])).toBe(false);
    expect(escribirRecientes(null, ["C:\\a\\x.brn"])).toBe(false);
  });
});

describe("Recientes", () => {
  it("agregar y quitar guardan; cada cambio parte de lo guardado (otra ventana)", () => {
    const a = new AlmacenFalso();
    const r = new Recientes(() => a, true);
    r.agregar("C:\\a\\x.brn");
    // Otra ventana de Bornera suma una ruta.
    new Recientes(() => a, true).agregar("C:\\a\\otra.brn");
    expect(r.agregar("C:\\a\\y.brn")).toEqual(["C:\\a\\y.brn", "C:\\a\\otra.brn", "C:\\a\\x.brn"]);
    expect(r.quitar("C:\\a\\OTRA.brn")).toEqual(["C:\\a\\y.brn", "C:\\a\\x.brn"]);
    expect(r.lista()).toEqual(["C:\\a\\y.brn", "C:\\a\\x.brn"]);
  });

  it("si pedir el almacén tira (localStorage bloqueado), la lista queda vacía y no tira", () => {
    const r = new Recientes(() => {
      throw new Error("SecurityError");
    }, true);
    expect(r.lista()).toEqual([]);
    expect(r.agregar("C:\\a\\x.brn")).toEqual(["C:\\a\\x.brn"]);
    expect(r.lista()).toEqual([]);
  });

  it("almacén lleno: agregar no tira y lo guardado queda como estaba", () => {
    const a = new AlmacenFalso();
    const r = new Recientes(() => a, false);
    r.agregar("/h/x.brn");
    a.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => r.agregar("/h/y.brn")).not.toThrow();
    expect(r.lista()).toEqual(["/h/x.brn"]);
  });
});
