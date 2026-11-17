// archivosTauri con los plugins de Tauri de mentira (T21): los filtros de los
// diálogos, el nombre corregido de Exportar y que cada ruta que se escribe
// entre en el alcance de la capability.
import { beforeEach, describe, expect, it, vi } from "vitest";
import capability from "../../src-tauri/capabilities/default.json";

const dialogo = vi.hoisted(() => ({
  open: vi.fn<(o: unknown) => Promise<string | null>>(),
  save: vi.fn<(o: unknown) => Promise<string | null>>(),
}));
const fs = vi.hoisted(() => ({
  escritos: [] as string[],
  renombres: [] as [string, string][],
  writeFile: vi.fn(async (ruta: string) => void fs.escritos.push(ruta)),
  rename: vi.fn(async (de: string, a: string) => void fs.renombres.push([de, a])),
  remove: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ size: 10 })),
  readFile: vi.fn(async () => new Uint8Array()),
}));

vi.mock("@tauri-apps/plugin-dialog", () => dialogo);
vi.mock("@tauri-apps/plugin-fs", () => fs);

const { archivosTauri } = await import("./archivos");

/** Las rutas que la capability deja usar sin pasar por el diálogo. */
const ALCANCE: string[] = (capability.permissions as (string | { identifier: string; allow: { path: string }[] })[]).flatMap((x) =>
  typeof x === "object" && x.identifier === "fs:scope" ? x.allow.map((a) => a.path) : [],
);

/**
 * Un glob de la capability como lo mira Tauri (crate glob, con
 * `require_literal_separator` y distinguiendo mayúsculas): `**​/` es
 * cualquier carpeta y `*` no cruza `/`. Alcanza para los de esta capability.
 */
function coincide(ruta: string, glob: string): boolean {
  const re = glob
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?");
  return new RegExp(`^${re}$`).test(ruta);
}

const enAlcance = (ruta: string) => ALCANCE.some((g) => coincide(ruta, g));

beforeEach(() => {
  fs.escritos = [];
  fs.renombres = [];
  vi.clearAllMocks();
});

describe("archivosTauri (T21)", () => {
  it("la capability suma solo **/*.brn.json y **/*.brn.json.tmp (el alcance amplio de .brn es T24)", () => {
    expect(ALCANCE).toEqual(["**/*.brn.tmp", "**/*.brn.json", "**/*.brn.json.tmp"]);
    expect(enAlcance("/c/a/x.brn")).toBe(false);
    expect(enAlcance("/c/a/x.brn.json.brn")).toBe(false);
    expect(enAlcance("/c/a/b/x.brn.tmp")).toBe(true);
    expect(enAlcance("/c/a/x.brn.jsonx")).toBe(false);
  });

  it("Abrir: un filtro con los dos formatos", async () => {
    dialogo.open.mockResolvedValue(null);
    await archivosTauri.elegirParaAbrir();
    expect(dialogo.open).toHaveBeenCalledWith(expect.objectContaining({ filters: [{ name: "Circuito de Bornera", extensions: ["brn", "brn.json"] }] }));
  });

  it("Guardar como: filtro .brn; un .brn.json escrito a mano queda así (D3)", async () => {
    dialogo.save.mockResolvedValue("/c/a/x.brn.json");
    const destino = await archivosTauri.elegirDestino("Marcha.brn", "brn");
    expect(dialogo.save).toHaveBeenCalledWith({ defaultPath: "Marcha.brn", filters: [{ name: "Circuito de Bornera", extensions: ["brn"] }] });
    expect(destino).toEqual({ nombre: "x.brn.json", ruta: "/c/a/x.brn.json" });
  });

  it.each([
    ["/c/a/x.brn", "/c/a/x.brn.json"],
    ["/c/a/x.json", "/c/a/x.brn.json"],
    ["/c/a/x", "/c/a/x.brn.json"],
    ["/c/a/x.brn.json", "/c/a/x.brn.json"],
  ])("Exportar: el diálogo da %s, se escribe %s y todo entra en el alcance", async (elegida, final) => {
    dialogo.save.mockResolvedValue(elegida);
    const destino = await archivosTauri.elegirDestino("Marcha.brn.json", "brnJson");
    expect(dialogo.save).toHaveBeenCalledWith({
      defaultPath: "Marcha.brn.json",
      filters: [{ name: "Circuito de Bornera sin comprimir", extensions: ["brn.json"] }],
    });
    expect(destino?.ruta).toBe(final);
    await archivosTauri.guardar(destino!, new Uint8Array([1]));
    expect(fs.escritos).toEqual([`${final}.tmp`]);
    expect(fs.renombres).toEqual([[`${final}.tmp`, final]]);
    // La ruta corregida no la dio el diálogo: tiene que entrar por la capability.
    for (const r of [`${final}.tmp`, final]) expect(enAlcance(r), r).toBe(true);
  });

  it("Cancelar en el diálogo de Exportar: null", async () => {
    dialogo.save.mockResolvedValue(null);
    expect(await archivosTauri.elegirDestino("Marcha.brn.json", "brnJson")).toBeNull();
  });
});
