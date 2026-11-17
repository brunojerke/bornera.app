import { describe, expect, it } from "vitest";
import { serializar } from "../core/io";
import { documentosDePrueba } from "../core/io/prueba-documentos";
import type { Documento } from "../core/model/documento";
import { documentoBancoCables } from "../editor/banco";
import { Autoguardado, MAXIMO_SIN_COPIA_MS, REINTENTO_OCUPADO_MS, SIN_COMANDOS_MS, type DependenciasAutoguardado } from "./autoguardado";
import type { Ocio } from "./copiaPorPartes";
import { almacenMemoria, type AlmacenCopias } from "./respaldo";

/** La próxima tarea de Node (los tipos de Node no están). */
const proximaTarea = (globalThis as unknown as { setImmediate: (f: () => void) => void }).setImmediate;
const tick = async (n = 30) => {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => proximaTarea(r));
};

const docPrueba = (): Documento => structuredClone(documentosDePrueba().find(([, d]) => d.hojas[0]!.componentes.length > 1)![1]);

/**
 * Reloj y temporizadores falsos, ocio inmediato (con `antesDeOcio` para meter
 * comandos entre pasos), un editor de mentira y el almacén en memoria.
 */
function entorno(opciones: { almacen?: AlmacenCopias & ReturnType<typeof almacenMemoria>; relojQueAvanza?: number } = {}) {
  let t = 0;
  let sig = 0;
  const timers = new Map<number, { at: number; f: () => void }>();
  const almacen = opciones.almacen ?? almacenMemoria();
  const e = {
    almacen,
    avisos: [] as string[],
    ocupado: false,
    ocios: 0,
    antesDeOcio: (() => {}) as () => void,
    ed: { documento: docPrueba(), cambios: 0, modificado: false },
    get ahora() {
      return t;
    },
    get temporizadores() {
      return timers.size;
    },
    /** Un comando: cambia el documento en su lugar y avisa, como el historial. */
    editar() {
      const c = e.ed.documento.hojas[0]!.componentes[0]!;
      c.x += 1;
      e.ed.cambios++;
      e.ed.modificado = true;
      ag.alCambiar();
    },
    /** Guardar bien (o deshacer hasta lo guardado): sin cambios. */
    guardar() {
      e.ed.modificado = false;
      ag.alCambiar();
    },
    /** Pasa `ms` del reloj, corriendo los temporizadores que vencen y dejando avanzar lo asíncrono. */
    async pasar(ms: number) {
      const fin = t + ms;
      for (;;) {
        await tick();
        const [id, x] = [...timers.entries()].filter(([, x]) => x.at <= fin).sort((a, b) => a[1].at - b[1].at)[0] ?? [];
        if (id === undefined || !x) break;
        timers.delete(id);
        t = Math.max(t, x.at);
        x.f();
      }
      t = fin;
      await tick();
    },
    async terminar() {
      for (let i = 0; i < 2000 && ag.copiando; i++) await tick(1);
    },
    async texto(): Promise<string | null> {
      const l = await almacen.leer("yo");
      return l.ok ? l.texto : null;
    },
  };
  const deps: DependenciasAutoguardado = {
    id: "yo",
    almacen,
    editor: () => e.ed,
    archivo: () => null,
    version: "prueba",
    ocupado: () => e.ocupado,
    avisar: (s) => e.avisos.push(s),
    // Con `relojQueAvanza`, cada mirada al reloj suma ese tiempo: así la copia cede entre trozos.
    ahora: () => (opciones.relojQueAvanza ? (t += opciones.relojQueAvanza) : t),
    fecha: () => 1000,
    programar: (f, ms) => {
      const id = ++sig;
      timers.set(id, { at: t + ms, f });
      return id;
    },
    cancelar: (id) => timers.delete(id as number),
    pedirOcio: (cb: (o: Ocio) => void) =>
      proximaTarea(() => {
        e.ocios++;
        e.antesDeOcio();
        cb({ didTimeout: false, timeRemaining: () => 50 });
      }),
  };
  const ag = new Autoguardado(deps);
  return { e, ag };
}

describe("Autoguardado: relojes (D2b-C)", () => {
  it("la copia sale a los 10 s sin comandos", async () => {
    const { e, ag } = entorno();
    e.editar();
    await e.pasar(SIN_COMANDOS_MS - 1);
    expect(e.almacen.registros.size).toBe(0);
    expect(ag.esperando).toBe(true);
    await e.pasar(1);
    await e.terminar();
    expect(await e.texto()).toBe(serializar(e.ed.documento));
    expect(ag.estado).toMatchObject({ hechas: 1, hayCopia: true });
    expect(ag.esperando).toBe(false);
  });

  it("con comandos cada 5 s, sale a los 60 s del primer cambio", async () => {
    const { e } = entorno();
    e.editar();
    while (e.ahora < MAXIMO_SIN_COPIA_MS - 5000) {
      await e.pasar(5000);
      e.editar();
    }
    await e.pasar(4999);
    expect(e.almacen.registros.size).toBe(0);
    await e.pasar(1);
    await e.terminar();
    expect(await e.texto()).toBe(serializar(e.ed.documento));
  });

  it("sin cambios no hay ningún reloj", () => {
    const { e, ag } = entorno();
    ag.alCambiar();
    expect(ag.esperando).toBe(false);
    expect(e.temporizadores).toBe(0);
  });

  it("un aviso del historial sin cambio del documento (un tramo, la marca) no corre el reloj", async () => {
    const { e, ag } = entorno();
    e.editar();
    await e.pasar(8000);
    ag.alCambiar();
    await e.pasar(2000);
    await e.terminar();
    expect(ag.estado.hechas).toBe(1);
  });

  it("un cambio después de que la copia leyó el documento arranca otro ciclo", async () => {
    let editarAlEscribir = true;
    const { e, ag } = entorno();
    // Un comando entre el último trozo y el registro.
    const escribir = e.almacen.escribirTrozo.bind(e.almacen);
    e.almacen.escribirTrozo = (tr) => {
      const p = escribir(tr);
      if (editarAlEscribir) {
        editarAlEscribir = false;
        queueMicrotask(() => e.editar());
      }
      return p;
    };
    e.editar();
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    expect(ag.estado.hechas).toBe(1);
    expect(ag.esperando).toBe(true);
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    expect(ag.estado.hechas).toBe(2);
    expect(await e.texto()).toBe(serializar(e.ed.documento));
  });

  it("ocupado (D1): no copia y vuelve a mirar en 1 s", async () => {
    const { e } = entorno();
    e.ocupado = true;
    e.editar();
    await e.pasar(SIN_COMANDOS_MS + 3 * REINTENTO_OCUPADO_MS);
    expect(e.almacen.trozos).toHaveLength(0);
    e.ocupado = false;
    await e.pasar(REINTENTO_OCUPADO_MS);
    await e.terminar();
    expect(await e.texto()).toBe(serializar(e.ed.documento));
  });
});

describe("Autoguardado: borrados (D2e, D2-A)", () => {
  it("guardar (o deshacer hasta lo guardado) borra la copia propia", async () => {
    const { e, ag } = entorno();
    e.editar();
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    expect(e.almacen.registros.size).toBe(1);
    e.guardar();
    await tick();
    expect(e.almacen.registros.size).toBe(0);
    expect(e.almacen.trozos).toHaveLength(0);
    expect(ag.estado.hayCopia).toBe(false);
    expect(ag.esperando).toBe(false);
  });

  it("Nuevo o Abrir (otro documento, sin cambios) borra la copia del anterior", async () => {
    const { e } = entorno();
    e.editar();
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    e.ed = { documento: docPrueba(), cambios: 0, modificado: false };
    e.guardar();
    await tick();
    expect(e.almacen.registros.size).toBe(0);
  });

  it("si se guarda con una copia en curso, la copia no escribe su registro", async () => {
    const { e, ag } = entorno();
    e.editar();
    e.antesDeOcio = () => {
      if (e.ocios === 1) e.guardar();
    };
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    await tick();
    expect(e.almacen.registros.size).toBe(0);
    expect(e.almacen.trozos).toHaveLength(0);
    expect(ag.estado.canceladas).toBe(1);
  });

  it("al arrancar, sin cambios, no borra nada (tampoco copias ajenas)", async () => {
    const almacen = almacenMemoria();
    await almacen.escribirTrozo({ id: "otra", generacion: 1, n: 0, texto: "x" });
    await almacen.completar({ id: "otra", esquema: 1, generacion: 1, trozos: 1, caracteres: 1, archivo: null, titulo: "", componentes: 0, fecha: 1, version: "" });
    const { e, ag } = entorno({ almacen });
    ag.alCambiar();
    await tick();
    expect(e.almacen.registros.has("otra")).toBe(true);
  });

  it("cerrar borra la copia propia y no copia más", async () => {
    const { e, ag } = entorno();
    e.editar();
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    await ag.cerrar();
    expect(e.almacen.registros.size).toBe(0);
    e.editar();
    await e.pasar(SIN_COMANDOS_MS);
    expect(e.almacen.registros.size).toBe(0);
  });

  it("cerrar no espera más que el tope si IndexedDB no contesta", async () => {
    const almacen = almacenMemoria();
    almacen.borrar = () => new Promise<void>(() => {});
    const { e, ag } = entorno({ almacen });
    let cerrado = false;
    void ag.cerrar(1000).then(() => (cerrado = true));
    await e.pasar(999);
    expect(cerrado).toBe(false);
    await e.pasar(1);
    expect(cerrado).toBe(true);
  });
});

describe("Autoguardado: fallos y salida de emergencia", () => {
  it("si falla la escritura: un aviso, una vez, y reintenta a los 10 s", async () => {
    let fallas = 2;
    const { e, ag } = entorno({ almacen: almacenMemoria({ fallarTrozo: () => fallas-- > 0 }) });
    e.editar();
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    expect(e.avisos).toEqual(["No se pudo hacer la copia de recuperación: no hay espacio en el disco"]);
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    expect(ag.estado.fallidas).toBe(2);
    expect(e.avisos).toHaveLength(1);
    await e.pasar(SIN_COMANDOS_MS);
    await e.terminar();
    expect(ag.estado.hechas).toBe(1);
    expect(await e.texto()).toBe(serializar(e.ed.documento));
  });

  it("apagar: el aviso único y no copia más", async () => {
    const { e, ag } = entorno();
    ag.apagar("No se pudo hacer la copia de recuperación: la base se cerró");
    e.editar();
    await e.pasar(SIN_COMANDOS_MS);
    expect(e.almacen.registros.size).toBe(0);
    expect(e.avisos).toHaveLength(1);
  });

  it("editando sin parar, la salida de emergencia se cuenta aparte", async () => {
    const { e, ag } = entorno({ relojQueAvanza: 0.5 });
    e.ed.documento = documentoBancoCables(100);
    e.editar();
    // Un comando antes de cada ocio: cada paso encuentra un cambio.
    e.antesDeOcio = () => e.editar();
    await ag.copiarYa();
    expect(ag.estado.emergencias).toBe(1);
    expect(ag.estado.ultima?.copia.deUnaVez).toBe(true);
    expect(ag.estado.ultima?.copia.reinicios).toBe(5);
  });
});
