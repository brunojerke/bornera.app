// Validaciones en el editor (T19, etapa 2): el caché (avisosHoja.ts), cuándo
// recalcula (solo por comando y solo lo que el comando puede mover), el
// contorno en la escena sin restos, el anillo de la selección única, las
// notas del panel y la cuenta de la barra. Al final, un recorrido al azar por
// el editor contra `validar` desde cero, y las pruebas a propósito.

import { afterEach, describe, expect, it, vi } from "vitest";
import { marchaParada } from "../core/circuitos/marchaParada";
import { indexarHoja, puntoExtremo, recorridoCable } from "../core/model/cables";
import { Borrar, CambiarEtiqueta, cablear, colocar, Espejar, Mover, Rotar, type Comando } from "../core/model/comandos";
import type { Componente, Documento, Extremo, Hoja } from "../core/model/documento";
import { recortar } from "../core/model/portapapeles";
import { contarAvisos, validar, type Aviso } from "../core/model/validaciones";
import { buscarSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import type { Colores } from "../render/capas";
import { RADIO_ANILLO } from "../render/resaltado";
import type { Renderer } from "../render/renderer";
import { cajaDibujo } from "../render/simbolo";
import { AvisosHoja } from "./avisosHoja";
import { documentoBanco, documentoBancoCables } from "./banco";
import { documentoNuevo, Editor, type DestinoVista } from "./editor";
import type { EventoHerramienta } from "./herramientas/tipos";

const BOBINA = "contactor.bobina";
const AUXILIAR = "contactor.auxiliar_na";
const AUXILIAR_NC = "contactor.auxiliar_nc";
const PULSADOR_NA = "pulsador.na";
const PULSADOR_NC = "pulsador.nc";
const LAMPARA = "senalizacion.lampara";
const FASE = "fuente.fase";

class VistaFalsa implements DestinoVista {
  regiones: Caja[] = [];
  invalidaciones = 0;
  invalidarRegion(caja: Caja): void {
    this.regiones.push(caja);
  }
  invalidar(): void {
    this.invalidaciones++;
  }
}

const ev = (x: number, y: number): EventoHerramienta => ({ x, y, boton: 0, botones: 0, mayus: false, ctrl: false, escala: 20 });

/** Renderer falso: anota cada llamada con sus argumentos. */
function rendererFalso(): { r: Renderer; llamadas: unknown[][] } {
  const llamadas: unknown[][] = [];
  const r = new Proxy({} as Renderer, {
    get:
      (_, nombre) =>
      (...args: unknown[]) => {
        llamadas.push([String(nombre), ...args]);
      },
  });
  return { r, llamadas };
}

const COLORES = { fondo: "#fff", punto: "#ccc", mayor: "#999", origen: "#999", simbolo: "#000", borne: "#c00", acento: "#06f", aviso: "#f80", conflicto: "#a12" } as Colores;
const MEDIR = (dibujar: () => void): number => {
  dibujar();
  return 7;
};
const TODO: Caja = { x: -1e6, y: -1e6, ancho: 2e6, alto: 2e6 };

function armar(doc: Documento = documentoNuevo()) {
  const editor = new Editor(doc);
  const vista = new VistaFalsa();
  editor.vista = vista;
  const h = editor.documento.hojas[0]!;
  const poner = (tipo: string, x: number, y: number, etiqueta: string) => {
    const cmd = colocar(editor.documento, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} });
    editor.ejecutar(cmd);
    return cmd.id;
  };
  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []) => {
    const cmd = cablear(editor.documento, { desde, hasta, codos });
    editor.ejecutar(cmd);
    return cmd.id;
  };
  const comp = (id: string) => h.componentes.find((c) => c.id === id)!;
  return { editor, vista, h, poner, tender, comp };
}

const b = (comp: string, borne: string): Extremo => ({ tipo: "borne", comp, borne });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });

/** Lleva contorno: algún aviso de etiqueta (R1 a R6 o R9). */
const deContorno = (a: Aviso) => a.regla !== "R7" && a.regla !== "R8";

/** La caja de dibujo de un componente, como la tiene la escena. */
function cajaDe(c: Componente): Caja {
  return cajaDibujo(buscarSimbolo(c.tipo)!, { x: c.x, y: c.y, rotacion: c.rot, espejado: c.espejado }, c.etiqueta || undefined);
}

function cubre(regiones: readonly Caja[], k: Caja): boolean {
  const e = 1e-9;
  return regiones.some((r) => r.x <= k.x + e && r.y <= k.y + e && r.x + r.ancho >= k.x + k.ancho - e && r.y + r.alto >= k.y + k.alto - e);
}

/** Lo que dice el editor (caché, cuenta y escena) contra `validar` desde cero. Devuelve las diferencias. */
function diferencias(editor: Editor, h: Hoja): string[] {
  const salida: string[] = [];
  const esperado = validar(h);
  if (JSON.stringify(editor.avisos.lista()) !== JSON.stringify(esperado)) salida.push("lista");
  if (JSON.stringify(editor.avisos.cuenta) !== JSON.stringify(contarAvisos(esperado))) salida.push("cuenta");
  const conContorno = new Set(esperado.filter(deContorno).map((a) => a.id));
  for (const c of h.componentes) {
    if ((editor.escena.obtener(c.id)?.conAviso === true) !== conContorno.has(c.id)) salida.push(`escena ${c.id}`);
  }
  return salida;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Lo básico ──────────────────────────────────────────────────────────────

describe("AvisosHoja en el editor (T19)", () => {
  it("al abrir la marcha-parada: cero; una bobina nueva da 2 R7 sin contorno; al cablear un borne, R7 baja y el cable suelto suma R8", () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor, poner, tender } = armar(mp.doc);
    expect(editor.avisos.lista()).toEqual([]);
    expect(editor.avisos.cuenta).toEqual({ errores: 0, avisos: 0 });

    const k9 = poner(BOBINA, 40, 0, "K9");
    expect(editor.avisos.de(k9).map((a) => a.regla)).toEqual(["R7", "R7"]);
    expect(editor.avisos.cuenta).toEqual({ errores: 0, avisos: 2 });
    expect(editor.avisos.conContorno(k9)).toBe(false);
    expect(editor.escena.obtener(k9)!.conAviso).toBeUndefined();

    const w = tender(b(k9, "A1"), libre(40, -6));
    expect(editor.avisos.bornesSueltos(k9)).toEqual(["A2"]);
    expect(editor.avisos.de(w)).toEqual([{ regla: "R8", severidad: "aviso", id: w }]);
    expect(editor.avisos.cuenta).toEqual({ errores: 0, avisos: 2 });
    editor.deshacer();
    expect(editor.avisos.bornesSueltos(k9)).toEqual(["A1", "A2"]);
    expect(editor.avisos.de(w)).toEqual([]);
  });

  it("dos bobinas K1: un error R4 en cada una, con contorno; la cuenta y alCambiarAvisos siguen al documento", () => {
    const { editor, poner } = armar();
    let avisados = 0;
    editor.alCambiarAvisos = () => avisados++;
    const a = poner(BOBINA, 0, 0, "K1");
    const c = poner(BOBINA, 10, 0, "K1");
    expect(editor.avisos.cuenta).toEqual({ errores: 2, avisos: 4 });
    expect(editor.escena.obtener(a)!.conAviso).toBe(true);
    expect(editor.escena.obtener(c)!.conAviso).toBe(true);
    expect(avisados).toBe(2);
    editor.ejecutar(new CambiarEtiqueta(c, "K2"));
    expect(editor.avisos.cuenta).toEqual({ errores: 0, avisos: 4 });
    expect(editor.escena.obtener(a)!.conAviso).toBeUndefined();
    expect(avisados).toBe(3);
    // Mover no cambia la cuenta: no avisa.
    editor.ejecutar(new Mover([a], 0, 5));
    expect(avisados).toBe(3);
  });

  it("sin restos: al aparecer la bobina de un contacto (R2), el contacto pierde el contorno y su caja se invalida aunque el cambio no lo nombre", () => {
    const { editor, vista, poner, comp } = armar();
    const aux = poner(AUXILIAR, 0, 0, "K2");
    const k = poner(BOBINA, 20, 0, "K1");
    expect(editor.escena.obtener(aux)!.conAviso).toBe(true);
    vista.regiones = [];
    editor.ejecutar(new CambiarEtiqueta(k, "K2"));
    expect(editor.escena.obtener(aux)!.conAviso).toBeUndefined();
    expect(cubre(vista.regiones, cajaDe(comp(aux)))).toBe(true);
    // Y al deshacer, vuelve, también sin que el cambio lo nombre.
    vista.regiones = [];
    editor.deshacer();
    expect(editor.escena.obtener(aux)!.conAviso).toBe(true);
    expect(cubre(vista.regiones, cajaDe(comp(aux)))).toBe(true);
  });

  it("a propósito: si los contornos que cambiaron no pasan a la escena, queda el contorno viejo y su caja no se invalida", () => {
    const { editor, vista, poner, comp } = armar();
    const aux = poner(AUXILIAR, 0, 0, "K2");
    const k = poner(BOBINA, 20, 0, "K1");
    const real = AvisosHoja.prototype.reflejar;
    vi.spyOn(editor.avisos, "reflejar").mockImplementation(function (this: AvisosHoja, cambio) {
      const r = real.call(this, cambio);
      return { ...r, contornos: new Set() };
    });
    vista.regiones = [];
    editor.ejecutar(new CambiarEtiqueta(k, "K2"));
    expect(editor.escena.obtener(aux)!.conAviso).toBe(true);
    expect(cubre(vista.regiones, cajaDe(comp(aux)))).toBe(false);
  });
});

// ── Cuándo recalcula (D-cuándo y los agregados de Bruno) ───────────────────

describe("cuándo recalcula: solo por comando, y solo lo que el comando puede mover", () => {
  const contadores = (e: Editor) => ({ etiqueta: e.avisos.pasadasEtiqueta, r6: e.avisos.pasadasR6, bornes: e.avisos.bornesRevisados });

  it("(a) mover, girar y espejar 2000 componentes no recorren la hoja: 0 pasadas de validar y 0 bornes revisados", () => {
    const { editor, h } = armar(documentoBanco(2000));
    const ids = h.componentes.map((c) => c.id);
    const antes = contadores(editor);
    editor.ejecutar(new Mover(ids, 3, 0));
    editor.ejecutar(new Rotar(ids, 90));
    editor.ejecutar(new Espejar(ids));
    editor.deshacer();
    editor.rehacer();
    expect(contadores(editor)).toEqual(antes);
    expect(diferencias(editor, h)).toEqual([]);
  });

  it("(a) también con cables: mover todo en la escena con cables de 2000 (la hoja entera) da 0 pasadas", () => {
    const { editor, h } = armar(documentoBancoCables(2000));
    const ids = [...h.componentes.map((c) => c.id), ...h.cables.map((w) => w.id)];
    const antes = contadores(editor);
    editor.ejecutar(new Mover(ids, 0, 4));
    editor.deshacer();
    expect(contadores(editor)).toEqual(antes);
  });

  it("(a) agregar, borrar, renombrar o cambiar el tipo sí recorren las etiquetas, una vez por comando", () => {
    const { editor, poner } = armar();
    const a = poner(BOBINA, 0, 0, "K1");
    let n = editor.avisos.pasadasEtiqueta;
    poner(LAMPARA, 10, 0, "H1");
    expect(editor.avisos.pasadasEtiqueta).toBe(++n);
    editor.ejecutar(new CambiarEtiqueta(a, "K3"));
    expect(editor.avisos.pasadasEtiqueta).toBe(++n);
    editor.ejecutar(new Borrar([a]));
    expect(editor.avisos.pasadasEtiqueta).toBe(++n);
    editor.deshacer();
    expect(editor.avisos.pasadasEtiqueta).toBe(++n);
  });

  it("cablear no recorre los componentes: 0 pasadas de etiqueta y solo los bornes de los dos componentes del cable", () => {
    const { editor, poner, tender } = armar();
    const s1 = poner(PULSADOR_NA, 0, 0, "S1");
    const h1 = poner(LAMPARA, 10, 0, "H1");
    for (let i = 0; i < 30; i++) poner(LAMPARA, 0, 20 + i * 6, `H${i + 2}`);
    const indice = indexarHoja(editor.documento.hojas[0]!);
    const p = puntoExtremo(indice, b(s1, "14"))!;
    const q = puntoExtremo(indice, b(h1, "X1"))!;
    const antes = contadores(editor);
    tender(b(s1, "14"), b(h1, "X1"), p.x === q.x || p.y === q.y ? [] : [[q.x, p.y]]);
    const despues = contadores(editor);
    expect(despues.etiqueta).toBe(antes.etiqueta);
    expect(despues.r6).toBe(antes.r6);
    // Los dos bornes de S1 y los dos de H1, no los de las otras 30 lámparas.
    expect(despues.bornes - antes.bornes).toBe(4);
  });

  it("renombrar no revisa bornes ni calcula R6 si no hay un NC con la etiqueta de una bobina", () => {
    const { editor, poner } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    poner(AUXILIAR, 10, 0, "K1");
    const antes = contadores(editor);
    editor.ejecutar(new CambiarEtiqueta(k, "K2"));
    expect(contadores(editor)).toEqual({ ...antes, etiqueta: antes.etiqueta + 1 });
  });

  it("R6: con un par NC y bobina, cablear sí lo calcula (una vez); mover no", () => {
    const { editor, poner, tender } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    const nc = poner(AUXILIAR_NC, 10, 0, "K1");
    const r6 = editor.avisos.pasadasR6;
    tender(b(nc, "22"), b(k, "A1"), [[10, -2]]);
    expect(editor.avisos.pasadasR6).toBe(r6 + 1);
    expect(editor.avisos.de(nc).map((a) => a.regla)).toContain("R6");
    editor.ejecutar(new Mover([k, nc], 0, 4));
    expect(editor.avisos.pasadasR6).toBe(r6 + 1);
  });

  it("(b) nunca por cuadro: mover el mouse, arrastrar y dibujar cuadros no recalculan; soltar sí", () => {
    const { editor, poner } = armar();
    const s1 = poner(PULSADOR_NA, 0, 0, "S1");
    poner(PULSADOR_NA, 10, 0, "S1");
    editor.seleccionarIds([s1]);
    const antes = contadores(editor);
    const f = rendererFalso();
    const info = { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO };
    const infoEstatica = { escala: 20, colores: COLORES, visible: TODO, detalle: { textos: true, bornes: true } };
    for (let i = 0; i < 20; i++) {
      editor.aplicar(editor.activa.mover(ev(30 + i, 30)));
      editor.dibujarDinamico(f.r, info);
      editor.escena.dibujar(f.r, infoEstatica);
    }
    editor.aplicar(editor.activa.presionar(ev(0, 0)));
    for (let i = 1; i <= 30; i++) {
      editor.aplicar(editor.activa.mover(ev(i * 0.2, i * 0.1)));
      editor.dibujarDinamico(f.r, info);
    }
    expect(editor.arrastrando).toBe(true);
    expect(contadores(editor)).toEqual(antes);
    editor.aplicar(editor.activa.soltar(ev(6, 3)));
    expect(editor.arrastrando).toBe(false);
    // Soltar es un Mover: R7 y etiquetas no se recalculan, pero sí se reflejó (sin pasada).
    expect(contadores(editor)).toEqual(antes);
    expect(diferencias(editor, editor.documento.hojas[0]!)).toEqual([]);
  });
});

// ── Lo que devuelve ────────────────────────────────────────────────────────

describe("reflejar devuelve solo lo que cambió", () => {
  it("cablear un borne de una de tres bobinas: solo esa bobina y el cable en ids; ningún contorno", () => {
    const { editor, poner } = armar();
    const a = poner(BOBINA, 0, 0, "K1");
    poner(BOBINA, 10, 0, "K2");
    poner(BOBINA, 20, 0, "K3");
    const real = AvisosHoja.prototype.reflejar;
    let ultimo: ReturnType<AvisosHoja["reflejar"]> | null = null;
    vi.spyOn(editor.avisos, "reflejar").mockImplementation(function (this: AvisosHoja, cambio) {
      ultimo = real.call(this, cambio);
      return ultimo;
    });
    const cmd = cablear(editor.documento, { desde: b(a, "A1"), hasta: libre(0, -6), codos: [] });
    editor.ejecutar(cmd);
    expect(new Set(ultimo!.ids)).toEqual(new Set([a, cmd.id]));
    expect(ultimo!.contornos.size).toBe(0);
    expect(ultimo!.cuenta).toBe(false); // un R7 menos y un R8 más
  });

  it("mover sin cambiar nada: nada", () => {
    const { editor, poner } = armar();
    const a = poner(BOBINA, 0, 0, "K1");
    const real = AvisosHoja.prototype.reflejar;
    let ultimo: ReturnType<AvisosHoja["reflejar"]> | null = null;
    vi.spyOn(editor.avisos, "reflejar").mockImplementation(function (this: AvisosHoja, cambio) {
      ultimo = real.call(this, cambio);
      return ultimo;
    });
    editor.ejecutar(new Mover([a], 2, 0));
    expect(ultimo!.ids.size).toBe(0);
    expect(ultimo!.contornos.size).toBe(0);
    expect(ultimo!.cuenta).toBe(false);
  });
});

// ── Panel y anillo ─────────────────────────────────────────────────────────

describe("panel y anillo", () => {
  it("el panel recibe los avisos del componente y del cable; cablear la bobina seleccionada avisa a la selección", () => {
    const { editor, poner, tender } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    editor.seleccionarIds([k]);
    let avisos = 0;
    editor.alCambiarSeleccion = () => avisos++;
    expect(editor.resumenSeleccion().unico!.avisos.map((a) => a.regla)).toEqual(["R7", "R7"]);
    const w = tender(b(k, "A1"), libre(0, -6));
    expect(avisos).toBe(1);
    expect(editor.resumenSeleccion().unico!.avisos.map((a) => a.regla)).toEqual(["R7"]);
    editor.seleccionarIds([w]);
    expect(editor.resumenSeleccion().cable!.avisos).toEqual([{ regla: "R8", severidad: "aviso", id: w }]);
  });

  it("anillo (opción C): con un único componente, en sus bornes sin cable; con un cable, en su extremo libre; con dos, ninguno", () => {
    const { editor, poner, tender } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    const l = poner(LAMPARA, 10, 0, "H1");
    const w = tender(b(k, "A1"), libre(0, -6));
    const info = { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO };
    const anillos = (ids: string[]) => {
      editor.seleccionarIds(ids);
      const f = rendererFalso();
      editor.dibujarDinamico(f.r, info);
      return f.llamadas.filter((x) => x[0] === "circulo" && x[3] === RADIO_ANILLO).map((x) => [x[1], x[2]]);
    };
    const a2 = editor.documento.hojas[0]!.componentes.find((c) => c.id === k)!;
    const borneA2 = buscarSimbolo(BOBINA)!.bornes.find((x) => x.nombre === "A2")!;
    expect(anillos([k])).toEqual([[a2.x + borneA2.x, a2.y + borneA2.y]]);
    expect(anillos([w])).toEqual([[0, -6]]);
    expect(anillos([l])).toHaveLength(2);
    expect(anillos([k, l])).toEqual([]);
  });

  it("anillo: debajo de 6 px por unidad, ninguno; y no se rearma por cuadro", () => {
    const { editor, poner } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    editor.seleccionarIds([k]);
    const f = rendererFalso();
    editor.dibujarDinamico(f.r, { escala: 5, colores: COLORES, medir: MEDIR, visible: TODO });
    expect(f.llamadas.filter((x) => x[0] === "circulo")).toEqual([]);
    const sueltos = vi.spyOn(editor.avisos, "bornesSueltos");
    for (let i = 0; i < 10; i++) editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO });
    expect(sueltos).toHaveBeenCalledTimes(1);
  });

  it("anillo: en el color de aviso, no en el de conflicto", () => {
    const { editor, poner } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    editor.seleccionarIds([k]);
    const f = rendererFalso();
    editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO });
    const i = f.llamadas.findIndex((x) => x[0] === "circulo");
    const estilo = f.llamadas.slice(0, i).reverse().find((x) => x[0] === "estilo")![1] as { trazo: string };
    expect(estilo.trazo).toBe(COLORES.aviso);
  });

  it("la previa de Colocar en conflicto va en --conflicto, no en --aviso", () => {
    const { editor, poner } = armar();
    poner(BOBINA, 0, 0, "K1");
    // Encima de la bobina: conflicto.
    editor.aplicar(editor.iniciarColocar(buscarSimbolo(BOBINA)!, "clic")!.mover(ev(0, 0)));
    expect(editor.colocar!.previa!.conflictos.length).toBeGreaterThan(0);
    const f = rendererFalso();
    editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO });
    const trazos = f.llamadas.filter((x) => x[0] === "estilo").map((x) => (x[1] as { trazo?: string }).trazo);
    expect(trazos).toContain(COLORES.conflicto);
    expect(trazos).not.toContain(COLORES.aviso);
  });
});

// ── Al azar, a través del editor ───────────────────────────────────────────

const SEMILLA = 20261115;
const OPERACIONES = 400;

function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Recorre `OPERACIONES` pasos al azar por el editor (colocar, mover, rotar,
 * espejar, borrar, renombrar con y sin arrastre, cablear de borne a borne, de
 * NC a bobina, a un extremo libre y en T, pegar, deshacer y rehacer) y,
 * después de cada uno, llama a `revisar`. La secuencia depende solo de la
 * semilla.
 */
function recorrer(editor: Editor, revisar: (paso: number) => void): Record<string, number> {
  const azar = generador(SEMILLA);
  const entero = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;
  const doc = editor.documento;
  const h = doc.hojas[0]!;
  const ETIQUETAS = ["K1", "K2", "k1 ", "", "S1", "K7", "H1", "L"];
  const TIPOS = [BOBINA, BOBINA, AUXILIAR, AUXILIAR_NC, AUXILIAR_NC, PULSADOR_NA, PULSADOR_NC, LAMPARA, FASE];
  const hechas: Record<string, number> = {
    colocar: 0,
    mover: 0,
    rotar: 0,
    espejar: 0,
    borrar: 0,
    renombrarConArrastre: 0,
    renombrarSinArrastre: 0,
    cablear: 0,
    cablearNCaBobina: 0,
    cablearSuelto: 0,
    cablearEnT: 0,
    pegar: 0,
    deshacer: 0,
    rehacer: 0,
  };
  const algunos = (): string[] => {
    const ids = new Set<string>();
    const n = entero(1, Math.min(4, h.componentes.length));
    while (ids.size < n) ids.add(elegir(h.componentes).id);
    if (h.cables.length > 0 && azar() < 0.3) ids.add(elegir(h.cables).id);
    return [...ids];
  };
  const intentar = (f: () => Comando): boolean => {
    let c: Comando;
    try {
      c = f();
    } catch {
      return false;
    }
    try {
      editor.ejecutar(c);
      return true;
    } catch {
      return false;
    }
  };
  const bornes = (): Extremo[] => {
    const lista: Extremo[] = [];
    for (const c of h.componentes) for (const x of buscarSimbolo(c.tipo)?.bornes ?? []) lista.push(b(c.id, x.nombre));
    return lista;
  };
  const tender = (hasta: () => Extremo | null, desdeDado?: Extremo): boolean => {
    const lista = bornes();
    if (lista.length === 0) return false;
    const desde = desdeDado ?? elegir(lista);
    const destino = hasta();
    if (!destino) return false;
    const indice = indexarHoja(h);
    const p = puntoExtremo(indice, desde);
    const q = puntoExtremo(indice, destino);
    if (!p || !q || (p.x === q.x && p.y === q.y)) return false;
    const codos: [number, number][] = p.x === q.x || p.y === q.y ? [] : azar() < 0.5 ? [[q.x, p.y]] : [[p.x, q.y]];
    return intentar(() => cablear(doc, { desde, hasta: destino, codos }));
  };
  const puntoEnCable = (): Extremo | null => {
    if (h.cables.length === 0) return null;
    const w = elegir(h.cables);
    const r = recorridoCable(indexarHoja(h), w);
    if (!r) return null;
    const k = entero(0, r.length / 2 - 2);
    const [x0, y0, x1, y1] = [r[2 * k]!, r[2 * k + 1]!, r[2 * k + 2]!, r[2 * k + 3]!];
    const x = x0 === x1 ? x0 : entero(Math.min(x0, x1), Math.max(x0, x1));
    const y = y0 === y1 ? y0 : entero(Math.min(y0, y1), Math.max(y0, y1));
    return { tipo: "cable", cable: w.id, x, y };
  };

  for (let paso = 0; paso < OPERACIONES; paso++) {
    const r = azar();
    const vacia = h.componentes.length === 0;
    let hecha: string | null = null;
    if (r < 0.15) {
      const datos = { tipo: elegir(TIPOS), x: entero(-30, 30), y: entero(-30, 30), rot: 0 as const, espejado: false, etiqueta: elegir(ETIQUETAS), params: {} };
      if (intentar(() => colocar(doc, datos))) hecha = "colocar";
    } else if (r < 0.22) {
      if (!vacia && intentar(() => new Mover(algunos(), entero(-4, 4) || 1, entero(-4, 4)))) hecha = "mover";
    } else if (r < 0.25) {
      if (!vacia && intentar(() => new Rotar(algunos(), 90))) hecha = "rotar";
    } else if (r < 0.27) {
      if (!vacia && intentar(() => new Espejar(algunos()))) hecha = "espejar";
    } else if (r < 0.34) {
      if (!vacia && intentar(() => new Borrar(algunos()))) hecha = "borrar";
    } else if (r < 0.41) {
      if (!vacia) {
        const c = elegir(h.componentes);
        const nueva = elegir(ETIQUETAS);
        if (azar() < 0.4 && c.tipo === BOBINA) {
          if (editor.cambiarEtiqueta(c.id, nueva)) hecha = "renombrarConArrastre";
        } else if (c.etiqueta !== nueva && intentar(() => new CambiarEtiqueta(c.id, nueva))) {
          hecha = "renombrarSinArrastre";
        }
      }
    } else if (r < 0.48) {
      if (tender(() => elegir(bornes()))) hecha = "cablear";
    } else if (r < 0.54) {
      const ncs = h.componentes.filter((c) => c.tipo === AUXILIAR_NC);
      const bobinas = h.componentes.filter((c) => c.tipo === BOBINA);
      if (ncs.length > 0 && bobinas.length > 0) {
        const nc = elegir(ncs);
        const k = bobinas.find((x) => x.etiqueta.trim().toUpperCase() === nc.etiqueta.trim().toUpperCase()) ?? elegir(bobinas);
        if (tender(() => b(k.id, elegir(["A1", "A2"])), b(nc.id, elegir(["21", "22"])))) hecha = "cablearNCaBobina";
      }
    } else if (r < 0.58) {
      if (tender(() => libre(entero(-34, 34), entero(-34, 34)))) hecha = "cablearSuelto";
    } else if (r < 0.63) {
      if (tender(puntoEnCable)) hecha = "cablearEnT";
    } else if (r < 0.7) {
      if (!vacia && intentar(() => editor.etiquetas.pegado(recortar(h, algunos()), entero(-20, 20), entero(-20, 20)).comando)) hecha = "pegar";
    } else if (r < 0.85) {
      if (editor.deshacer()) hecha = "deshacer";
    } else if (editor.rehacer()) {
      hecha = "rehacer";
    }
    if (hecha === null) continue;
    hechas[hecha]!++;
    revisar(paso);
  }
  return hechas;
}

describe("al azar, con semilla fija, a través del editor (T19)", { timeout: 30_000 }, () => {
  it(`${OPERACIONES} operaciones (semilla ${SEMILLA}): después de cada una, el caché, la cuenta y los contornos de la escena dicen lo mismo que validar desde cero`, () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    const malos: string[] = [];
    const reglas = new Set<string>();
    let sinPasada = 0;
    let ultima = editor.avisos.pasadasEtiqueta;
    const hechas = recorrer(editor, (paso) => {
      const d = diferencias(editor, h);
      if (d.length > 0 && malos.length < 3) malos.push(`paso ${paso}: ${d.join(", ")}`);
      for (const a of validar(h)) reglas.add(a.regla);
      if (editor.avisos.pasadasEtiqueta === ultima) sinPasada++;
      ultima = editor.avisos.pasadasEtiqueta;
    });
    expect(malos).toEqual([]);
    for (const [operacion, n] of Object.entries(hechas)) expect(n, operacion).toBeGreaterThan(0);
    // Salieron todas las reglas, y hubo pasos sin pasada de etiquetas (mover, cablear).
    expect([...reglas].sort()).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"]);
    expect(sinPasada).toBeGreaterThan(0);
  });

  it("a propósito: con la puesta al día anulada, el recorrido encuentra diferencias", () => {
    vi.spyOn(AvisosHoja.prototype, "reflejar").mockReturnValue({ contornos: new Set(), ids: new Set(), cuenta: false });
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });

  it("a propósito: con R7 incremental anulado (no revisa los bornes de los cables del cambio), el recorrido lo nota", () => {
    // `ponerR7` es privado: se reemplaza en el prototipo, solo para este test.
    const proto = AvisosHoja.prototype as unknown as { ponerR7: (id: string, c: Componente | undefined) => boolean };
    const real = proto.ponerR7;
    vi.spyOn(proto, "ponerR7").mockImplementation(function (this: AvisosHoja, id, c) {
      // Solo los componentes nuevos o borrados: los cables no cuentan.
      const conocido = (this as unknown as { r7: Map<string, unknown> }).r7.has(id);
      return c === undefined || !conocido ? real.call(this, id, c) : false;
    });
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });

  it("a propósito: si R6 no se recalcula al cablear, el recorrido lo nota", () => {
    const proto = AvisosHoja.prototype as unknown as { calcularR6: (h: Hoja) => Set<string> };
    vi.spyOn(proto, "calcularR6").mockReturnValue(new Set());
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });
});
