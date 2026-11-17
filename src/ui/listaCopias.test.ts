import { describe, expect, it } from "vitest";
import { serializar } from "../core/io";
import { documentosDePrueba } from "../core/io/prueba-documentos";
import type { EstadoAutoguardado } from "./autoguardado";
import { lineaAutoguardado, nombreCopia, textoCopias } from "./listaCopias";
import { almacenMemoria, candadosMemoria, registroCopia, type AlmacenCopias } from "./respaldo";

const doc = documentosDePrueba()[2]![1];

async function guardar(almacen: AlmacenCopias, id: string, texto: string, fecha: number, archivo: { nombre: string; ruta: string | null } | null = null) {
  await almacen.escribirTrozo({ id, generacion: 1, n: 0, texto });
  await almacen.completar(registroCopia(id, doc, { generacion: 1, trozos: 1, caracteres: texto.length }, archivo, "x", fecha));
}

const datos = { version: "0.1.4-alpha.1", motor: "Edg/157", fecha: "17/11/26 12:00", fallo: null, estado: null };

describe("nombreCopia", () => {
  it("el del archivo, o el título con «nunca se guardó»; «Sin título» si está vacío", () => {
    expect(nombreCopia({ archivo: { nombre: "marcha.brn", ruta: null }, titulo: "X" })).toBe("marcha.brn");
    expect(nombreCopia({ archivo: null, titulo: "Sin título" })).toBe("Sin título (nunca se guardó)");
    expect(nombreCopia({ archivo: null, titulo: "  " })).toBe("Sin título (nunca se guardó)");
  });
});

describe("textoCopias", () => {
  it("una fila por copia, la más nueva primero, con el dueño según los candados y si abre", async () => {
    const almacen = almacenMemoria();
    await guardar(almacen, "propia-1234", serializar(doc), 3000);
    await guardar(almacen, "viva-5678", serializar(doc), 2000, { nombre: "inversion.brn", ruta: "C:\\x\\inversion.brn" });
    await guardar(almacen, "muerta-9012", "{roto", 1000);
    await guardar(almacen, "medicion-abc", serializar(doc), 4000);
    const t = await textoCopias({ ...datos, idPropio: "propia-1234", almacen, candados: candadosMemoria(new Set(["propia-1234", "viva-5678"])) });
    const filas = t.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Copia"));
    expect(filas).toHaveLength(3);
    expect(filas[0]).toMatch(/^\| propia-1 \| esta instancia \| .* \| sí \|$/);
    expect(filas[1]).toMatch(/^\| viva-567 \| otra instancia viva \| inversion\.brn \|/);
    expect(filas[2]).toMatch(/^\| muerta-9 \| sin dueño \| .* \| no: /);
    expect(t).toContain("Web Locks: sí");
  });

  it("sin Web Locks, el dueño es «?»; sin IndexedDB, dice por qué", async () => {
    const almacen = almacenMemoria();
    await guardar(almacen, "otra", serializar(doc), 1);
    const t = await textoCopias({ ...datos, idPropio: "yo", almacen, candados: null });
    expect(t).toContain("| otra | ? |");
    expect(t).toContain("Web Locks: no");
    const sin = await textoCopias({ ...datos, idPropio: "yo", almacen: null, candados: null, fallo: "no hay espacio en el disco" });
    expect(sin).toContain("IndexedDB no abrió: no hay espacio en el disco");
  });
});

describe("lineaAutoguardado", () => {
  it("cuenta las copias y la salida de emergencia", () => {
    const e: EstadoAutoguardado = {
      hechas: 3,
      fallidas: 0,
      canceladas: 1,
      ultima: null,
      emergencias: 1,
      emergenciaMaxMs: 16.2,
      hayCopia: true,
      apagado: null,
    };
    expect(lineaAutoguardado(e)).toBe("Autoguardado: 3 copias hechas, 0 fallidas, 1 canceladas · salida de emergencia: 1 veces, máx. 16,2 ms");
    expect(lineaAutoguardado(null)).toBe("Autoguardado: no arrancó");
  });
});
