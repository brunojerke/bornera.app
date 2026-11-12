import { describe, expect, it } from "vitest";
import { conExtensionBrn, escribirSeguro, mensajeErrorFs, nombreDeRuta, rutaTemporal, type FsEscritura } from "./archivos";

/** Un disco de mentira: los archivos en un Map, con fallas a pedido (Tauri rechaza con textos). */
class DiscoFalso implements FsEscritura {
  archivos = new Map<string, Uint8Array>();
  llamadas: string[] = [];
  fallaEscribir: string | null = null;
  fallaRenombrar: string | null = null;
  fallaBorrar: string | null = null;

  async writeFile(ruta: string, bytes: Uint8Array): Promise<void> {
    this.llamadas.push(`escribir ${ruta}`);
    if (this.fallaEscribir) {
      // Como un disco lleno: queda escrita una parte.
      this.archivos.set(ruta, bytes.slice(0, 1));
      throw this.fallaEscribir;
    }
    this.archivos.set(ruta, bytes);
  }

  async rename(de: string, a: string): Promise<void> {
    this.llamadas.push(`renombrar ${de} ${a}`);
    if (this.fallaRenombrar) throw this.fallaRenombrar;
    const bytes = this.archivos.get(de);
    if (!bytes) throw "no existe";
    this.archivos.delete(de);
    this.archivos.set(a, bytes);
  }

  async remove(ruta: string): Promise<void> {
    this.llamadas.push(`borrar ${ruta}`);
    if (this.fallaBorrar) throw this.fallaBorrar;
    if (!this.archivos.delete(ruta)) throw "no existe";
  }
}

const RUTA = "C:\\Users\\Bruno\\Circuitos ñ [1]\\Marcha.brn";
const TEMPORAL = `${RUTA}.tmp`;
const NUEVO = new Uint8Array([1, 2, 3]);
const VIEJO = new Uint8Array([9]);

/** Un disco con el archivo anterior ya guardado. */
function disco(): DiscoFalso {
  const d = new DiscoFalso();
  d.archivos.set(RUTA, VIEJO);
  return d;
}

describe("escribirSeguro", () => {
  it("escribe el temporal en la misma carpeta y lo renombra sobre la ruta", async () => {
    const d = disco();
    await escribirSeguro(RUTA, NUEVO, d);
    expect(d.llamadas).toEqual([`escribir ${TEMPORAL}`, `renombrar ${TEMPORAL} ${RUTA}`]);
    expect([...d.archivos.keys()]).toEqual([RUTA]);
    expect(d.archivos.get(RUTA)).toEqual(NUEVO);
  });

  it("si falla la escritura, borra el temporal y el archivo anterior queda como estaba", async () => {
    const d = disco();
    d.fallaEscribir = "No hay espacio suficiente en el disco. (os error 112)";
    await expect(escribirSeguro(RUTA, NUEVO, d)).rejects.toBe(d.fallaEscribir);
    expect(d.llamadas.at(-1)).toBe(`borrar ${TEMPORAL}`);
    expect([...d.archivos.keys()]).toEqual([RUTA]);
    expect(d.archivos.get(RUTA)).toEqual(VIEJO);
  });

  it("si falla el rename (archivo abierto por otro programa), borra el temporal y tira ese error", async () => {
    const d = disco();
    d.fallaRenombrar = "El proceso no tiene acceso al archivo porque está siendo utilizado por otro proceso. (os error 32)";
    await expect(escribirSeguro(RUTA, NUEVO, d)).rejects.toBe(d.fallaRenombrar);
    expect(d.llamadas).toEqual([`escribir ${TEMPORAL}`, `renombrar ${TEMPORAL} ${RUTA}`, `borrar ${TEMPORAL}`]);
    expect([...d.archivos.keys()]).toEqual([RUTA]);
    expect(d.archivos.get(RUTA)).toEqual(VIEJO);
  });

  it("si además falla el borrado, tira el error original", async () => {
    const d = disco();
    d.fallaRenombrar = "primero";
    d.fallaBorrar = "segundo";
    await expect(escribirSeguro(RUTA, NUEVO, d)).rejects.toBe("primero");
    expect(d.archivos.get(RUTA)).toEqual(VIEJO);
  });

  it("un temporal de una escritura anterior se pisa", async () => {
    const d = disco();
    d.archivos.set(TEMPORAL, new Uint8Array([7, 7]));
    await escribirSeguro(RUTA, NUEVO, d);
    expect([...d.archivos.keys()]).toEqual([RUTA]);
    expect(d.archivos.get(RUTA)).toEqual(NUEVO);
  });
});

describe("rutas", () => {
  it("rutaTemporal: la misma ruta con .tmp (entra en el alcance **/*.brn.tmp)", () => {
    expect(rutaTemporal("C:\\a\\Marcha.brn")).toBe("C:\\a\\Marcha.brn.tmp");
  });

  it("nombreDeRuta: el último tramo, con barras de Windows o de Linux", () => {
    expect(nombreDeRuta(RUTA)).toBe("Marcha.brn");
    expect(nombreDeRuta("C:\\a\\Señal «A» [2].brn")).toBe("Señal «A» [2].brn");
    expect(nombreDeRuta("/home/bruno/x.brn")).toBe("x.brn");
    expect(nombreDeRuta("C:/a/b.brn")).toBe("b.brn");
    expect(nombreDeRuta("x.brn")).toBe("x.brn");
  });

  it("conExtensionBrn: agrega .brn solo si falta (sin mirar mayúsculas)", () => {
    expect(conExtensionBrn("C:\\a\\Parada")).toBe("C:\\a\\Parada.brn");
    expect(conExtensionBrn("C:\\a\\Parada.brn")).toBe("C:\\a\\Parada.brn");
    expect(conExtensionBrn("C:\\a\\PARADA.BRN")).toBe("C:\\a\\PARADA.BRN");
    expect(conExtensionBrn("C:\\a\\Marcha.txt")).toBe("C:\\a\\Marcha.txt.brn");
    expect(conExtensionBrn("C:\\x.brn\\Marcha")).toBe("C:\\x.brn\\Marcha.brn");
  });
});

describe("mensajeErrorFs", () => {
  it("una ruta fuera del alcance se explica en español; los demás errores pasan como vienen", () => {
    expect(mensajeErrorFs("forbidden path: C:\\a\\Marcha.txt.brn, maybe it is not allowed on the scope")).toMatch(/permiso.*\.brn/);
    const so = "Acceso denegado. (os error 5)";
    expect(mensajeErrorFs(so)).toBe(so);
    expect(mensajeErrorFs(new Error("x"))).toBe("x");
  });
});
