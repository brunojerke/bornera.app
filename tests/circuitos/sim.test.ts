// Los archivos congelados de la simulación (T30, M4-A) abren igual que sus
// armados y simulan con el criterio de docs/plan-T30.md. Si falla porque un
// armado cambió a propósito, se regeneran con el comando del mensaje y se
// commitean. Ver sim.mjs.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARMADOS_SIM, BOBINAS_CADENA, CIRCUITOS_SIM, type NombreCircuitoSim } from "../../src/core/circuitos/sim";
import { deserializar, serializar } from "../../src/core/io";
import { validarHoja } from "../../src/core/model/cables";
import { validar } from "../../src/core/model/validaciones";
import { entrarSimulacion, pulsar, soltar, textoAvisoSim, type Simulacion } from "../../src/core/sim/motor";
import { desempaquetar } from "../../src/ui/brn";
import { SesionSimulacion } from "../../src/editor/simulacion";

// Lo mismo que exporta sim.mjs: importarlo traería sus módulos de Node al chequeo de tipos.
const REGENERAR = "node tests/circuitos/sim.mjs";

async function abrir(nombre: NombreCircuitoSim) {
  const ruta = new URL(`./${nombre}.brn`, import.meta.url);
  if (!existsSync(ruta)) throw new Error(`Falta tests/circuitos/${nombre}.brn. Generalo con: ${REGENERAR}`);
  const bytes = new Uint8Array(readFileSync(ruta));
  const abierto = await desempaquetar(bytes);
  if (!abierto.ok) throw new Error(`${nombre}: no se pudo descomprimir: ${abierto.error}`);
  const r = deserializar(abierto.texto);
  if (!r.ok) throw new Error(`${nombre}: no abre: ${JSON.stringify(r.errores)}`);
  return { bytes, texto: abierto.texto, r };
}

async function entrar(nombre: NombreCircuitoSim): Promise<Simulacion> {
  const { r } = await abrir(nombre);
  const e = entrarSimulacion(r.documento.hojas[0]!);
  if (!e.ok) throw new Error(`${nombre}: no entra: ${JSON.stringify(e.errores)}`);
  return e.sim;
}

const conTension = (s: Simulacion) => s.netlist.bobinas.filter((_, g) => s.tension[g]).map((b) => b.etiqueta);
const textos = (s: Simulacion) => s.nuevos.map(textoAvisoSim);

describe("tests/circuitos: los .brn de la simulación", () => {
  for (const nombre of CIRCUITOS_SIM) {
    it(`${nombre}.brn: gzip, versión 1, abre sin avisos igual que su armado, válido y sin errores`, async () => {
      const { bytes, texto, r } = await abrir(nombre);
      expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
      expect(JSON.parse(texto).version).toBe(1);
      expect(r.avisos).toEqual([]);
      const armado = ARMADOS_SIM[nombre]();
      expect(r.documento, `El armado de ${nombre}() cambió y ${nombre}.brn no. Si es a propósito: \`${REGENERAR}\``).toEqual(armado.doc);
      expect(serializar(armado.doc)).toBe(texto);
      const hoja = r.documento.hojas[0]!;
      expect(validarHoja(hoja)).toEqual([]);
      expect(validar(hoja).filter((a) => a.severidad === "error")).toEqual([]);
    });
  }

  it("oscilante.brn: se detiene al entrar con «Oscila: K1»", async () => {
    const s = await entrar("oscilante");
    expect([s.detenida?.tipo, textos(s)]).toEqual(["oscila", ["Oscila: K1"]]);
  });

  it("corto.brn: H1 prendida; al pulsar S1, «Cortocircuito entre L y N» y se detiene", async () => {
    const { comp } = ARMADOS_SIM.corto();
    let s = await entrar("corto");
    expect([s.detenida, s.encendidas.some((x) => x)]).toEqual([null, true]);
    s = pulsar(s, comp["s1"]!);
    expect([s.detenida?.tipo, textos(s)]).toEqual(["corto", ["Cortocircuito entre L y N"]]);
  });

  it("carrera.brn: al pulsar S1, «Carrera entre K1 y K2» y queda K1", async () => {
    const { comp } = ARMADOS_SIM.carrera();
    const s = pulsar(await entrar("carrera"), comp["s1"]!);
    expect([conTension(s), textos(s), s.detenida]).toEqual([["K1"], ["Carrera entre K1 y K2"], null]);
  });

  it(`cadena.brn: S1 mueve K1 a K${BOBINAS_CADENA} y al soltar caen todas`, async () => {
    const { comp } = ARMADOS_SIM.cadena();
    let s = pulsar(await entrar("cadena"), comp["s1"]!);
    expect(conTension(s)).toEqual(Array.from({ length: BOBINAS_CADENA }, (_, i) => `K${i + 1}`));
    s = soltar(s, comp["s1"]!);
    expect([conTension(s), s.avisos]).toEqual([[], []]);
  });
});

// «Pasa cuando» de la fase 5 (T32, paso 7): el núcleo pulsa y suelta sobre los
// `.brn` de referencia, por la sesión que usa F5, y mira bobinas y lámparas.
// El documento queda igual: serializar da el mismo texto que el archivo.
describe("tests/circuitos: marcha-parada.brn e inversion.brn en Simular", () => {
  async function abrirReferencia(nombre: "marcha-parada" | "inversion") {
    const bytes = new Uint8Array(readFileSync(new URL(`./${nombre}.brn`, import.meta.url)));
    const abierto = await desempaquetar(bytes);
    if (!abierto.ok) throw new Error(`${nombre}: no se pudo descomprimir: ${abierto.error}`);
    const r = deserializar(abierto.texto);
    if (!r.ok) throw new Error(`${nombre}: no abre: ${JSON.stringify(r.errores)}`);
    const hoja = r.documento.hojas[0]!;
    const e = SesionSimulacion.entrar(hoja);
    if (!e.ok) throw new Error(`${nombre}: no entra: ${JSON.stringify(e.errores)}`);
    /** El id del componente de esa etiqueta y ese tipo. */
    const id = (etiqueta: string, tipo: string) => {
      const c = hoja.componentes.find((x) => x.etiqueta === etiqueta && x.tipo === tipo);
      if (!c) throw new Error(`${nombre}: sin ${tipo} ${etiqueta}`);
      return c.id;
    };
    const s = e.sesion;
    const prendida = (etiqueta: string) => s.sim.encendidas[s.sim.netlist.cargas.findIndex((c) => c.comp === id(etiqueta, "senalizacion.lampara"))]!;
    const pulsarYSoltar = (etiqueta: string, tipo: string) => {
      s.presionar(id(etiqueta, tipo), false);
      s.soltarBoton();
    };
    return { doc: r.documento, texto: abierto.texto, s, id, prendida, pulsarYSoltar };
  }

  it("marcha-parada.brn: con S1 entran K1 y H1 y siguen al soltar; con S0 se apagan y siguen así", async () => {
    const { doc, texto, s, id, prendida, pulsarYSoltar } = await abrirReferencia("marcha-parada");
    expect([conTension(s.sim), prendida("H1")]).toEqual([[], false]);
    s.presionar(id("S1", "pulsador.na"), false);
    expect([conTension(s.sim), prendida("H1")]).toEqual([["K1"], true]);
    s.soltarBoton();
    expect([conTension(s.sim), prendida("H1")]).toEqual([["K1"], true]);
    pulsarYSoltar("S0", "pulsador.nc");
    expect([conTension(s.sim), prendida("H1"), s.sim.avisos]).toEqual([[], false, []]);
    expect(serializar(doc)).toBe(texto);
  });

  it("inversion.brn: K1 entra; con K1, K2 no entra; S0 apaga; con S2 entra K2 y K1 no", async () => {
    const { doc, texto, s, prendida, pulsarYSoltar } = await abrirReferencia("inversion");
    pulsarYSoltar("S1", "pulsador.na");
    expect([conTension(s.sim), prendida("H1"), prendida("H2")]).toEqual([["K1"], true, false]);
    pulsarYSoltar("S2", "pulsador.na");
    expect(conTension(s.sim)).toEqual(["K1"]);
    pulsarYSoltar("S0", "pulsador.nc");
    expect([conTension(s.sim), prendida("H1")]).toEqual([[], false]);
    pulsarYSoltar("S2", "pulsador.na");
    expect([conTension(s.sim), prendida("H1"), prendida("H2"), s.sim.avisos]).toEqual([["K2"], false, true, []]);
    expect(serializar(doc)).toBe(texto);
  });
});
