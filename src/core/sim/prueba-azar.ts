// Circuitos chicos al azar para los tests del motor (T30, ajuste 7; T34, T36),
// compartidos por src/core/sim/motor-azar.test.ts y
// tests/circuitos/no-regresion-T40.test.ts. Solo los importan los tests: el
// código de la app no los usa.
import type { Cable, Componente, Hoja } from "../model/documento";
import { buscarSimbolo, polosDe } from "../symbols";

/** mulberry32: determinista y sin dependencias. */
export function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Armado {
  hoja: Hoja;
  pulsadores: string[];
  tope?: number;
}

export function generar(r: () => number, n: number, conPolos = false, conMando = false, conT40 = false): Armado {
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
  // Solo en el lote de T36: enclavados y finales (se pulsan), protecciones que conducen siempre,
  // el térmico con 95-96 y 97-98 (a veces sin su F) y la bocina.
  if (conMando) {
    for (let i = entero(1, 2); i > 0; i--) pulsadores.push(poner(elegir(["mando.selector", "mando.seta", "mando.final_na", "mando.final_nc"]), `S${10 + i}`));
    const protecciones = ["proteccion.fusible", "proteccion.termomagnetica_unipolar", "proteccion.termomagnetica_tripolar", "maniobra.seccionador", "proteccion.diferencial_bipolar", "proteccion.guardamotor"];
    for (let i = entero(1, 3); i > 0; i--) poner(elegir(protecciones), `Q${i}`);
    if (r() < 0.7) poner("proteccion.termico", "F2");
    for (let i = entero(0, 2); i > 0; i--) poner(elegir(["termico.contacto_nc", "termico.contacto_na"]), r() < 0.8 ? "F2" : "F3");
    if (r() < 0.6) poner("senalizacion.bocina", "H9");
  }
  // Solo en el lote de T40: sensores (enclavados con su carga BN-BU), presostato y termostato (se
  // pulsan), electroválvulas (a veces sin etiqueta), el motor de continua y el diferencial 3P.
  if (conT40) {
    for (let i = entero(1, 2); i > 0; i--) pulsadores.push(poner(elegir(["sensor.inductivo", "sensor.capacitivo", "sensor.fotoelectrico"]), `B${i}`));
    for (let i = entero(0, 2); i > 0; i--) pulsadores.push(poner(elegir(["sensor.presostato_na", "sensor.presostato_nc", "sensor.termostato_na", "sensor.termostato_nc"]), `B${10 + i}`));
    for (let i = entero(1, 2); i > 0; i--) poner("valvula.biestable", r() < 0.15 ? "" : `Y${i}`);
    if (r() < 0.5) poner("valvula.monoestable", "Y9");
    if (r() < 0.4) poner("motor.continua", "M1");
    if (r() < 0.3) poner("proteccion.diferencial_tripolar", "Q9");
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
  // T36: el segundo borne de cada polo de una protección alimenta un nodo propio, que otros pueden
  // elegir: conduce siempre, y con los dos bornes al azar casi todo sería corto.
  const aguasAbajo = new Map<string, { comp: string; borne: string }[]>();
  if (conMando) {
    for (const c of componentes) {
      const def = buscarSimbolo(c.tipo)!;
      if (def.elemento !== "proteccion") continue;
      for (const [, abajo] of polosDe(def)) {
        const nodo: { comp: string; borne: string }[] = [];
        nodos.push(nodo);
        aguasAbajo.set(`${c.id}|${abajo}`, nodo);
      }
    }
  }
  for (const c of componentes) {
    for (const b of buscarSimbolo(c.tipo)!.bornes) {
      if (r() >= 0.9) continue;
      const propio = aguasAbajo.get(`${c.id}|${b.nombre}`);
      if (propio) {
        propio.push({ comp: c.id, borne: b.nombre });
        continue;
      }
      const deTres = conPolos ? fijoPolos(c, b.nombre) : undefined;
      // T40: B2 de la electroválvula biestable y BU del sensor, al neutro como A2 (solo existen en ese lote).
      const alNeutro = b.nombre === "A2" || b.nombre === "B2" || b.nombre === "BU";
      const fijo = c.tipo === "fuente.fase" && c.etiqueta !== "" ? 0 : c.tipo === "fuente.neutro" || alNeutro ? 1 : -1;
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
  // T36: a veces, bocina → fusible → lámpara entre la fase y el neutro (cargas en serie a través de una
  // protección), que al azar casi no sale.
  if (conMando && r() < 0.25) {
    const hb = poner("senalizacion.bocina", "H8");
    const fu = poner("proteccion.fusible", "F8");
    const hl = poner("senalizacion.lampara", "H7");
    nodos[0]!.push({ comp: hb, borne: "X1" });
    nodos.push([{ comp: hb, borne: "X2" }, { comp: fu, borne: "1" }], [{ comp: fu, borne: "2" }, { comp: hl, borne: "X1" }]);
    nodos[1]!.push({ comp: hl, borne: "X2" });
  }
  // T40: a veces, una biestable con un pulsador a cada bobina (A1 y B1 desde L1), que al azar casi no
  // va de 14 a 12.
  if (conT40 && r() < 0.4) {
    const y = poner("valvula.biestable", "Y7");
    const sa = poner("pulsador.na", "S21");
    const sb = poner("pulsador.na", "S22");
    pulsadores.push(sa, sb);
    nodos[0]!.push({ comp: sa, borne: "13" }, { comp: sb, borne: "13" });
    nodos.push([{ comp: sa, borne: "14" }, { comp: y, borne: "A1" }], [{ comp: sb, borne: "14" }, { comp: y, borne: "B1" }]);
    nodos[1]!.push({ comp: y, borne: "A2" }, { comp: y, borne: "B2" });
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
