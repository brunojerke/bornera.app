// El circuito de la biblioteca 2 (sección 0 de docs/plan-biblioteca2.md; C1):
// se arma con W, abre sin avisos, es el mismo circuito que el de
// `sim/sensoresValvulas.test.ts` y simula como pide la sección 0.
import { describe, expect, it } from "vitest";
import { deserializar, serializar } from "../io";
import { validarHoja } from "../model/cables";
import { crearDocumento, type Cable, type Componente, type Documento } from "../model/documento";
import { validar } from "../model/validaciones";
import { entrarSimulacion, pulsar, soltar, type Simulacion } from "../sim/motor";
import { biblioteca2 } from "./biblioteca2";
import { compararRedes } from "./compararRedes";

function entrar(): { s: Simulacion; comp: ReturnType<typeof biblioteca2>["comp"] } {
  const { doc, comp } = biblioteca2();
  const e = entrarSimulacion(doc.hojas[0]!);
  if (!e.ok) throw new Error(`No entra: ${JSON.stringify(e.errores)}`);
  return { s: e.sim, comp };
}

/** Encendida alguna carga del componente. */
function encendido(s: Simulacion, comp: string): boolean {
  const ks = s.netlist.cargas.flatMap((c, k) => (c.comp === comp ? [k] : []));
  if (ks.length === 0) throw new Error(`Sin carga ${comp}`);
  return ks.some((k) => s.encendidas[k]!);
}

/** La posición de la electroválvula `comp`: true en 14 (accionada). */
function posicion(s: Simulacion, comp: string): boolean {
  const i = s.netlist.valvulas.findIndex((v) => v.comp === comp);
  if (i < 0) throw new Error(`Sin válvula ${comp}`);
  return s.posiciones[i]!;
}

const tres = (s: Simulacion, c: ReturnType<typeof biblioteca2>["comp"]) => [encendido(s, c.k1Bobina), encendido(s, c.y1), encendido(s, c.m1)];

/** El circuito de la prueba de T40 (`sensoresValvulas.test.ts`), sin geometría: la referencia por redes. */
function prueba(): Documento {
  const comps: [string, string, string][] = [
    ["l", "fuente.fase", "L1"],
    ["n", "fuente.neutro", "N"],
    ["t", "transformador.monofasico", "T1"],
    ["b1", "sensor.inductivo", "B1"],
    ["b2", "sensor.presostato_nc", "B2"],
    ["k", "contactor.bobina", "K1"],
    ["ka", "contactor.auxiliar_na", "K1"],
    ["y", "valvula.monoestable", "Y1"],
    ["g", "fuente.continua", "G1"],
    ["kb", "contactor.auxiliar_na", "K1"],
    ["m", "motor.continua", "M1"],
  ];
  const nodos = [
    ["l:L", "t:1U1"],
    ["n:N", "t:1U2"],
    ["t:2U1", "b1:BN", "ka:13"],
    ["t:2U2", "b1:BU", "k:A2", "y:A2"],
    ["b1:BK", "b2:11"],
    ["b2:12", "k:A1"],
    ["ka:14", "y:A1"],
    ["g:L+", "kb:13"],
    ["kb:14", "m:A1"],
    ["m:A2", "g:M"],
  ];
  const componentes: Componente[] = comps.map(([id, tipo, etiqueta]) => ({ id, tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta, params: {} }));
  const extremo = (s: string) => {
    const [comp, borne] = s.split(":") as [string, string];
    return { tipo: "borne" as const, comp, borne };
  };
  const cables: Cable[] = [];
  for (const nodo of nodos) for (let i = 1; i < nodo.length; i++) cables.push({ id: `w${cables.length + 1}`, desde: extremo(nodo[i - 1]!), hasta: extremo(nodo[i]!), codos: [] });
  const doc = crearDocumento({ titulo: "Prueba de T40", autor: "", fecha: "2026-11-27" });
  doc.hojas[0] = { ...doc.hojas[0]!, componentes, cables };
  return doc;
}

describe("biblioteca 2: armado", () => {
  it("se arma con W, sin avisos (R1 a R10) y con la hoja válida", () => {
    const hoja = biblioteca2().doc.hojas[0]!;
    expect(validar(hoja)).toEqual([]);
    expect(validarHoja(hoja)).toEqual([]);
    expect(hoja.componentes).toHaveLength(11);
  });

  it("guardar y abrir: el mismo documento, sin avisos; compararRedes contra sí misma, 0", () => {
    const { doc } = biblioteca2();
    const r = deserializar(serializar(doc));
    if (!r.ok) throw new Error("No abre");
    expect(r.avisos).toEqual([]);
    expect(r.documento).toEqual(doc);
    expect(compararRedes(r.documento, biblioteca2().doc)).toEqual([]);
  });

  it("es el circuito de la prueba de T40: compararRedes, 0 diferencias en los dos sentidos", () => {
    expect(compararRedes(biblioteca2().doc, prueba())).toEqual([]);
    expect(compararRedes(prueba(), biblioteca2().doc)).toEqual([]);
  });
});

describe("biblioteca 2: Simular (sección 0)", () => {
  it("en reposo nada; clic en B1 enciende K1, Y1 y M1, sin avisos; otro clic lo apaga", () => {
    let { s, comp } = entrar();
    expect(s.detenida).toBeNull();
    expect(s.avisos).toEqual([]);
    expect(tres(s, comp)).toEqual([false, false, false]);
    expect(encendido(s, comp.b1)).toBe(true);
    s = pulsar(s, comp.b1);
    expect([...tres(s, comp), posicion(s, comp.y1)]).toEqual([true, true, true, true]);
    expect(s.avisos).toEqual([]);
    s = soltar(s, comp.b1);
    expect([...tres(s, comp), posicion(s, comp.y1)]).toEqual([false, false, false, false]);
    expect([s.avisos, s.detenida]).toEqual([[], null]);
  });

  it("el presostato B2 (NC) corta: con B1 accionado, pulsar B2 apaga los tres y soltarlo los vuelve a encender", () => {
    let { s, comp } = entrar();
    s = pulsar(s, comp.b1);
    s = pulsar(s, comp.b2);
    expect(tres(s, comp)).toEqual([false, false, false]);
    s = soltar(s, comp.b2);
    expect(tres(s, comp)).toEqual([true, true, true]);
    expect(s.avisos).toEqual([]);
  });
});
