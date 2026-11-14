// Etiquetado en el editor (T17, etapa 2): la memoria de etiquetas
// (armarEtiquetas.ts), Colocar y su previa, pegar y duplicar, "Etiquetar los
// vacíos", el renombrado con arrastre y lo que el resumen le da al panel.
// Al final, el test al azar de la etapa 1, que ahora pasa por el editor.

import { beforeEach, describe, expect, it } from "vitest";
import { marchaParada } from "../core/circuitos/marchaParada";
import { validarHoja } from "../core/model/cables";
import { Borrar, colocar } from "../core/model/comandos";
import type { Componente, Documento, Hoja } from "../core/model/documento";
import { esTitular, etiquetasDeTitulares } from "../core/model/etiquetado";
import { normalizarEtiqueta } from "../core/model/etiquetas";
import { recortar, type Recorte } from "../core/model/portapapeles";
import { buscarSimbolo, esFuente, SIMBOLOS } from "../core/symbols";
import { EtiquetasHoja } from "./armarEtiquetas";
import { AVISO_SIN_VACIOS, documentoNuevo, Editor, type DestinoVista } from "./editor";
import type { EventoHerramienta } from "./herramientas/tipos";
import { vaciarPortapapeles } from "./portapapeles";

const BOBINA = "contactor.bobina";
const AUXILIAR = "contactor.auxiliar_na";
const AUXILIAR_NC = "contactor.auxiliar_nc";
const PULSADOR_NA = "pulsador.na";
const PULSADOR_NC = "pulsador.nc";
const LAMPARA = "senalizacion.lampara";
const FASE = "fuente.fase";
const NEUTRO = "fuente.neutro";

class VistaFalsa implements DestinoVista {
  cuadros = 0;
  invalidarRegion(): void {}
  invalidar(): void {
    this.cuadros++;
  }
}

const ev = (x: number, y: number, boton = 0): EventoHerramienta => ({ x, y, boton, botones: 0, mayus: false, ctrl: false, escala: 20 });
const def = (tipo: string) => buscarSimbolo(tipo)!;

function armar(doc: Documento = documentoNuevo()) {
  const editor = new Editor(doc);
  editor.vista = new VistaFalsa();
  const avisos: string[] = [];
  editor.alAvisar = (t) => avisos.push(t);
  const poner = (tipo: string, x: number, y: number, etiqueta: string) => {
    const cmd = colocar(editor.documento, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} });
    editor.ejecutar(cmd);
    return cmd.id;
  };
  /** Pasos que se pueden deshacer. */
  const pasos = () => (editor.historial as unknown as { hechos: unknown[] }).hechos.length;
  const comps = () => editor.documento.hojas[0]!.componentes;
  const etiqueta = (id: string) => comps().find((c) => c.id === id)!.etiqueta;
  return { editor, avisos, poner, pasos, comps, etiqueta };
}

const mover = (editor: Editor, x: number, y: number) => editor.aplicar(editor.activa.mover(ev(x, y)));
const clic = (editor: Editor, x: number, y: number) => {
  editor.aplicar(editor.activa.presionar(ev(x, y)));
  editor.aplicar(editor.activa.soltar(ev(x, y)));
};
/** Las etiquetas de los componentes agregados después de los primeros `desde`, en orden (y, x). */
const nuevas = (comps: readonly Componente[], desde: number) =>
  comps
    .slice(desde)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((c) => c.etiqueta);

beforeEach(() => vaciarPortapapeles());

// ── La memoria ─────────────────────────────────────────────────────────────

describe("EtiquetasHoja", () => {
  it("al colocar: el menor libre del prefijo; NA y NC comparten la S; el auxiliar vacío; las fuentes, su inicial", () => {
    const { editor, poner } = armar();
    const e = editor.etiquetas;
    expect(e.alColocar(def(BOBINA))).toBe("K1");
    poner(BOBINA, 0, 0, "K1");
    expect(e.alColocar(def(BOBINA))).toBe("K2");
    poner(PULSADOR_NA, 10, 0, "S1");
    poner(PULSADOR_NC, 20, 0, "S2");
    expect(e.alColocar(def(PULSADOR_NA))).toBe("S3");
    expect(e.alColocar(def(PULSADOR_NC))).toBe("S3");
    expect(e.alColocar(def(LAMPARA))).toBe("H1");
    expect(e.alColocar(def(AUXILIAR))).toBe("");
    expect(e.alColocar(def(FASE))).toBe("L");
    expect(e.alColocar(def(NEUTRO))).toBe("N");
  });

  it("se junta una vez y se vuelve a juntar recién después de invalidar", () => {
    const { doc } = marchaParada();
    const e = new EtiquetasHoja(doc);
    expect(e.calculos).toBe(0);
    for (let i = 0; i < 5; i++) e.alColocar(def(BOBINA));
    expect(e.calculos).toBe(1);
    e.invalidar();
    expect(e.calculos).toBe(1); // invalidar no junta: se junta cuando se pide
    expect([...e.usadas].sort()).toEqual(["H1", "K1", "S0", "S1"]);
    expect(e.calculos).toBe(2);
  });

  it("renombrar sin cambios no arma comando", () => {
    const { doc, comp: m } = marchaParada();
    expect(new EtiquetasHoja(doc).renombrar(m.k1Bobina, "k1").comando).toBeNull();
  });
});

// ── Colocar ────────────────────────────────────────────────────────────────

describe("Editor: Colocar con etiqueta (T17)", () => {
  it("dos bobinas seguidas en modo clic dan K1 y K2, en el resultado y en la previa", () => {
    const { editor, comps } = armar();
    editor.iniciarColocar(def(BOBINA), "clic");
    mover(editor, 0, 0);
    expect(editor.colocar!.previa!.etiqueta).toBe("K1");
    clic(editor, 0, 0);
    expect(comps().map((c) => c.etiqueta)).toEqual(["K1"]);
    // Sin mover el mouse, la previa ya muestra la que sigue.
    expect(editor.colocar!.previa!.etiqueta).toBe("K2");
    mover(editor, 10, 0);
    expect(editor.colocar!.previa!.etiqueta).toBe("K2");
    clic(editor, 10, 0);
    expect(comps().map((c) => c.etiqueta)).toEqual(["K1", "K2"]);
    expect(editor.colocar!.previa!.etiqueta).toBe("K3");
  });

  it("colocar es un solo paso; deshacer devuelve la etiqueta a la previa y rehacer repite la misma", () => {
    const { editor, pasos, comps } = armar();
    editor.iniciarColocar(def(PULSADOR_NA), "clic");
    clic(editor, 0, 0);
    clic(editor, 10, 0);
    expect(pasos()).toBe(2);
    expect(editor.colocar!.previa!.etiqueta).toBe("S3");
    editor.deshacer();
    expect(comps().map((c) => c.etiqueta)).toEqual(["S1"]);
    expect(editor.colocar!.previa!.etiqueta).toBe("S2");
    editor.rehacer();
    expect(comps().map((c) => c.etiqueta)).toEqual(["S1", "S2"]);
    expect(editor.colocar!.previa!.etiqueta).toBe("S3");
  });

  it("borrar deja un hueco y la próxima bobina lo rellena", () => {
    const { editor, poner, comps } = armar();
    poner(BOBINA, 0, 0, "K1");
    const k2 = poner(BOBINA, 10, 0, "K2");
    poner(BOBINA, 20, 0, "K3");
    editor.ejecutar(new Borrar([k2]));
    editor.iniciarColocar(def(BOBINA), "clic");
    clic(editor, 30, 0);
    expect(comps().map((c) => c.etiqueta)).toEqual(["K1", "K3", "K2"]);
  });

  it("el auxiliar entra vacío y la Fase entra L", () => {
    const { editor, comps } = armar();
    editor.iniciarColocar(def(AUXILIAR), "clic");
    clic(editor, 0, 0);
    editor.iniciarColocar(def(FASE), "clic");
    clic(editor, 10, 0);
    expect(comps().map((c) => c.etiqueta)).toEqual(["", "L"]);
  });

  it("mover el mouse no vuelve a juntar las etiquetas; un comando sí", () => {
    const { editor } = armar(marchaParada().doc);
    editor.iniciarColocar(def(BOBINA), "clic");
    mover(editor, 40, 0);
    const antes = editor.etiquetas.calculos;
    for (let i = 0; i < 50; i++) mover(editor, 40 + i * 0.7, i * 0.3);
    expect(editor.etiquetas.calculos).toBe(antes);
    clic(editor, 80, 0);
    expect(editor.etiquetas.calculos).toBeGreaterThan(antes);
  });
});

// ── Pegar y duplicar ───────────────────────────────────────────────────────

describe("Editor: pegar y duplicar con etiquetas (T17, D-duplicar C)", () => {
  /** La rama de K1, sin cables: S1, el auxiliar K1, la bobina K1 y H1. */
  function rama() {
    const a = armar();
    const ids = [
      a.poner(PULSADOR_NA, 0, 0, "S1"),
      a.poner(AUXILIAR, 4, 0, "K1"),
      a.poner(BOBINA, 0, 10, "K1"),
      a.poner(LAMPARA, 4, 10, "H1"),
    ];
    return { ...a, ids };
  }

  it("Ctrl+D de la rama de K1 da S2, K2, K2 y H2 en un paso; repetido, S3, K3, K3 y H3; deshacer y rehacer exactos", () => {
    const { editor, ids, pasos, comps } = rama();
    editor.seleccionarIds(ids);
    const n = pasos();
    expect(editor.accion("duplicar")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect(nuevas(comps(), 4)).toEqual(["S2", "K2", "K2", "H2"]);
    const tras1 = structuredClone(comps());

    expect(editor.accion("duplicar")).toBe(true); // queda seleccionado lo pegado
    expect(nuevas(comps(), 8)).toEqual(["S3", "K3", "K3", "H3"]);
    const tras2 = structuredClone(comps());

    editor.deshacer();
    expect(comps()).toEqual(tras1);
    editor.rehacer();
    expect(comps()).toEqual(tras2);
    expect(validarHoja(editor.documento.hojas[0]!)).toEqual([]);
  });

  it("cortar y pegar conserva las etiquetas", () => {
    const { editor, ids, comps } = rama();
    editor.seleccionarIds(ids);
    expect(editor.accion("cortar")).toBe(true);
    expect(comps()).toEqual([]);
    editor.accion("pegar");
    mover(editor, 40, 40);
    clic(editor, 40, 40);
    expect(nuevas(comps(), 0)).toEqual(["S1", "K1", "K1", "H1"]);
  });

  it("pegar en un documento nuevo conserva las etiquetas", () => {
    const { editor, ids } = rama();
    editor.seleccionarIds(ids);
    editor.accion("copiar");
    const otro = armar();
    otro.editor.accion("pegar");
    mover(otro.editor, 0, 0);
    clic(otro.editor, 0, 0);
    expect(nuevas(otro.comps(), 0)).toEqual(["S1", "K1", "K1", "H1"]);
  });
});

// ── Contacto auxiliar NC (T17b) ─────────────────────────────────────────────

describe("Editor: contacto auxiliar NC (T17b)", () => {
  /** La rama de K1 con sus dos auxiliares, sin cables: S1, NA K1, NC `nc`, la bobina K1 y H1. */
  function ramaNC(nc = "K1") {
    const a = armar();
    const ids = {
      s: a.poner(PULSADOR_NA, 0, 0, "S1"),
      na: a.poner(AUXILIAR, 4, 0, "K1"),
      nc: a.poner(AUXILIAR_NC, 8, 0, nc),
      bobina: a.poner(BOBINA, 0, 10, "K1"),
      h: a.poner(LAMPARA, 4, 10, "H1"),
    };
    return { ...a, ids, todos: Object.values(ids) };
  }
  /** Etiqueta de cada tipo agregado después de los primeros `desde` (uno de cada tipo). */
  const porTipo = (comps: readonly Componente[], desde: number) =>
    Object.fromEntries(comps.slice(desde).map((c) => [c.tipo, c.etiqueta]));

  it("colocar un NC: entra vacío, en el resultado y en la previa", () => {
    const { editor, comps } = armar(marchaParada().doc);
    const n = comps().length;
    editor.iniciarColocar(def(AUXILIAR_NC), "clic");
    mover(editor, 60, 0);
    expect(editor.colocar!.previa!.etiqueta).toBe("");
    clic(editor, 60, 0);
    expect(comps().slice(n).map((c) => [c.tipo, c.etiqueta])).toEqual([[AUXILIAR_NC, ""]]);
  });

  it("Ctrl+C y Ctrl+V con la bobina en el lote: el NC la sigue, como el NA (cierra el supuesto del portapapeles)", () => {
    const { editor, todos, comps } = ramaNC();
    editor.seleccionarIds(todos);
    expect(editor.accion("copiar")).toBe(true);
    editor.accion("pegar");
    mover(editor, 40, 40);
    clic(editor, 40, 40);
    expect(porTipo(comps(), 5)).toEqual({ [PULSADOR_NA]: "S2", [AUXILIAR]: "K2", [AUXILIAR_NC]: "K2", [BOBINA]: "K2", [LAMPARA]: "H2" });
    expect(validarHoja(editor.documento.hojas[0]!)).toEqual([]);
  });

  it("Ctrl+D con la bobina en el lote: el NC la sigue; deshacer y rehacer exactos", () => {
    const { editor, todos, comps } = ramaNC();
    editor.seleccionarIds(todos);
    expect(editor.accion("duplicar")).toBe(true);
    expect(porTipo(comps(), 5)).toEqual({ [PULSADOR_NA]: "S2", [AUXILIAR]: "K2", [AUXILIAR_NC]: "K2", [BOBINA]: "K2", [LAMPARA]: "H2" });
    const tras = structuredClone(comps());
    editor.deshacer();
    expect(comps()).toHaveLength(5);
    editor.rehacer();
    expect(comps()).toEqual(tras);
  });

  it("Ctrl+D de un NC solo, sin su bobina: conserva K1", () => {
    const { editor, ids, comps } = ramaNC();
    editor.seleccionarIds([ids.nc]);
    expect(editor.accion("duplicar")).toBe(true);
    expect(porTipo(comps(), 5)).toEqual({ [AUXILIAR_NC]: "K1" });
  });

  it("límite conocido (aviso en T19): la rama de K1 con su NC \"K2\" de enclavamiento, duplicada, deja el NC en K2", () => {
    // Sin bobina K2 en la hoja: el NC enclava contra otra rama que todavía no está dibujada.
    const { editor, todos, comps } = ramaNC("K2");
    editor.seleccionarIds(todos);
    expect(editor.accion("duplicar")).toBe(true);
    // La bobina y el NA pasan a K2. El NC conserva K2 porque su bobina (K2) no está en el lote:
    // queda enclavando contra su propia bobina. Debería quedar en K1; lo avisa T19.
    expect(porTipo(comps(), 5)).toEqual({ [PULSADOR_NA]: "S2", [AUXILIAR]: "K2", [AUXILIAR_NC]: "K2", [BOBINA]: "K2", [LAMPARA]: "H2" });
  });

  it("\"Etiquetar los vacíos\" no lo toca", () => {
    const { editor, poner, etiqueta } = armar();
    const b = poner(BOBINA, 0, 0, "");
    const nc = poner(AUXILIAR_NC, 10, 0, "");
    expect(editor.etiquetarVacios()).toBe(true);
    expect([etiqueta(b), etiqueta(nc)]).toEqual(["K1", ""]);
  });

  it("renombrar K1 a K5 desde el panel arrastra al NA y al NC, en un paso", () => {
    const { editor, ids, pasos, etiqueta } = ramaNC();
    editor.seleccionarIds([ids.bobina]);
    const n = pasos();
    expect(editor.cambiarEtiqueta(ids.bobina, "K5")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect([etiqueta(ids.bobina), etiqueta(ids.na), etiqueta(ids.nc)]).toEqual(["K5", "K5", "K5"]);
    expect(editor.resumenSeleccion().unico!.renombre).toMatchObject({ vieja: "K1", nueva: "K5", contactos: 2 });
  });
});

// ── Etiquetar los vacíos ───────────────────────────────────────────────────

describe("Editor: Etiquetar los vacíos (T17)", () => {
  it("rellena los titulares vacíos en un paso, sin tocar seguidores ni fuentes; deshacer los vacía", () => {
    const { editor, poner, pasos, etiqueta } = armar();
    poner(BOBINA, 0, 0, "K1");
    const b = poner(BOBINA, 10, 0, "");
    const p = poner(PULSADOR_NC, 0, 10, "");
    const c = poner(AUXILIAR, 20, 0, "");
    const f = poner(FASE, 30, 0, "L");
    const n = pasos();
    expect(editor.etiquetarVacios()).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect([etiqueta(b), etiqueta(p), etiqueta(c), etiqueta(f)]).toEqual(["K2", "S1", "", "L"]);
    editor.deshacer();
    expect([etiqueta(b), etiqueta(p)]).toEqual(["", ""]);
  });

  it("sin vacíos avisa y no hace paso", () => {
    const { editor, avisos, pasos } = armar(marchaParada().doc);
    const n = pasos();
    expect(editor.etiquetarVacios()).toBe(false);
    expect(avisos).toEqual([AVISO_SIN_VACIOS]);
    expect(pasos()).toBe(n);
  });
});

// ── Renombrar desde el panel ───────────────────────────────────────────────

describe("Editor: renombrar una bobina desde el panel (T17, D-manuales b)", () => {
  it("con arrastre: el contacto la sigue, en un paso, y la nota lo dice; deshacer vuelve los dos y borra la nota", () => {
    const { doc, comp: m } = marchaParada();
    const { editor, pasos, etiqueta } = armar(doc);
    editor.seleccionarIds([m.k1Bobina]);
    const n = pasos();
    expect(editor.cambiarEtiqueta(m.k1Bobina, "K5")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect([etiqueta(m.k1Bobina), etiqueta(m.k1Auxiliar)]).toEqual(["K5", "K5"]);
    expect(editor.resumenSeleccion().unico!.renombre).toEqual({ vieja: "K1", nueva: "K5", contactos: 1, motivo: null });
    editor.deshacer();
    expect([etiqueta(m.k1Bobina), etiqueta(m.k1Auxiliar)]).toEqual(["K1", "K1"]);
    expect(editor.resumenSeleccion().unico!.renombre).toBeNull();
  });

  it("sin arrastre (otra bobina K1): cambia solo la bobina, en un paso, y la nota da el motivo", () => {
    const { doc, comp: m } = marchaParada();
    const { editor, poner, pasos, etiqueta } = armar(doc);
    poner(BOBINA, 60, 0, "K1");
    editor.seleccionarIds([m.k1Bobina]);
    const n = pasos();
    expect(editor.cambiarEtiqueta(m.k1Bobina, "K5")).toBe(true);
    expect(pasos()).toBe(n + 1);
    expect([etiqueta(m.k1Bobina), etiqueta(m.k1Auxiliar)]).toEqual(["K5", "K1"]);
    expect(editor.resumenSeleccion().unico!.renombre).toEqual({ vieja: "K1", nueva: "K5", contactos: 0, motivo: "otra_bobina_vieja" });
  });

  it("a vacío: los contactos conservan su etiqueta y la nota lo dice", () => {
    const { doc, comp: m } = marchaParada();
    const { editor, etiqueta } = armar(doc);
    editor.seleccionarIds([m.k1Bobina]);
    expect(editor.cambiarEtiqueta(m.k1Bobina, "")).toBe(true);
    expect([etiqueta(m.k1Bobina), etiqueta(m.k1Auxiliar)]).toEqual(["", "K1"]);
    expect(editor.resumenSeleccion().unico!.renombre).toEqual({ vieja: "K1", nueva: "", contactos: 0, motivo: "nueva_vacia" });
  });

  it("la nota se borra al cambiar la selección y no aparece en otro componente", () => {
    const { doc, comp: m } = marchaParada();
    const { editor } = armar(doc);
    editor.seleccionarIds([m.k1Bobina]);
    editor.cambiarEtiqueta(m.k1Bobina, "K5");
    editor.seleccionarIds([m.h1]);
    expect(editor.resumenSeleccion().unico!.renombre).toBeNull();
    editor.seleccionarIds([m.k1Bobina]);
    expect(editor.resumenSeleccion().unico!.renombre).toBeNull();
  });

  it("renombrar algo que no es bobina no deja nota", () => {
    const { doc, comp: m } = marchaParada();
    const { editor } = armar(doc);
    editor.seleccionarIds([m.s1]);
    expect(editor.cambiarEtiqueta(m.s1, "S9")).toBe(true);
    expect(editor.resumenSeleccion().unico!.renombre).toBeNull();
  });
});

// ── Etiqueta repetida en el resumen ────────────────────────────────────────

describe("Editor: etiqueta repetida para el panel (T17, D-manuales B)", () => {
  it("un titular con la etiqueta de otro titular da el nombre del otro", () => {
    const { editor, poner } = armar();
    const k = poner(BOBINA, 0, 0, "K1");
    const h = poner(LAMPARA, 10, 0, "k1");
    editor.seleccionarIds([h]);
    expect(editor.resumenSeleccion().unico!.repetida).toBe("Bobina de contactor");
    editor.seleccionarIds([k]);
    expect(editor.resumenSeleccion().unico!.repetida).toBe("Lámpara");
  });

  it("nunca en una fuente: dos Neutro N son la misma red", () => {
    const { doc, comp: m } = marchaParada({ dosNeutros: true });
    const { editor } = armar(doc);
    editor.seleccionarIds([m.neutro]);
    expect(editor.resumenSeleccion().unico!.repetida).toBeNull();
  });

  it("ni en un contacto, ni por un contacto: el auxiliar K1 no repite a la bobina K1", () => {
    const { doc, comp: m } = marchaParada();
    const { editor } = armar(doc);
    editor.seleccionarIds([m.k1Auxiliar]);
    expect(editor.resumenSeleccion().unico!.repetida).toBeNull();
    editor.seleccionarIds([m.k1Bobina]);
    expect(editor.resumenSeleccion().unico!.repetida).toBeNull();
  });

  it("vacía no cuenta como repetida", () => {
    const { editor, poner } = armar();
    poner(BOBINA, 0, 0, "");
    const b = poner(BOBINA, 10, 0, "");
    editor.seleccionarIds([b]);
    expect(editor.resumenSeleccion().unico!.repetida).toBeNull();
  });
});

// ── Al azar ────────────────────────────────────────────────────────────────
// Mudado de src/core/model/etiquetado.test.ts (etapa 1): ahora arma los
// comandos con armarEtiquetas.ts a través del editor, que invalida la memoria
// en cada paso. Además de las reglas, comprueba que la memoria esté al día.

/** Generador de números con semilla (mulberry32), como en seguir.test.ts. */
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

const SEMILLA = 20261114;
const OPERACIONES = 400;

/** Copia de las hojas, para comparar antes y después (los contadores solo suben y deshacer no los baja). */
function foto(doc: Documento): Hoja[] {
  return JSON.parse(JSON.stringify(doc.hojas)) as Hoja[];
}

/** Lo que tiene que valer después de cada paso; vacío si todo está bien. */
function problemas(h: Hoja): string[] {
  const salida: string[] = [];
  const vistas = new Map<string, string>();
  for (const c of h.componentes) {
    const d = buscarSimbolo(c.tipo)!;
    if (esFuente(d)) {
      if (c.etiqueta !== d.etiquetaInicial) salida.push(`La fuente ${c.id} dice "${c.etiqueta}".`);
      continue;
    }
    const e = normalizarEtiqueta(c.etiqueta);
    if (!esTitular(d) || e === "") continue;
    const otro = vistas.get(e);
    if (otro !== undefined) salida.push(`${otro} y ${c.id} dicen "${e}".`);
    vistas.set(e, c.id);
  }
  for (const p of validarHoja(h)) salida.push(p.mensaje);
  return salida;
}

describe("al azar, con semilla fija, a través del editor", () => {
  it(`${OPERACIONES} operaciones (semilla ${SEMILLA}): nunca dos titulares con la misma etiqueta no vacía, fuentes intactas, hoja válida, memoria al día, y deshacer todo y rehacer todo exactos`, () => {
    const azar = generador(SEMILLA);
    const entero = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
    const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;

    const { doc } = marchaParada();
    const editor = new Editor(doc);
    const etiquetas = editor.etiquetas;
    const h = doc.hojas[0]!;
    const inicial = foto(doc);
    const tipos = SIMBOLOS.map((s) => s.tipo);
    let portapapeles: Recorte | null = null;
    const hechas = {
      colocar: 0,
      colocarVacio: 0,
      contactoDeBobina: 0,
      borrar: 0,
      copiar: 0,
      pegar: 0,
      duplicar: 0,
      renumerados: 0,
      arrastrados: 0,
      etiquetarVacios: 0,
      deshacer: 0,
      rehacer: 0,
    };

    const bobinasConEtiqueta = () => h.componentes.filter((c) => c.tipo === BOBINA && c.etiqueta !== "");

    /**
     * Lo que se copia, se borra o se duplica. A veces, una bobina con todos sus
     * contactos (la rama de un contactor); si no, de 1 a 6 componentes al azar.
     * A veces suma un cable.
     */
    const algunos = (): string[] => {
      const ids = new Set<string>();
      const bobinas = bobinasConEtiqueta();
      if (bobinas.length > 0 && azar() < 0.4) {
        const bobina = elegir(bobinas);
        ids.add(bobina.id);
        for (const c of h.componentes) if (c.tipo === AUXILIAR && c.etiqueta === bobina.etiqueta) ids.add(c.id);
        if (azar() < 0.5) ids.add(elegir(h.componentes).id);
      } else {
        const n = entero(1, Math.min(6, h.componentes.length));
        while (ids.size < n) ids.add(elegir(h.componentes).id);
      }
      if (h.cables.length > 0 && azar() < 0.5) ids.add(elegir(h.cables).id);
      return [...ids];
    };

    /** El Pegar como lo arma el editor; cuenta los renumerados y los contactos que siguieron a su bobina. */
    const pegarComo = (recorte: Recorte, dx: number, dy: number) => {
      const { comando, cambios } = etiquetas.pegado(recorte, dx, dy);
      for (const [id, e] of cambios) {
        const c = recorte.componentes.find((k) => k.id === id)!;
        expect(c.etiqueta, "solo entra lo que cambia").not.toBe(e);
        if (c.tipo === AUXILIAR) hechas.arrastrados++;
        else hechas.renumerados++;
      }
      editor.ejecutar(comando);
    };

    for (let k = 0; k < OPERACIONES; k++) {
      const r = azar();
      const vacia = h.componentes.length === 0;
      if (r < 0.3) {
        const tipo = elegir(tipos);
        const bobinas = bobinasConEtiqueta();
        // Uno de cada cuatro titulares entra vacío, como en un .brn viejo: lo
        // rellena "Etiquetar los vacíos". Un auxiliar, a veces, con la etiqueta
        // de una bobina que ya está, como la escribiría el usuario: la
        // etiqueta de un seguidor nunca cuenta como choque.
        const sinEtiqueta = esTitular(buscarSimbolo(tipo)) && azar() < 0.25;
        const deBobina = tipo === AUXILIAR && bobinas.length > 0 && azar() < 0.7;
        const etiqueta = sinEtiqueta ? "" : deBobina ? elegir(bobinas).etiqueta : etiquetas.alColocar(def(tipo));
        editor.ejecutar(colocar(doc, { tipo, x: entero(-60, 60), y: entero(-60, 60), rot: 0, espejado: false, etiqueta, params: {} }));
        if (sinEtiqueta) hechas.colocarVacio++;
        else if (deBobina) hechas.contactoDeBobina++;
        else hechas.colocar++;
      } else if (r < 0.42) {
        if (vacia) continue;
        editor.ejecutar(new Borrar(algunos()));
        hechas.borrar++;
      } else if (r < 0.5) {
        if (vacia) continue;
        portapapeles = recortar(h, algunos());
        hechas.copiar++;
      } else if (r < 0.62) {
        if (!portapapeles) continue;
        pegarComo(portapapeles, entero(-40, 40), entero(-40, 40));
        hechas.pegar++;
      } else if (r < 0.72) {
        if (vacia) continue;
        pegarComo(recortar(h, algunos()), 3, 3);
        hechas.duplicar++;
      } else if (r < 0.77) {
        if (!editor.etiquetarVacios()) continue;
        hechas.etiquetarVacios++;
      } else if (r < 0.9) {
        if (editor.deshacer()) hechas.deshacer++;
      } else if (editor.rehacer()) {
        hechas.rehacer++;
      }
      expect(problemas(h), `semilla ${SEMILLA}, operación ${k}`).toEqual([]);
      expect([...etiquetas.usadas].sort(), `memoria al día, operación ${k}`).toEqual([...etiquetasDeTitulares(h)].sort());
    }

    // La secuencia probó de todo: también renumerar al pegar y contactos que siguen a su bobina.
    for (const [operacion, n] of Object.entries(hechas)) expect(n, operacion).toBeGreaterThan(0);

    const final = foto(doc);
    while (editor.deshacer());
    expect(foto(doc)).toEqual(inicial);
    while (editor.rehacer());
    expect(foto(doc)).toEqual(final);
  });
});
