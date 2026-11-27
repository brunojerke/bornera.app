// Sensores, presostato, termostato, electroválvulas, motor de continua y
// diferencial 3P (T40, biblioteca 2): docs/plan-T40.md. El sensor es la carga
// BN-BU más el polo NA BN-BK, enclavado (D-B3 A); la electroválvula
// biestable queda en la última bobina con tensión (D-B5 A, D-T40-3 y 4 A; al
// detenerse, en la última estable: ajuste 2). Que el sensor conmute sin BU es
// el límite de la sección 3 del plan: se fija acá para que 6b lo cambie a
// sabiendas.
import { describe, expect, it } from "vitest";
import type { Cable, Componente, Hoja } from "../model/documento";
import { validar } from "../model/validaciones";
import { entrarSimulacion, iniciar, pulsar, soltar, textoAvisoSim, type Simulacion } from "./motor";
import { armarNetlist, type Netlist } from "./netlist";
import { SimulacionLenta } from "./prueba-motor";

// ── Ayudas ────────────────────────────────────────────────────────────────

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

function entrar(h: Hoja): Simulacion {
  const e = entrarSimulacion(h);
  if (!e.ok) throw new Error(`No entra: ${JSON.stringify(e.errores)}`);
  return e.sim;
}

/** Encendida alguna carga del componente. */
function encendido(s: Simulacion, comp: string, par = -1): boolean {
  const ks = s.netlist.cargas.flatMap((c, k) => (c.comp === comp ? [k] : []));
  if (ks.length === 0) throw new Error(`Sin carga ${comp}`);
  return par >= 0 ? s.encendidas[ks[par]!]! : ks.some((k) => s.encendidas[k]!);
}

/** La posición de la electroválvula `comp`: true en 14 (accionada). */
function posicion(s: Simulacion, comp: string): boolean {
  const i = s.netlist.valvulas.findIndex((v) => v.comp === comp);
  if (i < 0) throw new Error(`Sin válvula ${comp}`);
  return s.posiciones[i]!;
}

const reglasDe = (h: Hoja, id: string) => validar(h).filter((a) => a.id === id).map((a) => a.regla);

/** El motor y el cálculo lento dan lo mismo en `s` (la foto del lento, campo por campo). */
function comoElLento(s: Simulacion, lenta: SimulacionLenta): void {
  const f = lenta.foto();
  expect([...s.pulsados].sort()).toEqual(f.pulsados);
  expect(s.tension).toEqual(f.tension);
  expect(s.encendidas).toEqual(f.encendidas);
  expect(s.posiciones).toEqual(f.posiciones);
  expect(s.avisos).toEqual(f.avisos);
}

// El circuito de la sección 0 del plan: T1 (L1-N) da 24 V; B1 (PNP) → B2 (presostato NC) → K1; un NA
// de K1 a Y1 (monoestable) en el secundario; otro NA de K1 lleva G1 (continua) a M1 (motor de continua).
const PRUEBA: [string, string, string?][] = [
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
const NODOS_PRUEBA = [
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

// ── Netlist ───────────────────────────────────────────────────────────────

describe("netlist de T40", () => {
  it("sensor: el polo NA BN-BK, enclavado, y la carga BN-BU, con BN en los dos (D-B3 A)", () => {
    const n = armarNetlist(circuito([["b", "sensor.capacitivo", "B1"]]));
    expect(n.contactos).toEqual([{ comp: "b", polo: 0, etiqueta: "B1", na: true, accionamiento: "manual_enclavado", bornes: ["BN", "BK"], a: red(n, "b", "BN"), b: red(n, "b", "BK") }]);
    expect(n.cargas).toEqual([{ comp: "b", etiqueta: "B1", tipo: "carga", bornes: ["BN", "BU"], enPolo: [true, false], a: red(n, "b", "BN"), b: red(n, "b", "BU") }]);
    expect(n.valvulas).toEqual([]);
  });

  it.each(["sensor.inductivo", "sensor.capacitivo", "sensor.fotoelectrico"])("%s: el mismo armado", (tipo) => {
    const n = armarNetlist(circuito([["b", tipo, "B1"]]));
    expect(n.contactos.map((c) => [c.bornes, c.accionamiento])).toEqual([[["BN", "BK"], "manual_enclavado"]]);
    expect(n.cargas.map((c) => c.bornes)).toEqual([["BN", "BU"]]);
  });

  it.each([
    ["sensor.presostato_na", true, ["13", "14"]],
    ["sensor.presostato_nc", false, ["11", "12"]],
    ["sensor.termostato_na", true, ["13", "14"]],
    ["sensor.termostato_nc", false, ["11", "12"]],
  ] as const)("%s: un contacto momentáneo, como el final de carrera (D-B4 A), sin carga", (tipo, na, bornes) => {
    const n = armarNetlist(circuito([["b", tipo, "B1"]]));
    expect(n.contactos.map((c) => [c.na, c.accionamiento, c.bornes])).toEqual([[na, "manual_momentaneo", bornes]]);
    expect(n.cargas).toEqual([]);
  });

  it("electroválvula biestable: dos cargas, A1-A2 y B1-B2, y una válvula con las dos", () => {
    const n = armarNetlist(circuito([["y", "valvula.biestable", "Y1"]]));
    expect(n.cargas.map((c) => [c.comp, c.tipo, c.bornes, c.enPolo])).toEqual([
      ["y", "carga", ["A1", "A2"], [false, false]],
      ["y", "carga", ["B1", "B2"], [false, false]],
    ]);
    expect(n.valvulas).toEqual([{ comp: "y", etiqueta: "Y1", biestable: true, a: 0, b: 1 }]);
    expect(n.bobinas).toEqual([]);
  });

  it("electroválvula monoestable: una carga y una válvula sin `b`", () => {
    const n = armarNetlist(circuito([["h", "senalizacion.lampara", "H1"], ["y", "valvula.monoestable", " y2 "]]));
    expect(n.cargas.map((c) => c.bornes)).toEqual([["X1", "X2"], ["A1", "A2"]]);
    expect(n.valvulas).toEqual([{ comp: "y", etiqueta: "Y2", biestable: false, a: 1, b: -1 }]);
  });

  it("motor de continua: una carga A1-A2", () => {
    const n = armarNetlist(circuito([["m", "motor.continua", "M1"]]));
    expect(n.cargas).toEqual([{ comp: "m", etiqueta: "M1", tipo: "carga", bornes: ["A1", "A2"], enPolo: [false, false], a: red(n, "m", "A1"), b: red(n, "m", "A2") }]);
  });

  it("diferencial 3P: tres polos NA sin accionamiento (conducen siempre, T36)", () => {
    const n = armarNetlist(circuito([["q", "proteccion.diferencial_tripolar", "Q1"]]));
    expect(n.contactos.map((c) => [c.polo, c.na, c.accionamiento, c.bornes])).toEqual([
      [0, true, null, ["1", "2"]],
      [1, true, null, ["3", "4"]],
      [2, true, null, ["5", "6"]],
    ]);
    expect(n.cargas).toEqual([]);
  });
});

// ── Motor ─────────────────────────────────────────────────────────────────

describe("motor de T40: sensor, presostato y circuito de la sección 0", () => {
  it("el circuito de la prueba: en reposo nada; clic en B1 enciende K1, Y1 y M1, sin avisos; otro clic lo apaga", () => {
    const h = circuito(PRUEBA, NODOS_PRUEBA);
    let s = entrar(h);
    expect([encendido(s, "k"), encendido(s, "y"), encendido(s, "m")]).toEqual([false, false, false]);
    // El sensor está alimentado (BN-BU en el secundario), sin accionar.
    expect(encendido(s, "b1")).toBe(true);
    s = pulsar(s, "b1");
    expect([encendido(s, "k"), encendido(s, "y"), encendido(s, "m"), posicion(s, "y")]).toEqual([true, true, true, true]);
    expect(s.avisos).toEqual([]);
    s = soltar(s, "b1");
    expect([encendido(s, "k"), encendido(s, "y"), encendido(s, "m"), posicion(s, "y")]).toEqual([false, false, false, false]);
    expect(s.avisos).toEqual([]);
  });

  it("el presostato NC corta: con B1 accionado, pulsar B2 apaga K1 y soltarlo lo vuelve a encender", () => {
    let s = entrar(circuito(PRUEBA, NODOS_PRUEBA));
    s = pulsar(s, "b1");
    s = pulsar(s, "b2");
    expect(encendido(s, "k")).toBe(false);
    s = soltar(s, "b2");
    expect(encendido(s, "k")).toBe(true);
  });

  it("el sensor es enclavado (D-B3 A); presostato y termostato, momentáneos", () => {
    const s = entrar(circuito(PRUEBA, NODOS_PRUEBA));
    expect(s.netlist.contactos.filter((c) => c.comp === "b1").map((c) => c.accionamiento)).toEqual(["manual_enclavado"]);
    expect(s.netlist.contactos.filter((c) => c.comp === "b2").map((c) => c.accionamiento)).toEqual(["manual_momentaneo"]);
  });

  it("límite (sección 3 del plan): sin BU cableado el sensor conmuta igual; su carga no se enciende", () => {
    const nodos = NODOS_PRUEBA.map((nodo) => nodo.filter((b) => b !== "b1:BU"));
    const h = circuito(PRUEBA, nodos);
    expect(reglasDe(h, "b1")).toEqual(["R7"]);
    let s = entrar(h);
    expect(encendido(s, "b1")).toBe(false);
    s = pulsar(s, "b1");
    expect(encendido(s, "k")).toBe(true);
    expect(encendido(s, "b1")).toBe(false);
  });

  it("serie con un sensor: BN cuenta una vez (es de la carga y del polo); con un borne de otro en la red no hay aviso", () => {
    // L1 → H1 → (BN de B1) y BU → N: el sensor accionado une BN con BK. La red de BN no tiene potencial.
    const base: [string, string, string?][] = [
      ["l", "fuente.fase", "L1"],
      ["n", "fuente.neutro", "N"],
      ["h", "senalizacion.lampara", "H1"],
      ["b", "sensor.inductivo", "B1"],
    ];
    const nodos = [["l:L", "h:X1"], ["h:X2", "b:BN"], ["b:BU", "n:N"]];
    // Sin nada más: H1 y la carga del sensor quedan en serie entre L1 y N.
    let s = iniciar(armarNetlist(circuito(base, nodos)));
    s = pulsar(s, "b");
    expect(s.avisos.map((a) => a.tipo)).toEqual(["serie"]);
    // Con una Fase sin etiqueta (no da potencial) en la red de BN: no es una serie de cargas solas.
    const h = circuito([...base, ["f", "fuente.fase", ""]], [["l:L", "h:X1"], ["h:X2", "b:BN", "f:L"], ["b:BU", "n:N"]]);
    const n = armarNetlist(h);
    let t = iniciar(n);
    const lenta = new SimulacionLenta(n);
    t = pulsar(t, "b");
    lenta.pulsar("b");
    expect(t.avisos).toEqual([]);
    comoElLento(t, lenta);
  });
});

describe("motor de T40: electroválvulas (D-B5 A)", () => {
  // S1 lleva L1 a A1 de Y1 (biestable); S2, a B1; A2 y B2 al neutro.
  const COMPS: [string, string, string?][] = [
    ["l", "fuente.fase", "L1"],
    ["n", "fuente.neutro", "N"],
    ["s1", "pulsador.na", "S1"],
    ["s2", "pulsador.na", "S2"],
    ["y", "valvula.biestable", "Y1"],
  ];
  const NODOS = [["l:L", "s1:13", "s2:13"], ["s1:14", "y:A1"], ["s2:14", "y:B1"], ["n:N", "y:A2", "y:B2"]];

  it("la biestable arranca en 12; A la lleva a 14 y queda al soltar; B la vuelve a 12 y queda (memoria)", () => {
    const n = armarNetlist(circuito(COMPS, NODOS));
    const lenta = new SimulacionLenta(n);
    let s = iniciar(n);
    const paso = (f: (x: Simulacion) => Simulacion, g: () => void, esperado: boolean) => {
      s = f(s);
      g();
      expect(posicion(s, "y")).toBe(esperado);
      comoElLento(s, lenta);
    };
    expect(posicion(s, "y")).toBe(false);
    paso((x) => pulsar(x, "s1"), () => lenta.pulsar("s1"), true);
    paso((x) => soltar(x, "s1"), () => lenta.soltar("s1"), true);
    paso((x) => pulsar(x, "s2"), () => lenta.pulsar("s2"), false);
    paso((x) => soltar(x, "s2"), () => lenta.soltar("s2"), false);
    expect(s.avisos).toEqual([]);
  });

  it("con las dos bobinas queda donde estaba (D-T40-4 A) y avisa una vez por entrada", () => {
    let s = entrar(circuito(COMPS, NODOS));
    s = pulsar(s, "s1");
    s = pulsar(s, "s2");
    expect(posicion(s, "y")).toBe(true);
    expect(s.nuevos).toEqual([{ tipo: "dos_bobinas", comp: "y", etiqueta: "Y1" }]);
    expect(textoAvisoSim(s.nuevos[0]!)).toBe("Y1 con las dos bobinas");
    expect(s.detenida).toBeNull();
    s = soltar(s, "s1", "s2");
    s = pulsar(s, "s1", "s2");
    expect(posicion(s, "y")).toBe(true);
    expect(s.nuevos).toEqual([]);
    // Desde 12, las dos juntas: queda en 12.
    s = soltar(s, "s1");
    s = soltar(s, "s2");
    s = pulsar(s, "s2");
    s = soltar(s, "s2");
    expect(posicion(s, "y")).toBe(false);
    s = pulsar(s, "s1", "s2");
    expect(posicion(s, "y")).toBe(false);
  });

  it("cada entrada a Simular arranca en 12 (D-T40-3 A): la posición no queda en la hoja", () => {
    const h = circuito(COMPS, NODOS);
    let s = entrar(h);
    s = pulsar(s, "s1");
    s = soltar(s, "s1");
    expect(posicion(s, "y")).toBe(true);
    expect(posicion(entrar(h), "y")).toBe(false);
    expect(h.componentes.find((c) => c.id === "y")!.params).toEqual({});
  });

  it("al entrar con A1-A2 con tensión ya pasa a 14", () => {
    const h = circuito(COMPS, [["l:L", "y:A1"], ["n:N", "y:A2", "y:B2"]]);
    expect(posicion(entrar(h), "y")).toBe(true);
  });

  it("ajuste 2: si se detiene por oscilación, la biestable queda en la última estable", () => {
    // K1 se alimenta por su propio NC al pulsar S9: oscila y queda en reposo (K1 sin tensión). Un NC
    // de K1 en serie con S8 lleva L1 a A1: en ese estado final A1-A2 tiene tensión.
    const h = circuito(
      [
        ...COMPS,
        ["s9", "pulsador.na", "S9"],
        ["k", "contactor.bobina", "K1"],
        ["nc1", "contactor.auxiliar_nc", "K1"],
        ["s8", "pulsador.na", "S8"],
        ["nc2", "contactor.auxiliar_nc", "K1"],
      ],
      [
        ["l:L", "s1:13", "s2:13", "s9:13", "s8:13"],
        ["s1:14", "y:A1", "nc2:22"],
        ["s2:14", "y:B1"],
        ["n:N", "y:A2", "y:B2", "k:A2"],
        ["s9:14", "nc1:21"],
        ["nc1:22", "k:A1"],
        ["s8:14", "nc2:21"],
      ],
    );
    const n = armarNetlist(h);
    const lenta = new SimulacionLenta(n);
    let s = iniciar(n);
    expect(posicion(s, "y")).toBe(false);
    s = pulsar(s, "s9", "s8");
    lenta.pulsar("s9", "s8");
    expect(s.detenida?.tipo).toBe("oscila");
    expect(encendido(s, "y", 0)).toBe(true);
    expect(encendido(s, "y", 1)).toBe(false);
    expect(posicion(s, "y")).toBe(false);
    comoElLento(s, lenta);
  });

  it("la monoestable sigue a su bobina: accionada con tensión, en reposo sin ella", () => {
    const h = circuito(
      [["l", "fuente.fase", "L1"], ["n", "fuente.neutro", "N"], ["s1", "pulsador.na", "S1"], ["y", "valvula.monoestable", "Y1"]],
      [["l:L", "s1:13"], ["s1:14", "y:A1"], ["n:N", "y:A2"]],
    );
    let s = entrar(h);
    expect(posicion(s, "y")).toBe(false);
    s = pulsar(s, "s1");
    expect(posicion(s, "y")).toBe(true);
    s = soltar(s, "s1");
    expect(posicion(s, "y")).toBe(false);
  });

  it("sin etiqueta: R3 avisa y entra; dos biestables sin etiqueta no se mezclan y el aviso dice «sin etiqueta»", () => {
    const h = circuito(
      [["l", "fuente.fase", "L1"], ["n", "fuente.neutro", "N"], ["s1", "pulsador.na", "S1"], ["y", "valvula.biestable"], ["z", "valvula.biestable"]],
      [["l:L", "s1:13", "z:B1"], ["s1:14", "y:A1", "y:B1"], ["n:N", "y:A2", "y:B2", "z:A2", "z:B2"]],
    );
    expect(reglasDe(h, "y")).toContain("R3");
    let s = entrar(h);
    s = pulsar(s, "s1");
    expect(s.nuevos).toEqual([{ tipo: "dos_bobinas", comp: "y", etiqueta: "" }]);
    expect(textoAvisoSim(s.nuevos[0]!)).toBe("Electroválvula sin etiqueta con las dos bobinas");
    expect([posicion(s, "y"), posicion(s, "z")]).toEqual([false, false]);
  });
});

// ── Validación ────────────────────────────────────────────────────────────

describe("validación de T40", () => {
  it("R4: dos electroválvulas Y1 dan error y no entran a Simular", () => {
    const h = circuito([["y", "valvula.biestable", "Y1"], ["z", "valvula.monoestable", "Y1"]]);
    const e = entrarSimulacion(h);
    expect(e.ok).toBe(false);
    expect(validar(h, ["R4"]).map((a) => [a.id, a.severidad])).toEqual([["y", "error"], ["z", "error"]]);
  });

  it("R4: dos sensores B1 del mismo tipo dan aviso y entran (contactos a mano); NA y NC con la misma etiqueta, nada", () => {
    const h = circuito([["a", "sensor.inductivo", "B1"], ["b", "sensor.inductivo", "B1"]]);
    expect(validar(h, ["R4"]).map((a) => [a.id, a.severidad])).toEqual([["a", "aviso"], ["b", "aviso"]]);
    expect(entrarSimulacion(h).ok).toBe(true);
    expect(validar(circuito([["a", "sensor.presostato_na", "B2"], ["b", "sensor.presostato_nc", "B2"]]), ["R4"])).toEqual([]);
  });

  it("R3: sensor, presostato, electroválvula y motor de continua sin etiqueta", () => {
    const h = circuito([["a", "sensor.fotoelectrico"], ["b", "sensor.termostato_nc"], ["y", "valvula.monoestable"], ["m", "motor.continua"], ["q", "proteccion.diferencial_tripolar"]]);
    expect(validar(h, ["R3"]).map((a) => a.id)).toEqual(["a", "b", "y", "m", "q"]);
  });

  it("R5 con B e Y (T40): un pulsador «B1» y una lámpara «Y1» avisan; un sensor «K1», también", () => {
    const h = circuito([["s", "pulsador.na", "B1"], ["h", "senalizacion.lampara", "Y1"], ["b", "sensor.inductivo", "K1"], ["y", "valvula.biestable", "Y3"]]);
    expect(validar(h, ["R5"]).map((a) => (a.regla === "R5" ? [a.id, a.de] : []))).toEqual([
      ["s", "sensor"],
      ["h", "electroválvula"],
      ["b", "bobina"],
    ]);
  });
});
