import { describe, expect, it } from "vitest";
import { serializar } from "../core/io";
import { documentosDePrueba } from "../core/io/prueba-documentos";
import type { Documento } from "../core/model/documento";
import { documentoBancoCables } from "../editor/banco";
import { copiarPorPartes, PRESUPUESTO_PASO_MS, REINICIOS_DE_UNA_VEZ, type OpcionesCopia, type Ocio } from "./copiaPorPartes";
import { almacenMemoria } from "./respaldo";

const BANCO = documentoBancoCables(2000);

/** La próxima tarea, sin la espera mínima de `setTimeout` (en Windows, hasta 15 ms). Node lo tiene; los tipos de Node no están. */
const proximaTarea = (globalThis as unknown as { setImmediate: (f: () => void) => void }).setImmediate;

/**
 * Un entorno de prueba: reloj falso que avanza `porLlamada` ms cada vez que
 * se lo mira, ocio de `ocioMs` (con `antesDeOcio` para meter ediciones
 * entre pasos) y el almacén en memoria.
 */
function entorno(doc: Documento, opciones: { porLlamada?: number; ocioMs?: number; almacen?: ReturnType<typeof almacenMemoria> } = {}) {
  const almacen = opciones.almacen ?? almacenMemoria();
  let reloj = 0;
  let gen = 0;
  const e = {
    almacen,
    doc,
    cambios: 0,
    ocioMs: opciones.ocioMs ?? 50,
    ocios: 0,
    antesDeOcio: (() => {}) as () => void,
    /** Si da false, la fuente da null (copia cancelada). */
    sigue: () => true,
    /** Un comando: cambia el documento en su lugar, como los reales. */
    editar() {
      const c = e.doc.hojas[0]!.componentes[0];
      if (c) c.x += 1;
      e.cambios++;
    },
    opciones(extra: Partial<OpcionesCopia> = {}): OpcionesCopia {
      return {
        id: "yo",
        almacen,
        fuente: () => (e.sigue() ? { documento: e.doc, cambios: e.cambios } : null),
        generacion: () => ++gen,
        datos: () => ({ archivo: null, version: "prueba" }),
        pedirOcio: (cb: (o: Ocio) => void) =>
          proximaTarea(() => {
            e.ocios++;
            e.antesDeOcio();
            const ms = e.ocioMs;
            cb({ didTimeout: false, timeRemaining: () => ms });
          }),
        ahora: () => (reloj += opciones.porLlamada ?? 0.25),
        fecha: () => 1234,
        ...extra,
      };
    },
  };
  return e;
}

async function textoCopiado(almacen: ReturnType<typeof almacenMemoria>, id = "yo"): Promise<string> {
  const l = await almacen.leer(id);
  if (!l.ok) throw new Error(l.problema);
  return l.texto;
}

describe("copiarPorPartes (T23, 1b)", () => {
  it.each([0.5, PRESUPUESTO_PASO_MS, 1000])("con presupuesto %s ms, los trozos unidos dan serializar", async (presupuestoMs) => {
    // Ocio de sobra: el que manda es el presupuesto.
    const e = entorno(BANCO, { ocioMs: 1e6 });
    const r = await copiarPorPartes(e.opciones({ presupuestoMs }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await textoCopiado(e.almacen)).toBe(serializar(BANCO));
    expect(r.trozos).toBe(e.almacen.trozos.length);
    expect(r.pasos).toHaveLength(r.trozos + 1);
    expect(r.reinicios).toBe(0);
    if (presupuestoMs === 1000) expect(r.trozos).toBe(1);
    else expect(r.trozos).toBeGreaterThan(5);
  });

  it.each(documentosDePrueba())("%s: la copia es serializar", async (_nombre, doc) => {
    const e = entorno(doc);
    const r = await copiarPorPartes(e.opciones());
    expect(r.ok).toBe(true);
    expect(await textoCopiado(e.almacen)).toBe(serializar(doc));
  });

  it("ningún paso pasa del presupuesto más un vistazo del reloj", async () => {
    const e = entorno(BANCO, { porLlamada: 0.25 });
    const r = await copiarPorPartes(e.opciones());
    if (!r.ok) throw new Error("no copió");
    expect(Math.max(...r.pasos)).toBeLessThanOrEqual(PRESUPUESTO_PASO_MS + 0.25);
  });

  it("si el ocio que queda es menos que el presupuesto, el paso se achica a eso", async () => {
    const e = entorno(BANCO, { porLlamada: 0.25, ocioMs: 0.5 });
    const r = await copiarPorPartes(e.opciones());
    if (!r.ok) throw new Error("no copió");
    expect(Math.max(...r.pasos)).toBeLessThanOrEqual(0.75);
    expect(await textoCopiado(e.almacen)).toBe(serializar(BANCO));
  });

  it("el registro va al final: hasta entonces vale la copia anterior, y después se borran sus trozos", async () => {
    const doc = structuredClone(BANCO);
    const e = entorno(doc);
    const r1 = await copiarPorPartes(e.opciones());
    if (!r1.ok) throw new Error("no copió");
    const antes = serializar(doc);
    e.editar();
    // A mitad de la segunda copia, leer da la primera, entera.
    const leidas: string[] = [];
    e.ocios = 0;
    e.antesDeOcio = () => {
      if (e.ocios === 5) void textoCopiado(e.almacen).then((t) => leidas.push(t));
    };
    const r2 = await copiarPorPartes(e.opciones());
    if (!r2.ok) throw new Error("no copió");
    expect(leidas).toEqual([antes]);
    expect(r2.generacion).toBe(r1.generacion + 1);
    expect(e.almacen.registros.get("yo")).toMatchObject({ generacion: r2.generacion, trozos: r2.trozos, fecha: 1234, version: "prueba" });
    expect(new Set(e.almacen.trozos.map((t) => t.generacion))).toEqual(new Set([r2.generacion]));
    expect(await textoCopiado(e.almacen)).toBe(serializar(doc));
  });

  it("si falla el put de un trozo, la copia no queda completa y vuelve el error", async () => {
    const e = entorno(BANCO, { almacen: almacenMemoria({ fallarTrozo: (t) => t.n === 2 }) });
    const r = await copiarPorPartes(e.opciones());
    expect(r.ok).toBe(false);
    if (r.ok || r.cancelada) throw new Error("tendría que fallar");
    expect((r.error as DOMException).name).toBe("QuotaExceededError");
    expect(e.almacen.registros.size).toBe(0);
  });

  it("un cambio en el medio: vuelve a empezar con otra generación y copia el documento nuevo", async () => {
    const doc = structuredClone(BANCO);
    const e = entorno(doc);
    e.antesDeOcio = () => {
      if (e.ocios === 4) e.editar();
    };
    const r = await copiarPorPartes(e.opciones());
    if (!r.ok) throw new Error("no copió");
    expect(r.reinicios).toBe(1);
    expect(r.generacion).toBe(2);
    expect(r.cambios).toBe(1);
    expect(r.deUnaVez).toBe(false);
    expect(await textoCopiado(e.almacen)).toBe(serializar(doc));
    // Los trozos del intento cortado se borraron con el registro.
    expect(e.almacen.trozos.every((t) => t.generacion === 2)).toBe(true);
  });

  it(`ediciones seguidas (un comando antes de cada ocio): a los ${REINICIOS_DE_UNA_VEZ} reinicios sale de una vez, con el documento de ese momento`, async () => {
    const doc = structuredClone(BANCO);
    const e = entorno(doc);
    e.antesDeOcio = () => e.editar();
    const r = await copiarPorPartes(e.opciones());
    if (!r.ok) throw new Error("no copió");
    expect(r.reinicios).toBe(REINICIOS_DE_UNA_VEZ);
    expect(r.deUnaVez).toBe(true);
    expect(r.deUnaVezMs).toBeGreaterThan(0);
    expect(r.cambios).toBe(e.cambios);
    expect(await textoCopiado(e.almacen)).toBe(serializar(doc));
    // Cada trozo sigue con su put: varios, no uno.
    expect(r.trozos).toBeGreaterThan(5);
  });

  it("con ocios cortos, la copia de una vez espera un ocio largo", async () => {
    const doc = structuredClone(BANCO);
    const e = entorno(doc, { ocioMs: 10 });
    e.antesDeOcio = () => {
      e.editar();
      if (e.ocios === 30) e.ocioMs = 50;
    };
    const r = await copiarPorPartes(e.opciones());
    if (!r.ok) throw new Error("no copió");
    expect(e.ocios).toBe(30);
    expect(r.deUnaVez).toBe(true);
    expect(await textoCopiado(e.almacen)).toBe(serializar(doc));
  });

  it("si la fuente da null, se cancela sin registro", async () => {
    const e = entorno(BANCO);
    e.sigue = () => e.ocios < 3;
    const r = await copiarPorPartes(e.opciones());
    expect(r).toEqual({ ok: false, cancelada: true, reinicios: 0 });
    expect(e.almacen.registros.size).toBe(0);
  });

  it("si la fuente da null después del último trozo, no escribe el registro", async () => {
    const e = entorno(documentosDePrueba()[0]![1]);
    let llamadas = 0;
    // Un documento chico: entra en un solo paso, y la fuente se mira al empezarlo y antes del registro.
    const r = await copiarPorPartes(e.opciones({ fuente: () => (++llamadas <= 1 ? { documento: e.doc, cambios: 0 } : null) }));
    expect(llamadas).toBe(2);
    expect(r).toEqual({ ok: false, cancelada: true, reinicios: 0 });
    expect(e.almacen.registros.size).toBe(0);
  });

  it("otro documento (Abrir o Nuevo) también hace volver a empezar", async () => {
    const e = entorno(structuredClone(BANCO));
    const otro = documentosDePrueba()[2]![1];
    e.antesDeOcio = () => {
      if (e.ocios === 3) e.doc = otro;
    };
    const r = await copiarPorPartes(e.opciones());
    if (!r.ok) throw new Error("no copió");
    expect(r.reinicios).toBe(1);
    expect(await textoCopiado(e.almacen)).toBe(serializar(otro));
  });
});
