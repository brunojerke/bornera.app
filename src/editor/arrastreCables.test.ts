// El editor con cables que siguen (T14a): girar, espejar y arrastrar
// componentes cableados y cables, la vista previa del arrastre, los
// rechazos (soltar donde no vale, Esc, botón derecho, cambio de escena o de
// modo, el documento que cambia en el medio) y Colocar con la misma regla.

import { describe, expect, it } from "vitest";
import { indexarHoja, recorridoCable, validarHoja } from "../core/model/cables";
import { cablear, CambiarEtiqueta, colocar, type DatosCable } from "../core/model/comandos";
import type { Componente, Documento, Extremo } from "../core/model/documento";
import { geometriaComponente, problemasComponente, consultaHoja } from "../core/model/trazado";
import { buscarSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import { AVISO_ARRASTRE_CANCELADO, documentoNuevo, Editor, textoReducido, TOPE_CABLES_PREVIA, type DestinoVista } from "./editor";
import type { EventoHerramienta } from "./herramientas/tipos";

class VistaFalsa implements DestinoVista {
  regiones: Caja[] = [];
  cuadros = 0;
  invalidarRegion(caja: Caja): void {
    this.regiones.push(caja);
  }
  invalidar(): void {
    this.cuadros++;
  }
}

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const comp = (tipo: string, x: number, y: number, etiqueta: string): Omit<Componente, "id"> => ({
  tipo,
  x,
  y,
  rot: 0,
  espejado: false,
  etiqueta,
  params: {},
});
const borne = (c: string, b: string): Extremo => ({ tipo: "borne", comp: c, borne: b });

/**
 * c1 bobina K1 (0, 0): A1 (0, −2), A2 (0, 2). c2 pulsador S1 (10, 0): 13
 * (10, −2), 14 (10, 2). c3 bobina K2 (40, 0), sin cables. c4 lámpara H1
 * (20, 0) con un puente que le cruza el cuerpo (desde antes).
 * w1: K1.A1 → S1.13 recto; w2: K1.A2 → S1.14 por abajo (y = 5); w3: puente de H1.
 */
function armar() {
  const editor = new Editor(documentoNuevo());
  const vista = new VistaFalsa();
  editor.vista = vista;
  const avisos: string[] = [];
  editor.alAvisar = (t) => avisos.push(t);
  const doc = editor.documento;
  for (const c of [
    comp("contactor.bobina", 0, 0, "K1"),
    comp("pulsador.na", 10, 0, "S1"),
    comp("contactor.bobina", 40, 0, "K2"),
    comp("senalizacion.lampara", 20, 0, "H1"),
  ]) {
    editor.ejecutar(colocar(doc, c));
  }
  const cables: DatosCable[] = [
    { desde: borne("c1", "A1"), hasta: borne("c2", "13"), codos: [] },
    { desde: borne("c1", "A2"), hasta: borne("c2", "14"), codos: [[0, 5], [10, 5]] },
    { desde: borne("c4", "X1"), hasta: borne("c4", "X2"), codos: [] },
  ];
  for (const d of cables) editor.ejecutar(cablear(doc, d));
  vista.regiones = [];
  const historial = editor.historial as unknown as { hechos: unknown[] };
  return { editor, vista, avisos, pasos: () => historial.hechos.length };
}

const ev = (x: number, y: number, boton = 0): EventoHerramienta => ({ x, y, boton, botones: 1, mayus: false, ctrl: false, escala: 20 });

/** Aprieta en (x0, y0) y arrastra hasta (x, y) por los puntos intermedios, sin soltar. */
function arrastrar(editor: Editor, x0: number, y0: number, x: number, y: number, pasos = 4): void {
  const h = editor.seleccionar;
  editor.aplicar(h.presionar(ev(x0, y0)));
  for (let i = 1; i <= pasos; i++) editor.aplicar(h.mover(ev(x0 + ((x - x0) * i) / pasos, y0 + ((y - y0) * i) / pasos)));
}

/** Nada quedó oculto en la escena (ni componentes ni cables). */
function nadaOculto(editor: Editor, doc: Documento): boolean {
  const h = doc.hojas[0]!;
  return h.componentes.every((c) => !editor.escena.oculto(c.id)) && h.cables.every((w) => !editor.escena.cableOculto(w.id));
}

/** La escena dibuja cada cable con el recorrido del documento. */
function escenaAlDia(editor: Editor): boolean {
  const h = editor.documento.hojas[0]!;
  const indice = indexarHoja(h);
  return h.cables.every((w) => JSON.stringify(editor.escena.obtenerCable(w.id)?.puntos) === JSON.stringify(recorridoCable(indice, w)));
}

/** Ningún aviso nombra ids internos ("w3", "c7"). */
function sinIds(textos: readonly string[]): boolean {
  return textos.every((t) => !/\b[wc]\d+\b/.test(t));
}

/** Lo que el editor planeó para la previa del arrastre en el punto actual (privado). */
function planPrevia(editor: Editor) {
  return (editor as unknown as { planArrastre(): { cambiados: Map<string, { puntos: readonly number[] }>; r: { rechazo: unknown } } | null }).planArrastre();
}

describe("girar y espejar con cables", () => {
  it("R sobre un componente cableado gira y los cables lo siguen, en un paso; deshacer y rehacer, exactos", () => {
    const { editor, pasos } = armar();
    const antes = copia(editor.documento);
    const n = pasos();
    editor.seleccionarIds(["c1"]);
    expect(editor.accion("rotar")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect(validarHoja(editor.documento.hojas[0]!)).toEqual([]);
    expect(escenaAlDia(editor)).toBe(true);
    const despues = copia(editor.documento);
    expect(editor.accion("deshacer")).toBe(true);
    expect(editor.documento).toEqual(antes);
    expect(escenaAlDia(editor)).toBe(true);
    expect(editor.accion("rehacer")).toBe(true);
    expect(editor.documento).toEqual(despues);
  });

  it("un cable entre dos componentes que no se mueven no gira: avisa sin ids y no da paso", () => {
    const { editor, avisos, pasos } = armar();
    const n = pasos();
    editor.seleccionarIds(["w1"]);
    expect(editor.accion("rotar")).toBe(false);
    expect(editor.accion("espejar")).toBe(false);
    expect(avisos).toEqual([
      "Ese cable está conectado a componentes que no se mueven: mové los componentes.",
      "Ese cable está conectado a componentes que no se mueven: mové los componentes.",
    ]);
    expect(pasos()).toBe(n);
  });

  it("selección mezclada: R, M, Supr, Ctrl+Z y Ctrl+Y andan, cada uno en un paso", () => {
    const { editor, avisos, pasos } = armar();
    const antes = copia(editor.documento);
    editor.seleccionarIds(["c1", "c2", "w1", "w2"]);
    const n = pasos();
    for (const a of ["rotar", "rotarAntihorario", "espejar"] as const) {
      expect(editor.accion(a), `${a}: ${avisos.join(" / ")}`).toBe(true);
      expect(validarHoja(editor.documento.hojas[0]!)).toEqual([]);
    }
    expect(pasos()).toBe(n + 3);
    expect(editor.accion("borrar")).toBe(true);
    expect(editor.documento.hojas[0]!.cables.map((w) => w.id)).toEqual(["w3"]);
    expect(editor.seleccion.size).toBe(0);
    for (let i = 0; i < 4; i++) expect(editor.accion("deshacer")).toBe(true);
    expect(editor.documento).toEqual(antes);
    for (let i = 0; i < 4; i++) expect(editor.accion("rehacer")).toBe(true);
    expect(editor.documento.hojas[0]!.cables.map((w) => w.id)).toEqual(["w3"]);
    expect(escenaAlDia(editor)).toBe(true);
    expect(sinIds(avisos)).toBe(true);
  });

  it("R rechazado marca la ✕ hasta el próximo cambio y no da paso", () => {
    const { editor, avisos, pasos } = armar();
    // K2 al lado de un tramo vertical: girarlo dejaría un borne sobre el cable.
    editor.ejecutar(cablear(editor.documento, { desde: { tipo: "libre", x: 42, y: -5 }, hasta: { tipo: "libre", x: 42, y: 5 }, codos: [] }));
    const n = pasos();
    editor.seleccionarIds(["c3"]);
    expect(editor.accion("rotar")).toBe(false);
    expect(pasos()).toBe(n);
    expect(avisos.at(-1)).toBe("No se puede girar: el borne K2 · A1 quedaría sobre un cable sin conectarse.");
    const cruces = (editor as unknown as { crucesRechazo: unknown[] }).crucesRechazo;
    expect(cruces.length).toBeGreaterThan(0);
    editor.seleccionarIds([]);
    expect((editor as unknown as { crucesRechazo: unknown[] }).crucesRechazo).toEqual([]);
  });
});

describe("arrastrar con cables", () => {
  it("un clic sin movimiento no invalida nada", () => {
    const { editor, vista } = armar();
    editor.seleccionarIds(["c1"]);
    editor.aplicar(editor.seleccionar.presionar(ev(0.2, 0)));
    editor.aplicar(editor.seleccionar.soltar(ev(0.2, 0)));
    expect(vista.regiones).toEqual([]);
  });

  it("30 movimientos dan un solo comando, y los mosaicos se invalidan solo al empezar y al soltar", () => {
    const { editor, vista, pasos } = armar();
    editor.seleccionarIds(["c1"]);
    const n = pasos();
    editor.aplicar(editor.seleccionar.presionar(ev(0.2, 0)));
    editor.aplicar(editor.seleccionar.mover(ev(0.2, 1)));
    expect(editor.arrastrando).toBe(true);
    const alEmpezar = vista.regiones.length;
    expect(alEmpezar).toBeGreaterThan(0);
    // Ocultos: el componente y su zona de cables (w1 y w2).
    expect(editor.escena.oculto("c1")).toBe(true);
    expect(editor.escena.cableOculto("w1") && editor.escena.cableOculto("w2")).toBe(true);
    expect(editor.escena.cableOculto("w3")).toBe(false);
    for (let i = 0; i < 30; i++) editor.aplicar(editor.seleccionar.mover(ev(0.2 - i * 0.1, 1 + i * 0.2)));
    expect(vista.regiones.length).toBe(alEmpezar);
    editor.aplicar(editor.seleccionar.soltar(ev(-2.8, 7)));
    expect(pasos()).toBe(n + 1);
    expect(vista.regiones.length).toBeGreaterThan(alEmpezar);
    expect(nadaOculto(editor, editor.documento)).toBe(true);
    expect(validarHoja(editor.documento.hojas[0]!)).toEqual([]);
    expect(escenaAlDia(editor)).toBe(true);
  });

  it("los componentes fijos donde terminan cables de la zona salen de la estática mientras se arrastra (su marca de borne va encima del cable)", () => {
    const { editor, vista } = armar();
    editor.seleccionarIds(["c1"]);
    editor.aplicar(editor.seleccionar.presionar(ev(0.2, 0)));
    editor.aplicar(editor.seleccionar.mover(ev(0.2, 2)));
    // S1 (c2) no se mueve, pero w1 y w2 terminan en sus bornes; H1 (c4) y K2 (c3) no tocan la zona.
    expect(editor.escena.oculto("c2")).toBe(true);
    expect(editor.escena.oculto("c3") || editor.escena.oculto("c4")).toBe(false);
    const alEmpezar = vista.regiones.slice();
    for (let i = 0; i < 10; i++) editor.aplicar(editor.seleccionar.mover(ev(0.2, 2 + i * 0.3)));
    expect(vista.regiones.length).toBe(alEmpezar.length);
    editor.aplicar(editor.seleccionar.soltar(ev(0.2, 5)));
    expect(nadaOculto(editor, editor.documento)).toBe(true);
    // S1 vuelve a la estática: su caja (alrededor de (10, 0)) se invalida al empezar y al terminar.
    const tieneS1 = (k: Caja) => k.x <= 10 && k.x + k.ancho >= 10 && k.y <= 0 && k.y + k.alto >= 0;
    expect(alEmpezar.some(tieneS1)).toBe(true);
    expect(vista.regiones.slice(alEmpezar.length).some(tieneS1)).toBe(true);
  });

  it("la previa coincide con el resultado final en 100 posiciones", () => {
    const { editor, pasos } = armar();
    let a = 7;
    const azar = () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648);
    let comparadas = 0;
    for (let k = 0; k < 100; k++) {
      editor.seleccionarIds(azar() < 0.5 ? ["c1"] : ["c1", "c2", "w1"]);
      const dx = Math.floor(azar() * 13) - 6;
      const dy = Math.floor(azar() * 13) - 6;
      const n = pasos();
      arrastrar(editor, 0.2, 0, 0.2 + dx, dy);
      const previa = planPrevia(editor);
      editor.aplicar(editor.seleccionar.soltar(ev(0.2 + dx, dy)));
      if (pasos() === n) {
        // Rechazado (o sin moverse): la previa lo decía y nada cambió.
        expect(previa === null || previa.r.rechazo !== null).toBe(true);
        continue;
      }
      expect(previa?.r.rechazo).toBeNull();
      for (const [id, c] of previa!.cambiados) expect(editor.escena.obtenerCable(id)?.puntos).toEqual(c.puntos);
      expect(escenaAlDia(editor)).toBe(true);
      expect(nadaOculto(editor, editor.documento)).toBe(true);
      comparadas++;
      editor.deshacer();
    }
    expect(comparadas).toBeGreaterThan(50);
  });

  it("donde no vale: la pista dice por qué, se limpia al salir, y soltar ahí no da paso ni deja nada oculto", () => {
    const { editor, avisos, pasos, vista } = armar();
    const antes = copia(editor.documento);
    const pistas: (string | null)[] = [];
    editor.alCambiarPista = (p) => pistas.push(p);
    editor.seleccionarIds(["c3"]);
    const n = pasos();
    // K2 de (40, 0) a (5, 3): su A2 (5, 5) cae sobre el tramo de abajo de w2.
    arrastrar(editor, 40, 0, 5, 3);
    expect(editor.pista).toBe("No se puede mover acá: el borne K2 · A2 quedaría sobre un cable sin conectarse.");
    // Un poco más arriba vale: la pista se limpia.
    editor.aplicar(editor.seleccionar.mover(ev(5, -8)));
    expect(editor.pista).toBeNull();
    editor.aplicar(editor.seleccionar.mover(ev(5, 3)));
    expect(editor.pista).not.toBeNull();
    const alEmpezar = vista.regiones.slice();
    editor.aplicar(editor.seleccionar.soltar(ev(5, 3)));
    expect(pasos()).toBe(n);
    expect(editor.documento).toEqual(antes);
    expect(avisos.at(-1)).toBe("No se puede mover acá: el borne K2 · A2 quedaría sobre un cable sin conectarse.");
    expect(editor.pista).toBeNull();
    expect(pistas.at(-1)).toBeNull();
    expect(nadaOculto(editor, editor.documento)).toBe(true);
    // Sin restos: lo que se invalidó al empezar se vuelve a invalidar al terminar.
    for (const k of alEmpezar) expect(vista.regiones.slice(alEmpezar.length)).toContainEqual(k);
    expect(sinIds(avisos)).toBe(true);
  });

  it.each([
    ["Esc", (e: Editor) => e.aplicar(e.seleccionar.cancelar())],
    ["botón derecho", (e: Editor) => e.aplicar(e.seleccionar.presionar(ev(3, 4, 2)))],
    ["cambio de escena o de modo", (e: Editor) => e.cancelarHerramienta()],
    ["gesto cortado", (e: Editor) => e.aplicar(e.seleccionar.soltar(null))],
  ] as const)("%s en medio del arrastre: todo vuelve exacto, sin paso y sin restos", (_, cortar) => {
    const { editor, pasos, vista } = armar();
    const antes = copia(editor.documento);
    editor.seleccionarIds(["c1", "w1"]);
    const n = pasos();
    arrastrar(editor, 0.2, 0, 3, 4);
    expect(editor.arrastrando).toBe(true);
    const alEmpezar = vista.regiones.slice();
    cortar(editor);
    expect(editor.arrastrando).toBe(false);
    // Un soltar que llega después no hace nada.
    editor.aplicar(editor.seleccionar.soltar(ev(3, 4)));
    expect(pasos()).toBe(n);
    expect(editor.documento).toEqual(antes);
    expect(nadaOculto(editor, editor.documento)).toBe(true);
    expect(escenaAlDia(editor)).toBe(true);
    for (const k of alEmpezar) expect(vista.regiones.slice(alEmpezar.length)).toContainEqual(k);
  });

  it("si el documento cambia en el medio, el plan de la previa no se usa: el arrastre se cancela", () => {
    const { editor, avisos, pasos } = armar();
    editor.seleccionarIds(["c1"]);
    arrastrar(editor, 0.2, 0, 3, 4);
    expect(planPrevia(editor)).not.toBeNull();
    editor.ejecutar(new CambiarEtiqueta("c3", "K9"));
    const n = pasos();
    expect(editor.arrastrando).toBe(false);
    expect(avisos.at(-1)).toBe(AVISO_ARRASTRE_CANCELADO);
    editor.aplicar(editor.seleccionar.soltar(ev(3, 4)));
    expect(pasos()).toBe(n);
    expect(editor.documento.hojas[0]!.componentes[0]).toMatchObject({ x: 0, y: 0 });
    expect(nadaOculto(editor, editor.documento)).toBe(true);
  });

  it("una selección que no mueve nada no arrastra: avisa una vez", () => {
    const { editor, avisos, pasos, vista } = armar();
    editor.seleccionarIds(["w1"]);
    const n = pasos();
    arrastrar(editor, 5, -2, 5, 3);
    expect(editor.arrastrando).toBe(false);
    editor.aplicar(editor.seleccionar.soltar(ev(5, 3)));
    expect(avisos).toEqual(["Ese cable está conectado a componentes que no se mueven: mové los componentes."]);
    expect(pasos()).toBe(n);
    expect(vista.regiones).toEqual([]);
  });

});

describe("tope de la previa (TOPE_CABLES_PREVIA)", () => {
  /**
   * `n` bobinas en fila (cada 8, en y = 0), cada una con un cable recto de A2
   * (y = 2) al X1 de una lámpara fija debajo (y = 8). Arrastrar las bobinas
   * acomoda exactamente `n` cables. Se arma de cero, como el banco.
   */
  function fila(n: number) {
    const doc = documentoNuevo();
    const hoja = doc.hojas[0]!;
    for (let i = 0; i < n; i++) {
      hoja.componentes.push(
        { id: `c${2 * i + 1}`, ...comp("contactor.bobina", 8 * i, 0, `K${i + 1}`) },
        { id: `c${2 * i + 2}`, ...comp("senalizacion.lampara", 8 * i, 10, `H${i + 1}`) },
      );
      hoja.cables.push({ id: `w${i + 1}`, desde: borne(`c${2 * i + 1}`, "A2"), hasta: borne(`c${2 * i + 2}`, "X1"), codos: [] });
    }
    // Los contadores guardan el próximo número a dar.
    doc.contadores = { c: 2 * n + 1, w: n + 1 };
    expect(validarHoja(hoja)).toEqual([]);
    const editor = new Editor(doc);
    const vista = new VistaFalsa();
    editor.vista = vista;
    const avisos: string[] = [];
    editor.alAvisar = (t) => avisos.push(t);
    editor.seleccionarIds(hoja.componentes.filter((c) => c.tipo === "contactor.bobina").map((c) => c.id));
    const historial = editor.historial as unknown as { hechos: unknown[] };
    return { editor, vista, avisos, pasos: () => historial.hechos.length };
  }

  it(`justo por debajo (${TOPE_CABLES_PREVIA} cables): la previa planea y coincide con el resultado`, () => {
    const { editor, pasos } = fila(TOPE_CABLES_PREVIA);
    const n = pasos();
    arrastrar(editor, 0.2, 0, 0.2, -2);
    expect(editor.pista).toBeNull();
    const previa = planPrevia(editor);
    expect(previa?.r.rechazo).toBeNull();
    expect(previa!.cambiados.size).toBe(TOPE_CABLES_PREVIA);
    editor.aplicar(editor.seleccionar.soltar(ev(0.2, -2)));
    expect(pasos()).toBe(n + 1);
    for (const [id, c] of previa!.cambiados) expect(editor.escena.obtenerCable(id)?.puntos).toEqual(c.puntos);
    expect(validarHoja(editor.documento.hojas[0]!)).toEqual([]);
  });

  it(`justo por encima (${TOPE_CABLES_PREVIA + 1} cables): la previa no planea y la barra dice que se revisa al soltar; soltar donde vale da un paso`, () => {
    const { editor, pasos } = fila(TOPE_CABLES_PREVIA + 1);
    const n = pasos();
    arrastrar(editor, 0.2, 0, 0.2, -2);
    expect(editor.arrastrando).toBe(true);
    expect(editor.pista).toBe(textoReducido(TOPE_CABLES_PREVIA + 1));
    expect(editor.pista).toMatch(/al soltar.*se revisa/);
    expect(planPrevia(editor)).toBeNull();
    editor.aplicar(editor.seleccionar.soltar(ev(0.2, -2)));
    expect(pasos()).toBe(n + 1);
    expect(validarHoja(editor.documento.hojas[0]!)).toEqual([]);
    expect(escenaAlDia(editor)).toBe(true);
    expect(nadaOculto(editor, editor.documento)).toBe(true);
  });

  it("por encima, si se rechaza al soltar: todo vuelve exacto, sin paso, sin restos y con el motivo sin ids", () => {
    const { editor, vista, avisos, pasos } = fila(TOPE_CABLES_PREVIA + 1);
    const antes = copia(editor.documento);
    const n = pasos();
    // Bajar 6: el A2 de cada bobina (y = 8) cae sobre el X1 de su lámpara.
    arrastrar(editor, 0.2, 0, 0.2, 6);
    expect(editor.pista).toBe(textoReducido(TOPE_CABLES_PREVIA + 1));
    const alEmpezar = vista.regiones.slice();
    editor.aplicar(editor.seleccionar.soltar(ev(0.2, 6)));
    expect(pasos()).toBe(n);
    expect(editor.documento).toEqual(antes);
    expect(avisos.at(-1)).toMatch(/^No se puede mover acá: el borne K\d+ · A2 quedaría sobre el borne H\d+ · X1 sin conectarse\.$/);
    expect(sinIds(avisos)).toBe(true);
    expect(editor.pista).toBeNull();
    expect(nadaOculto(editor, editor.documento)).toBe(true);
    expect(escenaAlDia(editor)).toBe(true);
    for (const k of alEmpezar) expect(vista.regiones.slice(alEmpezar.length)).toContainEqual(k);
  });
});

describe("Colocar con la regla de conexiones aparentes", () => {
  /** Un cable libre horizontal de (−10, 0) a (10, 0); la herramienta Colocar con una bobina, en modo clic. */
  function conCable() {
    const editor = new Editor(documentoNuevo());
    editor.vista = new VistaFalsa();
    const avisos: string[] = [];
    editor.alAvisar = (t) => avisos.push(t);
    editor.ejecutar(cablear(editor.documento, { desde: { tipo: "libre", x: -10, y: 0 }, hasta: { tipo: "libre", x: 10, y: 0 }, codos: [] }));
    const h = editor.iniciarColocar(buscarSimbolo("contactor.bobina")!, "clic")!;
    return { editor, h, avisos };
  }

  /** Conflictos nuevos que daría colocar la previa, con la consulta lineal (la referencia). */
  function conflictosReferencia(editor: Editor, p: { x: number; y: number; rotacion: 0 | 90 | 180 | 270; espejado: boolean }): number {
    const g = geometriaComponente({ id: "nuevo", tipo: "contactor.bobina", x: p.x, y: p.y, rot: p.rotacion, espejado: p.espejado, etiqueta: "" })!;
    return problemasComponente(g, consultaHoja(editor.documento.hojas[0]!)).length;
  }

  it("nunca ejecuta Colocar si crea un conflicto nuevo, tampoco después de R y M", () => {
    const { editor, h, avisos } = conCable();
    const pasos = () => (editor.historial as unknown as { hechos: unknown[] }).hechos.length;
    let colocados = 0;
    let rechazados = 0;
    const secuencia = ["", "R", "M", "R", "R", "M", "R"] as const;
    for (const [x, y] of [
      [0, 0],
      [0, 2],
      [0, -2],
      [3, 1],
      [12, 0],
    ] as const) {
      for (const tecla of secuencia) {
        if (tecla === "R") editor.accion("rotar");
        if (tecla === "M") editor.accion("espejar");
        editor.aplicar(h.mover(ev(x, y)));
        const p = h.previa!;
        const esperados = conflictosReferencia(editor, p);
        expect(p.conflictos.length > 0).toBe(esperados > 0);
        const n = pasos();
        editor.aplicar(h.presionar(ev(x, y)));
        if (esperados > 0) {
          expect(pasos(), `(${x}, ${y}) ${p.rotacion}° ${p.espejado}`).toBe(n);
          expect(editor.pista).toMatch(/^No se puede colocar acá: /);
          rechazados++;
        } else {
          expect(pasos()).toBe(n + 1);
          colocados++;
          editor.deshacer();
        }
      }
    }
    expect(colocados).toBeGreaterThan(0);
    expect(rechazados).toBeGreaterThan(0);
    expect(sinIds(avisos)).toBe(true);
  });

  it("al deshacer en modo clic, la previa se vuelve a revisar", () => {
    const { editor, h } = conCable();
    editor.aplicar(h.mover(ev(0, 2)));
    expect(h.previa!.conflictos.length).toBeGreaterThan(0);
    editor.accion("deshacer"); // se va el cable
    expect(h.previa!.conflictos).toEqual([]);
    expect(editor.pista).toBeNull();
  });

  it("arrastrando desde la paleta, soltar donde no vale no coloca y avisa", () => {
    const editor = new Editor(documentoNuevo());
    editor.vista = new VistaFalsa();
    const avisos: string[] = [];
    editor.alAvisar = (t) => avisos.push(t);
    editor.ejecutar(cablear(editor.documento, { desde: { tipo: "libre", x: -10, y: 0 }, hasta: { tipo: "libre", x: 10, y: 0 }, codos: [] }));
    const h = editor.iniciarColocar(buscarSimbolo("contactor.bobina")!, "arrastre")!;
    editor.aplicar(h.mover(ev(0, 0)));
    editor.aplicar(h.soltar(ev(0, 0)));
    expect(editor.documento.hojas[0]!.componentes).toEqual([]);
    expect(editor.herramienta).toBeNull();
    expect(avisos.at(-1)).toMatch(/^No se puede colocar acá: /);
  });
});
