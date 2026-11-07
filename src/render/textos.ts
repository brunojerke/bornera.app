// Caché de textos pre-renderizados. Dibujar un texto con fillText es lo más
// caro de la capa estática (en la netbook, casi todo su costo): cada vez hay
// que rasterizar los glifos, y con la fuente escalada el motor no los
// reaprovecha. Acá cada texto se dibuja una sola vez por tamaño en píxeles
// (es decir, por nivel de zoom) en un "atlas", y después se copia con drawImage.
//
// - El atlas son páginas de LADO_PAGINA px, transparentes, que se piden de a
//   una a medida que hacen falta. Los textos se acomodan en estantes (filas)
//   del alto de cada uno, redondeado para que haya pocos altos distintos.
// - Cuando se llenan todas las páginas, `obtener` devuelve null (se dibuja con
//   fillText) y queda `lleno`: quien dibuja lo vacía antes del próximo mosaico.
//   Nunca se vacía solo, así una entrada ya entregada no se borra mientras se
//   está dibujando.
// - Las letras grandes (zoom muy cercano) no se cachean: hay pocas en pantalla
//   y ocuparían mucho lugar.
// - Quien dibuja vacía el caché al cambiar de nivel de zoom: los textos de
//   otro tamaño ya no sirven.
//
// Escribir en una página después de haberla copiado obliga a algunos motores
// (Chromium; WebKit con Skia) a duplicarla entera. Por eso RendererCanvas pide
// las entradas mientras recorre el dibujo y las copia todas juntas al final:
// primero se escribe, después se lee.

import type { CrearContexto } from "./capas";

/** Fuente de todos los textos: Helvetica, para que la pantalla se parezca al PDF. */
export const FUENTE = "Helvetica, Arial, sans-serif";

/**
 * Los textos se dibujan a este tamaño y se escalan después: algunos motores
 * (WebKitGTK) redondean o ignoran fuentes de 1 px aunque luego se amplíen.
 */
export const TAMANO_BASE_TEXTO = 100;

/** Lado de cada página del atlas, en px (1 MB por página). */
export const LADO_PAGINA = 512;

/** Páginas como máximo: 8 MB en total. */
export const MAX_PAGINAS = 8;

/** Las letras más altas que esto (px físicos) no se cachean. */
export const MAX_ALTO_PX = 48;

/** Margen transparente alrededor de cada texto, para el suavizado de bordes. */
const RELLENO = 1;

/** Los estantes miden un múltiplo de esto: pocos altos distintos, menos lugar perdido. */
const PASO_ESTANTE = 4;

/** Un texto ya dibujado en el atlas. Medidas en px enteros. */
export interface EntradaTexto {
  /** Página del atlas. */
  readonly imagen: CanvasImageSource;
  /** Recorte de la página que ocupa el texto. */
  readonly sx: number;
  readonly sy: number;
  readonly ancho: number;
  readonly alto: number;
  /**
   * Punto de anclaje dentro del recorte: comienzo del texto (alineación a la
   * izquierda) y centro vertical (como textBaseline "middle").
   */
  readonly ax: number;
  readonly ay: number;
  /** Avance del texto en px: la mitad corre el anclaje al centro; todo, a la derecha. */
  readonly avance: number;
}

interface Pagina {
  readonly ctx: CanvasRenderingContext2D;
  /** Primera fila libre (debajo del último estante). */
  libreY: number;
}

/** Fila de textos del mismo alto. */
interface Estante {
  readonly pagina: Pagina;
  readonly y: number;
  readonly alto: number;
  /** Primera columna libre. */
  x: number;
}

export class CacheTextos {
  /** Alguna entrada no entró: hay que vaciar antes de seguir cacheando. */
  lleno = false;
  private paginas: Pagina[] = [];
  /** Último estante abierto de cada alto. */
  private readonly estantes = new Map<number, Estante>();
  /** Color → tamaño en px → texto → entrada (mapas anidados: buscar no arma claves). */
  private readonly entradas = new Map<string, Map<number, Map<string, EntradaTexto>>>();
  private cantidadEntradas = 0;

  /** `crearContexto(true)` debe dar un canvas transparente. */
  constructor(private readonly crearContexto: CrearContexto) {}

  /** Bytes de las páginas (4 por píxel). */
  get memoria(): number {
    return this.paginas.length * LADO_PAGINA * LADO_PAGINA * 4;
  }

  /** Textos guardados. */
  get cantidad(): number {
    return this.cantidadEntradas;
  }

  /**
   * El texto dibujado con letra de `px` píxeles físicos de alto y ese color.
   * Lo dibuja en el atlas si no estaba. Null si no conviene o no entra: hay
   * que dibujarlo con fillText.
   */
  obtener(texto: string, px: number, color: string): EntradaTexto | null {
    if (!texto || !(px > 0) || px > MAX_ALTO_PX) return null;
    let porTamano = this.entradas.get(color);
    if (!porTamano) this.entradas.set(color, (porTamano = new Map()));
    let porTexto = porTamano.get(px);
    if (!porTexto) porTamano.set(px, (porTexto = new Map()));
    const guardada = porTexto.get(texto);
    if (guardada) return guardada;
    if (this.lleno) return null;

    const nueva = this.dibujar(texto, px, color);
    if (nueva) {
      porTexto.set(texto, nueva);
      this.cantidadEntradas++;
    } else {
      this.lleno = true;
    }
    return nueva;
  }

  /** Borra todos los textos y deja las páginas listas para reusar. */
  vaciar(): void {
    for (const p of this.paginas) {
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      p.ctx.clearRect(0, 0, LADO_PAGINA, LADO_PAGINA);
      p.libreY = 0;
    }
    this.estantes.clear();
    this.entradas.clear();
    this.cantidadEntradas = 0;
    this.lleno = false;
  }

  /** Suelta la memoria de las páginas. */
  liberar(): void {
    this.vaciar();
    for (const p of this.paginas) {
      p.ctx.canvas.width = 0;
      p.ctx.canvas.height = 0;
    }
    this.paginas = [];
  }

  private dibujar(texto: string, px: number, color: string): EntradaTexto | null {
    const s = px / TAMANO_BASE_TEXTO;
    const medidor = (this.paginas[0] ?? this.nuevaPagina()).ctx;
    prepararFuente(medidor);
    const m = medidor.measureText(texto);
    // Medidas reales de los glifos alrededor del anclaje (con textBaseline
    // "middle"); si el motor no las informa, una estimación holgada.
    const avance = m.width * s;
    const izquierda = Math.max(0, m.actualBoundingBoxLeft ?? 0) * s;
    const derecha = Math.max(m.width, m.actualBoundingBoxRight ?? m.width) * s;
    const arriba = Math.max(0, m.actualBoundingBoxAscent ?? TAMANO_BASE_TEXTO * 0.6) * s;
    const abajo = Math.max(0, m.actualBoundingBoxDescent ?? TAMANO_BASE_TEXTO * 0.6) * s;
    if (!Number.isFinite(avance + derecha + arriba + abajo)) return null;

    // El anclaje cae en un píxel entero: el glifo queda igual que si se dibujara directo.
    const ax = RELLENO + Math.ceil(izquierda);
    const ay = RELLENO + Math.ceil(arriba);
    const ancho = ax + Math.ceil(derecha) + RELLENO;
    const alto = ay + Math.ceil(abajo) + RELLENO;
    const lugar = this.ubicar(ancho, alto);
    if (!lugar) return null;

    const c = lugar.pagina.ctx;
    c.setTransform(s, 0, 0, s, lugar.x + ax, lugar.y + ay);
    prepararFuente(c);
    c.fillStyle = color;
    c.fillText(texto, 0, 0);
    return { imagen: c.canvas, sx: lugar.x, sy: lugar.y, ancho, alto, ax, ay, avance };
  }

  /** Lugar libre para un recorte de ancho×alto, o null si no entra en ninguna página. */
  private ubicar(ancho: number, alto: number): { pagina: Pagina; x: number; y: number } | null {
    if (ancho > LADO_PAGINA || alto > LADO_PAGINA) return null;
    const h = Math.ceil(alto / PASO_ESTANTE) * PASO_ESTANTE;
    let e = this.estantes.get(h);
    if (!e || e.x + ancho > LADO_PAGINA) {
      // Estante nuevo: en la primera página con lugar abajo, o en una página nueva.
      let pagina = this.paginas.find((p) => p.libreY + h <= LADO_PAGINA);
      if (!pagina) {
        if (this.paginas.length >= MAX_PAGINAS) return null;
        pagina = this.nuevaPagina();
      }
      e = { pagina, y: pagina.libreY, alto: h, x: 0 };
      pagina.libreY += h;
      this.estantes.set(h, e);
    }
    const x = e.x;
    e.x += ancho;
    return { pagina: e.pagina, x, y: e.y };
  }

  private nuevaPagina(): Pagina {
    const ctx = this.crearContexto(true);
    ctx.canvas.width = LADO_PAGINA;
    ctx.canvas.height = LADO_PAGINA;
    const p = { ctx, libreY: 0 };
    this.paginas.push(p);
    return p;
  }
}

/** Fuente y anclaje de todos los textos (cambiar el tamaño de un canvas los reinicia). */
export function prepararFuente(c: CanvasRenderingContext2D): void {
  c.font = `${TAMANO_BASE_TEXTO}px ${FUENTE}`;
  c.textAlign = "left";
  c.textBaseline = "middle";
}
