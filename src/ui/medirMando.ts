// S1, S2, S3 y S5 de «Probar la fase 5» (T31; docs/plan-T31.md): miden en la
// app real, cada una en su propio Editor y su propio lienzo fuera de
// pantalla. No tocan la hoja del usuario ni su editor. Cada S hace una vuelta
// de calentamiento sin medir y después las de `VUELTAS_S`.
//
// - S1 (S1-A): entrar a Simular sobre la escena de mando 2000 (R4, netlist e
//   iniciar) por la misma entrada que F5, `Editor.entrarSimulacion` (T32,
//   S-A), y un repintado completo de la
//   capa estática al 31 % hasta nítido, como sustituto del dibujo de T33. Se
//   toma cada parte por separado (N-A: la netlist sola informa).
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
import { Editor } from "../editor/editor";
import { Camara } from "../render/camara";
import { Capas } from "../render/capas";
import { VUELTAS_S, type MuestraS1, type MuestraS5, type MuestrasS } from "./fase5";

/** El zoom de los textos (6,2 px por unidad), el de las filas «al 31 %». */
const ZOOM_31 = 0.31;
/** Cuadros como máximo hasta quedar nítido (si no, la prueba falla). */
const CUADROS_MAX = 500;

const respirar = () => new Promise((r) => setTimeout(r, 0));

/** Espera a que termine R11 en reposo (los tramos corren con `setTimeout`). */
async function esperarR11(ed: Editor): Promise<void> {
  while (ed.avisos.enReposoR11) await respirar();
}

/** Un lienzo fuera de pantalla con las capas de `ed`, centrado al 31 %. */
function lienzoAl31(ed: Editor, ancho: number, alto: number) {
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Sin Canvas 2D.");
  const capas = new Capas(ctx);
  capas.contenido = ed.escena;
  const camara = new Camara();
  const caja = ed.escena.caja;
  if (!caja) throw new Error("La escena de mando está vacía.");
  camara.zoom = ZOOM_31;
  camara.centrar(caja.x + caja.ancho / 2, caja.y + caja.alto / 2, ancho, alto);
  return { ctx, capas, camara };
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
  const { ctx, capas, camara } = lienzoAl31(ed, ancho, alto);
  capas.dibujar(camara, ancho, alto, 1);
  const muestras: MuestraS1[] = [];
  for (let i = 0; i <= VUELTAS_S.S1; i++) {
    await respirar();
    const marcas: number[] = [];
    entrarMedido(ed, marcas);
    capas.invalidarEstatica();
    let cuadros = 0;
    for (;;) {
      const m = capas.dibujar(camara, ancho, alto, 1);
      ctx.getImageData(0, 0, 1, 1); // fuerza el rasterizado, como el banco
      cuadros++;
      if (!m.pendiente) break;
      if (cuadros >= CUADROS_MAX) throw new Error(`S1: no quedó nítido en ${CUADROS_MAX} cuadros.`);
    }
    const fin = performance.now();
    const [t0, t1, t2, t3] = marcas as [number, number, number, number];
    if (i > 0) muestras.push({ r4: t1 - t0, netlist: t2 - t1, iniciar: t3 - t2, cuadro: fin - t3, total: fin - t0, cuadros });
  }
  return muestras;
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
  progreso("S5: R11 en la hoja entera");
  const s5 = await medirS5(docF);
  return { muestras: { s1, s2, s3, s5 }, escena };
}
