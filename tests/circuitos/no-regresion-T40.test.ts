// No regresión de T40 (ajuste 1 de Bruno): los 38 símbolos de antes de T40
// dan la misma netlist (redes, potenciales, polos, cargas, bobinas) y el mismo
// resultado del motor que en `5aeec6a`. Las instantáneas (una huella por
// circuito) se escribieron con `5aeec6a` y no se regeneran: solo cambian los tipos nuevos,
// que acá no entran. Se mira solo lo que ya existía: los campos que suma T40
// (`bornes`, `valvulas`, `posiciones`) quedan afuera.
//
// Entran el corpus `formato-v1/`, los `.brn` de referencia, un circuito con
// contactos y cargas en serie y 150 circuitos al azar (semilla 405) con los 38
// tipos, cada uno con pulsar y soltar de cada pulsador; además, los tres lotes
// de `motor-azar.test.ts` (semillas 30, 34 y 36), con sus mismas acciones.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deserializar } from "../../src/core/io";
import type { Cable, Componente, Documento, Hoja } from "../../src/core/model/documento";
import { buscarSimbolo } from "../../src/core/symbols";
import { enclavados, iniciar, pulsables, pulsar, soltar, type Simulacion } from "../../src/core/sim/motor";
import { armarNetlist, type Netlist } from "../../src/core/sim/netlist";
import { azar, generar as generarLote } from "../../src/core/sim/prueba-azar";
import { desempaquetar } from "../../src/ui/brn";

/** Los 38 tipos de `5aeec6a`, escritos a mano: los de T40 no entran. */
const TIPOS_38: readonly string[] = [
  "fuente.fase", "fuente.neutro", "pulsador.na", "pulsador.nc", "contactor.bobina", "contactor.auxiliar_na",
  "contactor.auxiliar_nc", "senalizacion.lampara", "fuente.trifasica", "contactor.principal", "fuente.trifasica_n",
  "fuente.tierra", "proteccion.termomagnetica_unipolar", "proteccion.termomagnetica_bipolar",
  "proteccion.termomagnetica_tripolar", "proteccion.termomagnetica_tetrapolar", "proteccion.diferencial_bipolar",
  "proteccion.diferencial_tetrapolar", "proteccion.guardamotor", "maniobra.seccionador", "proteccion.fusible_tripolar",
  "proteccion.termico", "motor.trifasico", "motor.estrella_triangulo", "mando.selector", "mando.seta", "mando.final_na",
  "mando.final_nc", "termico.contacto_nc", "termico.contacto_na", "proteccion.fusible", "senalizacion.bocina",
  "fuente.continua", "fuente.variable", "fuente.conmutada", "transformador.monofasico", "transformador.trifasico",
  "transformador.variac",
];

const CORPUS = new URL("./formato-v1/", import.meta.url);
const AQUI = new URL("./", import.meta.url);

async function abrir(url: URL): Promise<Documento> {
  const p = await desempaquetar(Uint8Array.from(readFileSync(url) as Uint8Array));
  if (!p.ok) throw new Error(`${url}: ${p.error}`);
  const r = deserializar(p.texto);
  if (!r.ok) throw new Error(`${url}: ${JSON.stringify(r.errores)}`);
  return r.documento;
}

/** La netlist con solo los campos de `5aeec6a`. */
function netlistVieja(n: Netlist) {
  return {
    redes: n.redes.map((r) => ({ bornes: r.bornes.map((b) => `${b.comp}:${b.borne}`), cables: r.cables, potenciales: r.potenciales })),
    potenciales: n.potenciales,
    enCorto: n.enCorto,
    contactos: n.contactos.map((c) => [c.comp, c.polo, c.etiqueta, c.na, c.accionamiento, c.a, c.b]),
    cargas: n.cargas.map((k) => [k.comp, k.etiqueta, k.tipo, k.a, k.b]),
    bobinas: n.bobinas,
  };
}

/** El resultado del motor con solo los campos de `5aeec6a`. */
function fotoVieja(s: Simulacion) {
  return {
    pulsados: [...s.pulsados].sort(),
    tension: s.tension,
    conducen: s.conducen,
    encendidas: s.encendidas,
    potencialDeRed: s.potencialDeRed,
    detenida: s.detenida,
    nuevos: s.nuevos,
  };
}

/** Entra, y pulsa (y suelta, si no es enclavado) cada pulsador en orden; un enclavado se libera al final. */
function correr(h: Hoja) {
  const n = armarNetlist(h);
  let s = iniciar(n);
  const fotos = [fotoVieja(s)];
  const encl = enclavados(n);
  const lista = [...pulsables(n)].sort();
  for (const p of lista) {
    s = pulsar(s, p);
    fotos.push(fotoVieja(s));
    if (!encl.has(p)) {
      s = soltar(s, p);
      fotos.push(fotoVieja(s));
    }
  }
  const quedan = lista.filter((p) => encl.has(p));
  if (quedan.length > 0) {
    s = soltar(s, ...quedan);
    fotos.push(fotoVieja(s));
  }
  return { netlist: netlistVieja(n), fotos, avisos: s.avisos };
}

const ETIQUETAS = ["K1", "K1", "K2", "S1", "S2", "H1", "Q1", "F1", "M1", "G1", "T1", ""];

/** Un circuito al azar con los 38 tipos: L1 y N fijos, de 4 a 12 más, bornes a nodos al azar. */
function generar(r: () => number, i: number): Hoja {
  const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const componentes: Componente[] = [];
  const poner = (tipo: string, etiqueta: string) => {
    componentes.push({ id: `c${componentes.length + 1}`, tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta, params: {} });
  };
  poner("fuente.fase", "L1");
  poner("fuente.neutro", "N");
  const cuantos = 4 + Math.floor(r() * 9);
  for (let k = 0; k < cuantos; k++) {
    const tipo = elegir(TIPOS_38);
    poner(tipo, tipo === "fuente.fase" ? elegir(["L1", "L2", ""]) : tipo === "fuente.neutro" ? "N" : elegir(ETIQUETAS));
  }
  const nodos: { comp: string; borne: string }[][] = Array.from({ length: 3 + Math.floor(r() * 5) }, () => []);
  const libres = nodos.length;
  for (const c of componentes) {
    const def = buscarSimbolo(c.tipo)!;
    for (const b of def.bornes) {
      if (r() >= 0.85) continue;
      // Un borne que da potencial (fuente o salida propia), salvo L1 y N, suele ir a un nodo propio: si
      // no, casi todo es corto en reposo.
      const da = (def.elemento === "fuente" || def.salida?.[b.nombre] !== undefined) && !(c.id === "c1" || c.id === "c2");
      if (da) {
        nodos.push([{ comp: c.id, borne: b.nombre }]);
        continue;
      }
      // Cadenas L1 → contacto → nodo libre → carga → N: el primer borne de un contacto suele ir a L1 y el
      // último de una bobina o carga, a N.
      const j = def.bornes.indexOf(b);
      const contacto = def.elemento === "contacto_na" || def.elemento === "contacto_nc" || def.elemento === "proteccion";
      const carga = def.elemento === "bobina" || def.elemento === "carga";
      const fijo =
        (c.tipo === "fuente.fase" && c.etiqueta === "L1") || (contacto && j === 0 && r() < 0.5) ? 0 : c.tipo === "fuente.neutro" || (carga && j === def.bornes.length - 1) ? 1 : -1;
      // Fuera de L1 y N, los nodos 0 y 1 salen poco: si no, casi todo es corto en reposo.
      const x = r();
      const otro = x < 0.15 ? nodos[Math.floor(r() * 2)]! : x < 0.25 ? elegir(nodos) : nodos[2 + Math.floor(r() * (libres - 2))]!;
      (fijo >= 0 && r() < 0.8 ? nodos[fijo]! : otro).push({ comp: c.id, borne: b.nombre });
    }
  }
  const cables: Cable[] = [];
  for (const nodo of nodos) {
    for (let k = 1; k < nodo.length; k++) {
      cables.push({ id: `w${cables.length + 1}`, desde: { tipo: "borne", ...nodo[k - 1]! }, hasta: { tipo: "borne", ...nodo[k]! }, codos: [] });
    }
  }
  return { nombre: `Azar ${i}`, componentes, cables };
}

/** L1 → S1 (NA) → H1 → H2 → N, y K1 por un NA de S2 con su auxiliar NC en serie con la bocina: cargas en serie. */
function enSerie(): Hoja {
  const c = (id: string, tipo: string, etiqueta: string): Componente => ({ id, tipo, x: 0, y: 0, rot: 0, espejado: false, etiqueta, params: {} });
  const w = (id: string, a: [string, string], b: [string, string]): Cable => ({ id, desde: { tipo: "borne", comp: a[0], borne: a[1] }, hasta: { tipo: "borne", comp: b[0], borne: b[1] }, codos: [] });
  return {
    nombre: "En serie",
    componentes: [
      c("f", "fuente.fase", "L1"), c("n", "fuente.neutro", "N"), c("s1", "pulsador.na", "S1"), c("h1", "senalizacion.lampara", "H1"),
      c("h2", "senalizacion.lampara", "H2"), c("s2", "pulsador.na", "S2"), c("k1", "contactor.bobina", "K1"),
      c("nc", "contactor.auxiliar_nc", "K1"), c("hb", "senalizacion.bocina", "H3"), c("q", "proteccion.fusible", "F1"),
    ],
    cables: [
      w("w1", ["f", "L"], ["s1", "13"]), w("w2", ["s1", "14"], ["h1", "X1"]), w("w3", ["h1", "X2"], ["h2", "X1"]), w("w4", ["h2", "X2"], ["n", "N"]),
      w("w5", ["f", "L"], ["s2", "13"]), w("w6", ["s2", "14"], ["k1", "A1"]), w("w7", ["k1", "A2"], ["n", "N"]),
      w("w8", ["f", "L"], ["nc", "21"]), w("w9", ["nc", "22"], ["hb", "X1"]), w("w10", ["hb", "X2"], ["q", "1"]), w("w11", ["q", "2"], ["h2", "X1"]),
    ],
  };
}

/** Un lote de `motor-azar.test.ts`, con las mismas acciones al azar: 200 circuitos, 10 acciones. */
function lote(semilla: number, conPolos: boolean, conMando: boolean) {
  const r = azar(semilla);
  const salida = [];
  for (let n = 0; n < 200; n++) {
    const { hoja, pulsadores, tope } = generarLote(r, n, conPolos, conMando);
    const netlist = armarNetlist(hoja);
    let s = iniciar(netlist, tope === undefined ? {} : { tope });
    const fotos = [fotoVieja(s)];
    for (let a = 0; a < 10; a++) {
      const cuales = pulsadores.filter(() => r() < 0.5);
      s = r() < 0.6 ? pulsar(s, ...cuales) : soltar(s, ...cuales);
      fotos.push(fotoVieja(s));
    }
    salida.push({ netlist: netlistVieja(netlist), fotos, avisos: s.avisos });
  }
  return salida;
}

/** FNV-1a de 32 bits con la base `h`: dos seguidos dan 64 bits, de sobra para notar una diferencia. */
function fnv(texto: string, h: number): string {
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/**
 * Una línea por circuito con la huella de su resultado (netlist y fotos): la
 * instantánea queda chica y una diferencia dice qué circuito cambió (para
 * verlo entero, correr el mismo circuito en `5aeec6a`).
 */
function lineas(xs: readonly unknown[]): string {
  return xs
    .map((x, i) => {
      const t = JSON.stringify(x);
      return `${i} ${fnv(t, 0x811c9dc5)}${fnv(t, 0x050c5d1f)}\n`;
    })
    .join("");
}

describe("no regresión de T40: los 38 símbolos de antes, como en 5aeec6a", () => {
  it("corpus y .brn de referencia", async () => {
    const nombres = [
      ...(readdirSync(CORPUS) as string[]).sort().map((n) => [`formato-v1/${n}`, new URL(n, CORPUS)] as const),
      ...(readdirSync(AQUI) as string[]).filter((n) => n.endsWith(".brn")).sort().map((n) => [n, new URL(n, AQUI)] as const),
    ];
    const salida: string[] = [];
    for (const [nombre, url] of nombres) {
      const doc = await abrir(url);
      salida.push(`${nombre}\n${lineas(doc.hojas.map((h) => correr(h)))}`);
    }
    await expect(salida.join("")).toMatchFileSnapshot("./__snapshots__/no-regresion-T40-corpus.txt");
  });

  it("contactos y cargas en serie, y 150 circuitos al azar con los 38 tipos (semilla 405)", async () => {
    const r = azar(405);
    const salida = [correr(enSerie()), ...Array.from({ length: 150 }, (_, i) => correr(generar(r, i)))];
    expect(salida[0]!.avisos.some((a) => a.tipo === "serie")).toBe(true);
    await expect(lineas(salida)).toMatchFileSnapshot("./__snapshots__/no-regresion-T40-azar.txt");
  });

  it.each([
    [30, false, false],
    [34, true, false],
    [36, true, true],
  ])("lote de motor-azar con semilla %i", async (semilla, conPolos, conMando) => {
    await expect(lineas(lote(semilla, conPolos, conMando))).toMatchFileSnapshot(`./__snapshots__/no-regresion-T40-lote${semilla}.txt`);
  });
});

// Ajuste 3 de Bruno: `diferencial()` suma el 3P sin N; el 2P y el 4P de antes dibujan igual (mismas
// primitivas en reposo y accionado, mismos bornes, polos y caja), con la instantánea de `5aeec6a`.
describe("no regresión de T40: diferenciales 2P y 4P", () => {
  it.each(["proteccion.diferencial_bipolar", "proteccion.diferencial_tetrapolar"])("%s", async (tipo) => {
    const d = buscarSimbolo(tipo)!;
    const dibujo = { tamano: d.tamano, primitivas: d.primitivas, primitivasAccionado: d.primitivasAccionado, bornes: d.bornes, polos: d.polos, ladoNombresBornes: d.ladoNombresBornes, prefijoEtiqueta: d.prefijoEtiqueta };
    await expect(`${JSON.stringify(dibujo, null, 1)}\n`).toMatchFileSnapshot(`./__snapshots__/no-regresion-T40-${tipo}.json`);
  });
});
