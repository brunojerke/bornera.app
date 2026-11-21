// Validaciones en el editor (T19, etapa 2): el caché (avisosHoja.ts), cuándo
// recalcula (solo por comando y solo lo que el comando puede mover), el
// contorno en la escena sin restos, el anillo de la selección única, las
// notas del panel y la cuenta de la barra. Al final, un recorrido al azar por
// el editor contra `validar` desde cero, y las pruebas a propósito.

import { afterEach, describe, expect, it, vi } from "vitest";
import { marchaParada } from "../core/circuitos/marchaParada";
import { indexarHoja, puntoExtremo, recorridoCable } from "../core/model/cables";
import { Borrar, CambiarEtiqueta, CambiarExtremo, cablear, colocar, Espejar, Grupo, Mover, Rotar, type Comando } from "../core/model/comandos";
import type { Componente, Documento, Extremo, Hoja } from "../core/model/documento";
import type { Historial } from "../core/model/historial";
import { pegar, recortar } from "../core/model/portapapeles";
import { aparentesHoja, avisosR11, juntarConR11, mismaRedPorRedes } from "../core/model/aparentes";
import { contarAvisos, validar, type Aviso } from "../core/model/validaciones";
import { buscarSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import type { Colores } from "../render/capas";
import { RADIO_ANILLO } from "../render/resaltado";
import type { Renderer } from "../render/renderer";
import { cajaDibujo } from "../render/simbolo";
import { AvisosHoja, MS_TRAMO_R11, type OpcionesR11 } from "./avisosHoja";
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
const NEUTRO = "fuente.neutro";

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

/**
 * Un editor de prueba. R11 en reposo (T29, D6-A) no se programa solo: al
 * abrir se termina acá, y cada test que lo prueba corre sus tramos a mano.
 */
function armar(doc: Documento = documentoNuevo(), r11: OpcionesR11 = { programar: () => {} }) {
  const editor = new Editor(doc, 0, { r11 });
  editor.avisos.terminarR11();
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

/** Lleva contorno: algún aviso de etiqueta (R1 a R6, R9 o R10). */
const deContorno = (a: Aviso) => a.regla !== "R7" && a.regla !== "R8" && a.regla !== "R11";

/**
 * Lo que tiene que mostrar el editor, desde cero: `validar` y R11 (T29), en su
 * orden. R11 desde cero mira desde cada elemento; con la consulta lineal (la
 * de las hojas chicas, aparte del editor) es cuadrático, así que las hojas
 * grandes (2000) usan el índice espacial del editor.
 */
function todoDesdeCero(h: Hoja, editor: Editor): Aviso[] {
  const grande = h.componentes.length + h.cables.length > 300;
  return juntarConR11(h, validar(h), grande ? avisosR11(h, indexarHoja(h), editor.consulta) : avisosR11(h));
}

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
  const esperado = todoDesdeCero(h, editor);
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

  it("(3b, arreglo 3) renombrar, borrar y deshacer uno en 2000 evalúan su grupo de etiqueta, no la hoja", () => {
    const { editor, h } = armar(documentoBancoCables(2000));
    const k = h.componentes.find((c) => c.tipo === BOBINA && c.etiqueta !== "")!;
    const grupo = (e: string) => h.componentes.filter((c) => c.etiqueta.trim().toUpperCase() === e.trim().toUpperCase()).length;
    const evaluados = () => editor.avisos.componentesEtiqueta;
    let n = evaluados();
    const viejo = grupo(k.etiqueta);
    editor.ejecutar(new CambiarEtiqueta(k.id, "K999"));
    // El grupo viejo (con la bobina) y el nuevo (solo ella).
    expect(evaluados() - n).toBe(viejo);
    expect(diferencias(editor, h)).toEqual([]);
    n = evaluados();
    editor.ejecutar(new Borrar([k.id]));
    expect(evaluados() - n).toBe(0);
    n = evaluados();
    editor.deshacer();
    expect(evaluados() - n).toBe(1);
    n = evaluados();
    editor.deshacer();
    expect(evaluados() - n).toBe(viejo);
    expect(diferencias(editor, h)).toEqual([]);
    expect(viejo).toBeLessThan(20);
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

  it("R6 en las redes tocadas (3b, arreglo 2): con 2000 y un par NC y bobina, cablear el NC y deshacer visitan sus redes, no la hoja; un Grupo deshecho o rehecho va a la hoja entera", () => {
    const { editor, h, poner } = armar(documentoBancoCables(2000));
    const bobina = h.componentes.find((c) => c.tipo === BOBINA && c.etiqueta !== "")!;
    const x = Math.max(...h.componentes.map((c) => c.x)) + 8;
    const nc = poner(AUXILIAR_NC, x, 0, bobina.etiqueta);
    const p = puntoExtremo(indexarHoja(h), b(nc, "21"))!;
    const cable = () => cablear(editor.documento, { desde: b(nc, "21"), hasta: libre(p.x, p.y - 3), codos: [] });
    const a = editor.avisos;
    const antes = { r6: a.pasadasR6, hoja: a.pasadasR6Hoja, bornes: a.bornesR6 };
    editor.ejecutar(cable());
    editor.deshacer();
    expect(a.pasadasR6).toBe(antes.r6 + 2);
    expect(a.pasadasR6Hoja).toBe(antes.hoja);
    // El borne del cable y el otro borne del NC, en cada pasada.
    expect(a.bornesR6 - antes.bornes).toBeLessThanOrEqual(4);
    expect(diferencias(editor, h)).toEqual([]);
    // El mismo cable dentro de un Grupo: ejecutarlo va por las redes tocadas; deshacerlo y rehacerlo, por la hoja entera (D1).
    editor.agrupar([cable()]);
    expect(a.pasadasR6Hoja).toBe(antes.hoja);
    editor.deshacer();
    expect(a.pasadasR6Hoja).toBe(antes.hoja + 1);
    editor.rehacer();
    expect(a.pasadasR6Hoja).toBe(antes.hoja + 2);
    expect(diferencias(editor, h)).toEqual([]);
  });

  it("el índice de vecinos de R6 se arma una vez al aparecer el par NC y bobina y se va con él", () => {
    const proto = AvisosHoja.prototype as unknown as { armarVecinos: () => unknown };
    const armado = vi.spyOn(proto, "armarVecinos");
    const { editor, poner, tender } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    tender(b(k, "A1"), libre(0, -6));
    expect(armado).not.toHaveBeenCalled();
    const nc = poner(AUXILIAR_NC, 10, 0, "K1");
    expect(armado).toHaveBeenCalledTimes(1);
    tender(b(nc, "22"), b(k, "A1"), [[10, -2]]);
    expect(armado).toHaveBeenCalledTimes(1);
    const vecinos = () => (editor.avisos as unknown as { vecinos: unknown }).vecinos;
    expect(vecinos()).not.toBeNull();
    editor.ejecutar(new CambiarEtiqueta(nc, "K2"));
    expect(vecinos()).toBeNull();
    editor.deshacer();
    expect(armado).toHaveBeenCalledTimes(2);
  });

  it("msUltimaR6 (para el banco): 0 sin pasadas; mide solo la pasada de R6 y no cambia si R6 no corre", () => {
    const { editor, poner, tender } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    poner(AUXILIAR, 40, 0, "K1");
    expect(editor.avisos.pasadasR6).toBe(0);
    expect(editor.avisos.msUltimaR6).toBe(0);
    const nc = poner(AUXILIAR_NC, 20, 0, "K1");
    // Reloj falso: cada lectura avanza 2,5 ms; la pasada lee dos veces.
    let t = 100;
    const reloj = vi.spyOn(performance, "now").mockImplementation(() => (t += 2.5));
    try {
      const r6 = editor.avisos.pasadasR6;
      tender(b(nc, "22"), b(k, "A1"), [[20, -2]]);
      expect(editor.avisos.pasadasR6).toBe(r6 + 1);
      expect(editor.avisos.msUltimaR6).toBe(2.5);
      t += 1000;
      editor.ejecutar(new Mover([k, nc], 0, 4));
      expect(editor.avisos.pasadasR6).toBe(r6 + 1);
      expect(editor.avisos.msUltimaR6).toBe(2.5);
    } finally {
      reloj.mockRestore();
    }
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
const SEMILLA_R6 = 20261116;
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
/**
 * Con `r6` (etapa 3b, arreglo 2), otra semilla y un recorrido cargado de NC,
 * bobinas y fuentes con nombre, que suma operaciones solo de cables: borrar
 * cables, reconectar un extremo suelto y dos cables en un Grupo (cuyo
 * deshacer y rehacer van a la hoja entera). Sin `r6`, el recorrido es el de
 * la etapa 2, paso por paso.
 */
interface OpcionesRecorrido {
  semilla?: number;
  r6?: boolean;
}

function recorrer(editor: Editor, revisar: (paso: number) => void, opciones: OpcionesRecorrido = {}): Record<string, number> {
  const r6 = opciones.r6 === true;
  const azar = generador(opciones.semilla ?? SEMILLA);
  const entero = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;
  const doc = editor.documento;
  const h = doc.hojas[0]!;
  const historial = (editor as unknown as { historial: Historial }).historial;
  const ETIQUETAS = r6 ? ["K1", "K2", "k1 ", "K1", "", "L", "N"] : ["K1", "K2", "k1 ", "", "S1", "K7", "H1", "L"];
  const TIPOS = r6
    ? [BOBINA, BOBINA, AUXILIAR, AUXILIAR_NC, AUXILIAR_NC, AUXILIAR_NC, FASE, NEUTRO]
    : [BOBINA, BOBINA, AUXILIAR, AUXILIAR_NC, AUXILIAR_NC, PULSADOR_NA, PULSADOR_NC, LAMPARA, FASE];
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
    ...(r6 ? { borrarCables: 0, reconectar: 0, agruparCables: 0, deshacerGrupo: 0, rehacerGrupo: 0 } : {}),
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
  /** Arma un cable (sin ejecutarlo); null si no se puede. */
  const armarCable = (hasta: () => Extremo | null, desdeDado?: Extremo): Comando | null => {
    const lista = bornes();
    if (lista.length === 0) return null;
    const desde = desdeDado ?? elegir(lista);
    const destino = hasta();
    if (!destino) return null;
    const indice = indexarHoja(h);
    const p = puntoExtremo(indice, desde);
    const q = puntoExtremo(indice, destino);
    if (!p || !q || (p.x === q.x && p.y === q.y)) return null;
    const codos: [number, number][] = p.x === q.x || p.y === q.y ? [] : azar() < 0.5 ? [[q.x, p.y]] : [[p.x, q.y]];
    try {
      return cablear(doc, { desde, hasta: destino, codos });
    } catch {
      return null;
    }
  };
  const tender = (hasta: () => Extremo | null, desdeDado?: Extremo): boolean => {
    const c = armarCable(hasta, desdeDado);
    return c !== null && intentar(() => c);
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

  /** Solo con `r6`: el paso siguiente rehace el Grupo recién deshecho. */
  let rehacerGrupo = false;

  /** Un cable de un NC a un borne de su bobina (o de otra, si no hay). */
  const ncABobina = (): boolean => {
    const ncs = h.componentes.filter((c) => c.tipo === AUXILIAR_NC);
    const bobinas = h.componentes.filter((c) => c.tipo === BOBINA);
    if (ncs.length === 0 || bobinas.length === 0) return false;
    const nc = elegir(ncs);
    const k = bobinas.find((x) => x.etiqueta.trim().toUpperCase() === nc.etiqueta.trim().toUpperCase()) ?? elegir(bobinas);
    return tender(() => b(k.id, elegir(["A1", "A2"])), b(nc.id, elegir(["21", "22"])));
  };

  /** Solo con `r6`: operaciones que tocan solo cables. Devuelve la hecha, o null. */
  const soloCables = (r: number): string | null => {
    if (r < 0.06) return ncABobina() ? "cablearNCaBobina" : null;
    if (r < 0.11) {
      if (h.cables.length === 0) return null;
      const ids = new Set([elegir(h.cables).id]);
      if (azar() < 0.4) ids.add(elegir(h.cables).id);
      return intentar(() => new Borrar([...ids])) ? "borrarCables" : null;
    }
    if (r < 0.16) {
      const sueltos = h.cables.filter((w) => w.desde.tipo === "libre" || w.hasta.tipo === "libre");
      if (sueltos.length === 0) return null;
      const w = elegir(sueltos);
      const lado = w.desde.tipo === "libre" ? "desde" : "hasta";
      const destino = azar() < 0.7 ? (bornes().length > 0 ? elegir(bornes()) : null) : puntoEnCable();
      if (!destino || destino.tipo === "libre") return null;
      return intentar(() => new CambiarExtremo(w.id, lado, destino)) ? "reconectar" : null;
    }
    if (r >= 0.21) {
      // Deshacer un Grupo, si está arriba; el paso siguiente lo rehace.
      if (historial.siguienteDeshacer instanceof Grupo && editor.deshacer()) {
        hechas.deshacer!++;
        rehacerGrupo = true;
        return "deshacerGrupo";
      }
      return null;
    }
    const a = armarCable(() => elegir(bornes()));
    const c = armarCable(() => (azar() < 0.5 ? libre(entero(-34, 34), entero(-34, 34)) : puntoEnCable()));
    if (!a || !c) return null;
    try {
      editor.agrupar([a, c]);
      return "agruparCables";
    } catch {
      return null;
    }
  };

  for (let paso = 0; paso < OPERACIONES; paso++) {
    if (rehacerGrupo) {
      rehacerGrupo = false;
      if (historial.siguienteRehacer instanceof Grupo && editor.rehacer()) {
        hechas.rehacer!++;
        hechas.rehacerGrupo!++;
        revisar(paso);
        continue;
      }
    }
    let r = azar();
    const vacia = h.componentes.length === 0;
    let hecha: string | null = null;
    if (r6 && r < 0.25) {
      hecha = soloCables(r);
      if (hecha !== null) {
        hechas[hecha]!++;
        revisar(paso);
      }
      continue;
    }
    if (r6) r = (r - 0.25) / 0.75;
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
      if (ncABobina()) hecha = "cablearNCaBobina";
    } else if (r < 0.58) {
      if (tender(() => libre(entero(-34, 34), entero(-34, 34)))) hecha = "cablearSuelto";
    } else if (r < 0.63) {
      if (tender(puntoEnCable)) hecha = "cablearEnT";
    } else if (r < 0.7) {
      if (!vacia && intentar(() => editor.etiquetas.pegado(recortar(h, algunos()), entero(-20, 20), entero(-20, 20)).comando)) hecha = "pegar";
    } else if (r < 0.85) {
      const grupo = historial.siguienteDeshacer instanceof Grupo;
      if (editor.deshacer()) {
        hecha = "deshacer";
        if (r6 && grupo) {
          hechas.deshacerGrupo!++;
          rehacerGrupo = true;
        }
      }
    } else {
      const grupo = historial.siguienteRehacer instanceof Grupo;
      let rehecho = false;
      try {
        rehecho = editor.rehacer() !== null;
      } catch {
        // Rehacer una reconexión que ya no vale: el historial queda como estaba.
      }
      if (rehecho) {
        hecha = "rehacer";
        if (r6 && grupo) hechas.rehacerGrupo!++;
      }
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
    let parciales = 0;
    let ultima = editor.avisos.pasadasEtiqueta;
    let evaluados = editor.avisos.componentesEtiqueta;
    const hechas = recorrer(editor, (paso) => {
      const d = diferencias(editor, h);
      if (d.length > 0 && malos.length < 3) malos.push(`paso ${paso}: ${d.join(", ")}`);
      for (const a of validar(h)) reglas.add(a.regla);
      if (editor.avisos.pasadasEtiqueta === ultima) sinPasada++;
      else if (editor.avisos.componentesEtiqueta - evaluados < h.componentes.length) parciales++;
      ultima = editor.avisos.pasadasEtiqueta;
      evaluados = editor.avisos.componentesEtiqueta;
    });
    expect(malos).toEqual([]);
    for (const [operacion, n] of Object.entries(hechas)) expect(n, operacion).toBeGreaterThan(0);
    // Salieron todas las reglas, hubo pasos sin pasada de etiquetas (mover, cablear) y pasadas solo por grupos (3b, arreglo 3).
    expect([...reglas].sort()).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"]);
    expect(sinPasada).toBeGreaterThan(0);
    expect(parciales).toBeGreaterThan(20);
  });

  it(`R6 en las redes tocadas (3b, arreglo 2): ${OPERACIONES} operaciones cargadas de NC y bobinas (semilla ${SEMILLA_R6}), con borrar cables, reconectar y grupos, dicen lo mismo que validar`, () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    const a = editor.avisos;
    const malos: string[] = [];
    let locales = 0;
    let localesQueCambian = 0;
    let conR6 = 0;
    let previo = JSON.stringify(validar(h, ["R6"]));
    let pasadas = { r6: a.pasadasR6, hoja: a.pasadasR6Hoja };
    const hechas = recorrer(
      editor,
      (paso) => {
        const d = diferencias(editor, h);
        if (d.length > 0 && malos.length < 3) malos.push(`paso ${paso}: ${d.join(", ")}`);
        const ahora = JSON.stringify(validar(h, ["R6"]));
        const local = a.pasadasR6 > pasadas.r6 && a.pasadasR6Hoja === pasadas.hoja;
        if (local) locales++;
        if (local && ahora !== previo) localesQueCambian++;
        if (ahora !== "[]") conR6++;
        previo = ahora;
        pasadas = { r6: a.pasadasR6, hoja: a.pasadasR6Hoja };
      },
      { semilla: SEMILLA_R6, r6: true },
    );
    expect(malos).toEqual([]);
    const deCables = ["cablear", "cablearNCaBobina", "cablearSuelto", "cablearEnT", "borrarCables", "reconectar", "agruparCables", "deshacerGrupo", "rehacerGrupo"];
    for (const operacion of [...deCables, "colocar", "renombrarSinArrastre", "deshacer", "rehacer"]) expect(hechas[operacion], operacion).toBeGreaterThan(0);
    // Pasadas en las redes tocadas, algunas que prenden o apagan un R6, y pasos con R6 a la vista.
    // Con la semilla de hoy: 112 pasadas locales, 11 que cambian R6 y 112 pasos con R6.
    expect(locales).toBeGreaterThan(50);
    expect(localesQueCambian).toBeGreaterThan(5);
    expect(conR6).toBeGreaterThan(50);
  });

  it("a propósito (3b, arreglo 2): si R6 en las redes tocadas no siembra los extremos viejos, el recorrido lo nota", () => {
    const proto = AvisosHoja.prototype as unknown as { sembrarViejos: () => void };
    vi.spyOn(proto, "sembrarViejos").mockImplementation(() => {});
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(
      editor,
      () => {
        if (diferencias(editor, h).length > 0) malos++;
      },
      { semilla: SEMILLA_R6, r6: true },
    );
    expect(malos).toBeGreaterThan(0);
  });

  it("a propósito (3b, arreglo 3): si las etiquetas se recalculan solo para los componentes del cambio, sin el resto de su grupo, el recorrido lo nota", () => {
    const proto = AvisosHoja.prototype as unknown as { sumarGrupos: () => boolean };
    vi.spyOn(proto, "sumarGrupos").mockReturnValue(false);
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
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

  it("a propósito (3b, arreglo 1): si la comparación con lo guardado mira solo el tipo y no la etiqueta, el recorrido lo nota", () => {
    const proto = AvisosHoja.prototype as unknown as { mismoComponente: (g: { tipo: string }, c: Componente) => boolean };
    vi.spyOn(proto, "mismoComponente").mockImplementation((g, c) => g.tipo === c.tipo);
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });

  it("a propósito: si R6 no se recalcula al cablear, el recorrido lo nota", () => {
    const proto = AvisosHoja.prototype as unknown as { calcularR6: (h: Hoja) => Set<string>; r6Local: () => Set<string> };
    vi.spyOn(proto, "calcularR6").mockReturnValue(new Set());
    vi.spyOn(proto, "r6Local").mockReturnValue(new Set());
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });
});

// ── R10 y R11 (T29) ────────────────────────────────────────────────────────

describe("R10 y R11 en el editor (T29)", () => {
  const r11De = (editor: Editor, id: string) => editor.avisos.de(id).filter((a) => a.regla === "R11");

  /** Dónde queda un borne de un componente de la hoja. */
  const borneDe = (h: Hoja, comp: string, borne: string) => {
    const c = h.componentes.find((k) => k.id === comp)!;
    const d = buscarSimbolo(c.tipo)!.bornes.find((x) => x.nombre === borne)!;
    return { x: c.x + d.x, y: c.y + d.y };
  };

  it("R10: una Fase «l1» junto a la «L» marca la «L» con contorno; renombrarla a «N2» lo saca", () => {
    const mp = marchaParada();
    const { editor, h, poner } = armar(mp.doc);
    const otra = poner(FASE, 40, 0, "l1");
    expect(editor.avisos.de(mp.comp.fase).map((a) => a.regla)).toEqual(["R10"]);
    expect(editor.escena.obtener(mp.comp.fase)?.conAviso).toBe(true);
    expect(diferencias(editor, h)).toEqual([]);
    editor.ejecutar(new CambiarEtiqueta(otra, "N2"));
    expect(editor.avisos.de(mp.comp.fase)).toEqual([]);
    expect(editor.escena.obtener(mp.comp.fase)?.conAviso === true).toBe(false);
    editor.deshacer();
    expect(editor.avisos.de(mp.comp.fase).map((a) => a.regla)).toEqual(["R10"]);
    expect(diferencias(editor, h)).toEqual([]);
  });

  it("R11: al abrir, un cable sobre un borne marca los dos; sacarlo con Mover lo quita, deshacer lo muestra y rehacer lo saca", () => {
    const a = armar();
    const l = a.poner(LAMPARA, 0, 0, "H1");
    const p = borneDe(a.h, l, "X1");
    a.tender(libre(p.x - 4, p.y), libre(p.x + 4, p.y));
    // Abrir: un editor nuevo con el mismo documento.
    const { editor, h } = armar(a.editor.documento);
    const w = h.cables[0]!.id;
    expect(r11De(editor, l).map((x) => (x.regla === "R11" ? x.tipo : ""))).toEqual(["borne"]);
    expect(r11De(editor, w)).toHaveLength(1);
    expect(diferencias(editor, h)).toEqual([]);
    let cuentas = 0;
    editor.alCambiarAvisos = () => cuentas++;
    editor.ejecutar(new Mover([l], 0, 10));
    expect(r11De(editor, l)).toEqual([]);
    expect(r11De(editor, w)).toEqual([]);
    expect(diferencias(editor, h)).toEqual([]);
    editor.deshacer();
    expect(r11De(editor, l)).toHaveLength(1);
    expect(r11De(editor, w)).toHaveLength(1);
    expect(diferencias(editor, h)).toEqual([]);
    editor.rehacer();
    expect(r11De(editor, l)).toEqual([]);
    expect(diferencias(editor, h)).toEqual([]);
    expect(cuentas).toBe(3);
    expect(editor.avisos.pasadasR11Hoja).toBe(1);
  });

  it("R11: el panel dice la conexión aparente y el anillo se pone en el borne", () => {
    const a = armar();
    const l = a.poner(LAMPARA, 0, 0, "H1");
    const p = borneDe(a.h, l, "X1");
    const w = a.tender(libre(p.x - 4, p.y), libre(p.x + 4, p.y));
    const { editor } = armar(a.editor.documento);
    editor.seleccionarIds([w]);
    expect(editor.resumenSeleccion().cable!.avisos.map((x) => x.regla)).toEqual(["R8", "R11"]);
    const f = rendererFalso();
    editor.dibujarDinamico(f.r, { escala: 20, colores: COLORES, medir: MEDIR, visible: TODO });
    const anillos = f.llamadas.filter((x) => x[0] === "circulo" && x[3] === RADIO_ANILLO).map((x) => [x[1], x[2]]);
    expect(anillos).toContainEqual([p.x, p.y]);
  });

  it("R11-A: dos cables encimados de redes distintas avisan; un tercer cable que los une (sin tocarlos a ellos) los calla, y deshacer lo vuelve", () => {
    const { editor, h, tender } = armar();
    const w1 = tender(libre(0, 50), libre(10, 50));
    const w2 = tender(libre(5, 50), libre(15, 50));
    const encimado = (id: string) => r11De(editor, id).some((x) => x.regla === "R11" && x.tipo === "encimado");
    expect(encimado(w1) && encimado(w2)).toBe(true);
    // De una T en el extremo izquierdo de w1 (0, 50) baja y va a una T en el extremo derecho de w2 (15, 50).
    tender({ tipo: "cable", cable: w1, x: 0, y: 50 }, { tipo: "cable", cable: w2, x: 15, y: 50 }, [
      [0, 60],
      [15, 60],
    ]);
    expect(encimado(w1) || encimado(w2)).toBe(false);
    expect(diferencias(editor, h)).toEqual([]);
    editor.deshacer();
    expect(encimado(w1) && encimado(w2)).toBe(true);
    expect(diferencias(editor, h)).toEqual([]);
  });

  it("I-A: mover un componente en 2000 + cables cruza con el índice lo que tiene cerca, no la hoja", () => {
    const { editor, h } = armar(documentoBancoCables(2000));
    const a = editor.avisos;
    expect(a.pasadasR11Hoja).toBe(1);
    const antes = a.revisadosR11;
    const total = h.componentes.length + h.cables.length;
    editor.ejecutar(new Mover([h.componentes[7]!.id], 0, 1));
    expect(a.pasadasR11Hoja).toBe(1);
    const revisados = a.revisadosR11 - antes;
    expect(revisados).toBeGreaterThan(0);
    expect(revisados).toBeLessThan(total / 50);
  });

  it(`al azar (semilla ${SEMILLA}): R11 sale y cambia; R11-A calla algún encimado de la misma red`, () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let conR11 = 0;
    let cambia = 0;
    let callados = 0;
    let previo = JSON.stringify(avisosR11(h));
    recorrer(editor, () => {
      const ahora = JSON.stringify(avisosR11(h));
      if (ahora !== "[]") conR11++;
      if (ahora !== previo) cambia++;
      previo = ahora;
      const mismaRed = mismaRedPorRedes(h);
      if (aparentesHoja(h).some((x) => x.entreCables && mismaRed(x.a, x.b))) callados++;
    });
    // Con la semilla de hoy: conR11, cambia y callados en el mensaje si falla.
    expect({ conR11: conR11 > 50, cambia: cambia > 20, callados: callados > 0 }, JSON.stringify({ conR11, cambia, callados })).toEqual({
      conR11: true,
      cambia: true,
      callados: true,
    });
  });

  it("a propósito: si R11 no cruza con lo que está cerca (solo desde lo del cambio), el recorrido lo nota", () => {
    const proto = AvisosHoja.prototype as unknown as { sumarCercanos: () => void };
    vi.spyOn(proto, "sumarCercanos").mockImplementation(() => {});
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });

  it("a propósito: sin R11-A (la misma red nunca), el recorrido lo nota", () => {
    const proto = AvisosHoja.prototype as unknown as { mismaRed: () => (a: string, b: string) => boolean };
    vi.spyOn(proto, "mismaRed").mockReturnValue(() => false);
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });

  it("a propósito: con R11 sin poner al día después de cada comando, el recorrido lo nota", () => {
    vi.spyOn(AvisosHoja.prototype, "reflejarR11").mockReturnValue({ contornos: new Set(), ids: new Set(), cuenta: false });
    const mp = marchaParada({ ramaNC: true });
    const { editor, h } = armar(mp.doc);
    let malos = 0;
    recorrer(editor, () => {
      if (diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });
});

// ── R11 en reposo (T29, D6-A) ──────────────────────────────────────────────

describe("R11 en reposo: arriba de 100 elementos y al abrir, por tramos (T29, D6-A)", () => {
  /** Un editor con los tramos en una cola que el test corre a mano. */
  function conCola(doc: Documento, r11: OpcionesR11 = {}) {
    const cola: (() => void)[] = [];
    const { editor, h } = armar(doc, { ...r11, programar: (f) => cola.push(f) });
    const correr = (n = Infinity) => {
      for (let i = 0; i < n && cola.length > 0; i++) cola.shift()!();
    };
    return { editor, h, cola, correr };
  }

  /** Una hoja con `n` lámparas en fila, cada una con un cable suelto que pasa sobre su X1 (R11 en los dos). */
  function filaConAparentes(n: number): Documento {
    const { editor, poner, tender } = armar();
    const x1 = buscarSimbolo(LAMPARA)!.bornes.find((k) => k.nombre === "X1")!;
    for (let i = 0; i < n; i++) {
      poner(LAMPARA, i * 10, 0, "");
      tender(libre(i * 10 + x1.x - 2, x1.y), libre(i * 10 + x1.x + 2, x1.y));
    }
    return editor.documento;
  }

  const r11 = (editor: Editor) => editor.avisos.lista().filter((a) => a.regla === "R11");

  it("al abrir: nada hasta terminar los tramos; después, los avisos y la cuenta, y se avisa una vez", () => {
    const doc = filaConAparentes(60);
    const cola: (() => void)[] = [];
    const editor = new Editor(doc, 0, { r11: { programar: (f) => cola.push(f), pasosTramo: 10 } });
    const h = editor.documento.hojas[0]!;
    let avisos = 0;
    editor.alCambiarAvisos = () => avisos++;
    expect(editor.avisos.enReposoR11).toBe(true);
    expect(r11(editor)).toEqual([]);
    let tramos = 0;
    while (cola.length > 0) {
      cola.shift()!();
      tramos++;
    }
    expect(tramos).toBeGreaterThan(5);
    expect(editor.avisos.enReposoR11).toBe(false);
    expect(avisos).toBe(1);
    expect(r11(editor)).toHaveLength(120);
    expect(diferencias(editor, h)).toEqual([]);
  });

  it("hasta 100 elementos, en vivo; con 101 o más, en reposo hasta terminar", () => {
    const h0 = filaConAparentes(60).hojas[0]!;
    const { editor, h, correr } = conCola(documentoNuevo());
    const ids = (n: number) => [...h0.componentes.slice(0, n).map((c) => c.id), ...h0.cables.slice(0, n).map((w) => w.id)];
    // 50 lámparas + 50 cables = 100: en vivo.
    editor.ejecutar(pegar(editor.documento, recortar(h0, ids(50)), 0, 0));
    expect(editor.avisos.enReposoR11).toBe(false);
    expect(r11(editor)).toHaveLength(100);
    // 51 + 51 = 102: en reposo; los avisos llegan al terminar.
    editor.ejecutar(pegar(editor.documento, recortar(h0, ids(51)), 0, 50));
    expect(editor.avisos.enReposoR11).toBe(true);
    expect(r11(editor)).toHaveLength(100);
    correr();
    expect(editor.avisos.enReposoR11).toBe(false);
    expect(r11(editor)).toHaveLength(202);
    expect(diferencias(editor, h)).toEqual([]);
  });

  it("un comando en el medio: se suma a lo pendiente y el cálculo vuelve a empezar con todo lo acumulado", () => {
    const h0 = filaConAparentes(60).hojas[0]!;
    const { editor, h, correr } = conCola(documentoNuevo(), { pasosTramo: 5 });
    editor.ejecutar(pegar(editor.documento, recortar(h0, [...h0.componentes.map((c) => c.id), ...h0.cables.map((w) => w.id)]), 0, 0));
    correr(3);
    expect(editor.avisos.enReposoR11).toBe(true);
    // Un cambio chico, que solo iría en vivo: se suma a lo pendiente.
    editor.ejecutar(new Mover([h.componentes[0]!.id], 0, 10));
    expect(editor.avisos.enReposoR11).toBe(true);
    correr(4);
    editor.deshacer();
    correr();
    expect(editor.avisos.enReposoR11).toBe(false);
    expect(diferencias(editor, h)).toEqual([]);
  });

  it("los tramos duran hasta 4 ms: abrir 2000 + 3030 cables lleva muchos tramos, y ninguno se pasa de largo", () => {
    const duraciones: number[] = [];
    const cola: (() => void)[] = [];
    const editor = new Editor(documentoBancoCables(2000), 0, { r11: { programar: (f) => cola.push(f) } });
    while (cola.length > 0) {
      const t0 = performance.now();
      cola.shift()!();
      duraciones.push(performance.now() - t0);
    }
    expect(editor.avisos.enReposoR11).toBe(false);
    expect(MS_TRAMO_R11).toBe(4);
    expect(duraciones.length).toBeGreaterThan(10);
    // Un tramo corta en el primer paso después de 4 ms; un paso es un elemento o 64 pares (margen holgado para una máquina cargada).
    expect(Math.max(...duraciones)).toBeLessThan(MS_TRAMO_R11 + 6);
  });

  it(`al azar (semilla ${SEMILLA}), todo en reposo (umbral 0) y cortado en tramos de 3 pasos: cuando termina, lo mismo que el cálculo lento; los comandos llegan en el medio`, () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor, h, cola, correr } = conCola(mp.doc, { umbral: 0, pasosTramo: 3 });
    const azar = generador(SEMILLA + 29);
    const malos: string[] = [];
    let comparados = 0;
    let enElMedio = 0;
    let conR11 = 0;
    const hechas = recorrer(editor, (paso) => {
      // Entre comandos corre 0 a 3 tramos: muchas veces el próximo comando llega con el cálculo a medias.
      correr(Math.floor(azar() * 4));
      if (editor.avisos.enReposoR11) {
        enElMedio++;
        // Cada tanto, se deja terminar.
        if (azar() < 0.15) correr();
      }
      if (!editor.avisos.enReposoR11) {
        comparados++;
        const d = diferencias(editor, h);
        if (d.length > 0 && malos.length < 3) malos.push(`paso ${paso}: ${d.join(", ")}`);
        if (r11(editor).length > 0) conR11++;
      }
    });
    correr();
    expect(cola).toEqual([]);
    expect(diferencias(editor, h)).toEqual([]);
    expect(malos).toEqual([]);
    for (const [operacion, n] of Object.entries(hechas)) expect(n, operacion).toBeGreaterThan(0);
    expect({ comparados: comparados > 50, enElMedio: enElMedio > 50, conR11: conR11 > 20 }, JSON.stringify({ comparados, enElMedio, conR11 })).toEqual({
      comparados: true,
      enElMedio: true,
      conR11: true,
    });
  });

  it("a propósito: si al volver a empezar se pierden los afectados del cálculo cortado, el recorrido por partes lo nota", () => {
    const proto = AvisosHoja.prototype as unknown as { acumularR11: (...a: unknown[]) => void };
    const real = proto.acumularR11;
    vi.spyOn(proto, "acumularR11").mockImplementation(function (this: { afectadosR11: Set<string> }, ...a: unknown[]) {
      this.afectadosR11.clear();
      return real.apply(this, a);
    });
    const mp = marchaParada({ ramaNC: true });
    const { editor, h, correr } = conCola(mp.doc, { umbral: 0, pasosTramo: 3 });
    const azar = generador(SEMILLA + 29);
    let malos = 0;
    recorrer(editor, () => {
      correr(Math.floor(azar() * 4));
      if (editor.avisos.enReposoR11 && azar() < 0.15) correr();
      if (!editor.avisos.enReposoR11 && diferencias(editor, h).length > 0) malos++;
    });
    expect(malos).toBeGreaterThan(0);
  });
});
