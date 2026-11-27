// Motor contra el cálculo lento (T30, ajuste 7): 200 circuitos chicos al azar,
// con semilla fija, y pulsaciones al azar. Después de entrar y de cada pulsar
// o soltar, los dos tienen que dar lo mismo: bobinas, contactos, cargas,
// potenciales, detención y avisos. Además se exige que el lote cubra cada caso
// (estable con algo prendido, carrera, cargas en serie, oscila, tope y corto).
import { describe, expect, it } from "vitest";
import { buscarSimbolo } from "../symbols";
import { iniciar, pulsar, soltar, type Simulacion } from "./motor";
import { armarNetlist } from "./netlist";
import { azar, generar } from "./prueba-azar";
import { SimulacionLenta } from "./prueba-motor";

const SEMILLA = 30;
/** Lote con polos (T34): trifásica y contactores principales; semilla propia, el de arriba no cambia. */
const SEMILLA_POLOS = 34;
/** Lote con mando y protecciones (T36): los otros dos no cambian. */
const SEMILLA_MANDO = 36;
/** Lote con sensores y electroválvulas (T40), sobre el de T36: los otros tres no cambian. */
const SEMILLA_T40 = 40;
const CIRCUITOS = 200;
const ACCIONES = 10;

function foto(s: Simulacion) {
  return {
    pulsados: [...s.pulsados].sort(),
    tension: [...s.tension],
    conducen: [...s.conducen],
    encendidas: [...s.encendidas],
    posiciones: [...s.posiciones],
    potencialDeRed: [...s.potencialDeRed],
    detenida: s.detenida,
    avisos: [...s.avisos],
    nuevos: [...s.nuevos],
  };
}

describe("motor contra el cálculo lento, al azar, con sensores y electroválvulas (T40)", () => {
  it(`${CIRCUITOS} circuitos con sensores, presostato, termostato, electroválvulas, motor de continua y diferencial 3P, semilla ${SEMILLA_T40}: el mismo resultado en cada paso, y cubre cada caso`, () => {
    const r = azar(SEMILLA_T40);
    const casos = { estable: 0, encendida: 0, serie: 0, oscila: 0, corto: 0, dos_bobinas: 0, sensorEncendido: 0, sensorAccionado: 0, en14: 0, vuelveA12: 0, monoAccionada: 0, quietaAlDetenerse: 0 };
    for (let n = 0; n < CIRCUITOS; n++) {
      const { hoja, pulsadores, tope } = generar(r, n, false, true, true);
      const netlist = armarNetlist(hoja);
      const tipoDe = (comp: string) => hoja.componentes.find((k) => k.id === comp)!.tipo;
      const sensores = netlist.cargas.flatMap((c, i) => (tipoDe(c.comp).startsWith("sensor.") ? [i] : []));
      const sensoresComp = pulsadores.filter((p) => /^sensor\.(inductivo|capacitivo|fotoelectrico)$/.test(tipoDe(p)));
      let s = iniciar(netlist, tope === undefined ? {} : { tope });
      const lenta = new SimulacionLenta(netlist, tope);
      expect(foto(s), `circuito ${n}, al entrar`).toEqual(lenta.foto());
      for (let a = 0; a < ACCIONES; a++) {
        const antes = s.posiciones;
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
        if (sensores.some((k) => s.encendidas[k])) casos.sensorEncendido++;
        if (sensoresComp.some((p) => s.pulsados.has(p))) casos.sensorAccionado++;
        netlist.valvulas.forEach((v, i) => {
          if (v.biestable && !antes[i] && s.posiciones[i]) casos.en14++;
          if (v.biestable && antes[i] && !s.posiciones[i]) casos.vuelveA12++;
          if (!v.biestable && s.posiciones[i]) casos.monoAccionada++;
          // Detenida, la biestable queda en la última estable (ajuste 2 de Bruno).
          if (v.biestable && s.detenida && s.nuevos.length > 0) {
            expect(s.posiciones[i], `circuito ${n}, acción ${a}: biestable al detenerse`).toBe(antes[i]);
            casos.quietaAlDetenerse++;
          }
        });
      }
      if (!s.detenida) casos.estable++;
      for (const v of s.avisos) if (v.tipo in casos) casos[v.tipo as keyof typeof casos]++;
    }
    for (const [caso, veces] of Object.entries(casos)) expect(veces, `el lote no cubre «${caso}»`).toBeGreaterThan(0);
  });
});

describe("motor contra el cálculo lento, al azar, con mando y protecciones (T36)", () => {
  it(`${CIRCUITOS} circuitos con enclavados, protecciones, térmico y bocina, semilla ${SEMILLA_MANDO}: el mismo resultado en cada paso, y cubre cada caso`, () => {
    const r = azar(SEMILLA_MANDO);
    const casos = { estable: 0, encendida: 0, carrera: 0, serie: 0, oscila: 0, tope: 0, corto: 0, proteccionConTension: 0, enclavadoAccionado: 0, bocinaEncendida: 0, termicoNA: 0 };
    for (let n = 0; n < CIRCUITOS; n++) {
      const { hoja, pulsadores, tope } = generar(r, n, true, true);
      const netlist = armarNetlist(hoja);
      const tipoDe = (comp: string) => hoja.componentes.find((k) => k.id === comp)!.tipo;
      const protecciones = netlist.contactos.flatMap((c, i) => (c.accionamiento === null ? [i] : []));
      const bocinas = netlist.cargas.flatMap((c, i) => (tipoDe(c.comp) === "senalizacion.bocina" ? [i] : []));
      const enclavados = pulsadores.filter((p) => buscarSimbolo(tipoDe(p))!.accionamiento === "manual_enclavado");
      let s = iniciar(netlist, tope === undefined ? {} : { tope });
      const lenta = new SimulacionLenta(netlist, tope);
      expect(foto(s), `circuito ${n}, al entrar`).toEqual(lenta.foto());
      // Las protecciones conducen siempre; 97-98 no conduce nunca (F no dispara en T36).
      for (const i of protecciones) expect(s.conducen[i], `circuito ${n}, protección`).toBe(true);
      for (const [i, c] of netlist.contactos.entries()) if (c.accionamiento === "termico") expect(s.conducen[i], `circuito ${n}, térmico`).toBe(!c.na);
      if (netlist.contactos.some((c) => c.accionamiento === "termico" && c.na)) casos.termicoNA++;
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
        if (bocinas.some((k) => s.encendidas[k])) casos.bocinaEncendida++;
        if (enclavados.some((p) => s.pulsados.has(p))) casos.enclavadoAccionado++;
        if (!s.detenida && protecciones.some((i) => s.potencialDeRed[netlist.contactos[i]!.a] !== null)) casos.proteccionConTension++;
      }
      if (!s.detenida) casos.estable++;
      for (const v of s.avisos) if (v.tipo !== "dos_bobinas") casos[v.tipo]++;
    }
    for (const [caso, veces] of Object.entries(casos)) expect(veces, `el lote no cubre «${caso}»`).toBeGreaterThan(0);
  });
});

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
      for (const v of s.avisos) if (v.tipo !== "dos_bobinas") casos[v.tipo]++;
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
      for (const v of s.avisos) if (v.tipo !== "dos_bobinas") casos[v.tipo]++;
    }
    for (const [caso, veces] of Object.entries(casos)) expect(veces, `el lote no cubre «${caso}»`).toBeGreaterThan(0);
  });
});
