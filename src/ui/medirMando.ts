// S1, S2, S3 y S5 de «Probar la fase 5» (T31; docs/plan-T31.md): miden en la
// app real, cada una en su propio Editor y su propio lienzo fuera de
// pantalla. No tocan la hoja del usuario ni su editor. Cada S hace una vuelta
// de calentamiento sin medir y después las de `VUELTAS_S`.
//
// - S1 (completa desde T33): entrar a Simular sobre la escena de mando 2000
//   por la misma entrada que F5, `Editor.entrarSimulacion` (T32, S-A), con el
//   dibujo del estado (D8-A, I-A: el Editor invalida la escena entera sobre
//   estas capas), hasta el cuadro nítido al 31 %. Se toma cada parte por
//   separado (N-A: la netlist sola informa); «iniciar» incluye armar el
//   dibujo del estado. Cada vuelta sale de Simular y vuelve a nítido sin medir.
// - S4 (T33, S4-B): con dibujo al 31 % y la cámara centrada en la marcha de
//   S2, cada gesto (pulsar la marcha, soltarla) desde el clic hasta el cuadro
//   nítido, en cuadros seguidos sin esperar al navegador (como S1): el máximo
//   de cuadro y el del gesto (motor + dibujo + cuadros). La parada vuelve a
//   reposo sin medir. La cadena de 100 relés se mide igual, centrada en ella,
//   y solo informa.
// - S2: pulsar y soltar la marcha de una marcha-parada; la parada la vuelve
//   a reposo sin medir.
// - S3: pulsar el pulsador de la cadena hasta que entran los 100; soltarlo
//   no se mide.
// - S5 (S5-A): abrir la escena de F1–F3 (2000 + 3030 cables) en un Editor y
//   esperar a que termine R11 en reposo; decide `msTrabajoR11` (la suma de
//   los tramos), y el tiempo de pared informa.

import type { Documento } from "../core/model/documento";
import { entrarSimulacion, pulsar, soltar, type Simulacion } from "../core/sim/motor";
import { bancoMando, type BancoMando } from "../editor/bancoMando";
import { Editor, type DestinoVista } from "../editor/editor";
import { Camara, unirCajas, type Caja } from "../render/camara";
import { Capas } from "../render/capas";
import { VUELTAS_S, type MuestraS1, type MuestraS4, type MuestraS5, type MuestrasS } from "./fase5";

/** El zoom de los textos (6,2 px por unidad), el de las filas «al 31 %». */
const ZOOM_31 = 0.31;
/** Cuadros como máximo hasta quedar nítido (si no, la prueba falla). */
const CUADROS_MAX = 500;

const respirar = () => new Promise((r) => setTimeout(r, 0));

/** Espera a que termine R11 en reposo (los tramos corren con `setTimeout`). */
async function esperarR11(ed: Editor): Promise<void> {
  while (ed.avisos.enReposoR11) await respirar();
}

/**
 * Un lienzo fuera de pantalla con las capas de `ed`, al 31 % y centrado en
 * `centro` (por defecto, la escena entera). El Editor invalida sobre estas
 * capas (T33): lo que dibuja F5 o un pulsar llega igual que a la Vista.
 */
function lienzoAl31(ed: Editor, ancho: number, alto: number, centro: Caja | null = ed.escena.caja) {
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Sin Canvas 2D.");
  const capas = new Capas(ctx);
  capas.contenido = ed.escena;
  const camara = new Camara();
  if (!centro) throw new Error("La escena de mando está vacía.");
  camara.zoom = ZOOM_31;
  camara.centrar(centro.x + centro.ancho / 2, centro.y + centro.alto / 2, ancho, alto);
  const vista: DestinoVista = {
    invalidarRegion: (k) => void capas.invalidarRegion(k),
    invalidar: () => {},
    invalidarEstado: (cajas) => {
      capas.descartarOtrosNiveles();
      for (const k of cajas) capas.invalidarRegion(k);
    },
  };
  ed.vista = vista;
  /** Cuadros seguidos hasta nítido: el más largo (con el rasterizado forzado, como el banco) y cuántos. */
  const hastaNitido = (que: string): { maximo: number; cuadros: number } => {
    let maximo = 0;
    for (let cuadros = 1; ; cuadros++) {
      const t = performance.now();
      const m = capas.dibujar(camara, ancho, alto, 1);
      ctx.getImageData(0, 0, 1, 1); // fuerza el rasterizado, como el banco
      maximo = Math.max(maximo, performance.now() - t);
      if (!m.pendiente) return { maximo, cuadros };
      if (cuadros >= CUADROS_MAX) throw new Error(`${que}: no quedó nítido en ${CUADROS_MAX} cuadros.`);
    }
  };
  return { capas, camara, hastaNitido };
}

/** Entra a Simular por F5 (`Editor.entrarSimulacion`, S-A), con el tiempo de cada parte: inicio, R4, netlist y fin. */
function entrarMedido(ed: Editor, marcas: number[]): void {
  ed.salirSimulacion();
  marcas.push(performance.now());
  const errores = ed.entrarSimulacion(() => marcas.push(performance.now()));
  marcas.push(performance.now());
  if (errores) throw new Error(`La escena de mando no entra a Simular: ${errores.map((a) => a.regla).join(", ")}.`);
}

/** Una simulación de la escena para S2 y S3 (sin medir la entrada). */
function simulacionDe(hoja: Documento["hojas"][number]): Simulacion {
  const e = entrarSimulacion(hoja);
  if (!e.ok) throw new Error(`La escena de mando no entra a Simular: ${e.errores.map((a) => a.regla).join(", ")}.`);
  return e.sim;
}

/** S1, con su vuelta de calentamiento. */
async function medirS1(banco: BancoMando, ancho: number, alto: number): Promise<MuestraS1[]> {
  const ed = new Editor(banco.doc);
  await esperarR11(ed);
  const { hastaNitido } = lienzoAl31(ed, ancho, alto);
  hastaNitido("S1 (Editar)");
  const muestras: MuestraS1[] = [];
  for (let i = 0; i <= VUELTAS_S.S1; i++) {
    await respirar();
    const marcas: number[] = [];
    entrarMedido(ed, marcas);
    const { cuadros } = hastaNitido("S1");
    const fin = performance.now();
    const [t0, t1, t2, t3] = marcas as [number, number, number, number];
    if (i > 0) muestras.push({ r4: t1 - t0, netlist: t2 - t1, iniciar: t3 - t2, cuadro: fin - t3, total: fin - t0, cuadros });
    // De vuelta a Editar, sin medir: la vuelta siguiente parte del mismo dibujo.
    ed.salirSimulacion();
    hastaNitido("S1 (salir)");
  }
  return muestras;
}

/** Caja que rodea las bobinas con esas etiquetas (para centrar la cámara en la cadena). */
function cajaBobinas(ed: Editor, etiquetas: readonly string[]): Caja {
  const quedan = new Set(etiquetas);
  let caja: Caja | null = null;
  for (const c of ed.documento.hojas[0]!.componentes) {
    if (c.tipo !== "contactor.bobina" || !quedan.has(c.etiqueta)) continue;
    const k = { x: c.x, y: c.y, ancho: 0, alto: 0 };
    caja = caja ? unirCajas(caja, k) : k;
  }
  if (!caja) throw new Error("S4: la cadena no tiene bobinas.");
  return caja;
}

/**
 * Gestos de S4 (S4-B) sobre una sesión ya en Simular: cada uno desde el clic
 * hasta nítido, con el máximo de cuadro. `gestos` hace los de una vuelta
 * (los medidos) y `reposo` la deja como al empezar, sin medir.
 */
async function medirGestos(
  hastaNitido: (que: string) => { maximo: number; cuadros: number },
  vueltas: number,
  gestos: readonly (() => boolean)[],
  reposo: () => void,
  que: string,
): Promise<MuestraS4[]> {
  const muestras: MuestraS4[] = [];
  for (let i = 0; i <= vueltas; i++) {
    await respirar();
    for (const g of gestos) {
      const t0 = performance.now();
      if (!g()) throw new Error(`${que}: un gesto no cambió nada.`);
      const { maximo, cuadros } = hastaNitido(que);
      const gesto = performance.now() - t0;
      if (i > 0) muestras.push({ cuadro: maximo, gesto, cuadros });
    }
    reposo();
    hastaNitido(`${que} (reposo)`);
  }
  return muestras;
}

/** S4 sobre la marcha de S2 y la cadena (informa), cada una con su vuelta de calentamiento. */
async function medirS4(banco: BancoMando, ancho: number, alto: number): Promise<{ s4: MuestraS4[]; cadena: MuestraS4[] }> {
  const m = banco.marchas[0]!;
  const ed = new Editor(banco.doc);
  await esperarR11(ed);
  const p = ed.escena.obtener(m.marcha);
  if (!p) throw new Error("S4: no está la marcha.");
  const marcha = lienzoAl31(ed, ancho, alto, { x: p.x, y: p.y, ancho: 0, alto: 0 });
  marcha.hastaNitido("S4 (Editar)");
  const errores = ed.entrarSimulacion();
  if (errores) throw new Error(`La escena de mando no entra a Simular: ${errores.map((a) => a.regla).join(", ")}.`);
  marcha.hastaNitido("S4 (entrar)");
  const s4 = await medirGestos(
    marcha.hastaNitido,
    VUELTAS_S.S4,
    [() => ed.presionarPulsador(m.marcha), () => ed.soltarSimulacion()],
    () => {
      ed.presionarPulsador(m.parada);
      ed.soltarSimulacion();
    },
    "S4",
  );
  // La cadena (informa): otras capas, centradas en ella, sobre la misma sesión.
  const cad = lienzoAl31(ed, ancho, alto, cajaBobinas(ed, banco.cadena.bobinas));
  cad.hastaNitido("S4 cadena (entrar)");
  const cadena = await medirGestos(cad.hastaNitido, VUELTAS_S.S4Cadena, [() => ed.presionarPulsador(banco.cadena.pulsador), () => ed.soltarSimulacion()], () => {}, "S4 cadena");
  ed.salirSimulacion();
  return { s4, cadena };
}

/** S2 y S3, sobre una simulación de la escena de mando. */
async function medirS2S3(banco: BancoMando): Promise<{ s2: number[]; s3: number[] }> {
  let sim = simulacionDe(banco.doc.hojas[0]!);
  const m = banco.marchas[0]!;
  const s2: number[] = [];
  for (let i = 0; i <= VUELTAS_S.S2; i++) {
    await respirar();
    const t0 = performance.now();
    sim = soltar(pulsar(sim, m.marcha), m.marcha);
    const t1 = performance.now();
    if (!sim.tension[sim.netlist.bobinas.findIndex((b) => b.etiqueta === m.bobina)]) throw new Error(`S2: la marcha no arrancó ${m.bobina}.`);
    sim = soltar(pulsar(sim, m.parada), m.parada);
    if (i > 0) s2.push(t1 - t0);
  }
  const s3: number[] = [];
  const p = banco.cadena.pulsador;
  for (let i = 0; i <= VUELTAS_S.S3; i++) {
    await respirar();
    const t0 = performance.now();
    sim = pulsar(sim, p);
    const t1 = performance.now();
    const entraron = sim.tension.filter(Boolean).length;
    if (entraron !== banco.cadena.bobinas.length) throw new Error(`S3: entraron ${entraron} de ${banco.cadena.bobinas.length}.`);
    sim = soltar(sim, p);
    if (i > 0) s3.push(t1 - t0);
  }
  return { s2, s3 };
}

/** S5 sobre `doc` (la escena de F1–F3), con su vuelta de calentamiento. */
async function medirS5(doc: Documento): Promise<MuestraS5[]> {
  const muestras: MuestraS5[] = [];
  for (let i = 0; i <= VUELTAS_S.S5; i++) {
    await respirar();
    const ed = new Editor(doc);
    const t0 = performance.now();
    await esperarR11(ed);
    const pared = performance.now() - t0;
    const avisos = ed.avisos.lista().filter((a) => a.regla === "R11").length;
    if (i > 0) muestras.push({ trabajo: ed.avisos.msTrabajoR11, pared, tramos: ed.avisos.tramosR11, avisos });
  }
  return muestras;
}

/**
 * S1, S2, S3 y S5. `docF` es la escena de F1–F3 (2000 + 3030 cables) para
 * S5. Devuelve las muestras y el tamaño de la escena de mando.
 */
export async function medirMando(
  docF: Documento,
  ancho: number,
  alto: number,
  progreso: (paso: string) => void = () => {},
): Promise<{ muestras: MuestrasS; escena: { componentes: number; cables: number; bobinas: number } }> {
  progreso("armando la escena de mando 2000");
  await respirar();
  const banco = bancoMando();
  const hoja = banco.doc.hojas[0]!;
  const escena = {
    componentes: hoja.componentes.length,
    cables: hoja.cables.length,
    bobinas: hoja.componentes.filter((c) => c.tipo === "contactor.bobina").length,
  };
  progreso("S1: entrar a Simular");
  const s1 = await medirS1(banco, ancho, alto);
  progreso("S2 y S3: pulsar y soltar");
  const { s2, s3 } = await medirS2S3(banco);
  progreso("S4: pulsar con dibujo");
  const { s4, cadena } = await medirS4(banco, ancho, alto);
  progreso("S5: R11 en la hoja entera");
  const s5 = await medirS5(docF);
  return { muestras: { s1, s2, s3, s4, s4Cadena: cadena, s5 }, escena };
}
