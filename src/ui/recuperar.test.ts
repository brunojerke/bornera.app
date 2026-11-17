import { describe, expect, it } from "vitest";
import { serializar } from "../core/io";
import { documentosDePrueba } from "../core/io/prueba-documentos";
import { abrirCopia, copiasParaOfrecer, fechaVisible, nombreVisible } from "./recuperar";
import { almacenMemoria, candadosMemoria, registroCopia, type AlmacenCopias } from "./respaldo";

const doc = documentosDePrueba()[2]![1];

async function copia(almacen: AlmacenCopias, id: string, texto: string, fecha: number, esquema = 1) {
  await almacen.escribirTrozo({ id, generacion: 1, n: 0, texto });
  await almacen.completar({ ...registroCopia(id, doc, { generacion: 1, trozos: 1, caracteres: texto.length }, null, "x", fecha), esquema: esquema as 1 });
}

describe("nombreVisible", () => {
  it("el del archivo; si nunca se guardó, el título o «Sin título»", () => {
    expect(nombreVisible({ archivo: { nombre: "marcha-parada.brn", ruta: null }, titulo: "X" })).toEqual({ nombre: "marcha-parada.brn", nuncaGuardada: false });
    expect(nombreVisible({ archivo: null, titulo: "Sin título" })).toEqual({ nombre: "Sin título", nuncaGuardada: true });
    expect(nombreVisible({ archivo: null, titulo: " " })).toEqual({ nombre: "Sin título", nuncaGuardada: true });
    expect(nombreVisible({ archivo: null, titulo: "Tablero 1" })).toEqual({ nombre: "Tablero 1", nuncaGuardada: true });
  });
});

describe("fechaVisible", () => {
  const ahora = new Date(2026, 10, 17, 12, 0);
  it("hoy, ayer u otro día, con la hora en dos cifras", () => {
    expect(fechaVisible(new Date(2026, 10, 17, 11, 32).getTime(), ahora)).toBe("hoy a las 11:32");
    expect(fechaVisible(new Date(2026, 10, 16, 18, 5).getTime(), ahora)).toBe("ayer a las 18:05");
    expect(fechaVisible(new Date(2026, 10, 12, 9, 40).getTime(), ahora)).toBe("el 12/11 a las 09:40");
    expect(fechaVisible(new Date(2026, 10, 17, 0, 1).getTime(), ahora)).toBe("hoy a las 00:01");
  });
});

describe("copiasParaOfrecer", () => {
  it("las completas de otros ids sin dueño, la más nueva primero, con su candado retenido", async () => {
    const almacen = almacenMemoria();
    const t = serializar(doc);
    await copia(almacen, "yo", t, 50);
    await copia(almacen, "vieja", t, 10);
    await copia(almacen, "nueva", t, 30);
    await copia(almacen, "viva", t, 40);
    const candados = candadosMemoria(new Set(["yo", "viva"]));
    const ofrecidas = await copiasParaOfrecer(almacen, candados, "yo");
    expect(ofrecidas.map((o) => o.registro.id)).toEqual(["nueva", "vieja"]);
    // Retenidas: otra instancia que arranca ahora no las ofrece.
    expect(await copiasParaOfrecer(almacen, candados, "otra")).toEqual([]);
    ofrecidas[0]!.soltar();
    expect((await copiasParaOfrecer(almacen, candados, "otra")).map((o) => o.registro.id)).toEqual(["nueva"]);
  });

  it("sin Web Locks se ofrecen todas las ajenas", async () => {
    const almacen = almacenMemoria();
    await copia(almacen, "a", "x", 1);
    await copia(almacen, "yo", "x", 2);
    expect((await copiasParaOfrecer(almacen, null, "yo")).map((o) => o.registro.id)).toEqual(["a"]);
  });

  it("borra los trozos sueltos de ids sin dueño y sin copia completa; nunca los de una instancia viva ni una copia completa", async () => {
    const almacen = almacenMemoria();
    await copia(almacen, "completa", "x", 1);
    await almacen.escribirTrozo({ id: "cortada", generacion: 1, n: 0, texto: "a medias" });
    await almacen.escribirTrozo({ id: "viva", generacion: 1, n: 0, texto: "escribiendo" });
    await almacen.escribirTrozo({ id: "yo", generacion: 1, n: 0, texto: "mía" });
    await copiasParaOfrecer(almacen, candadosMemoria(new Set(["yo", "viva"])), "yo");
    expect((await almacen.idsConTrozos()).sort()).toEqual(["completa", "viva", "yo"]);
    expect(almacen.registros.has("completa")).toBe(true);
  });
});

describe("abrirCopia", () => {
  it("una copia buena abre con la validación estricta", async () => {
    const almacen = almacenMemoria();
    await copia(almacen, "a", serializar(doc), 1);
    const r = await abrirCopia(almacen, "a");
    expect(r.ok).toBe(true);
    if (r.ok) expect(serializar(r.documento)).toBe(serializar(doc));
  });

  it("una copia que no abre: los problemas y el texto para exportarlo tal cual", async () => {
    const almacen = almacenMemoria();
    await copia(almacen, "rota", "{roto", 1);
    const r = await abrirCopia(almacen, "rota");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problemas.length).toBeGreaterThan(0);
      expect(r.texto).toBe("{roto");
    }
  });

  it("faltan trozos: el problema y lo que hay", async () => {
    const almacen = almacenMemoria();
    await almacen.escribirTrozo({ id: "a", generacion: 1, n: 0, texto: "{" });
    await almacen.completar({ ...registroCopia("a", doc, { generacion: 1, trozos: 2, caracteres: 9 }, null, "x", 1) });
    expect(await abrirCopia(almacen, "a")).toEqual({ ok: false, problemas: [{ donde: "", mensaje: "Faltan trozos de la copia: hay 1 de 2" }], texto: "{" });
  });

  it("un esquema desconocido no abre", async () => {
    const almacen = almacenMemoria();
    await copia(almacen, "a", serializar(doc), 1, 2);
    const r = await abrirCopia(almacen, "a");
    expect(r.ok ? "" : r.problemas[0]!.mensaje).toBe("La copia es de un esquema desconocido (2)");
  });
});
