// Uniones de a poco (T14b, D2-B): después de cada operación, las del editor
// tienen que ser las mismas que recorriendo la hoja entera (`uniones`).

import { describe, expect, it } from "vitest";
import { borneDe, indexarHoja, recorridoCable } from "../core/model/cables";
import { Borrar, Espejar, Mover, Rotar, cablear, colocar, type Comando } from "../core/model/comandos";
import type { Cable, Extremo, Hoja } from "../core/model/documento";
import { codos, opuesta, type ExtremoRuta } from "../core/model/ruteo";
import { consultaHoja, problemasTrazado } from "../core/model/trazado";
import { uniones } from "../core/model/uniones";
import { SIMBOLOS, buscarSimbolo, type Rotacion } from "../core/symbols";
import { documentoNuevo, Editor } from "./editor";
import { Uniones } from "./uniones";

const borne = (comp: string, b: string): Extremo => ({ tipo: "borne", comp, borne: b });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });
const enCable = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });

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

const SEMILLA = 20261111;

function rutaDe(hoja: Hoja, e: Extremo): ExtremoRuta {
  if (e.tipo !== "borne") return { x: e.x, y: e.y };
  const b = borneDe(indexarHoja(hoja).componentes.get(e.comp)!, e.borne)!;
  return { x: b.x, y: b.y, preferidas: [b.direccion], prohibidas: [opuesta(b.direccion)] };
}

/** Cablea con el ruteo de T13 y su validación, como W. Devuelve el id, o null si no hay ruta. */
function rutear(ed: Editor, desde: Extremo, hasta: Extremo): string | null {
  const hoja = ed.documento.hojas[0]!;
  const consulta = consultaHoja(hoja);
  const d = rutaDe(hoja, desde);
  const h = rutaDe(hoja, hasta);
  const c = codos(d, h, (k) => problemasTrazado({ desde, hasta, puntos: [d.x, d.y, ...k.flat(), h.x, h.y] }, consulta).length === 0);
  if (!c) return null;
  try {
    const cmd = cablear(ed.documento, { desde, hasta, codos: c });
    ed.ejecutar(cmd);
    return cmd.id;
  } catch {
    return null;
  }
}

/** Los bornes de los componentes que hay ahora en la hoja. */
function bornesDe(hoja: Hoja): Extremo[] {
  return hoja.componentes.flatMap((c) => buscarSimbolo(c.tipo)!.bornes.map((b) => borne(c.id, b.nombre)));
}

/** Un punto entero en el medio de un tramo del cable (no en sus extremos), o null. */
function puntoMedio(hoja: Hoja, w: Cable, azar: () => number): { x: number; y: number } | null {
  const p = recorridoCable(indexarHoja(hoja), w);
  if (!p) return null;
  const i = Math.floor(azar() * (p.length / 2 - 1));
  const [x0, y0, x1, y1] = [p[2 * i]!, p[2 * i + 1]!, p[2 * i + 2]!, p[2 * i + 3]!];
  const largo = Math.abs(x1 - x0) + Math.abs(y1 - y0);
  if (largo < 2) return null;
  const s = 1 + Math.floor(azar() * (largo - 1));
  return { x: x0 + Math.sign(x1 - x0) * s, y: y0 + Math.sign(y1 - y0) * s };
}

/** Una T sobre `host` hacia un borne o un punto libre. Devuelve el id, o null. */
function derivar(ed: Editor, host: Cable, azar: () => number): string | null {
  const hoja = ed.documento.hojas[0]!;
  const bornes = bornesDe(hoja);
  const p = puntoMedio(hoja, host, azar);
  if (!p) return null;
  const destino =
    bornes.length > 0 && azar() < 0.5
      ? bornes[Math.floor(azar() * bornes.length)]!
      : libre(p.x + Math.floor(azar() * 9) - 4, p.y + Math.floor(azar() * 9) - 4);
  if (destino.tipo === "libre" && destino.x === p.x && destino.y === p.y) return null;
  return rutear(ed, enCable(host.id, p.x, p.y), destino);
}

/** Editor con componentes en una grilla, cables entre bornes y T, algunas en cascada. */
function editorAzar(azar: () => number): { ed: Editor; cascadas: number } {
  const ed = new Editor(documentoNuevo());
  const doc = ed.documento;
  const tipos = SIMBOLOS.map((s) => s.tipo);
  const rotaciones: Rotacion[] = [0, 90, 180, 270];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      if (azar() < 0.35) continue;
      const tipo = tipos[Math.floor(azar() * tipos.length)]!;
      const x = i * 10 + Math.floor(azar() * 3);
      const y = j * 10 + Math.floor(azar() * 3);
      ed.ejecutar(colocar(doc, { tipo, x, y, rot: rotaciones[Math.floor(azar() * 4)]!, espejado: azar() < 0.5, etiqueta: "", params: {} }));
    }
  }
  const hoja = doc.hojas[0]!;
  const bornes = bornesDe(hoja);
  for (let k = 0; k < 14 && bornes.length > 1; k++) {
    const a = bornes[Math.floor(azar() * bornes.length)]!;
    const b = bornes[Math.floor(azar() * bornes.length)]!;
    if (a !== b) rutear(ed, a, b);
  }
  // T sueltas y T en cascada (una T sobre la T anterior).
  let cascadas = 0;
  let anterior: string | null = null;
  for (let k = 0; k < 8 && hoja.cables.length > 0; k++) {
    const sobreAnterior: boolean = anterior !== null && azar() < 0.6;
    const host: Cable | undefined = sobreAnterior
      ? hoja.cables.find((w) => w.id === anterior)
      : hoja.cables[Math.floor(azar() * hoja.cables.length)];
    if (!host) continue;
    const id = derivar(ed, host, azar);
    if (id && sobreAnterior) cascadas++;
    if (id) anterior = id;
  }
  return { ed, cascadas };
}

const deHoja = (ed: Editor) => uniones(ed.documento.hojas[0]!);

describe("Uniones de a poco", () => {
  it("un anfitrión que cambia solo (sin su T) rehace el punto de la T", () => {
    const host: Cable = { id: "w1", desde: libre(0, 0), hasta: libre(10, 0), codos: [] };
    const t: Cable = { id: "w2", desde: enCable("w1", 4, 0), hasta: libre(4, 5), codos: [] };
    const indice = { componentes: new Map(), cables: new Map([["w1", host], ["w2", t]]) };
    const u = new Uniones(indice, [host, t]);
    expect(u.todas()).toEqual([{ x: 4, y: 0, cables: ["w1", "w2"], componentes: [] }]);
    // El anfitrión se acorta hasta la T: queda en su extremo libre, 2 brazos.
    indice.cables.set("w1", { ...host, hasta: libre(4, 0) });
    const cambio = u.actualizar(["w1"], indice);
    expect(cambio.quitadas.map((x) => [x.x, x.y])).toEqual([[4, 0]]);
    expect(cambio.puestas).toEqual([]);
    expect(u.cantidad).toBe(0);
  });

  it("borrar el anfitrión saca la unión (la T queda libre); deshacer y rehacer", () => {
    const ed = new Editor(documentoNuevo());
    const doc = ed.documento;
    const a = cablear(doc, { desde: libre(0, 0), hasta: libre(10, 0), codos: [] });
    ed.ejecutar(a);
    ed.ejecutar(cablear(doc, { desde: enCable(a.id, 4, 0), hasta: libre(4, 5), codos: [] }));
    expect(ed.uniones.cantidad).toBe(1);
    ed.ejecutar(new Borrar([a.id]));
    expect(ed.uniones.cantidad).toBe(0);
    ed.deshacer();
    expect(ed.uniones.todas()).toEqual(deHoja(ed));
    expect(ed.uniones.cantidad).toBe(1);
    ed.rehacer();
    expect(ed.uniones.cantidad).toBe(0);
  });

  it(`al azar (semilla ${SEMILLA}): después de cada operación, igual que recorrer la hoja`, () => {
    const azar = generador(SEMILLA);
    const n = { aceptadas: 0, rechazadas: 0, anfitrionesBorrados: 0, deshechos: 0, rehechos: 0, cascadas: 0, conUniones: 0 };
    for (let d = 0; d < 25; d++) {
      const { ed, cascadas } = editorAzar(azar);
      n.cascadas += cascadas;
      const hoja = ed.documento.hojas[0]!;
      expect(ed.uniones.todas(), `documento ${d}`).toEqual(deHoja(ed));
      for (let k = 0; k < 25; k++) {
        const contexto = `semilla ${SEMILLA}, documento ${d}, operación ${k}`;
        const todos = [...hoja.componentes.map((c) => c.id), ...hoja.cables.map((w) => w.id)];
        const r = azar();
        const antes = ed.uniones.todas();
        if (r < 0.1) {
          if (ed.deshacer()) n.deshechos++;
          // Rehacer solo anda justo después de deshacer: a veces, enseguida.
          if (azar() < 0.6) {
            expect(ed.uniones.todas(), `${contexto}, deshecho`).toEqual(deHoja(ed));
            if (ed.rehacer()) n.rehechos++;
          }
        } else if (r < 0.17) {
          if (ed.rehacer()) n.rehechos++;
        } else if (r < 0.27 && hoja.cables.length > 0) {
          derivar(ed, hoja.cables[Math.floor(azar() * hoja.cables.length)]!, azar);
        } else if (todos.length > 0) {
          const ids = todos.filter(() => azar() < 0.25);
          if (ids.length === 0) ids.push(todos[Math.floor(azar() * todos.length)]!);
          let cmd: Comando;
          if (r < 0.4) {
            // Borrar: la mitad de las veces, un anfitrión de alguna T.
            const anfitriones = hoja.cables.flatMap((w) => [w.desde, w.hasta]).flatMap((e) => (e.tipo === "cable" ? [e.cable] : []));
            const unAnfitrion = anfitriones.length > 0 && azar() < 0.5;
            if (unAnfitrion) n.anfitrionesBorrados++;
            cmd = new Borrar(unAnfitrion ? [anfitriones[Math.floor(azar() * anfitriones.length)]!] : ids.slice(0, 2));
          } else if (r < 0.7) cmd = new Mover(ids, Math.floor(azar() * 9) - 4, Math.floor(azar() * 9) - 4);
          else if (r < 0.82) cmd = new Rotar(ids, 90);
          else if (r < 0.9) cmd = new Rotar(ids, -90);
          else cmd = new Espejar(ids);
          try {
            ed.ejecutar(cmd);
            n.aceptadas++;
          } catch {
            n.rechazadas++;
            // Un rechazo no cambia nada.
            expect(ed.uniones.todas(), contexto).toEqual(antes);
          }
        }
        expect(ed.uniones.todas(), contexto).toEqual(deHoja(ed));
        if (ed.uniones.cantidad > 0) n.conUniones++;
      }
    }
    // Que la prueba pruebe algo: hay de todo.
    expect(n.aceptadas, JSON.stringify(n)).toBeGreaterThan(150);
    expect(n.rechazadas, JSON.stringify(n)).toBeGreaterThan(10);
    expect(n.anfitrionesBorrados, JSON.stringify(n)).toBeGreaterThan(10);
    expect(n.deshechos, JSON.stringify(n)).toBeGreaterThan(20);
    expect(n.rehechos, JSON.stringify(n)).toBeGreaterThan(10);
    expect(n.cascadas, JSON.stringify(n)).toBeGreaterThan(10);
    expect(n.conUniones, JSON.stringify(n)).toBeGreaterThan(200);
  });
});
