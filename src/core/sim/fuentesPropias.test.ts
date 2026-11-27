// Fuentes propias y trafos (T39, biblioteca 2): docs/plan-T39.md. La salida
// da potenciales propios de nombre etiqueta + borne (D-B8, D-B10), siempre
// activos (D-B2 A); la entrada L-N es carga; el primario trifásico no (D-B11).
// El límite de D-B9 (una carga entre una fase de una fuente y el neutro de
// otra enciende) no se fija acá: se resuelve en 6b.
import { describe, expect, it } from "vitest";
import type { Cable, Componente, Hoja } from "../model/documento";
import { redes } from "../model/redes";
import { validar } from "../model/validaciones";
import { entrarSimulacion, type Simulacion } from "./motor";
import { armarNetlist, type Netlist } from "./netlist";
import { particion, particionEsperada } from "./prueba-netlist";

// ── Ayudas ────────────────────────────────────────────────────────────────

const CONTINUA = "fuente.continua";
const VARIABLE = "fuente.variable";
const CONMUTADA = "fuente.conmutada";
const MONO = "transformador.monofasico";
const TRIFASICO = "transformador.trifasico";
const VARIAC = "transformador.variac";
const LAMPARA = "senalizacion.lampara";

/** Un circuito sin geometría: componentes [id, tipo, etiqueta] y nodos de bornes "id:borne" unidos por cables. */
function circuito(comps: [string, string, string?][], nodos: string[][] = []): Hoja {
  const componentes: Componente[] = comps.map(([id, tipo, etiqueta = ""]) => ({ id, tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta, params: {} }));
  const cables: Cable[] = [];
  const extremo = (s: string) => {
    const [comp, borne] = s.split(":") as [string, string];
    return { tipo: "borne" as const, comp, borne };
  };
  for (const nodo of nodos) for (let i = 1; i < nodo.length; i++) cables.push({ id: `w${cables.length + 1}`, desde: extremo(nodo[i - 1]!), hasta: extremo(nodo[i]!), codos: [] });
  return { nombre: "Hoja 1", componentes, cables };
}

const red = (n: Netlist, c: string, b: string): number => {
  const r = n.redDeBorne.get(c)?.get(b);
  if (r === undefined) throw new Error(`${c}:${b} sin red`);
  return r;
};

/** Los potenciales de la red de ese borne, como «papel nombre». */
const potencialesDe = (n: Netlist, c: string, b: string): string[] => n.redes[red(n, c, b)]!.potenciales.map((i) => `${n.potenciales[i]!.papel} ${n.potenciales[i]!.nombre}`);

function entrar(h: Hoja): Simulacion {
  const e = entrarSimulacion(h);
  if (!e.ok) throw new Error(`No entra: ${JSON.stringify(e.errores)}`);
  return e.sim;
}

/** Encendida alguna carga del componente. */
function encendido(s: Simulacion, comp: string): boolean {
  const ks = s.netlist.cargas.flatMap((c, k) => (c.comp === comp ? [k] : []));
  if (ks.length === 0) throw new Error(`Sin carga ${comp}`);
  return ks.some((k) => s.encendidas[k]!);
}

const reglasDe = (h: Hoja, id: string) => validar(h).filter((a) => a.id === id).map((a) => a.regla);

// ── Potenciales de salida (D-B8, D-B10) ───────────────────────────────────

describe("salida propia: potencial = etiqueta + borne (D-B8, D-B10)", () => {
  it("dos continuas G1 y G2 no se unen: «G1.L+» y «G2.L+» son dos potenciales y dos redes", () => {
    const n = armarNetlist(circuito([["g1", CONTINUA, "G1"], ["g2", CONTINUA, "G2"]]));
    expect(n.potenciales).toEqual([
      { papel: "fase", nombre: "G1.L+" },
      { papel: "fase", nombre: "G2.L+" },
      { papel: "neutro", nombre: "G1.M" },
      { papel: "neutro", nombre: "G2.M" },
    ]);
    expect(red(n, "g1", "L+")).not.toBe(red(n, "g2", "L+"));
    expect(red(n, "g1", "M")).not.toBe(red(n, "g2", "M"));
    expect(n.enCorto).toEqual([]);
  });

  it("variable y conmutada: V+ y +V son fase, V- y -V neutro (D-B1, D-T39-1); PE no da potencial", () => {
    const n = armarNetlist(circuito([["g1", VARIABLE, "G1"], ["g2", CONMUTADA, "G2"], ["pe", "fuente.tierra", "PE"]], [["g2:PE", "pe:PE"]]));
    expect(potencialesDe(n, "g1", "V+")).toEqual(["fase G1.V+"]);
    expect(potencialesDe(n, "g1", "V-")).toEqual(["neutro G1.V-"]);
    expect(potencialesDe(n, "g2", "+V")).toEqual(["fase G2.+V"]);
    expect(potencialesDe(n, "g2", "-V")).toEqual(["neutro G2.-V"]);
    expect(potencialesDe(n, "g2", "PE")).toEqual([]);
    expect(potencialesDe(n, "g2", "L")).toEqual([]);
  });

  it("la salida de T1 no se une con la red: 2U1 no es L ni N; cablear 2U1 a L da corto", () => {
    const comps: [string, string, string?][] = [["l", "fuente.fase", "L"], ["n", "fuente.neutro", "N"], ["t1", MONO, "T1"]];
    const n = armarNetlist(circuito(comps, [["l:L", "t1:1U1"], ["n:N", "t1:1U2"]]));
    expect(red(n, "t1", "2U1")).not.toBe(red(n, "l", "L"));
    expect(red(n, "t1", "2U1")).not.toBe(red(n, "n", "N"));
    expect(red(n, "t1", "2U2")).not.toBe(red(n, "n", "N"));
    expect(potencialesDe(n, "t1", "2U1")).toEqual(["fase T1.2U1"]);
    expect(potencialesDe(n, "t1", "2U2")).toEqual(["neutro T1.2U2"]);
    expect(n.enCorto).toEqual([]);
    const corto = armarNetlist(circuito(comps, [["l:L", "t1:1U1"], ["n:N", "t1:1U2"], ["t1:2U1", "l:L"]]));
    expect(corto.enCorto).toEqual([red(corto, "t1", "2U1")]);
  });

  it("trifásico: 2U, 2V y 2W fase y 2N neutro, cada uno su potencial (D-T39-3 A)", () => {
    const n = armarNetlist(circuito([["t2", TRIFASICO, "T2"]]));
    expect(n.potenciales.map((p) => `${p.papel} ${p.nombre}`)).toEqual(["fase T2.2U", "fase T2.2V", "fase T2.2W", "neutro T2.2N"]);
  });

  it("puentear L+ con M de G1: corto por cables", () => {
    const n = armarNetlist(circuito([["g1", CONTINUA, "G1"]], [["g1:L+", "g1:M"]]));
    expect(n.enCorto).toEqual([red(n, "g1", "L+")]);
  });

  it("una Fase «T1.2U1» es la misma red que esa salida (D-T39-2 A); un Neutro «G1.M» también, una Fase «G1.M» no", () => {
    const n = armarNetlist(
      circuito([["t1", MONO, "T1"], ["f", "fuente.fase", "t1.2u1"], ["g1", CONTINUA, "G1"], ["nm", "fuente.neutro", "G1.M"], ["fm", "fuente.fase", "G1.M"]]),
    );
    expect(red(n, "f", "L")).toBe(red(n, "t1", "2U1"));
    expect(red(n, "nm", "N")).toBe(red(n, "g1", "M"));
    expect(red(n, "fm", "L")).not.toBe(red(n, "g1", "M"));
  });

  it("misma partición que el oráculo (prueba-netlist), con fuentes, trafos y la red", () => {
    const h = circuito(
      [["l", "fuente.fase", "L1"], ["n", "fuente.neutro", "N"], ["t1", MONO, "T1"], ["t2", TRIFASICO, "T2"], ["g1", CONMUTADA, "G1"], ["g2", CONTINUA, ""], ["f", "fuente.fase", "T2.2U"], ["h1", LAMPARA, "H1"]],
      [["l:L", "t1:1U1", "g1:L"], ["n:N", "t1:1U2", "g1:N"], ["t1:2U1", "h1:X1"], ["g1:-V", "h1:X2"]],
    );
    expect(particion(armarNetlist(h).redes)).toEqual(particionEsperada(h));
  });
});

// ── Entrada como carga (D-B2, D-B11) ──────────────────────────────────────

describe("entrada: carga en la conmutada, el trafo mono y el variac; el primario trifásico no (D-B11)", () => {
  it("L-N, 1U1-1U2 y 1U1-1U2 son cargas; el trifásico, la continua y la variable no tienen", () => {
    const n = armarNetlist(circuito([["g1", CONTINUA, "G1"], ["g2", VARIABLE, "G2"], ["g3", CONMUTADA, "G3"], ["t1", MONO, "T1"], ["t2", TRIFASICO, "T2"], ["t3", VARIAC, "T3"]]));
    expect(n.cargas.map((c) => [c.comp, c.etiqueta, c.tipo])).toEqual([
      ["g3", "G3", "carga"],
      ["t1", "T1", "carga"],
      ["t3", "T3", "carga"],
    ]);
    expect(n.cargas[0]).toMatchObject({ a: red(n, "g3", "L"), b: red(n, "g3", "N") });
    expect(n.cargas[1]).toMatchObject({ a: red(n, "t1", "1U1"), b: red(n, "t1", "1U2") });
  });

  it("con L y N en la entrada, la conmutada y el trafo encienden (su entrada); sin ellas, no", () => {
    const comps: [string, string, string?][] = [["l", "fuente.fase", "L"], ["n", "fuente.neutro", "N"], ["g1", CONMUTADA, "G1"], ["t1", MONO, "T1"]];
    const s = entrar(circuito(comps, [["l:L", "g1:L", "t1:1U1"], ["n:N", "g1:N", "t1:1U2"]]));
    expect(encendido(s, "g1")).toBe(true);
    expect(encendido(s, "t1")).toBe(true);
    const sin = entrar(circuito(comps));
    expect(encendido(sin, "g1")).toBe(false);
    expect(encendido(sin, "t1")).toBe(false);
  });
});

// ── Carga en la salida (D-B2: siempre activa) ─────────────────────────────

describe("una carga en la salida enciende sin tensión en la entrada (D-B2 A)", () => {
  it.each([
    ["T1", MONO, "2U1", "2U2"],
    ["T2", TRIFASICO, "2U", "2N"],
    ["T3", VARIAC, "2U1", "2U2"],
    ["G1", CONTINUA, "L+", "M"],
    ["G2", VARIABLE, "V+", "V-"],
    ["G3", CONMUTADA, "+V", "-V"],
  ])("%s (%s): H1 entre %s y %s enciende", (etiqueta, tipo, a, b) => {
    const s = entrar(circuito([["x", tipo, etiqueta], ["h1", LAMPARA, "H1"]], [[`x:${a}`, "h1:X1"], [`x:${b}`, "h1:X2"]]));
    expect(encendido(s, "h1")).toBe(true);
    // La entrada, sin cablear, no enciende (los que la tienen).
    if (s.netlist.cargas.some((c) => c.comp === "x")) expect(encendido(s, "x")).toBe(false);
  });
});

// ── Sin etiqueta (ajuste 4, B) ────────────────────────────────────────────

describe("sin etiqueta (ajuste 4 B de T39): entra a Simular, la salida no da potencial y R3 avisa", () => {
  it.each([
    [CONTINUA, "L+", "M"],
    [MONO, "2U1", "2U2"],
  ])("%s sin etiqueta: entra, H1 no enciende y R3 está", (tipo, a, b) => {
    const h = circuito([["x", tipo, ""], ["h1", LAMPARA, "H1"]], [[`x:${a}`, "h1:X1"], [`x:${b}`, "h1:X2"]]);
    const e = entrarSimulacion(h);
    expect(e.ok).toBe(true);
    const s = entrar(h);
    expect(s.netlist.potenciales).toEqual([]);
    expect(encendido(s, "h1")).toBe(false);
    expect(reglasDe(h, "x")).toContain("R3");
    expect(validar(h).find((a) => a.id === "x" && a.regla === "R3")?.severidad).toBe("aviso");
  });
});

// ── R4 y R5 (titulares G y T) ─────────────────────────────────────────────

describe("R4 y R5 con G y T", () => {
  it.each([
    ["dos G1", CONTINUA, CONTINUA, "G1"],
    ["dos T1", MONO, MONO, "T1"],
    ["una continua y una conmutada G1", CONTINUA, CONMUTADA, "G1"],
    ["un trafo mono y un variac T1", MONO, VARIAC, "T1"],
  ])("%s: error R4 y no entran a Simular", (_, a, b, etiqueta) => {
    const h = circuito([["x", a, etiqueta], ["y", b, etiqueta]]);
    const e = entrarSimulacion(h);
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.errores.map((x) => [x.regla, x.id, x.severidad])).toEqual([["R4", "x", "error"], ["R4", "y", "error"]]);
  });

  it("R5: una lámpara «G1» avisa de fuente y una bobina «T1» de transformador", () => {
    const h = circuito([["h", LAMPARA, "G1"], ["k", "contactor.bobina", "T1"]]);
    const r5 = validar(h, ["R5"]);
    expect(r5.map((a) => [a.id, a.regla === "R5" ? a.de : ""])).toEqual([
      ["h", "fuente"],
      ["k", "transformador"],
    ]);
  });
});

// ── Nombres de red (compararRedes, R6) ─────────────────────────────────────

describe("redes(): la salida nombra su red con etiqueta + borne", () => {
  it("«G1.L+» y «G1.M»; al renombrar a G5, «G5.L+»; sin etiqueta, sin nombre", () => {
    const h = circuito([["g", CONTINUA, "G1"], ["h1", LAMPARA, "H1"]], [["g:L+", "h1:X1"]]);
    expect(redes(h).flatMap((r) => r.nombres)).toEqual(["G1.L+", "G1.M"]);
    h.componentes[0]!.etiqueta = "g5";
    expect(redes(h).flatMap((r) => r.nombres)).toEqual(["G5.L+", "G5.M"]);
    h.componentes[0]!.etiqueta = "";
    expect(redes(h).flatMap((r) => r.nombres)).toEqual([]);
  });

  it("R6: un NC en la rama de su bobina no avisa si una salida con etiqueta nombra la red; sin etiqueta, sí", () => {
    const comps: [string, string, string?][] = [["k", "contactor.bobina", "K1"], ["nc", "contactor.auxiliar_nc", "K1"], ["g", CONTINUA, "G1"]];
    const nodos = [["nc:22", "k:A1", "g:L+"]];
    expect(reglasDe(circuito(comps, nodos), "nc")).not.toContain("R6");
    comps[2] = ["g", CONTINUA, ""];
    expect(reglasDe(circuito(comps, nodos), "nc")).toContain("R6");
  });
});
