// Referencias cruzadas (T18, etapa 1): el núcleo. Plan en docs/archivo/plan-T18.md,
// secciones 2 y 4.
import { describe, expect, it, vi } from "vitest";
import { marchaParada } from "../circuitos/marchaParada";
import { serializar } from "../io";
import { buscarSimbolo, cajaCuerpo, type Rotacion } from "../symbols";
import { Borrar, CambiarEtiqueta, CambiarEtiquetas, colocar, Espejar, Mover, Rotar, type Comando } from "./comandos";
import { crearDocumento, type Componente, type Hoja } from "./documento";
import { conEtiquetas, etiquetarLote, etiquetasDeTitulares, planRenombrarBobina } from "./etiquetado";
import { Historial } from "./historial";
import { pegar, recortar, type Recorte } from "./portapapeles";
import { bornesDeFila, referenciasCruzadas, textoFila, textoUbicacion, type FilaReferencia } from "./referencias";

const BOBINA = "contactor.bobina";
const NA = "contactor.auxiliar_na";
const NC = "contactor.auxiliar_nc";
const PULSADOR = "pulsador.na";
const LAMPARA = "senalizacion.lampara";
/** Un tipo que no está en la biblioteca, como en un .brn de una versión más nueva. */
const DESCONOCIDO = "desconocido.contacto";
const ROTACIONES: Rotacion[] = [0, 90, 180, 270];

/** Una hoja sin cables con los componentes dados, con ids c1, c2… en ese orden. */
function hojaCon(...lista: [tipo: string, etiqueta: string, x: number, y: number][]): Hoja {
  return {
    nombre: "Hoja 1",
    cables: [],
    componentes: lista.map(([tipo, etiqueta, x, y], i): Componente => ({ id: `c${i + 1}`, tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} })),
  };
}

/** Las listas como texto: id de bobina → las líneas que se dibujan. */
function lineas(refs: ReadonlyMap<string, readonly FilaReferencia[]>): [string, string[]][] {
  return [...refs].map(([id, filas]) => [id, filas.map(textoFila)]);
}

/** Los ids de los contactos de cada lista. */
function contactos(refs: ReadonlyMap<string, readonly FilaReferencia[]>): [string, string[]][] {
  return [...refs].map(([id, filas]) => [id, filas.map((f) => f.contacto)]);
}

function copia<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ── Circuitos de referencia ────────────────────────────────────────────────

describe("referenciasCruzadas: marcha-parada", () => {
  it("K1 tiene una fila, NA 13-14 en (10, 11), y nadie más tiene lista", () => {
    const { doc, comp: c } = marchaParada();
    const refs = referenciasCruzadas(doc.hojas[0]!);
    expect([...refs.keys()]).toEqual([c.k1Bobina]);
    expect(refs.get(c.k1Bobina)).toEqual([{ contacto: c.k1Auxiliar, clase: "NA", bornes: ["13", "14"], ubicacion: { hoja: 0, x: 10, y: 11 } }]);
    expect(lineas(refs)).toEqual([[c.k1Bobina, ["NA 13-14 (10, 11)"]]]);
  });

  it("rama con NC: K1 tiene dos filas, primero la NA de retención y después la NC de la lámpara H2", () => {
    const { doc, comp: c } = marchaParada({ ramaNC: true });
    const refs = referenciasCruzadas(doc.hojas[0]!);
    expect(contactos(refs)).toEqual([[c.k1Bobina, [c.k1Auxiliar, c.k1AuxiliarNC!]]]);
    expect(lineas(refs)).toEqual([[c.k1Bobina, ["NA 13-14 (10, 11)", "NC 21-22 (24, 11)"]]]);
  });

  it.each([
    ["base", false],
    ["con rama NC", true],
  ])("%s: calcular no toca el documento ni lo que se guarda en el .brn", (_n, ramaNC) => {
    const { doc } = marchaParada({ ramaNC });
    const antes = copia(doc);
    const texto = serializar(doc);
    referenciasCruzadas(doc.hojas[0]!);
    expect(doc).toEqual(antes);
    expect(serializar(doc)).toBe(texto);
  });
});

// ── Casos (tabla de la sección 2, sin avisos) ──────────────────────────────

describe("casos de la tabla, sin avisos", () => {
  it("bobina sin contactos: no tiene lista", () => {
    expect(referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [NA, "K2", 10, 0])).size).toBe(0);
  });

  it("contacto sin bobina: no aparece en ninguna lista", () => {
    const refs = referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [NA, "K1", 10, 0], [NC, "K2", 20, 0]));
    expect(contactos(refs)).toEqual([["c1", ["c2"]]]);
  });

  it("dos bobinas con la misma etiqueta: las dos muestran la misma lista", () => {
    const refs = referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [NA, "K1", 10, 0], [BOBINA, "k1", 0, 10], [NC, "K1", 20, 0]));
    expect(contactos(refs)).toEqual([
      ["c1", ["c2", "c4"]],
      ["c3", ["c2", "c4"]],
    ]);
    expect(refs.get("c1")).toBe(refs.get("c3"));
  });

  it("contacto sin etiqueta: no aparece", () => {
    const refs = referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [NA, "", 10, 0], [NC, "   ", 20, 0], [NA, "K1", 30, 0]));
    expect(contactos(refs)).toEqual([["c1", ["c4"]]]);
  });

  it("bobina sin etiqueta: sin lista, aunque haya contactos sin etiqueta", () => {
    expect(referenciasCruzadas(hojaCon([BOBINA, "", 0, 0], [NA, "", 10, 0], [BOBINA, "  ", 0, 10], [NC, " ", 20, 0])).size).toBe(0);
  });

  it("contacto con la etiqueta de algo que no es bobina (un auxiliar «S1»): no aparece", () => {
    expect(referenciasCruzadas(hojaCon([PULSADOR, "S1", 0, 0], [NA, "S1", 10, 0], [LAMPARA, "H1", 0, 10], [NC, "H1", 20, 0])).size).toBe(0);
  });

  it("un pulsador con la etiqueta de la bobina no es un contacto seguidor: no aparece", () => {
    const refs = referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [PULSADOR, "K1", 10, 0], [NA, "K1", 20, 0]));
    expect(contactos(refs)).toEqual([["c1", ["c3"]]]);
  });

  it("símbolo desconocido: no cuenta, ni como bobina ni como contacto", () => {
    expect(referenciasCruzadas(hojaCon([DESCONOCIDO, "K1", 0, 0], [NA, "K1", 10, 0])).size).toBe(0);
    expect(referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [DESCONOCIDO, "K1", 10, 0])).size).toBe(0);
  });
});

// ── Normalización y orden ──────────────────────────────────────────────────

describe("normalización", () => {
  it("un contacto «k1 » sigue a la bobina K1, y un contacto K1 a la bobina « k1»", () => {
    expect(contactos(referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [NA, "k1 ", 10, 0])))).toEqual([["c1", ["c2"]]]);
    expect(contactos(referenciasCruzadas(hojaCon([BOBINA, " k1", 0, 0], [NC, "K1", 10, 0])))).toEqual([["c1", ["c2"]]]);
  });
});

describe("orden de las filas", () => {
  it("por el primer borne: la NC 21-22 va después de la NA 13-14, aunque esté más arriba y antes en la hoja", () => {
    const refs = referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [NC, "K1", 5, -10], [NA, "K1", 20, 30]));
    expect(lineas(refs)).toEqual([["c1", ["NA 13-14 (20, 30)", "NC 21-22 (5, -10)"]]]);
  });

  it("dos NA de una bobina salen en orden (y, x), sin importar su lugar en la hoja", () => {
    const hoja = hojaCon([BOBINA, "K1", 0, 0], [NA, "K1", 20, 5], [NA, "K1", 10, 11], [NA, "K1", 5, 11]);
    const esperado = [["c1", ["NA 13-14 (20, 5)", "NA 13-14 (5, 11)", "NA 13-14 (10, 11)"]]];
    expect(lineas(referenciasCruzadas(hoja))).toEqual(esperado);
    // Todas las permutaciones de la lista de la hoja dan el mismo orden.
    const permutaciones = <T>(xs: T[]): T[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutaciones([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
    for (const p of permutaciones(hoja.componentes)) {
      expect(lineas(referenciasCruzadas({ componentes: p })), p.map((c) => c.id).join(",")).toEqual(esperado);
    }
  });

  it("en el mismo punto y con los mismos bornes, decide el orden de la hoja", () => {
    const hoja = hojaCon([BOBINA, "K1", 0, 0], [NA, "K1", 3, 3], [NA, "K1", 3, 3]);
    expect(contactos(referenciasCruzadas(hoja))).toEqual([["c1", ["c2", "c3"]]]);
    expect(contactos(referenciasCruzadas({ componentes: [...hoja.componentes].reverse() }))).toEqual([["c1", ["c3", "c2"]]]);
  });
});

describe("bornesDeFila: la única fuente de los bornes (D0-A, fijos)", () => {
  it("NA 13-14, NC 21-22: los nombres de la definición", () => {
    expect(bornesDeFila(buscarSimbolo(NA)!)).toEqual(["13", "14"]);
    expect(bornesDeFila(buscarSimbolo(NC)!)).toEqual(["21", "22"]);
  });
});

describe("rotar o espejar un contacto no cambia su fila", () => {
  it.each([NA, NC])("%s: 4 giros de 90°, uno de −90° y dos espejos, cada uno con su fila igual", (tipo) => {
    const doc = crearDocumento({ titulo: "Prueba", autor: "", fecha: "2026-11-14" });
    const historial = new Historial(doc);
    const hoja = doc.hojas[0]!;
    historial.ejecutar(colocar(doc, { tipo: BOBINA, x: 0, y: 0, rot: 0, espejado: false, etiqueta: "K1", params: {} }));
    const contacto = colocar(doc, { tipo, x: 10, y: 4, rot: 0, espejado: false, etiqueta: "K1", params: {} });
    historial.ejecutar(contacto);
    const original = referenciasCruzadas(hoja);
    expect(original.size).toBe(1);
    const pasos: Comando[] = [
      new Rotar([contacto.id], 90),
      new Rotar([contacto.id], 90),
      new Espejar([contacto.id]),
      new Rotar([contacto.id], 90),
      new Rotar([contacto.id], -90),
      new Espejar([contacto.id]),
      new Rotar([contacto.id], 90),
    ];
    for (const [k, paso] of pasos.entries()) {
      historial.ejecutar(paso);
      expect(referenciasCruzadas(hoja), `paso ${k}`).toEqual(original);
    }
  });
});

// ── Coordenadas (ajuste 2) ─────────────────────────────────────────────────

describe("coordenadas: las de la barra de estado (ajuste 2)", () => {
  // La barra muestra el cursor en unidades de grilla, redondeado
  // (`Math.round`, src/ui/BarraEstado.svelte), con el origen en el (0, 0) de
  // la grilla y la Y hacia abajo. Con el cursor a menos de media unidad del
  // centro del contacto, muestra exactamente sus `x` e `y` (son enteros). Con
  // la barra real, lo comprueba el humo t18 (etapa 3).
  const PUNTOS: [number, number][] = [
    [10, 11],
    [-3, -7],
    [0, -12],
    [25, 0],
  ];

  it.each([NA, NC])("%s: la ubicación es x e y del componente, el centro de su cuerpo, en las 4 rotaciones y espejado", (tipo) => {
    const def = buscarSimbolo(tipo)!;
    for (const [x, y] of PUNTOS) {
      for (const rot of ROTACIONES) {
        for (const espejado of [false, true]) {
          const contexto = `(${x}, ${y}) a ${rot}°${espejado ? " espejado" : ""}`;
          const hoja = hojaCon([BOBINA, "K1", 40, 40], [tipo, "K1", x, y]);
          hoja.componentes[1] = { ...hoja.componentes[1]!, rot, espejado };
          const fila = referenciasCruzadas(hoja).get("c1")![0]!;
          expect(fila.ubicacion, contexto).toEqual({ hoja: 0, x, y });
          const cuerpo = cajaCuerpo(def.tamano, x, y, rot);
          expect([cuerpo.x + cuerpo.ancho / 2, cuerpo.y + cuerpo.alto / 2], contexto).toEqual([x, y]);
          // El texto lleva los dos números que daría la barra con el cursor cerca del centro.
          for (const [dx, dy] of [[0, 0], [0.4, -0.4], [-0.4, 0.4]] as const) {
            expect(textoUbicacion(fila.ubicacion), `${contexto}, cursor corrido (${dx}, ${dy})`).toBe(`(${Math.round(x + dx)}, ${Math.round(y + dy)})`);
          }
        }
      }
    }
  });

  it("un negativo va con su signo, como en la barra: (-3, -7)", () => {
    const fila = referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [NA, "K1", -3, -7])).get("c1")![0]!;
    expect(textoUbicacion(fila.ubicacion)).toBe("(-3, -7)");
    expect(textoFila(fila)).toBe("NA 13-14 (-3, -7)");
  });

  it("la ubicación lleva el índice de la hoja; el texto de hoy no lo muestra", () => {
    const fila = referenciasCruzadas(hojaCon([BOBINA, "K1", 0, 0], [NA, "K1", 10, 11]), 2).get("c1")![0]!;
    expect(fila.ubicacion).toEqual({ hoja: 2, x: 10, y: 11 });
    expect(textoUbicacion(fila.ubicacion)).toBe("(10, 11)");
  });
});

// ── Al azar, contra el cálculo lento ───────────────────────────────────────

/** Generador de números con semilla (mulberry32), como en seguir.test.ts. */
function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEMILLA = 20261114;
const OPERACIONES = 1000;

/**
 * Normalización escrita acá, a propósito: el cálculo lento no puede usar
 * `normalizarEtiqueta`, porque la prueba con la regla anulada la reemplaza y
 * los dos cálculos coincidirían.
 */
const normalizarLento = (t: string): string => t.trim().toUpperCase();

/**
 * El cálculo de referencia, lento y escrito aparte: por cada bobina con
 * etiqueta, recorre toda la hoja buscando sus contactos, y ordena por el
 * número del primer borne, (y, x) y el lugar en la hoja.
 */
function referenciasLentas(hoja: Pick<Hoja, "componentes">): Map<string, FilaReferencia[]> {
  const salida = new Map<string, FilaReferencia[]>();
  for (const b of hoja.componentes) {
    if (buscarSimbolo(b.tipo)?.elemento !== "bobina") continue;
    const etiqueta = normalizarLento(b.etiqueta);
    if (etiqueta === "") continue;
    const encontradas: { fila: FilaReferencia; i: number; borne: number }[] = [];
    hoja.componentes.forEach((c, i) => {
      const def = buscarSimbolo(c.tipo);
      if (def?.accionamiento !== "bobina" || normalizarLento(c.etiqueta) !== etiqueta) return;
      const bornes = def.bornes.map((x) => x.nombre);
      const borne = Number(bornes[0]);
      if (!Number.isInteger(borne)) throw new Error(`El cálculo lento espera bornes numéricos: ${c.tipo} tiene "${bornes[0]}".`);
      const clase = def.elemento === "contacto_nc" ? "NC" : "NA";
      encontradas.push({ fila: { contacto: c.id, clase, bornes, ubicacion: { hoja: 0, x: c.x, y: c.y } }, i, borne });
    });
    if (encontradas.length === 0) continue;
    encontradas.sort((p, q) => p.borne - q.borne || p.fila.ubicacion.y - q.fila.ubicacion.y || p.fila.ubicacion.x - q.fila.ubicacion.x || p.i - q.i);
    salida.set(
      b.id,
      encontradas.map((e) => e.fila),
    );
  }
  return salida;
}

/** Las listas como texto, para comparar y para leer la diferencia. */
function canonico(refs: ReadonlyMap<string, readonly FilaReferencia[]>): string[] {
  return [...refs].map(
    ([id, filas]) => `${id} → ${filas.map((f) => `${f.contacto} ${f.clase} ${f.bornes.join("-")} h${f.ubicacion.hoja} (${f.ubicacion.x}, ${f.ubicacion.y})`).join(" | ")}`,
  );
}

type Calculo = (hoja: Pick<Hoja, "componentes">) => ReadonlyMap<string, readonly FilaReferencia[]>;

interface Recorrido {
  /** Pasos en que el cálculo no coincidió con el lento. */
  diferencias: number;
  /** Las primeras diferencias, para leer. */
  primeras: string[];
  /** Cuántas veces se hizo cada operación (aceptada). */
  hechas: Record<string, number>;
  /** Cuántos pasos tuvieron cada situación que pone a prueba una regla. */
  situaciones: Record<string, number>;
  /** Comandos que tiraron al armarlos o aplicarlos (la hoja queda como estaba). */
  rechazados: number;
}

/**
 * Etiquetas con que se colocan y renombran: K1 a K5, algunas sin normalizar,
 * vacías, de puros espacios y de cosas que no son bobinas.
 */
const ETIQUETAS = ["K1", "K2", "K3", "K4", "K5", "k1 ", " K2", "k3", "", "  ", "S1", "H1"];
/** Lo que se coloca: más bobinas y contactos que lo demás. */
const TIPOS = [BOBINA, BOBINA, NA, NA, NA, NC, NC, PULSADOR, LAMPARA, DESCONOCIDO];

/**
 * Parte de la marcha-parada con la rama NC y hace `OPERACIONES` pasos al azar
 * (colocar, mover, rotar, espejar, borrar, renombrar con y sin arrastre,
 * copiar, pegar, duplicar, deshacer y rehacer) con un `Historial`. Después de
 * cada paso compara `calcular` con el cálculo lento. La secuencia depende solo
 * de la semilla: el resultado de `calcular` no decide nada.
 */
function recorrer(calcular: Calculo): Recorrido {
  const azar = generador(SEMILLA);
  const entero = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;

  const { doc, historial } = marchaParada({ ramaNC: true });
  const h = doc.hojas[0]!;
  let portapapeles: Recorte | null = null;
  let rechazados = 0;
  let diferencias = 0;
  const primeras: string[] = [];
  const hechas: Record<string, number> = {
    colocar: 0,
    mover: 0,
    rotar: 0,
    espejar: 0,
    borrar: 0,
    renombrar: 0,
    renombrarConArrastre: 0,
    copiar: 0,
    pegar: 0,
    pegarEtiquetando: 0,
    duplicar: 0,
    deshacer: 0,
    rehacer: 0,
  };
  const situaciones: Record<string, number> = {
    listaDeVariasFilas: 0,
    bobinasConLaMismaEtiqueta: 0,
    etiquetasDistintasSinNormalizar: 0,
    bobinaYContactoVacios: 0,
    contactoSinBobina: 0,
    desconocidoConEtiquetaDeBobina: 0,
    pulsadorConEtiquetaDeBobina: 0,
    ordenDistintoDelDeLaHoja: 0,
    empateDeBorneYLugar: 0,
  };

  /** Arma y ejecuta; si tira, cuenta el rechazo y devuelve false. */
  const ejecutar = (armar: () => Comando): boolean => {
    try {
      historial.ejecutar(armar());
      return true;
    } catch {
      rechazados++;
      return false;
    }
  };

  const bobinas = () => h.componentes.filter((c) => c.tipo === BOBINA);

  /** De 1 a 4 componentes al azar, o una bobina con sus contactos (la rama de un contactor). A veces, un cable. */
  const algunos = (): string[] => {
    const ids = new Set<string>();
    const conEtiqueta = bobinas().filter((b) => normalizarLento(b.etiqueta) !== "");
    if (conEtiqueta.length > 0 && azar() < 0.35) {
      const b = elegir(conEtiqueta);
      ids.add(b.id);
      for (const c of h.componentes) if (c.tipo !== BOBINA && normalizarLento(c.etiqueta) === normalizarLento(b.etiqueta)) ids.add(c.id);
    } else {
      const n = entero(1, Math.min(4, h.componentes.length));
      while (ids.size < n) ids.add(elegir(h.componentes).id);
    }
    if (h.cables.length > 0 && azar() < 0.3) ids.add(elegir(h.cables).id);
    return [...ids];
  };

  for (let k = 0; k < OPERACIONES; k++) {
    const r = azar();
    const vacia = h.componentes.length === 0;
    let hecha: string | null = null;
    if (r < 0.26) {
      // Zona amplia: en una apretada, mover, girar y espejar chocan casi siempre.
      const datos = { tipo: elegir(TIPOS), x: entero(-40, 40), y: entero(-40, 40), rot: elegir(ROTACIONES), espejado: azar() < 0.3, etiqueta: elegir(ETIQUETAS), params: {} };
      if (ejecutar(() => colocar(doc, datos))) hecha = "colocar";
    } else if (r < 0.33) {
      if (!vacia && ejecutar(() => new Mover(algunos(), entero(-6, 6), entero(-6, 6)))) hecha = "mover";
    } else if (r < 0.37) {
      if (!vacia && ejecutar(() => new Rotar(algunos(), elegir([90, -90] as const)))) hecha = "rotar";
    } else if (r < 0.4) {
      if (!vacia && ejecutar(() => new Espejar(algunos()))) hecha = "espejar";
    } else if (r < 0.47) {
      if (!vacia && ejecutar(() => new Borrar(algunos()))) hecha = "borrar";
    } else if (r < 0.55) {
      const candidatos = h.componentes.filter((c) => !c.tipo.startsWith("fuente."));
      if (candidatos.length > 0 && ejecutar(() => new CambiarEtiqueta(elegir(candidatos).id, elegir(ETIQUETAS)))) hecha = "renombrar";
    } else if (r < 0.6) {
      // Como el panel: la bobina se lleva a sus contactos si se puede (T17).
      const lista = bobinas();
      if (lista.length > 0) {
        const plan = planRenombrarBobina(h, elegir(lista).id, elegir(["K1", "K2", "K3", "K4", "K5", "K6"]));
        if (plan.cambios.size > 0 && ejecutar(() => new CambiarEtiquetas(plan.cambios))) hecha = "renombrarConArrastre";
      }
    } else if (r < 0.65) {
      if (!vacia) {
        portapapeles = recortar(h, algunos());
        hecha = "copiar";
      }
    } else if (r < 0.74) {
      // Pegar con un corrimiento chico; uno de cada tres, justo encima: el
      // contacto pegado empata en bornes y lugar con el original.
      const recorte = portapapeles;
      if (recorte) {
        const encima = azar() < 1 / 3;
        const dx = encima ? 0 : entero(-3, 3);
        const dy = encima ? 0 : entero(-3, 3);
        if (azar() < 0.5) {
          if (ejecutar(() => pegar(doc, recorte, dx, dy))) hecha = "pegar";
        } else if (ejecutar(() => pegar(doc, conEtiquetas(recorte, etiquetarLote(etiquetasDeTitulares(h), recorte.componentes)), dx, dy))) {
          hecha = "pegarEtiquetando";
        }
      }
    } else if (r < 0.8) {
      if (!vacia) {
        const recorte = recortar(h, algunos());
        if (ejecutar(() => pegar(doc, conEtiquetas(recorte, etiquetarLote(etiquetasDeTitulares(h), recorte.componentes)), entero(4, 12), 0))) hecha = "duplicar";
      }
    } else if (r < 0.88) {
      if (historial.deshacer()) hecha = "deshacer";
    } else if (historial.rehacer()) {
      // Más peso que deshacer: cualquier otra operación vacía lo que había para rehacer.
      hecha = "rehacer";
    }
    if (hecha === null) continue;
    hechas[hecha]!++;

    const lenta = referenciasLentas(h);
    const esperado = canonico(lenta);
    const obtenido = canonico(calcular(h));
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
      diferencias++;
      if (primeras.length < 3) primeras.push(`operación ${k} (${hecha}):\n  da       ${obtenido.join("\n           ")}\n  esperado ${esperado.join("\n           ")}`);
    }
    contarSituaciones(h, lenta, situaciones);
  }
  return { diferencias, primeras, hechas, situaciones, rechazados };
}

/** Suma 1 a cada situación que se da en la hoja: las que ponen a prueba cada regla. */
function contarSituaciones(h: Hoja, lenta: Map<string, FilaReferencia[]>, s: Record<string, number>): void {
  const porId = new Map(h.componentes.map((c, i) => [c.id, { c, i }]));
  const etiquetasDeBobina = new Set<string>();
  let bobinaVacia = false;
  let contactoVacio = false;
  const vistas = new Set<string>();
  let repetida = false;
  for (const c of h.componentes) {
    const def = buscarSimbolo(c.tipo);
    const e = normalizarLento(c.etiqueta);
    if (def?.elemento === "bobina") {
      if (e === "") bobinaVacia = true;
      else {
        if (vistas.has(e) && [...lenta.keys()].some((id) => normalizarLento(porId.get(id)!.c.etiqueta) === e)) repetida = true;
        vistas.add(e);
        etiquetasDeBobina.add(e);
      }
    } else if (def?.accionamiento === "bobina" && e === "") contactoVacio = true;
  }
  const marcar = (clave: string, si: boolean) => {
    if (si) s[clave]!++;
  };
  marcar("bobinasConLaMismaEtiqueta", repetida);
  marcar("bobinaYContactoVacios", bobinaVacia && contactoVacio);
  marcar(
    "contactoSinBobina",
    h.componentes.some((c) => buscarSimbolo(c.tipo)?.accionamiento === "bobina" && normalizarLento(c.etiqueta) !== "" && !etiquetasDeBobina.has(normalizarLento(c.etiqueta))),
  );
  marcar("desconocidoConEtiquetaDeBobina", h.componentes.some((c) => c.tipo === DESCONOCIDO && etiquetasDeBobina.has(normalizarLento(c.etiqueta))));
  marcar("pulsadorConEtiquetaDeBobina", h.componentes.some((c) => c.tipo === PULSADOR && etiquetasDeBobina.has(normalizarLento(c.etiqueta))));

  let varias = false;
  let sinNormalizar = false;
  let orden = false;
  let empate = false;
  for (const [id, filas] of lenta) {
    if (filas.length > 1) varias = true;
    const bobina = porId.get(id)!.c;
    if (filas.some((f) => porId.get(f.contacto)!.c.etiqueta !== bobina.etiqueta)) sinNormalizar = true;
    const indices = filas.map((f) => porId.get(f.contacto)!.i);
    if (indices.some((v, j) => j > 0 && v < indices[j - 1]!)) orden = true;
    if (filas.some((f, j) => j > 0 && f.bornes[0] === filas[j - 1]!.bornes[0] && f.ubicacion.x === filas[j - 1]!.ubicacion.x && f.ubicacion.y === filas[j - 1]!.ubicacion.y)) empate = true;
  }
  marcar("listaDeVariasFilas", varias);
  marcar("etiquetasDistintasSinNormalizar", sinNormalizar);
  marcar("ordenDistintoDelDeLaHoja", orden);
  marcar("empateDeBorneYLugar", empate);
}

describe("al azar, con semilla fija, contra el cálculo lento", () => {
  it(`${OPERACIONES} operaciones (semilla ${SEMILLA}): después de cada paso, igual que el cálculo lento`, () => {
    const r = recorrer(referenciasCruzadas);
    expect(r.primeras, `${r.diferencias} pasos con diferencias`).toEqual([]);
    expect(r.diferencias).toBe(0);
    // La secuencia probó de todo, y se dieron las situaciones que ponen a prueba cada regla.
    for (const [operacion, n] of Object.entries(r.hechas)) expect(n, operacion).toBeGreaterThan(0);
    for (const [situacion, n] of Object.entries(r.situaciones)) expect(n, situacion).toBeGreaterThan(0);
  });

  it("con la normalización anulada a propósito, el mismo recorrido encuentra diferencias", async () => {
    // `normalizarEtiqueta` pasa a ser la identidad solo para un `referencias`
    // cargado de nuevo. El cálculo lento normaliza por su cuenta.
    vi.resetModules();
    vi.doMock("./etiquetas", async (importOriginal) => ({
      ...(await importOriginal<typeof import("./etiquetas")>()),
      normalizarEtiqueta: (texto: string) => texto,
    }));
    try {
      const mutante = (await import("./referencias")).referenciasCruzadas;
      // El reemplazo llegó: «k1 » ya no sigue a K1 (con la regla, sí).
      const hoja = hojaCon([BOBINA, "K1", 0, 0], [NA, "k1 ", 10, 0]);
      expect(mutante(hoja).size).toBe(0);
      expect(referenciasCruzadas(hoja).size).toBe(1);

      const r = recorrer(mutante);
      expect(r.diferencias, "el recorrido al azar no notó que falta la normalización").toBeGreaterThan(0);
    } finally {
      vi.doUnmock("./etiquetas");
      vi.resetModules();
    }
  });
});
