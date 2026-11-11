// Uniones de a poco (T14b, D2-B): después de cada operación, las del editor
// tienen que ser las mismas que recorriendo la hoja entera (`uniones`).

import { describe, expect, it } from "vitest";
import { borneDe, indexarHoja, recorridoCable, seApoyaEn, validarHoja } from "../core/model/cables";
import { Borrar, CambiarExtremo, Espejar, Mover, Rotar, cablear, colocar, type Comando } from "../core/model/comandos";
import { planearReconexion, type DestinoExtremo } from "../core/model/reconectar";
import type { Cable, Extremo, Hoja } from "../core/model/documento";
import { codos, opuesta, type ExtremoRuta } from "../core/model/ruteo";
import { consultaHoja, problemasTrazado } from "../core/model/trazado";
import { uniones } from "../core/model/uniones";
import { SIMBOLOS, buscarSimbolo, type Rotacion } from "../core/symbols";
import type { Caja } from "../render/camara";
import { cajaUnion } from "../render/escenaEditable";
import { documentoBancoCables } from "./banco";
import { documentoNuevo, Editor, type DestinoVista } from "./editor";
import type { EventoHerramienta } from "./herramientas/tipos";
import { Uniones } from "./uniones";

class VistaFalsa implements DestinoVista {
  regiones: Caja[] = [];
  invalidarRegion(caja: Caja): void {
    this.regiones.push(caja);
  }
  invalidar(): void {}
}

const ev = (x: number, y: number): EventoHerramienta => ({ x, y, boton: 0, botones: 1, mayus: false, ctrl: false, escala: 20 });

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

/**
 * Reconecta un extremo libre al azar (T14c): a un borne, a una T en el medio
 * de un tramo de otro cable o, a veces, a un codo o un extremo de ese cable.
 * "si" si se reconectó, "no" si se rechazó (y el comando tira sin cambiar
 * nada), null si no hubo qué probar.
 */
function reconectar(ed: Editor, azar: () => number): "si" | "no" | null {
  const hoja = ed.documento.hojas[0]!;
  const sueltos: [Cable, "desde" | "hasta"][] = [];
  for (const c of hoja.cables) for (const lado of ["desde", "hasta"] as const) if (c[lado].tipo === "libre") sueltos.push([c, lado]);
  if (sueltos.length === 0) return null;
  const [w, lado] = sueltos[Math.floor(azar() * sueltos.length)]!;
  const bornes = bornesDe(hoja);
  let destino: DestinoExtremo | null = null;
  if (bornes.length > 0 && azar() < 0.5) {
    destino = bornes[Math.floor(azar() * bornes.length)]! as DestinoExtremo;
  } else {
    const host = hoja.cables[Math.floor(azar() * hoja.cables.length)]!;
    const rec = recorridoCable(indexarHoja(hoja), host);
    if (!rec) return null;
    let p: { x: number; y: number } | null;
    if (azar() < 0.2) {
      const i = Math.floor(azar() * (rec.length / 2));
      p = { x: rec[2 * i]!, y: rec[2 * i + 1]! };
    } else {
      p = puntoMedio(hoja, host, azar);
    }
    destino = p ? { tipo: "cable", cable: host.id, x: p.x, y: p.y } : null;
  }
  if (!destino) return null;
  const r = planearReconexion(ed.entornoPlan(), w.id, lado, destino);
  if (r.rechazo) {
    const antes = JSON.stringify(ed.documento);
    expect(() => ed.ejecutar(new CambiarExtremo(w.id, lado, destino, { entorno: ed.entornoPlan }))).toThrow(r.rechazo.motivo);
    expect(JSON.stringify(ed.documento)).toBe(antes);
    return "no";
  }
  ed.ejecutar(new CambiarExtremo(w.id, lado, destino, { entorno: ed.entornoPlan, plan: r }));
  return "si";
}

/** Invariantes de la hoja (T14c): válida, sin ciclos de apoyos y sin T en el extremo de su anfitrión. */
function revisarHoja(hoja: Hoja, contexto: string): void {
  expect(validarHoja(hoja), contexto).toEqual([]);
  const indice = indexarHoja(hoja);
  for (const c of hoja.cables) {
    expect(seApoyaEn(indice, c.id, c.id), `${contexto}: ciclo de apoyos con ${c.id}`).toBe(false);
    for (const e of [c.desde, c.hasta]) {
      if (e.tipo !== "cable") continue;
      const rec = recorridoCable(indice, indice.cables.get(e.cable)!)!;
      const m = rec.length;
      const enExtremo = (rec[0] === e.x && rec[1] === e.y) || (rec[m - 2] === e.x && rec[m - 1] === e.y);
      expect(enExtremo, `${contexto}: la T de ${c.id} en el extremo de ${e.cable}`).toBe(false);
    }
  }
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

  it("un extremo que cambia de tipo con solo el id del cable en el cambio (T14c): libre → T, libre → borne y la vuelta", () => {
    const k: Hoja["componentes"][number] = { id: "c1", tipo: "contactor.bobina", x: 0, y: 20, rot: 0, espejado: false, etiqueta: "K1", params: {} };
    const a1 = borneDe(k, "A1")!;
    const hoja: Hoja = {
      nombre: "Hoja 1",
      componentes: [k],
      cables: [
        { id: "w1", desde: libre(0, 0), hasta: libre(10, 0), codos: [] },
        // Extremo libre justo sobre el anfitrión: cambia solo el tipo.
        { id: "w2", desde: libre(4, 0), hasta: libre(4, 5), codos: [] },
        // Extremo libre fuera del anfitrión: cambian el tipo y el punto.
        { id: "w3", desde: libre(7, 3), hasta: libre(7, 6), codos: [] },
        // Otro cable que ya llega a A1: con un segundo, A1 es unión.
        { id: "w4", desde: borne("c1", "A1"), hasta: libre(a1.x - 6, a1.y), codos: [] },
        { id: "w5", desde: libre(a1.x + 6, a1.y - 4), hasta: libre(a1.x + 6, a1.y), codos: [] },
      ],
    };
    let indice = indexarHoja(hoja);
    const u = new Uniones(indice, hoja.cables);
    expect(u.todas()).toEqual([]);
    expect(u.todas()).toEqual(uniones(hoja));
    /** Cambia los extremos del cable `id` y pone al día las uniones con solo ese id. */
    const cambiar = (id: string, cambios: Partial<Cable>) => {
      const i = hoja.cables.findIndex((w) => w.id === id);
      hoja.cables[i] = { ...hoja.cables[i]!, ...cambios };
      indice = indexarHoja(hoja);
      const cambio = u.actualizar([id], indice);
      expect(u.todas(), id).toEqual(uniones(hoja));
      return { quitadas: cambio.quitadas.map((x) => [x.x, x.y]), puestas: cambio.puestas.map((x) => [x.x, x.y]) };
    };

    // libre → T, mismo punto: aparece la unión.
    expect(cambiar("w2", { desde: enCable("w1", 4, 0) })).toEqual({ quitadas: [], puestas: [[4, 0]] });
    // libre → T, con otro punto: aparece la unión.
    expect(cambiar("w3", { desde: enCable("w1", 7, 0) })).toEqual({ quitadas: [], puestas: [[7, 0]] });
    // libre → borne con otro cable en ese borne: aparece la unión.
    expect(cambiar("w5", { hasta: borne("c1", "A1"), codos: [[a1.x + 6, a1.y]] })).toEqual({ quitadas: [], puestas: [[a1.x, a1.y]] });
    expect(u.cantidad).toBe(3);

    // La vuelta: desaparecen.
    expect(cambiar("w5", { hasta: libre(a1.x + 6, a1.y), codos: [] })).toEqual({ quitadas: [[a1.x, a1.y]], puestas: [] });
    expect(cambiar("w3", { desde: libre(7, 3) })).toEqual({ quitadas: [[7, 0]], puestas: [] });
    expect(cambiar("w2", { desde: libre(4, 0) })).toEqual({ quitadas: [[4, 0]], puestas: [] });
    expect(u.cantidad).toBe(0);
    // Y otra vez a T: el registro viejo no queda pegado.
    expect(cambiar("w2", { desde: enCable("w1", 4, 0) })).toEqual({ quitadas: [], puestas: [[4, 0]] });
    // El anfitrión cambia solo después de la vuelta: el punto de la T sigue bien.
    expect(cambiar("w1", { hasta: libre(4, 0) }).puestas).toEqual([]);
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

  it("la escena recibe las uniones e invalida sus cajas al crear, deshacer y rehacer una T", () => {
    const ed = new Editor(documentoNuevo());
    const vista = new VistaFalsa();
    ed.vista = vista;
    const doc = ed.documento;
    const a = cablear(doc, { desde: libre(0, 0), hasta: libre(10, 0), codos: [] });
    ed.ejecutar(a);
    vista.regiones = [];
    ed.ejecutar(cablear(doc, { desde: enCable(a.id, 4, 0), hasta: libre(4, 5), codos: [] }));
    expect(ed.escena.cantidadUniones).toBe(1);
    expect(vista.regiones).toContainEqual(cajaUnion(4, 0));
    vista.regiones = [];
    ed.deshacer();
    expect(ed.escena.cantidadUniones).toBe(0);
    expect(vista.regiones).toContainEqual(cajaUnion(4, 0));
    ed.rehacer();
    expect(ed.escena.unionesEn(cajaUnion(4, 0))).toEqual([{ x: 4, y: 0, cables: [a.id, "w2"].sort(), componentes: [] }]);
    // Un editor nuevo sobre el mismo documento las arma de entrada.
    expect(new Editor(doc).escena.cantidadUniones).toBe(1);
  });

  it("al arrastrar, las cajas de las uniones de lo arrastrado se invalidan al ocultar, al soltar y al volver", () => {
    const ed = new Editor(documentoNuevo());
    const vista = new VistaFalsa();
    ed.vista = vista;
    const doc = ed.documento;
    const k = colocar(doc, { tipo: "contactor.bobina", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} });
    ed.ejecutar(k);
    ed.ejecutar(cablear(doc, { desde: borne(k.id, "A1"), hasta: libre(0, -6), codos: [] }));
    ed.ejecutar(cablear(doc, { desde: borne(k.id, "A1"), hasta: libre(5, -2), codos: [] }));
    expect(ed.uniones.todas().map((u) => [u.x, u.y])).toEqual([[0, -2]]);
    vista.regiones = [];
    const h = ed.seleccionar;
    ed.aplicar(h.presionar(ev(0.2, 0)));
    ed.aplicar(h.mover(ev(0.2, 1.5)));
    ed.aplicar(h.mover(ev(0.2, 3)));
    expect(ed.escena.oculto(k.id)).toBe(true);
    expect(vista.regiones).toContainEqual(cajaUnion(0, -2));
    vista.regiones = [];
    ed.aplicar(h.soltar(ev(0.2, 3)));
    expect(ed.escena.oculto(k.id)).toBe(false);
    expect(ed.uniones.todas().map((u) => [u.x, u.y])).toEqual([[0, 1]]);
    expect(vista.regiones).toContainEqual(cajaUnion(0, -2));
    expect(vista.regiones).toContainEqual(cajaUnion(0, 1));
    expect(ed.uniones.todas()).toEqual(deHoja(ed));
  });

  it("atajo de la hoja entera (R, Mayús+R, M y mover, con deshacer y rehacer): igual al cálculo completo, sin recalcular", () => {
    const ops: [string, (ids: string[]) => Comando][] = [
      ["R", (ids) => new Rotar(ids, 90)],
      ["Mayús+R", (ids) => new Rotar(ids, -90)],
      ["M", (ids) => new Espejar(ids)],
      ["mover", (ids) => new Mover(ids, 3, -2)],
    ];
    const docs: [string, () => Editor][] = [
      ["banco con 100", () => new Editor(documentoBancoCables(100))],
      ["al azar con cascadas", () => editorAzar(generador(SEMILLA + 7)).ed],
    ];
    for (const [nombreDoc, crear] of docs) {
      for (const [nombre, op] of ops) {
        const ed = crear();
        const ctx = `${nombreDoc}, ${nombre}`;
        const h = ed.documento.hojas[0]!;
        expect(ed.uniones.cantidad, ctx).toBeGreaterThan(0);
        const llamadas = { actualizar: 0, transformar: 0 };
        const u = ed.uniones as unknown as Record<"actualizar" | "transformar", (...a: unknown[]) => unknown>;
        for (const k of ["actualizar", "transformar"] as const) {
          const o = u[k]!.bind(ed.uniones);
          u[k] = (...a: unknown[]) => {
            llamadas[k]++;
            return o(...a);
          };
        }
        const enEscena = () =>
          ed.escena
            .unionesEn({ x: -1e6, y: -1e6, ancho: 2e6, alto: 2e6 })
            .map((x) => ({ x: x.x, y: x.y, cables: [...x.cables], componentes: [...x.componentes] }))
            .sort((a, b) => a.y - b.y || a.x - b.x);
        const igualCompleto = (paso: string) => {
          expect(ed.uniones.todas(), `${ctx}, ${paso}`).toEqual(deHoja(ed));
          expect(enEscena(), `${ctx}, ${paso}, escena`).toEqual(deHoja(ed));
        };
        // Las cajas de las uniones no se invalidan aparte: tienen que caber en lo que invalidan los cables.
        const vista = new VistaFalsa();
        ed.vista = vista;
        const cabe = (paso: string, antes: { x: number; y: number }[]) => {
          for (const u of [...antes, ...ed.uniones.todas()]) {
            const k = cajaUnion(u.x, u.y);
            const ok = vista.regiones.some((r) => k.x >= r.x && k.y >= r.y && k.x + k.ancho <= r.x + r.ancho && k.y + k.alto <= r.y + r.alto);
            expect(ok, `${ctx}, ${paso}: la caja de (${u.x}, ${u.y}) no cabe en ninguna invalidada`).toBe(true);
          }
          vista.regiones = [];
        };
        let antes = ed.uniones.todas();
        ed.ejecutar(op([...h.componentes.map((c) => c.id), ...h.cables.map((w) => w.id)]));
        igualCompleto("aplicado");
        cabe("aplicado", antes);
        antes = ed.uniones.todas();
        ed.deshacer();
        igualCompleto("deshecho");
        cabe("deshecho", antes);
        antes = ed.uniones.todas();
        ed.rehacer();
        igualCompleto("rehecho");
        cabe("rehecho", antes);
        expect(llamadas, ctx).toEqual({ actualizar: 0, transformar: 3 });
      }
    }
  });

  it(`al azar (semilla ${SEMILLA}): después de cada operación, igual que recorrer la hoja`, () => {
    const azar = generador(SEMILLA);
    const n = {
      aceptadas: 0,
      rechazadas: 0,
      anfitrionesBorrados: 0,
      deshechos: 0,
      rehechos: 0,
      cascadas: 0,
      conUniones: 0,
      reconectados: 0,
      reconexionesRechazadas: 0,
    };
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
        } else if (r < 0.37) {
          // Reconectar un extremo libre (T14c).
          const hecho = reconectar(ed, azar);
          if (hecho === "si") n.reconectados++;
          else if (hecho === "no") n.reconexionesRechazadas++;
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
        revisarHoja(hoja, contexto);
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
    expect(n.reconectados, JSON.stringify(n)).toBeGreaterThan(10);
    expect(n.reconexionesRechazadas, JSON.stringify(n)).toBeGreaterThan(10);
  });
});
