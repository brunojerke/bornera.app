// Referencias cruzadas en el editor (T18, etapa 2): el caché
// (referenciasHoja.ts), cuándo recalcula, qué bobinas pasan a la escena y
// que al achicarse o desaparecer una lista no queden restos (ajuste 3).
// Al final, un recorrido al azar por el editor contra un cálculo nuevo, y las
// pruebas a propósito.

import { afterEach, describe, expect, it, vi } from "vitest";
import { marchaParada } from "../core/circuitos/marchaParada";
import { Borrar, CambiarEtiqueta, cablear, colocar, Mover, Rotar } from "../core/model/comandos";
import type { Componente, Documento, Hoja } from "../core/model/documento";
import { recortar } from "../core/model/portapapeles";
import { referenciasCruzadas, textoFila } from "../core/model/referencias";
import { buscarSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import { cajaDibujo } from "../render/simbolo";
import { documentoNuevo, Editor, type DestinoVista } from "./editor";
import type { EventoHerramienta } from "./herramientas/tipos";
import { ReferenciasHoja } from "./referenciasHoja";

const BOBINA = "contactor.bobina";
const AUXILIAR = "contactor.auxiliar_na";
const AUXILIAR_NC = "contactor.auxiliar_nc";
const PULSADOR = "pulsador.na";
const LAMPARA = "senalizacion.lampara";

class VistaFalsa implements DestinoVista {
  regiones: Caja[] = [];
  invalidarRegion(caja: Caja): void {
    this.regiones.push(caja);
  }
  invalidar(): void {}
}

const ev = (x: number, y: number): EventoHerramienta => ({ x, y, boton: 0, botones: 0, mayus: false, ctrl: false, escala: 20 });

function armar(doc: Documento = documentoNuevo()) {
  const editor = new Editor(doc);
  const vista = new VistaFalsa();
  editor.vista = vista;
  const poner = (tipo: string, x: number, y: number, etiqueta: string) => {
    const cmd = colocar(editor.documento, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} });
    editor.ejecutar(cmd);
    return cmd.id;
  };
  const comp = (id: string) => editor.documento.hojas[0]!.componentes.find((c) => c.id === id)!;
  return { editor, vista, poner, comp };
}

/** Lo esperado: id de bobina → sus líneas, con un cálculo nuevo. */
function esperado(h: Hoja): Map<string, string[]> {
  return new Map([...referenciasCruzadas(h)].map(([id, filas]) => [id, filas.map(textoFila)]));
}

/** La caja de dibujo de un componente con sus líneas (las que tenía o tiene en la escena). */
function cajaCon(c: Componente, lineas?: readonly string[]): Caja {
  return cajaDibujo(buscarSimbolo(c.tipo)!, { x: c.x, y: c.y, rotacion: c.rot, espejado: c.espejado }, c.etiqueta || undefined, lineas);
}

/** True si alguna de las regiones cubre la caja entera. */
function cubre(regiones: readonly Caja[], k: Caja): boolean {
  const e = 1e-9;
  return regiones.some((r) => r.x <= k.x + e && r.y <= k.y + e && r.x + r.ancho >= k.x + k.ancho - e && r.y + r.alto >= k.y + k.alto - e);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReferenciasHoja en el editor (T18)", () => {
  it("al abrir: la marcha-parada da K1 con su fila, en el caché y en la escena", () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor } = armar(mp.doc);
    expect([...editor.referencias.todas()]).toEqual([[mp.comp.k1Bobina, ["NA 13-14 (10, 11)", "NC 21-22 (24, 11)"]]]);
    expect(editor.escena.obtener(mp.comp.k1Bobina)!.referencias).toEqual(["NA 13-14 (10, 11)", "NC 21-22 (24, 11)"]);
    expect(editor.escena.obtener(mp.comp.h1)!.referencias).toBeUndefined();
    expect(editor.referencias.calculos).toBe(1);
  });

  it("no recalcula al mover el mouse ni durante el arrastre de un contacto; sí al soltar", () => {
    const { editor, poner } = armar();
    const k1 = poner(BOBINA, 0, 0, "K1");
    const contacto = poner(AUXILIAR, 10, 0, "K1");
    editor.seleccionarIds([contacto]);
    const antes = editor.referencias.calculos;
    expect(editor.escena.obtener(k1)!.referencias).toEqual(["NA 13-14 (10, 0)"]);

    for (let i = 0; i < 20; i++) editor.aplicar(editor.activa.mover(ev(30 + i, 30)));
    editor.aplicar(editor.activa.presionar(ev(10, 0)));
    for (let i = 1; i <= 30; i++) editor.aplicar(editor.activa.mover(ev(10 + i * 0.1, i * 0.1)));
    expect(editor.arrastrando).toBe(true);
    expect(editor.referencias.calculos).toBe(antes);
    // La lista muestra la ubicación vieja hasta soltar (D-cuándo).
    expect(editor.escena.obtener(k1)!.referencias).toEqual(["NA 13-14 (10, 0)"]);

    editor.aplicar(editor.activa.soltar(ev(13, 3)));
    expect(editor.arrastrando).toBe(false);
    expect(editor.referencias.calculos).toBe(antes + 1);
    expect(editor.escena.obtener(k1)!.referencias).toEqual(["NA 13-14 (13, 3)"]);
    editor.deshacer();
    expect(editor.escena.obtener(k1)!.referencias).toEqual(["NA 13-14 (10, 0)"]);
  });

  it("no recalcula al cablear ni al mover un pulsador o una lámpara", () => {
    const { editor, poner } = armar();
    poner(BOBINA, 0, 0, "K1");
    poner(AUXILIAR, 10, 0, "K1");
    const s1 = poner(PULSADOR, 20, 0, "S1");
    const h1 = poner(LAMPARA, 30, 0, "H1");
    const antes = editor.referencias.calculos;
    editor.ejecutar(new Mover([s1], 0, 10));
    editor.ejecutar(new Mover([h1], 0, 10));
    editor.ejecutar(cablear(editor.documento, { desde: { tipo: "borne", comp: s1, borne: "14" }, hasta: { tipo: "borne", comp: h1, borne: "X2" }, codos: [] }));
    editor.deshacer();
    editor.rehacer();
    expect(editor.referencias.calculos).toBe(antes);
    // Colocar un contacto sí recalcula.
    poner(AUXILIAR_NC, 40, 0, "K1");
    expect(editor.referencias.calculos).toBe(antes + 1);
  });

  it("mover un contacto actualiza en la escena solo la bobina de su etiqueta", () => {
    const { editor, poner } = armar();
    const k1 = poner(BOBINA, 0, 0, "K1");
    const c1 = poner(AUXILIAR, 10, 0, "K1");
    const k2 = poner(BOBINA, 0, 20, "K2");
    poner(AUXILIAR, 10, 20, "K2");
    const actualizar = vi.spyOn(editor.escena, "actualizar");
    editor.ejecutar(new Mover([c1], 2, 0));
    expect(new Set(actualizar.mock.calls.map((l) => l[0]))).toEqual(new Set([c1, k1]));
    expect(editor.escena.obtener(k1)!.referencias).toEqual(["NA 13-14 (12, 0)"]);
    expect(editor.escena.obtener(k2)!.referencias).toEqual(["NA 13-14 (10, 20)"]);
  });

  it("renombrar K1 a K5 en el panel (con arrastre): la lista sigue a la bobina; sin arrastre, K5 queda sin lista", () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor } = armar(mp.doc);
    const lista = ["NA 13-14 (10, 11)", "NC 21-22 (24, 11)"];
    expect(editor.cambiarEtiqueta(mp.comp.k1Bobina, "K5")).toBe(true);
    expect(editor.escena.obtener(mp.comp.k1Bobina)!.referencias).toEqual(lista);
    editor.deshacer();
    expect(editor.escena.obtener(mp.comp.k1Bobina)!.referencias).toEqual(lista);

    // Sin arrastre: solo la bobina cambia de etiqueta.
    editor.ejecutar(new CambiarEtiqueta(mp.comp.k1Bobina, "K5"));
    expect(editor.escena.obtener(mp.comp.k1Bobina)!.referencias).toBeUndefined();
    expect(editor.referencias.todas().size).toBe(0);
  });

  it("borrar el último contacto: la bobina queda sin lista", () => {
    const mp = marchaParada();
    const { editor } = armar(mp.doc);
    editor.ejecutar(new Borrar([mp.comp.k1Auxiliar]));
    expect(editor.escena.obtener(mp.comp.k1Bobina)!.referencias).toBeUndefined();
    expect(editor.referencias.lineas(mp.comp.k1Bobina)).toBeUndefined();
  });
});

describe("sin restos por el editor (T18, ajuste 3)", () => {
  it("borrar el último contacto: lo invalidado cubre la caja vieja entera de K1, la que tenía la lista; Ctrl+Z la nueva", () => {
    const mp = marchaParada();
    const { editor, vista, comp } = armar(mp.doc);
    const k1 = comp(mp.comp.k1Bobina);
    const conLista = cajaCon(k1, ["NA 13-14 (10, 11)"]);
    expect(conLista.ancho).toBeGreaterThan(cajaCon(k1).ancho);
    // El contacto está en otro lado: su caja no cubre la de K1.
    expect(cubre([cajaCon(comp(mp.comp.k1Auxiliar))], conLista)).toBe(false);

    vista.regiones = [];
    editor.ejecutar(new Borrar([mp.comp.k1Auxiliar]));
    expect(cubre(vista.regiones, conLista)).toBe(true);

    vista.regiones = [];
    editor.deshacer();
    expect(editor.escena.obtener(mp.comp.k1Bobina)!.referencias).toEqual(["NA 13-14 (10, 11)"]);
    expect(cubre(vista.regiones, conLista)).toBe(true);
  });

  it("rama NC: de 2 filas a 1 (borrar el NC) cubre la caja vieja", () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor, vista, comp } = armar(mp.doc);
    // Un NC con coordenadas largas, para que la caja de 2 filas sea más ancha que la de 1.
    editor.ejecutar(new Mover([mp.comp.k1AuxiliarNC!, mp.comp.h2!, ...mp.cables.slice(8)], 100, 0));
    const k1 = comp(mp.comp.k1Bobina);
    const dos = editor.referencias.lineas(k1.id)!;
    expect(dos).toEqual(["NA 13-14 (10, 11)", "NC 21-22 (124, 11)"]);
    const conDos = cajaCon(k1, dos);
    expect(conDos.ancho).toBeGreaterThan(cajaCon(k1, ["NA 13-14 (10, 11)"]).ancho);

    vista.regiones = [];
    editor.ejecutar(new Borrar([mp.comp.k1AuxiliarNC!]));
    expect(editor.referencias.lineas(k1.id)).toEqual(["NA 13-14 (10, 11)"]);
    expect(cubre(vista.regiones, conDos)).toBe(true);
  });

  it("a propósito: si las bobinas cuya lista cambió no pasan a la escena, la caja vieja no se invalida", () => {
    const mp = marchaParada();
    const { editor, vista, comp } = armar(mp.doc);
    const conLista = cajaCon(comp(mp.comp.k1Bobina), ["NA 13-14 (10, 11)"]);
    const real = ReferenciasHoja.prototype.reflejar;
    vi.spyOn(editor.referencias, "reflejar").mockImplementation(function (this: ReferenciasHoja, ids, actuales) {
      real.call(this, ids, actuales);
      return new Set();
    });
    vista.regiones = [];
    editor.ejecutar(new Borrar([mp.comp.k1Auxiliar]));
    expect(cubre(vista.regiones, conLista)).toBe(false);
  });
});

// ── Al azar, a través del editor ─────────────────────────────────────────────

const SEMILLA = 20261114;
const OPERACIONES = 600;

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
 * Recorre `OPERACIONES` pasos al azar por el editor y, después de cada uno,
 * llama a `revisar` con el número de paso. Devuelve cuántas veces salió cada
 * operación.
 */
function recorrer(editor: Editor, revisar: (paso: number) => void): Record<string, number> {
  const azar = generador(SEMILLA);
  const entero = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;
  const doc = editor.documento;
  const h = doc.hojas[0]!;
  const ETIQUETAS = ["K1", "K2", "K3", "k1 ", "", "S1"];
  const TIPOS = [BOBINA, BOBINA, AUXILIAR, AUXILIAR, AUXILIAR_NC, PULSADOR, LAMPARA];
  const hechas: Record<string, number> = {
    colocar: 0,
    mover: 0,
    rotar: 0,
    borrar: 0,
    renombrarConArrastre: 0,
    renombrarSinArrastre: 0,
    pegar: 0,
    duplicar: 0,
    deshacer: 0,
    rehacer: 0,
  };
  const algunos = (): string[] => {
    const ids = new Set<string>();
    const n = entero(1, Math.min(4, h.componentes.length));
    while (ids.size < n) ids.add(elegir(h.componentes).id);
    return [...ids];
  };
  const intentar = (f: () => void): boolean => {
    try {
      f();
      return true;
    } catch {
      return false; // un Mover o Rotar rechazado no cambia nada
    }
  };

  for (let paso = 0; paso < OPERACIONES; paso++) {
    const r = azar();
    const vacia = h.componentes.length === 0;
    if (r < 0.25) {
      editor.ejecutar(colocar(doc, { tipo: elegir(TIPOS), x: entero(-40, 40), y: entero(-40, 40), rot: 0, espejado: false, etiqueta: elegir(ETIQUETAS), params: {} }));
      hechas.colocar!++;
    } else if (r < 0.37) {
      if (vacia || !intentar(() => editor.ejecutar(new Mover(algunos(), entero(-5, 5) || 1, entero(-5, 5))))) continue;
      hechas.mover!++;
    } else if (r < 0.42) {
      if (vacia || !intentar(() => editor.ejecutar(new Rotar(algunos(), 90)))) continue;
      hechas.rotar!++;
    } else if (r < 0.5) {
      if (vacia) continue;
      editor.ejecutar(new Borrar(algunos()));
      hechas.borrar!++;
    } else if (r < 0.58) {
      const bobinas = h.componentes.filter((c) => c.tipo === BOBINA);
      if (bobinas.length === 0) continue;
      const b = elegir(bobinas);
      const nueva = elegir(["K1", "K2", "K3", "K4", "K5"]);
      if (azar() < 0.5) {
        if (!editor.cambiarEtiqueta(b.id, nueva)) continue;
        hechas.renombrarConArrastre!++;
      } else {
        if (b.etiqueta === nueva) continue;
        editor.ejecutar(new CambiarEtiqueta(b.id, nueva));
        hechas.renombrarSinArrastre!++;
      }
    } else if (r < 0.66) {
      if (vacia) continue;
      editor.ejecutar(editor.etiquetas.pegado(recortar(h, algunos()), entero(-30, 30), entero(-30, 30)).comando);
      hechas.pegar!++;
    } else if (r < 0.72) {
      if (vacia) continue;
      editor.seleccionarIds(algunos());
      if (!editor.accion("duplicar")) continue;
      // Si abrió la previa (no había lugar al lado), se cancela.
      if (editor.activa !== editor.seleccionar) editor.cancelarHerramienta();
      hechas.duplicar!++;
    } else if (r < 0.87) {
      if (editor.deshacer()) hechas.deshacer!++;
    } else if (editor.rehacer()) {
      hechas.rehacer!++;
    }
    revisar(paso);
  }
  return hechas;
}

describe("al azar, con semilla fija, a través del editor (T18)", () => {
  it(`${OPERACIONES} operaciones (semilla ${SEMILLA}): después de cada una, el caché y la escena dicen lo mismo que un cálculo nuevo`, () => {
    const mp = marchaParada({ ramaNC: true });
    const { editor } = armar(mp.doc);
    const h = mp.doc.hojas[0]!;
    let conLista = 0;
    let saltados = 0;
    let ultimos = editor.referencias.calculos;
    const hechas = recorrer(editor, (paso) => {
      const e = esperado(h);
      expect(new Map(editor.referencias.todas()), `caché, paso ${paso}`).toEqual(e);
      for (const c of h.componentes) {
        expect(editor.escena.obtener(c.id)?.referencias, `escena de ${c.id} (${c.tipo} "${c.etiqueta}"), paso ${paso}`).toEqual(e.get(c.id));
      }
      if (e.size > 0) conLista++;
      if (editor.referencias.calculos === ultimos) saltados++;
      ultimos = editor.referencias.calculos;
    });
    for (const [operacion, n] of Object.entries(hechas)) expect(n, operacion).toBeGreaterThan(0);
    // Hubo listas casi siempre, y pasos que no recalcularon (los que no tocan bobinas ni contactos).
    expect(conLista).toBeGreaterThan(OPERACIONES / 2);
    expect(saltados).toBeGreaterThan(0);
  });

  it("a propósito: con la actualización del caché anulada, el recorrido encuentra diferencias", () => {
    vi.spyOn(ReferenciasHoja.prototype, "reflejar").mockReturnValue(new Set());
    const mp = marchaParada({ ramaNC: true });
    const { editor } = armar(mp.doc);
    const h = mp.doc.hojas[0]!;
    let diferencias = 0;
    recorrer(editor, () => {
      const e = esperado(h);
      const cache = new Map(editor.referencias.todas());
      if (JSON.stringify([...cache].sort()) !== JSON.stringify([...e].sort())) diferencias++;
    });
    expect(diferencias).toBeGreaterThan(0);
  });
});
