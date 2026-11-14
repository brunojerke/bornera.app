// Ctrl+D contra el ancho de la lista de referencias (T18, ajuste 1, primer
// paso de la etapa 2): duplicar la rama de K1 de la marcha-parada no deja la
// lista de K1 sobre la copia, ni la de K2 sobre la rama de K1. Se prueba con
// la marcha-parada y con la rama NC (`ramaNC`), la rama más ancha: ahí la
// lista de K1 tampoco toca su propio NC, su H2 ni los cables de esa rama.
//
// La caja de la lista es la real del dibujo (`cajaReferencias`, con el ancho
// promedio por exceso) y las líneas son las del caché del editor, las mismas
// que van a la escena. Al final, el peor caso de ancho: una fila con
// coordenadas largas y negativas, que no se garantiza (límite conocido,
// docs/plan-T18.md).
//
// Los obstáculos son la `cajaDibujo` de cada componente (la cota que nunca se
// queda corta: cuerpo, nombres de bornes y etiqueta con la letra más ancha) y
// cada tramo de cable con medio grosor de trazo. Se excluye solo la bobina
// dueña de la lista: lo suyo (etiqueta, nombres de bornes) es S4, del dibujo.

import { describe, expect, it } from "vitest";
import { marchaParada, type MarchaParada } from "../core/circuitos/marchaParada";
import { indexarHoja, recorridoCable, validarHoja } from "../core/model/cables";
import type { Componente, Hoja } from "../core/model/documento";
import { referenciasCruzadas, textoFila } from "../core/model/referencias";
import { buscarSimbolo } from "../core/symbols";
import type { Caja } from "../render/camara";
import { ALTO_BORNE, anchoTexto, cajaDibujo, cajaEtiqueta, cajaReferencias } from "../render/simbolo";
import { Editor, type DestinoVista } from "./editor";

class VistaFalsa implements DestinoVista {
  invalidarRegion(): void {}
  invalidar(): void {}
}

/** Medio grosor del trazo de un cable, generoso. */
const MEDIO_TRAZO = 0.1;
/** Por debajo de esta holgura (en unidades) contra cualquier cosa, se frena (decisión de Bruno al aprobar la etapa 2). */
const HOLGURA_MINIMA = 1;

const colocacion = (c: Componente) => ({ x: c.x, y: c.y, rotacion: c.rot, espejado: c.espejado });

/** La caja real de la lista de `bobina` con esas líneas. */
function cajaLista(bobina: Componente, lineas: readonly string[]): Caja {
  const k = cajaReferencias(buscarSimbolo(bobina.tipo)!, colocacion(bobina), lineas);
  if (!k) throw new Error("Sin lista.");
  return k;
}

interface Obstaculo {
  /** Id del componente o del cable. */
  id: string;
  cable: boolean;
  /** Para leer el fallo. */
  que: string;
  caja: Caja;
}

/** Todo lo dibujado de la hoja salvo la bobina `excepto`: componentes (cajaDibujo) y tramos de cable. */
function obstaculos(hoja: Hoja, excepto: string): Obstaculo[] {
  const salida: Obstaculo[] = [];
  for (const c of hoja.componentes) {
    if (c.id === excepto) continue;
    const def = buscarSimbolo(c.tipo)!;
    const caja = cajaDibujo(def, colocacion(c), c.etiqueta);
    salida.push({ id: c.id, cable: false, que: `${c.etiqueta || c.tipo} en (${c.x}, ${c.y})`, caja });
  }
  const indice = indexarHoja(hoja);
  for (const w of hoja.cables) {
    const p = recorridoCable(indice, w);
    if (!p) throw new Error(`El cable ${w.id} no se resuelve.`);
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = Math.min(p[i]!, p[i + 2]!);
      const x1 = Math.max(p[i]!, p[i + 2]!);
      const y0 = Math.min(p[i + 1]!, p[i + 3]!);
      const y1 = Math.max(p[i + 1]!, p[i + 3]!);
      salida.push({
        id: w.id,
        cable: true,
        que: `cable ${w.id} de (${p[i]}, ${p[i + 1]}) a (${p[i + 2]}, ${p[i + 3]})`,
        caja: { x: x0 - MEDIO_TRAZO, y: y0 - MEDIO_TRAZO, ancho: x1 - x0 + 2 * MEDIO_TRAZO, alto: y1 - y0 + 2 * MEDIO_TRAZO },
      });
    }
  }
  return salida;
}

/** Separación entre dos cajas: la mayor de las dos distancias por eje (negativa o 0 si se tocan). */
function separacion(a: Caja, b: Caja): number {
  const dx = Math.max(b.x - (a.x + a.ancho), a.x - (b.x + b.ancho));
  const dy = Math.max(b.y - (a.y + a.alto), a.y - (b.y + b.alto));
  return Math.max(dx, dy);
}

/** Lo que toca la caja `lista` y la menor separación con todo lo demás. */
function revisar(lista: Caja, obs: readonly Obstaculo[]): { tocados: string[]; holgura: number } {
  const tocados: string[] = [];
  let holgura = Infinity;
  for (const o of obs) {
    const s = separacion(lista, o.caja);
    if (s <= 0) tocados.push(o.que);
    holgura = Math.min(holgura, s);
  }
  return { tocados, holgura };
}

/** Arma la marcha-parada, selecciona la rama de K1 (más la rama NC si hay) con sus cables y hace Ctrl+D. */
function duplicarRamaK1(mp: MarchaParada) {
  const editor = new Editor(mp.doc);
  editor.vista = new VistaFalsa();
  const avisos: string[] = [];
  editor.alAvisar = (t) => avisos.push(t);
  const { s1, k1Auxiliar, k1Bobina, h1, k1AuxiliarNC, h2 } = mp.comp;
  const rama = [s1, k1Auxiliar, k1Bobina, h1, ...(k1AuxiliarNC && h2 ? [k1AuxiliarNC, h2] : [])];
  // Todos los cables: `recortar` se queda con los que tienen sus dos puntas en lo elegido.
  editor.seleccionarIds([...rama, ...mp.cables]);
  const hoja = () => editor.documento.hojas[0]!;
  const antes = new Set([...hoja().componentes, ...hoja().cables].map((k) => k.id));
  const xAntes = new Map(hoja().componentes.map((c) => [c.id, c.x]));

  expect(editor.accion("duplicar")).toBe(true);
  expect(avisos).toEqual([]); // pegó directo, sin la previa de "No hay lugar al lado"

  const nuevos = hoja().componentes.filter((c) => !antes.has(c.id));
  expect(nuevos).toHaveLength(rama.length);
  const bobinaK2 = nuevos.find((c) => c.tipo === "contactor.bobina")!;
  const dx = bobinaK2.x - xAntes.get(k1Bobina)!;
  /** True si el obstáculo es de la copia (componente o cable nuevo). */
  const esDeCopia = (o: Obstaculo) => !antes.has(o.id);
  const bobinaK1 = hoja().componentes.find((c) => c.id === k1Bobina)!;
  // Las líneas del caché del editor (las de la escena), iguales a un cálculo nuevo.
  const refs = referenciasCruzadas(hoja());
  const lineasK1 = editor.referencias.lineas(k1Bobina)!;
  const lineasK2 = editor.referencias.lineas(bobinaK2.id)!;
  expect(lineasK1).toEqual(refs.get(k1Bobina)!.map(textoFila));
  expect(lineasK2).toEqual(refs.get(bobinaK2.id)!.map(textoFila));
  // Las dos listas no se tocan entre sí.
  expect(separacion(cajaLista(bobinaK1, lineasK1), cajaLista(bobinaK2, lineasK2))).toBeGreaterThan(HOLGURA_MINIMA);
  return { hoja: hoja(), bobinaK1, bobinaK2, nuevos, dx, esDeCopia, lineasK1, lineasK2, refs };
}

describe("Ctrl+D contra el ancho de la lista (T18, ajuste 1)", () => {
  it("marcha-parada: dx = 21; la lista de K1 no toca la copia ni la de K2 la rama de K1", () => {
    const mp = marchaParada();
    const { hoja, bobinaK1, bobinaK2, nuevos, dx, esDeCopia, lineasK1, lineasK2 } = duplicarRamaK1(mp);
    const lampara2 = nuevos.find((c) => c.tipo === "senalizacion.lampara")!;
    expect(lampara2.etiqueta).toBe("H2"); // la copia de H1
    expect(dx).toBe(21); // caja del recorte de x = −2 a 17: ceil(19) + 2
    expect(bobinaK2.etiqueta).toBe("K2");
    expect(validarHoja(hoja)).toEqual([]);
    expect(lineasK1).toEqual(["NA 13-14 (10, 11)"]);
    expect(lineasK2).toEqual(["NA 13-14 (31, 11)"]);

    const listaK1 = cajaLista(bobinaK1, lineasK1);
    const obsK1 = obstaculos(hoja, bobinaK1.id);
    const k1 = revisar(listaK1, obsK1);
    const enCopia = revisar(listaK1, obsK1.filter((o) => esDeCopia(o)));
    const listaK2 = cajaLista(bobinaK2, lineasK2);
    const obsK2 = obstaculos(hoja, bobinaK2.id);
    const k2 = revisar(listaK2, obsK2);
    const enRamaK1 = revisar(listaK2, obsK2.filter((o) => !esDeCopia(o)));
    expect(k1.tocados).toEqual([]);
    expect(k2.tocados).toEqual([]);
    expect(k1.holgura).toBeGreaterThanOrEqual(HOLGURA_MINIMA);
    expect(k2.holgura).toBeGreaterThanOrEqual(HOLGURA_MINIMA);

    // Holguras medidas (contra cajaDibujo, por exceso), anotadas en el plan.
    expect(k1.holgura).toBeCloseTo(1.55, 6); // w4 y w6, los cables de la bobina en x = 0 (una fila: 1,55 en y)
    expect(k2.holgura).toBeCloseTo(1.55, 6);
    expect(enCopia.holgura).toBeCloseTo(7.07, 6); // la etiqueta de K2
    expect(enRamaK1.holgura).toBeCloseTo(4, 6); // H1, a la izquierda de K2
    // Lo más cerca a la derecha: la lámpara de la propia rama.
    expect(separacion(listaK1, cajaDe(obsK1, mp.comp.h1))).toBeCloseTo(2.07, 6);
    expect(separacion(listaK2, cajaDe(obsK2, lampara2.id))).toBeCloseTo(2.07, 6);
  });

  it("rama NC: dx = 29; la lista de K1 no toca la copia ni su propio NC, su H2 o los cables w9 a w11", () => {
    const mp = marchaParada({ ramaNC: true });
    const { hoja, bobinaK1, bobinaK2, nuevos, dx, esDeCopia, lineasK1, lineasK2 } = duplicarRamaK1(mp);
    expect(dx).toBe(29); // caja del recorte de x = −2 (S1) a 25 (H2): ceil(27) + 2
    expect(nuevos.map((c) => c.etiqueta).sort()).toEqual(["H3", "H4", "K2", "K2", "K2", "S2"]);
    expect(validarHoja(hoja)).toEqual([]);
    expect(lineasK1).toEqual(["NA 13-14 (10, 11)", "NC 21-22 (24, 11)"]);
    expect(lineasK2).toEqual(["NA 13-14 (39, 11)", "NC 21-22 (53, 11)"]);

    const listaK1 = cajaLista(bobinaK1, lineasK1);
    const obsK1 = obstaculos(hoja, bobinaK1.id);
    const k1 = revisar(listaK1, obsK1);
    expect(k1.tocados).toEqual([]);

    // Lo propio de la rama NC, por separado: el NC, la H2 y w9 a w11.
    const propios = new Set([mp.comp.k1AuxiliarNC!, mp.comp.h2!, ...mp.cables.slice(8)]);
    expect(propios.size).toBe(5);
    const obsPropios = obsK1.filter((o) => propios.has(o.id));
    expect(new Set(obsPropios.map((o) => o.id)).size).toBe(5);
    const enPropios = revisar(listaK1, obsPropios);
    expect(enPropios.tocados).toEqual([]);

    // Lo de la copia, por separado: sus 6 componentes y sus cables.
    const obsCopia = obsK1.filter((o) => esDeCopia(o));
    expect(obsCopia.filter((o) => !o.cable)).toHaveLength(nuevos.length);
    expect(obsCopia.some((o) => o.cable)).toBe(true);
    const enCopia = revisar(listaK1, obsCopia);
    expect(enCopia.tocados).toEqual([]);

    const listaK2 = cajaLista(bobinaK2, lineasK2);
    const obsK2 = obstaculos(hoja, bobinaK2.id);
    const k2 = revisar(listaK2, obsK2);
    expect(k2.tocados).toEqual([]);
    const enRamaK1 = revisar(listaK2, obsK2.filter((o) => !esDeCopia(o)));
    expect(enRamaK1.tocados).toEqual([]);
    expect(k1.holgura).toBeGreaterThanOrEqual(HOLGURA_MINIMA);
    expect(k2.holgura).toBeGreaterThanOrEqual(HOLGURA_MINIMA);

    // Holguras medidas (contra cajaDibujo, por exceso), anotadas en el plan.
    expect(k1.holgura).toBeCloseTo(1.4, 6); // w4 y w6, los cables de la bobina en x = 0 (1,4 en x)
    expect(k2.holgura).toBeCloseTo(1.4, 6);
    expect(enPropios.holgura).toBeCloseTo(7.1, 6); // w11, en y = 30
    expect(enCopia.holgura).toBeCloseTo(14.07, 6); // la etiqueta de S2
    expect(enRamaK1.holgura).toBeCloseTo(4, 6); // la H2 original, a la izquierda de K2
    expect(separacion(listaK1, cajaDe(obsK1, mp.comp.h1))).toBeCloseTo(2.07, 6);
  });

  it("sin duplicar: en la marcha-parada y en la rama NC, la lista de K1 no toca ningún cable ni otro componente", () => {
    for (const mp of [marchaParada(), marchaParada({ ramaNC: true })]) {
      const editor = new Editor(mp.doc);
      const hoja = mp.doc.hojas[0]!;
      const k1 = hoja.componentes.find((c) => c.id === mp.comp.k1Bobina)!;
      expect([...editor.referencias.todas().keys()]).toEqual([k1.id]); // nadie más tiene lista
      const r = revisar(cajaLista(k1, editor.referencias.lineas(k1.id)!), obstaculos(hoja, k1.id));
      expect(r.tocados).toEqual([]);
      expect(r.holgura).toBeGreaterThanOrEqual(HOLGURA_MINIMA);
    }
  });

  it("peor caso de ancho (límite conocido): una fila con «(-120, -345)» en la rama NC duplicada entra justo antes de H1", () => {
    const mp = marchaParada({ ramaNC: true });
    const { hoja, bobinaK1, refs } = duplicarRamaK1(mp);
    // La fila del NC con coordenadas largas y negativas; la hoja no se toca.
    const filas = refs.get(bobinaK1.id)!.map((f) => (f.clase === "NC" ? { ...f, ubicacion: { hoja: 0, x: -120, y: -345 } } : f));
    const lineas = filas.map(textoFila);
    expect(lineas).toEqual(["NA 13-14 (10, 11)", "NC 21-22 (-120, -345)"]);
    const lista = cajaLista(bobinaK1, lineas);
    const h1 = hoja.componentes.find((c) => c.id === mp.comp.h1)!;
    const defH1 = buscarSimbolo(h1.tipo)!;
    const porExceso = cajaDibujo(defH1, colocacion(h1), h1.etiqueta);
    const etiquetaReal = cajaEtiqueta(defH1, colocacion(h1), h1.etiqueta)!;

    // Contra la cajaDibujo de H1 (por exceso), entra justo: 21 letras es lo que entra (límite anotado en el plan).
    expect(separacion(lista, porExceso)).toBeCloseTo(0.11, 6);
    // Contra la etiqueta de H1 como se dibuja (ancho promedio por exceso), más aire.
    expect(separacion(lista, etiquetaReal)).toBeCloseTo(1.31, 6);
    // Lo que entra: letras de la fila más larga sin tocar cada caja.
    const letra = anchoTexto("x", ALTO_BORNE);
    expect(Math.floor((porExceso.x - lista.x) / letra)).toBe(21);
    expect(Math.floor((etiquetaReal.x - lista.x) / letra)).toBe(23);
    expect(lineas[1]!.length).toBe(21); // con una letra más, tocaría la cajaDibujo de H1
  });
});

/** La caja con que `obstaculos` anotó a `id`. */
function cajaDe(obs: readonly Obstaculo[], id: string): Caja {
  const o = obs.find((k) => k.id === id);
  if (!o) throw new Error(`No hay obstáculo ${id}.`);
  return o.caja;
}
