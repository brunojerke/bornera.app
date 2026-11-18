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
  stat: vi.fn(async (_ruta: string) => ({ size: 10 })),
  exists: vi.fn(async (_ruta: string) => true),
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
 * Un glob de la capability como lo mira Tauri 2.12 (crate glob, con
 * `require_literal_separator` y distinguiendo mayúsculas, también en
 * Windows: `src/scope/fs.rs`): `**​/` es cualquier carpeta, `*` no cruza un
 * separador y `[bB]` es una letra de la clase. En Windows, `\` también es
 * separador. Alcanza para los de esta capability.
 */
function coincide(ruta: string, glob: string): boolean {
  const re = glob
    .replace(/[.+?^${}()|\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?");
  return new RegExp(`^${re}$`).test(ruta.replace(/\\/g, "/"));
}

const enAlcance = (ruta: string) => ALCANCE.some((g) => coincide(ruta, g));

beforeEach(() => {
  fs.escritos = [];
  fs.renombres = [];
  vi.clearAllMocks();
});

describe("archivosTauri (T21)", () => {
  it("T24 (D8-A): todo .brn y .brn.json, y sus .tmp, sin mirar mayúsculas", () => {
    expect(ALCANCE).toEqual([
      "**/*.[bB][rR][nN]",
      "**/*.[bB][rR][nN].tmp",
      "**/*.[bB][rR][nN].[jJ][sS][oO][nN]",
      "**/*.[bB][rR][nN].[jJ][sS][oO][nN].tmp",
    ]);
    for (const r of [
      "/c/a/x.brn",
      "/c/a/b/x.brn.tmp",
      "/c/a/x.brn.json",
      "/c/a/x.brn.json.tmp",
      // El pendiente de T15a: la extensión en mayúsculas y su temporal.
      "C:\\a\\X.BRN",
      "C:\\a\\X.BRN.tmp",
      "C:\\a\\X.BRN.JSON",
      "C:\\a\\X.BRN.JSON.tmp",
      "C:\\a\\x.Brn.Json.tmp",
      "/home/b/Marcha.bRn",
    ])
      expect(enAlcance(r), r).toBe(true);
    for (const r of ["/c/a/x.json", "/c/a/x.brnx", "/c/a/x.brn.jsonx", "/c/a/x.brn.TMP", "/c/a/x.txt", "/c/a/brn", "C:\\a\\x.brn\\otro.txt"])
      expect(enAlcance(r), r).toBe(false);
  });

  it("los permisos de fs: los de T15a más exists (Abrir reciente, T24)", () => {
    const permisos = (capability.permissions as unknown[]).filter((x): x is string => typeof x === "string" && x.startsWith("fs:"));
    expect(permisos).toEqual(["fs:allow-stat", "fs:allow-exists", "fs:allow-read-file", "fs:allow-write-file", "fs:allow-rename", "fs:allow-remove"]);
  });

  it("Abrir reciente: existe y deRuta usan la ruta tal cual, sin el diálogo", async () => {
    fs.exists.mockResolvedValueOnce(false);
    expect(await archivosTauri.existe!("C:\\a\\X.BRN")).toBe(false);
    expect(fs.exists).toHaveBeenCalledWith("C:\\a\\X.BRN");
    const a = await archivosTauri.deRuta!("C:\\a\\X.BRN");
    expect(a).toMatchObject({ nombre: "X.BRN", ruta: "C:\\a\\X.BRN", tamano: 10 });
    expect(fs.stat).toHaveBeenCalledWith("C:\\a\\X.BRN");
    expect(dialogo.open).not.toHaveBeenCalled();
  });

  it("Abrir reciente: «forbidden path» se traduce, como en Abrir", async () => {
    fs.exists.mockRejectedValueOnce("forbidden path: C:\\a\\x.txt");
    await expect(archivosTauri.existe!("C:\\a\\x.txt")).rejects.toThrow(/no tiene permiso/);
  });

  it("Guardar como «X.BRN»: el temporal X.BRN.tmp entra en el alcance (pendiente de T15a)", async () => {
    dialogo.save.mockResolvedValue("C:\\a\\X.BRN");
    const destino = await archivosTauri.elegirDestino("Marcha.brn", "brn");
    expect(destino?.ruta).toBe("C:\\a\\X.BRN");
    await archivosTauri.guardar(destino!, new Uint8Array([1]));
    expect(fs.escritos).toEqual(["C:\\a\\X.BRN.tmp"]);
    for (const r of ["C:\\a\\X.BRN.tmp", "C:\\a\\X.BRN"]) expect(enAlcance(r), r).toBe(true);
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
