// Motor contra el cálculo lento (T30, ajuste 7): 200 circuitos chicos al azar,
// con semilla fija, y pulsaciones al azar. Después de entrar y de cada pulsar
// o soltar, los dos tienen que dar lo mismo: bobinas, contactos, cargas,
// potenciales, detención y avisos. Además se exige que el lote cubra cada caso
// (estable con algo prendido, carrera, cargas en serie, oscila, tope y corto).
import { describe, expect, it } from "vitest";
import type { Cable, Componente, Hoja } from "../model/documento";
import { buscarSimbolo } from "../symbols";
import { iniciar, pulsar, soltar, type Simulacion } from "./motor";
import { armarNetlist } from "./netlist";
import { SimulacionLenta } from "./prueba-motor";

const SEMILLA = 30;
/** Lote con polos (T34): trifásica y contactores principales; semilla propia, el de arriba no cambia. */
const SEMILLA_POLOS = 34;
const CIRCUITOS = 200;
const ACCIONES = 10;

/** mulberry32: determinista y sin dependencias. */
function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Armado {
  hoja: Hoja;
  pulsadores: string[];
  tope?: number;
}

function generar(r: () => number, n: number, conPolos = false): Armado {
  const entero = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const componentes: Componente[] = [];
  const poner = (tipo: string, etiqueta: string) => {
    const id = `c${componentes.length + 1}`;
    componentes.push({ id, tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta, params: {} });
    return id;
  };

  for (let i = entero(1, 2); i > 0; i--) poner("fuente.fase", elegir(["L1", "L1", "L2"]));
  poner("fuente.neutro", "N");
  if (r() < 0.05) poner("fuente.fase", "N");
  const pulsadores: string[] = [];
  for (let i = entero(1, 3); i > 0; i--) pulsadores.push(poner(elegir(["pulsador.na", "pulsador.nc"]), `S${i}`));
  const bobinas = entero(1, 4);
  for (let i = 1; i <= bobinas; i++) poner("contactor.bobina", r() < 0.05 ? "K1" : `K${i}`);
  for (let i = entero(0, 6); i > 0; i--) poner(elegir(["contactor.auxiliar_na", "contactor.auxiliar_nc"]), `K${entero(1, bobinas + 1)}`);
  for (let i = entero(0, 2); i > 0; i--) poner("senalizacion.lampara", `H${i}`);
  // Un borne que no es de carga ni de contacto en una red sin potencial: una Fase sin etiqueta (R9).
  if (r() < 0.3) poner("fuente.fase", "");
  // Solo en el lote con polos (T34): consume azar solo ahí, así el otro lote queda igual.
  if (conPolos) {
    if (r() < 0.8) poner("fuente.trifasica", "");
    for (let i = entero(1, 3); i > 0; i--) poner("contactor.principal", `K${entero(1, bobinas + 1)}`);
  }

  // Cada borne va a un nodo al azar (o queda suelto); los bornes de un nodo se unen en cadena. Para que no
  // todo sea corto, las fases suelen ir al nodo 0, los neutros y el A2 de las bobinas al nodo 1.
  const nodos: { comp: string; borne: string }[][] = Array.from({ length: entero(3, 7) }, () => []);
  // Con polos (T34): L2 y L3 de la trifásica tienen su nodo, como la fase el 0, y ahí suelen ir los bornes
  // 3 y 5 de los principales (L1 y el borne 1, al nodo 0). Fuera de `nodos`: no entran en `elegir`.
  const deFases = conPolos ? [[], []] as { comp: string; borne: string }[][] : [];
  const fijoPolos = (c: Componente, borne: string): { comp: string; borne: string }[] | undefined => {
    if (c.tipo === "fuente.trifasica") return borne === "L1" ? nodos[0] : borne === "L2" ? deFases[0] : deFases[1];
    if (c.tipo === "contactor.principal") return borne === "1" ? nodos[0] : borne === "3" ? deFases[0] : borne === "5" ? deFases[1] : undefined;
    return undefined;
  };
  for (const c of componentes) {
    for (const b of buscarSimbolo(c.tipo)!.bornes) {
      if (r() >= 0.9) continue;
      const deTres = conPolos ? fijoPolos(c, b.nombre) : undefined;
      const fijo = c.tipo === "fuente.fase" && c.etiqueta !== "" ? 0 : c.tipo === "fuente.neutro" || b.nombre === "A2" ? 1 : -1;
      const destino = deTres ?? (fijo >= 0 ? nodos[fijo] : undefined);
      (destino && r() < 0.85 ? destino : elegir(nodos)).push({ comp: c.id, borne: b.nombre });
    }
  }
  nodos.push(...deFases);
  // A veces, una bobina alimentada por su propio NC (oscila), que al azar casi no sale.
  const a1 = nodos.find((nodo) => nodo.some((b) => b.comp === componentes.find((c) => c.tipo === "contactor.bobina")!.id && b.borne === "A1"));
  if (a1 && r() < 0.15) {
    const nc = poner("contactor.auxiliar_nc", componentes.find((c) => c.tipo === "contactor.bobina")!.etiqueta);
    nodos[0]!.push({ comp: nc, borne: "21" });
    a1.push({ comp: nc, borne: "22" });
  }
  const cables: Cable[] = [];
  for (const nodo of nodos) {
    for (let i = 1; i < nodo.length; i++) {
      cables.push({ id: `w${cables.length + 1}`, desde: { tipo: "borne", ...nodo[i - 1]! }, hasta: { tipo: "borne", ...nodo[i]! }, codos: [] });
    }
  }
  const tope = r() < 0.2 ? entero(0, 4) : undefined;
  return { hoja: { nombre: `Azar ${n}`, componentes, cables }, pulsadores, ...(tope === undefined ? {} : { tope }) };
}

function foto(s: Simulacion) {
  return {
    pulsados: [...s.pulsados].sort(),
    tension: [...s.tension],
    conducen: [...s.conducen],
    encendidas: [...s.encendidas],
    potencialDeRed: [...s.potencialDeRed],
    detenida: s.detenida,
    avisos: [...s.avisos],
    nuevos: [...s.nuevos],
  };
}

describe("motor contra el cálculo lento, al azar, con polos (T34)", () => {
  it(`${CIRCUITOS} circuitos con trifásica y principales, semilla ${SEMILLA_POLOS}: el mismo resultado en cada paso, y cubre cada caso`, () => {
    const r = azar(SEMILLA_POLOS);
    const casos = { estable: 0, encendida: 0, carrera: 0, serie: 0, oscila: 0, tope: 0, corto: 0, polosCerrados: 0, cortoEntreFases: 0 };
    for (let n = 0; n < CIRCUITOS; n++) {
      const { hoja, pulsadores, tope } = generar(r, n, true);
      const netlist = armarNetlist(hoja);
      const principales = netlist.contactos.flatMap((c, i) => (hoja.componentes.find((k) => k.id === c.comp)!.tipo === "contactor.principal" ? [i] : []));
      let s = iniciar(netlist, tope === undefined ? {} : { tope });
      const lenta = new SimulacionLenta(netlist, tope);
      expect(foto(s), `circuito ${n}, al entrar`).toEqual(lenta.foto());
      for (let a = 0; a < ACCIONES; a++) {
        const cuales = pulsadores.filter(() => r() < 0.5);
        if (r() < 0.6) {
          s = pulsar(s, ...cuales);
          lenta.pulsar(...cuales);
        } else {
          s = soltar(s, ...cuales);
          lenta.soltar(...cuales);
        }
        expect(foto(s), `circuito ${n}, acción ${a}`).toEqual(lenta.foto());
        if (s.encendidas.some((x) => x)) casos.encendida++;
        if (!s.detenida && principales.some((i) => s.conducen[i])) casos.polosCerrados++;
      }
      if (!s.detenida) casos.estable++;
      for (const v of s.avisos) casos[v.tipo]++;
      const d = s.detenida;
      if (d?.tipo === "corto" && d.potenciales.filter((p) => /^L[123]$/.test(netlist.potenciales[p]!.nombre)).length >= 2) casos.cortoEntreFases++;
    }
    for (const [caso, veces] of Object.entries(casos)) expect(veces, `el lote no cubre «${caso}»`).toBeGreaterThan(0);
  });
});

describe("motor contra el cálculo lento, al azar (ajuste 7)", () => {
  it(`${CIRCUITOS} circuitos, semilla ${SEMILLA}: el mismo resultado en cada paso, y cubre cada caso`, () => {
    const r = azar(SEMILLA);
    const casos = { estable: 0, encendida: 0, carrera: 0, serie: 0, oscila: 0, tope: 0, corto: 0 };
    for (let n = 0; n < CIRCUITOS; n++) {
      const { hoja, pulsadores, tope } = generar(r, n);
      const netlist = armarNetlist(hoja);
      let s = iniciar(netlist, tope === undefined ? {} : { tope });
      const lenta = new SimulacionLenta(netlist, tope);
      expect(foto(s), `circuito ${n}, al entrar`).toEqual(lenta.foto());
      for (let a = 0; a < ACCIONES; a++) {
        const cuales = pulsadores.filter(() => r() < 0.5);
        if (r() < 0.6) {
          s = pulsar(s, ...cuales);
          lenta.pulsar(...cuales);
        } else {
          s = soltar(s, ...cuales);
          lenta.soltar(...cuales);
        }
        expect(foto(s), `circuito ${n}, acción ${a}`).toEqual(lenta.foto());
        if (s.encendidas.some((x) => x)) casos.encendida++;
      }
      if (!s.detenida) casos.estable++;
      for (const v of s.avisos) casos[v.tipo]++;
    }
    for (const [caso, veces] of Object.entries(casos)) expect(veces, `el lote no cubre «${caso}»`).toBeGreaterThan(0);
  });
});
