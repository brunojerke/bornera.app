// Tests del criterio del motor (T30): docs/plan-T30.md. Sin reloj: el límite
// es la cantidad de cambios y se inyecta (`tope`).
import { describe, expect, it } from "vitest";
import { cadena, carrera, corto, oscilante } from "../circuitos/sim";
import { inversion } from "../circuitos/inversion";
import { marchaParada } from "../circuitos/marchaParada";
import { serializar } from "../io";
import type { Cable, Componente, Hoja } from "../model/documento";
import { entrarSimulacion, iniciar, pulsar, soltar, textoAvisoSim, type Simulacion } from "./motor";
import { armarNetlist } from "./netlist";

// ── Ayudas ────────────────────────────────────────────────────────────────

/** Un circuito sin geometría: componentes [id, tipo, etiqueta] y nodos de bornes "id:borne" unidos por cables. */
function circuito(comps: [string, string, string?][], nodos: string[][]): Hoja {
  const componentes: Componente[] = comps.map(([id, tipo, etiqueta = ""]) => ({ id, tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta, params: {} }));
  const cables: Cable[] = [];
  const extremo = (s: string) => {
    const [comp, borne] = s.split(":") as [string, string];
    return { tipo: "borne" as const, comp, borne };
  };
  for (const nodo of nodos) for (let i = 1; i < nodo.length; i++) cables.push({ id: `w${cables.length + 1}`, desde: extremo(nodo[i - 1]!), hasta: extremo(nodo[i]!), codos: [] });
  return { nombre: "Hoja 1", componentes, cables };
}

function entrar(h: Hoja, tope?: number): Simulacion {
  const e = entrarSimulacion(h, tope === undefined ? {} : { tope });
  if (!e.ok) throw new Error(`No entra: ${JSON.stringify(e.errores)}`);
  return e.sim;
}

/** Tensión de la bobina de esa etiqueta. */
function tension(s: Simulacion, etiqueta: string): boolean {
  const g = s.netlist.bobinas.findIndex((b) => b.etiqueta === etiqueta);
  if (g < 0) throw new Error(`Sin bobina ${etiqueta}`);
  return s.tension[g]!;
}

/** Etiquetas de las bobinas con tensión. */
const conTension = (s: Simulacion) => s.netlist.bobinas.filter((_, g) => s.tension[g]).map((b) => b.etiqueta);

function encendida(s: Simulacion, comp: string): boolean {
  const k = s.netlist.cargas.findIndex((c) => c.comp === comp);
  if (k < 0) throw new Error(`Sin carga ${comp}`);
  return s.encendidas[k]!;
}

const textos = (avisos: Simulacion["avisos"]) => avisos.map(textoAvisoSim);

// ── Circuitos de referencia ───────────────────────────────────────────────

describe("motor: circuitos de referencia", () => {
  it("marcha-parada: S1 arranca, al soltar retiene, S0 para", () => {
    const { doc, comp } = marchaParada();
    let s = entrar(doc.hojas[0]!);
    expect([tension(s, "K1"), encendida(s, comp.h1), s.detenida, s.avisos]).toEqual([false, false, null, []]);
    s = pulsar(s, comp.s1);
    expect([tension(s, "K1"), encendida(s, comp.h1)]).toEqual([true, true]);
    s = soltar(s, comp.s1);
    expect(tension(s, "K1")).toBe(true);
    s = pulsar(s, comp.s0);
    expect([tension(s, "K1"), encendida(s, comp.h1)]).toEqual([false, false]);
    s = soltar(s, comp.s0);
    expect([tension(s, "K1"), s.avisos]).toEqual([false, []]);
  });

  it("marcha-parada con la rama NC: H2 prendida en reposo, apagada con K1", () => {
    const { doc, comp } = marchaParada({ ramaNC: true });
    let s = entrar(doc.hojas[0]!);
    expect(encendida(s, comp.h2!)).toBe(true);
    s = pulsar(s, comp.s1);
    expect([encendida(s, comp.h1), encendida(s, comp.h2!)]).toEqual([true, false]);
  });

  it("marcha-parada con dos neutros: la etiqueta de red alimenta la lámpara", () => {
    const { doc, comp } = marchaParada({ dosNeutros: true });
    const s = pulsar(entrar(doc.hojas[0]!), comp.s1);
    expect(encendida(s, comp.h1)).toBe(true);
  });

  it("inversión: enclavamiento por los NC", () => {
    const { doc, comp } = inversion();
    let s = entrar(doc.hojas[0]!);
    s = soltar(pulsar(s, comp.s1), comp.s1);
    expect(conTension(s)).toEqual(["K1"]);
    s = soltar(pulsar(s, comp.s2), comp.s2);
    expect(conTension(s)).toEqual(["K1"]);
    s = soltar(pulsar(s, comp.s0), comp.s0);
    expect(conTension(s)).toEqual([]);
    s = soltar(pulsar(s, comp.s2), comp.s2);
    expect(conTension(s)).toEqual(["K2"]);
    expect([encendida(s, comp.h1), encendida(s, comp.h2), s.avisos]).toEqual([false, true, []]);
  });

  it("inversión con S1 y S2 apretados a la vez: «Carrera entre K1 y K2», queda K1 (ajuste 3)", () => {
    const { doc, comp } = inversion();
    const s = pulsar(entrar(doc.hojas[0]!), comp.s1, comp.s2);
    expect(conTension(s)).toEqual(["K1"]);
    expect(textos(s.nuevos)).toEqual(["Carrera entre K1 y K2"]);
    expect(s.detenida).toBeNull();
  });

  it("no cambia el documento: serializar igual después de entrar, pulsar, soltar y salir", () => {
    for (const { doc, comp } of [marchaParada(), inversion()]) {
      const antes = serializar(doc);
      let s = entrar(doc.hojas[0]!);
      s = pulsar(s, comp.s1);
      s = soltar(s, comp.s1);
      s = pulsar(s, comp.s0);
      expect(s.detenida).toBeNull();
      expect(serializar(doc)).toBe(antes);
    }
    for (const armado of [oscilante, corto, carrera, cadena]) {
      const { doc, comp } = armado();
      const antes = serializar(doc);
      let s = entrar(doc.hojas[0]!);
      if (comp["s1"]) s = soltar(pulsar(s, comp["s1"]), comp["s1"]);
      expect(serializar(doc)).toBe(antes);
    }
  });
});

// ── Cargas ────────────────────────────────────────────────────────────────

describe("motor: cargas", () => {
  it("bobina de 380 V entre L1 y L2: con tensión", () => {
    const h = circuito([["f1", "fuente.fase", "L1"], ["k1", "contactor.bobina", "K1"], ["f2", "fuente.fase", "L2"]], [["f1:L", "k1:A1"], ["k1:A2", "f2:L"]]);
    expect(tension(entrar(h), "K1")).toBe(true);
  });

  it("la misma fase en los dos bornes: apagada", () => {
    const h = circuito([["f1", "fuente.fase", "L1"], ["h1", "senalizacion.lampara", "H1"], ["f2", "fuente.fase", "L1"]], [["f1:L", "h1:X1"], ["h1:X2", "f2:L"]]);
    expect(encendida(entrar(h), "h1")).toBe(false);
  });

  it("un borne sin potencial: apagada", () => {
    const h = circuito([["f1", "fuente.fase", "L1"], ["h1", "senalizacion.lampara", "H1"]], [["f1:L", "h1:X1"]]);
    expect(encendida(entrar(h), "h1")).toBe(false);
  });

  it("dos neutros de distinto nombre: apagada (no es fase y neutro)", () => {
    const h = circuito([["n1", "fuente.neutro", "N"], ["h1", "senalizacion.lampara", "H1"], ["n2", "fuente.neutro", "N2"]], [["n1:N", "h1:X1"], ["h1:X2", "n2:N"]]);
    expect(encendida(entrar(h), "h1")).toBe(false);
  });

  it("auxiliar sin bobina de su etiqueta: en reposo (el NC conduce, el NA no)", () => {
    const h = circuito(
      [["f", "fuente.fase", "L1"], ["nc", "contactor.auxiliar_nc", "K9"], ["na", "contactor.auxiliar_na", "K9"], ["h1", "senalizacion.lampara", "H1"], ["h2", "senalizacion.lampara", "H2"], ["n", "fuente.neutro", "N"]],
      [["f:L", "nc:21", "na:13"], ["nc:22", "h1:X1"], ["na:14", "h2:X1"], ["h1:X2", "h2:X2", "n:N"]],
    );
    const s = entrar(h);
    expect([encendida(s, "h1"), encendida(s, "h2")]).toEqual([true, false]);
  });

  it("pulsar algo que no es pulsador no hace nada", () => {
    const { doc, comp } = marchaParada();
    const s = entrar(doc.hojas[0]!);
    const t = pulsar(s, comp.k1Bobina, comp.k1Auxiliar, "no-existe");
    expect([t.tension, t.pulsados.size, t.nuevos]).toEqual([s.tension, 0, []]);
  });
});

// ── Cargas en serie (M1-B) ────────────────────────────────────────────────

describe("motor: cargas en serie (M1-B)", () => {
  /** L – H1 – X – K1 – N, y aparte S1 prende H2. */
  const serie = () =>
    circuito(
      [["f", "fuente.fase", "L"], ["h1", "senalizacion.lampara", "H1"], ["k1", "contactor.bobina", "K1"], ["n", "fuente.neutro", "N"], ["s1", "pulsador.na", "S1"], ["h2", "senalizacion.lampara", "H2"]],
      [["f:L", "h1:X1", "s1:13"], ["h1:X2", "k1:A1"], ["k1:A2", "n:N", "h2:X2"], ["s1:14", "h2:X1"]],
    );

  it("L – H1 – X – K1 – N: apagadas y «Cargas en serie: H1 y K1»", () => {
    const s = entrar(serie());
    expect([encendida(s, "h1"), tension(s, "K1")]).toEqual([false, false]);
    expect(textos(s.nuevos)).toEqual(["Cargas en serie: H1 y K1"]);
    expect(s.nuevos).toEqual([{ tipo: "serie", cargas: ["h1", "k1"], etiquetas: ["H1", "K1"] }]);
  });

  it("una vez por grupo en cada entrada, no en cada pulsación (ajuste 4)", () => {
    let s = entrar(serie());
    s = pulsar(s, "s1");
    expect([encendida(s, "h2"), s.nuevos]).toEqual([true, []]);
    s = soltar(s, "s1");
    expect([s.nuevos, s.avisos.length]).toEqual([[], 1]);
    expect(textos(entrar(serie()).nuevos)).toEqual(["Cargas en serie: H1 y K1"]);
  });

  it("dos cargas en paralelo colgadas de una red sin alimentar: sin aviso", () => {
    const h = circuito(
      [["f", "fuente.fase", "L"], ["k1", "contactor.bobina", "K1"], ["h1", "senalizacion.lampara", "H1"], ["n", "fuente.neutro", "N"]],
      [["k1:A1", "h1:X1"], ["k1:A2", "h1:X2", "n:N"], ["f:L"]],
    );
    expect(entrar(h).avisos).toEqual([]);
  });

  it("con otro borne en la red del medio (una Fase sin etiqueta): sin aviso", () => {
    const h = circuito(
      [["f", "fuente.fase", "L"], ["h1", "senalizacion.lampara", "H1"], ["k1", "contactor.bobina", "K1"], ["n", "fuente.neutro", "N"], ["x", "fuente.fase", ""]],
      [["f:L", "h1:X1"], ["h1:X2", "k1:A1", "x:L"], ["k1:A2", "n:N"]],
    );
    expect(entrar(h).avisos).toEqual([]);
  });

  it("con un contacto abierto en la red del medio: sin aviso; al cerrarlo, sí", () => {
    // L – H1 – X – S1 (NA) – Y – K1 – N: con S1 suelto X llega a un contacto; apretado, los contactos que conducen no cuentan.
    const h = circuito(
      [["f", "fuente.fase", "L"], ["h1", "senalizacion.lampara", "H1"], ["s1", "pulsador.na", "S1"], ["k1", "contactor.bobina", "K1"], ["n", "fuente.neutro", "N"]],
      [["f:L", "h1:X1"], ["h1:X2", "s1:13"], ["s1:14", "k1:A1"], ["k1:A2", "n:N"]],
    );
    let s = entrar(h);
    expect(s.avisos).toEqual([]);
    s = pulsar(s, "s1");
    expect(textos(s.nuevos)).toEqual(["Cargas en serie: H1 y K1"]);
  });
});

// ── Carreras (D2-B) ───────────────────────────────────────────────────────

describe("motor: carreras (D2-B)", () => {
  it("carrera.brn armado: «Carrera entre K1 y K2», queda K1; una vez por entrada (ajuste 4)", () => {
    const { doc, comp } = carrera();
    let s = entrar(doc.hojas[0]!);
    s = pulsar(s, comp["s1"]!);
    expect(conTension(s)).toEqual(["K1"]);
    expect(s.nuevos).toEqual([{ tipo: "carrera", etiquetas: ["K1", "K2"] }]);
    s = soltar(s, comp["s1"]!);
    expect([conTension(s), s.nuevos]).toEqual([[], []]);
    s = pulsar(s, comp["s1"]!);
    expect([conTension(s), s.nuevos, s.avisos.length]).toEqual([["K1"], [], 1]);
    // Otra entrada vuelve a avisar.
    expect(textos(pulsar(entrar(doc.hojas[0]!), comp["s1"]!).nuevos)).toEqual(["Carrera entre K1 y K2"]);
  });

  it("orden natural: entre K2 y K10 gana K2", () => {
    const h = circuito(
      [["f", "fuente.fase", "L"], ["s1", "pulsador.na", "S1"], ["a", "contactor.auxiliar_nc", "K10"], ["k2", "contactor.bobina", "K2"], ["b", "contactor.auxiliar_nc", "K2"], ["k10", "contactor.bobina", "K10"], ["n", "fuente.neutro", "N"]],
      [["f:L", "s1:13"], ["s1:14", "a:21", "b:21"], ["a:22", "k2:A1"], ["b:22", "k10:A1"], ["k2:A2", "k10:A2", "n:N"]],
    );
    const s = pulsar(entrar(h), "s1");
    expect(conTension(s)).toEqual(["K2"]);
    expect(textos(s.nuevos)).toEqual(["Carrera entre K2 y K10"]);
  });

  /** Una rama: desde el nodo `desde`, los NC de las etiquetas dadas en serie y la bobina; A2 al neutro. */
  function rama(id: string, desde: string, ncs: string[]): { comps: [string, string, string][]; nodos: string[][] } {
    const comps: [string, string, string][] = ncs.map((e, i) => [`${id}nc${i}`, "contactor.auxiliar_nc", e]);
    comps.push([id, "contactor.bobina", id.toUpperCase()]);
    const nodos: string[][] = [];
    let anterior = desde;
    ncs.forEach((_, i) => {
      nodos.push([anterior, `${id}nc${i}:21`]);
      anterior = `${id}nc${i}:22`;
    });
    nodos.push([anterior, `${id}:A1`], [`${id}:A2`, "n:N"]);
    return { comps, nodos };
  }

  it("tres enclavadas con un pulsador común (caso A del plan)", () => {
    const ramas = [rama("k1", "s1:14", ["K2", "K3"]), rama("k2", "s1:14", ["K1", "K3"]), rama("k3", "s1:14", ["K1", "K2"])];
    const h = circuito(
      [["f", "fuente.fase", "L"], ["s1", "pulsador.na", "S1"], ["n", "fuente.neutro", "N"], ...ramas.flatMap((r) => r.comps)],
      [["f:L", "s1:13"], ...ramas.flatMap((r) => r.nodos)],
    );
    let s = pulsar(entrar(h), "s1");
    expect(conTension(s)).toEqual(["K1"]);
    expect(textos(s.nuevos)).toEqual(["Carrera entre K1 y K2", "Carrera entre K1 y K3"]);
    expect(s.detenida).toBeNull();
    s = soltar(s, "s1");
    expect([conTension(s), s.nuevos]).toEqual([[], []]);
    s = pulsar(s, "s1");
    expect([conTension(s), s.nuevos]).toEqual([["K1"], []]);
  });

  it("la carrera pasa por una tercera (caso B del plan): avisa K2 y K3, no K1 y K3", () => {
    // S1 alimenta K1 y, por el NC de K2, K3. Un NA de K1 alimenta K2 por el NC de K3.
    const h = circuito(
      [
        ["f", "fuente.fase", "L"],
        ["s1", "pulsador.na", "S1"],
        ["k1", "contactor.bobina", "K1"],
        ["nc2", "contactor.auxiliar_nc", "K2"],
        ["k3", "contactor.bobina", "K3"],
        ["na1", "contactor.auxiliar_na", "K1"],
        ["nc3", "contactor.auxiliar_nc", "K3"],
        ["k2", "contactor.bobina", "K2"],
        ["n", "fuente.neutro", "N"],
      ],
      [["f:L", "s1:13", "na1:13"], ["s1:14", "k1:A1", "nc2:21"], ["nc2:22", "k3:A1"], ["na1:14", "nc3:21"], ["nc3:22", "k2:A1"], ["k1:A2", "k2:A2", "k3:A2", "n:N"]],
    );
    const s = pulsar(entrar(h), "s1");
    expect(conTension(s)).toEqual(["K1", "K2"]);
    expect(textos(s.nuevos)).toEqual(["Carrera entre K2 y K3"]);
  });
});

// ── Detenciones (D3-A) ────────────────────────────────────────────────────

describe("motor: oscilación, tope y corto (D3-A)", () => {
  it("oscilante: se detiene al entrar con «Oscila: K1» y no responde", () => {
    const { doc } = oscilante();
    const s = entrar(doc.hojas[0]!);
    expect(s.detenida).toEqual({ tipo: "oscila", etiquetas: ["K1"] });
    expect(textos(s.nuevos)).toEqual(["Oscila: K1"]);
  });

  it("detenida, pulsar y soltar no hacen nada hasta salir", () => {
    const h = circuito(
      [["f", "fuente.fase", "L"], ["nc", "contactor.auxiliar_nc", "K1"], ["k1", "contactor.bobina", "K1"], ["s1", "pulsador.na", "S1"], ["h1", "senalizacion.lampara", "H1"], ["n", "fuente.neutro", "N"]],
      [["f:L", "nc:21", "s1:13"], ["nc:22", "k1:A1"], ["s1:14", "h1:X1"], ["k1:A2", "h1:X2", "n:N"]],
    );
    const s = entrar(h);
    expect(s.detenida?.tipo).toBe("oscila");
    const t = pulsar(s, "s1");
    expect([t.pulsados.size, encendida(t, "h1"), t.nuevos, t.avisos]).toEqual([0, false, [], s.avisos]);
  });

  it("cadena: S1 mueve K1 a K5 y al soltar caen las cinco", () => {
    const { doc, comp } = cadena();
    let s = pulsar(entrar(doc.hojas[0]!), comp["s1"]!);
    expect(conTension(s)).toEqual(["K1", "K2", "K3", "K4", "K5"]);
    s = soltar(s, comp["s1"]!);
    expect([conTension(s), s.avisos]).toEqual([[], []]);
  });

  it("tope inyectado: la cadena con tope 3 da «No se estabilizó en 3 pasos» (ajuste 5)", () => {
    const { doc, comp } = cadena();
    const s = pulsar(entrar(doc.hojas[0]!, 3), comp["s1"]!);
    expect(s.detenida).toEqual({ tipo: "tope", pasos: 3 });
    expect(conTension(s)).toEqual(["K1", "K2", "K3"]);
    expect(textos(s.nuevos)).toEqual(["No se estabilizó en 3 pasos"]);
    expect(textos(s.nuevos)).not.toContain("Oscila: K4");
  });

  it("tope por defecto: 2 × bobinas + 50", () => {
    const { doc } = cadena();
    expect(entrar(doc.hojas[0]!).tope).toBe(2 * 5 + 50);
  });

  it("oscilación antes que tope: con tope 2, el oscilante igual dice «Oscila»", () => {
    const { doc } = oscilante();
    expect(entrar(doc.hojas[0]!, 2).detenida?.tipo).toBe("oscila");
    expect(entrar(doc.hojas[0]!, 1).detenida).toEqual({ tipo: "tope", pasos: 1 });
  });

  it("corto por cables al entrar (D10-A): se detiene y marca la red", () => {
    const h = circuito([["f", "fuente.fase", "L1"], ["n", "fuente.neutro", "N"], ["h1", "senalizacion.lampara", "H1"]], [["f:L", "n:N", "h1:X1"]]);
    const s = entrar(h);
    const red = s.netlist.redDeBorne.get("f")!.get("L")!;
    expect(s.detenida).toEqual({ tipo: "corto", redes: [red], potenciales: [0, 1], nombres: ["L1", "N"] });
    expect(textos(s.nuevos)).toEqual(["Cortocircuito entre L1 y N"]);
    expect(s.potencialDeRed[red]).toBeNull();
  });

  it("Fase «N» unida a Neutro «N»: «Cortocircuito entre Fase N y Neutro N»", () => {
    const h = circuito([["f", "fuente.fase", "N"], ["n", "fuente.neutro", "N"]], [["f:L", "n:N"]]);
    expect(textos(entrar(h).nuevos)).toEqual(["Cortocircuito entre Fase N y Neutro N"]);
  });

  it("corto.brn armado: H1 prendida; al pulsar S1, corto; soltar no hace nada (M5-A)", () => {
    const { doc, comp } = corto();
    let s = entrar(doc.hojas[0]!);
    expect([encendida(s, comp["h1"]!), s.detenida]).toEqual([true, null]);
    s = pulsar(s, comp["s1"]!);
    expect(s.detenida?.tipo).toBe("corto");
    expect(textos(s.nuevos)).toEqual(["Cortocircuito entre L y N"]);
    const t = soltar(s, comp["s1"]!);
    expect([t.pulsados.has(comp["s1"]!), t.detenida]).toEqual([true, s.detenida]);
  });

  it("corto después de un cambio de bobina: queda el estado con la bobina cambiada (M2-A)", () => {
    // S1 alimenta K1; un NA de K1 une L y N.
    const h = circuito(
      [["f", "fuente.fase", "L"], ["s1", "pulsador.na", "S1"], ["k1", "contactor.bobina", "K1"], ["na", "contactor.auxiliar_na", "K1"], ["n", "fuente.neutro", "N"]],
      [["f:L", "s1:13", "na:13"], ["s1:14", "k1:A1"], ["k1:A2", "na:14", "n:N"]],
    );
    const s = pulsar(entrar(h), "s1");
    expect(s.detenida?.tipo).toBe("corto");
    expect(tension(s, "K1")).toBe(true);
  });
});

// ── Entrar (D4-A) ─────────────────────────────────────────────────────────

describe("motor: entrar (D4-A)", () => {
  const dosK1 = () =>
    circuito(
      [["f", "fuente.fase", "L"], ["s1", "pulsador.na", "S1"], ["ka", "contactor.bobina", "K1"], ["kb", "contactor.bobina", "K1"], ["na", "contactor.auxiliar_na", "K1"], ["h1", "senalizacion.lampara", "H1"], ["n", "fuente.neutro", "N"]],
      [["f:L", "s1:13", "na:13"], ["s1:14", "ka:A1"], ["na:14", "h1:X1"], ["ka:A2", "kb:A2", "h1:X2", "n:N"]],
    );

  it("dos bobinas con la misma etiqueta no dejan entrar: errores R4 (ajuste 1)", () => {
    const e = entrarSimulacion(dosK1());
    expect(e.ok).toBe(false);
    if (e.ok) return;
    expect(e.errores.length).toBeGreaterThan(0);
    expect(e.errores.every((a) => a.regla === "R4" && a.severidad === "error")).toBe(true);
    expect(e.errores.map((a) => a.id).sort()).toEqual(["ka", "kb"]);
  });

  it("respaldo: si igual llegan, la etiqueta tiene tensión si cualquiera la tiene", () => {
    let s = iniciar(armarNetlist(dosK1()));
    expect(s.netlist.bobinas).toEqual([{ etiqueta: "K1", cargas: [0, 1] }]);
    expect(encendida(s, "h1")).toBe(false);
    s = pulsar(s, "s1");
    expect([tension(s, "K1"), encendida(s, "h1")]).toEqual([true, true]);
  });

  it("los avisos de edición no impiden entrar (una bobina sin contactos, fuentes sin cables)", () => {
    const h = circuito([["f", "fuente.fase", "L"], ["k1", "contactor.bobina", "K1"]], []);
    expect(entrarSimulacion(h).ok).toBe(true);
  });

  it("el mismo resultado dos veces", () => {
    const correr = () => {
      const { doc, comp } = inversion();
      let s = entrar(doc.hojas[0]!);
      s = pulsar(s, comp.s1, comp.s2);
      s = soltar(s, comp.s1);
      s = pulsar(s, comp.s0);
      return { tension: s.tension, conducen: s.conducen, encendidas: s.encendidas, potencialDeRed: s.potencialDeRed, avisos: s.avisos };
    };
    expect(correr()).toEqual(correr());
  });
});

// ── Polos (T34) ───────────────────────────────────────────────────────────

/** Trifásica T, pulsador S1 que alimenta K1 entre L1 y N, y los principales de K1 hacia U, V, W (sin motor: tres lámparas en estrella al neutro). */
function potencia(): Hoja {
  return circuito(
    [
      ["t", "fuente.trifasica"],
      ["n", "fuente.neutro", "N"],
      ["s1", "pulsador.na", "S1"],
      ["kb", "contactor.bobina", "K1"],
      ["k", "contactor.principal", "K1"],
      ["hu", "senalizacion.lampara", "HU"],
      ["hv", "senalizacion.lampara", "HV"],
      ["hw", "senalizacion.lampara", "HW"],
    ],
    [
      ["t:L1", "s1:13", "k:1"],
      ["s1:14", "kb:A1"],
      ["kb:A2", "n:N", "hu:X2", "hv:X2", "hw:X2"],
      ["t:L2", "k:3"],
      ["t:L3", "k:5"],
      ["k:2", "hu:X1"],
      ["k:4", "hv:X1"],
      ["k:6", "hw:X1"],
    ],
  );
}

const nombreDeRed = (s: Simulacion, comp: string, borne: string): string | null => {
  const p = s.potencialDeRed[s.netlist.redDeBorne.get(comp)!.get(borne)!];
  return p === null || p === undefined ? null : s.netlist.potenciales[p]!.nombre;
};

describe("motor: polos (T34)", () => {
  it("K1 cierra los tres polos a la vez: 2, 4 y 6 toman L1, L2 y L3", () => {
    let s = entrar(potencia());
    expect(s.conducen.filter((_, i) => s.netlist.contactos[i]!.comp === "k")).toEqual([false, false, false]);
    expect(["2", "4", "6"].map((b) => nombreDeRed(s, "k", b))).toEqual([null, null, null]);
    s = pulsar(s, "s1");
    expect(tension(s, "K1")).toBe(true);
    expect(s.conducen.filter((_, i) => s.netlist.contactos[i]!.comp === "k")).toEqual([true, true, true]);
    expect(["2", "4", "6"].map((b) => nombreDeRed(s, "k", b))).toEqual(["L1", "L2", "L3"]);
    expect(["hu", "hv", "hw"].map((h) => encendida(s, h))).toEqual([true, true, true]);
    s = soltar(s, "s1");
    expect(["2", "4", "6"].map((b) => nombreDeRed(s, "k", b))).toEqual([null, null, null]);
    expect(s.avisos).toEqual([]);
  });

  it("los principales no son pulsadores: pulsarlos no hace nada", () => {
    const s = entrar(potencia());
    expect(pulsar(s, "k").conducen).toEqual(s.conducen);
  });

  it("sin bobina de su etiqueta, en reposo (abiertos)", () => {
    const h = potencia();
    h.componentes.find((c) => c.id === "k")!.etiqueta = "K9";
    const s = pulsar(entrar(h), "s1");
    expect(s.conducen.filter((_, i) => s.netlist.contactos[i]!.comp === "k")).toEqual([false, false, false]);
    expect(encendida(s, "hu")).toBe(false);
  });

  it("K1 y K2 con las fases cruzadas: al cerrar los dos, «Cortocircuito entre L1 y L2» y se detiene", () => {
    const h = circuito(
      [
        ["t", "fuente.trifasica"],
        ["n", "fuente.neutro", "N"],
        ["s1", "pulsador.na", "S1"],
        ["s2", "pulsador.na", "S2"],
        ["k1b", "contactor.bobina", "K1"],
        ["k2b", "contactor.bobina", "K2"],
        ["k1", "contactor.principal", "K1"],
        ["k2", "contactor.principal", "K2"],
      ],
      [
        ["t:L1", "s1:13", "s2:13", "k1:1", "k2:3"],
        ["s1:14", "k1b:A1"],
        ["s2:14", "k2b:A1"],
        ["k1b:A2", "k2b:A2", "n:N"],
        ["t:L2", "k1:3", "k2:1"],
        ["t:L3", "k1:5", "k2:5"],
        ["k1:2", "k2:2"],
        ["k1:4", "k2:4"],
        ["k1:6", "k2:6"],
      ],
    );
    let s = pulsar(entrar(h), "s1");
    expect(s.detenida).toBeNull();
    expect(["2", "4", "6"].map((b) => nombreDeRed(s, "k1", b))).toEqual(["L1", "L2", "L3"]);
    s = pulsar(s, "s2");
    expect(s.detenida?.tipo).toBe("corto");
    expect(textoAvisoSim(s.detenida!)).toBe("Cortocircuito entre L1 y L2");
    expect(soltar(s, "s1", "s2").tension).toEqual(s.tension);
  });

  it("cargas en serie a través de un polo cerrado: «Cargas en serie: H1 y H2»", () => {
    // L1 – H1 – polo 3-4 de K1 (cerrado) – H2 – N; K1 alimentada aparte.
    const h = circuito(
      [
        ["t", "fuente.trifasica"],
        ["n", "fuente.neutro", "N"],
        ["kb", "contactor.bobina", "K1"],
        ["k", "contactor.principal", "K1"],
        ["h1", "senalizacion.lampara", "H1"],
        ["h2", "senalizacion.lampara", "H2"],
      ],
      [
        ["t:L1", "kb:A1", "h1:X1"],
        ["kb:A2", "n:N", "h2:X2"],
        ["h1:X2", "k:3"],
        ["k:4", "h2:X1"],
      ],
    );
    const s = entrar(h);
    expect(tension(s, "K1")).toBe(true);
    expect(textos(s.avisos)).toEqual(["Cargas en serie: H1 y H2"]);
  });

  it("con el polo de al lado abierto en la red del medio no avisa (el borne cuenta como contacto que no conduce)", () => {
    // L1 – H1 – (polo 1-2 de K9, sin bobina: abierto) y (polo 3-4 cerrado por K1) – H2 – N.
    const h = circuito(
      [
        ["t", "fuente.trifasica"],
        ["n", "fuente.neutro", "N"],
        ["kb", "contactor.bobina", "K1"],
        ["k", "contactor.principal", "K1"],
        ["k9", "contactor.principal", "K9"],
        ["h1", "senalizacion.lampara", "H1"],
        ["h2", "senalizacion.lampara", "H2"],
      ],
      [
        ["t:L1", "kb:A1", "h1:X1"],
        ["kb:A2", "n:N", "h2:X2"],
        ["h1:X2", "k:3", "k9:1"],
        ["k:4", "h2:X1"],
      ],
    );
    expect(entrar(h).avisos).toEqual([]);
  });
});
