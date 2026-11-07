// Navegación del lienzo: zoom con la rueda centrado en el mouse,
// desplazamiento con botón del medio o espacio + arrastrar, y F para encuadrar.
// Solo mueve la cámara; no toca el documento (no pasa por Comandos).

import type { Camara, Punto } from "../render/camara";

/** Sensibilidad de la rueda: zoom × e^(−deltaY · k), con deltaY en píxeles. */
const SENSIBILIDAD_RUEDA = 0.0015;
/** Píxeles por "línea" de rueda (deltaMode 1, típico de Firefox en Linux). */
const PX_POR_LINEA = 16;

export interface OpcionesNavegacion {
  camara: Camara;
  /** La cámara cambió: redibujar y actualizar indicadores. */
  alCambiar: () => void;
  /** Pedido de encuadrar todo (tecla F). */
  alEncuadrar: () => void;
  /** Posición del mouse en unidades de grilla; null si salió del lienzo. */
  alMoverCursor?: (p: Punto | null) => void;
}

/** True si la tecla la está recibiendo un campo donde se escribe. */
function esCampoEditable(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  return destino.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(destino.tagName);
}

/** True si el espacio activaría un botón con foco: ahí no se roba la tecla. */
function esBoton(destino: EventTarget | null): boolean {
  return destino instanceof HTMLElement && destino.tagName === "BUTTON";
}

/** Conecta la navegación al canvas. Devuelve la función que la desconecta. */
export function conectarNavegacion(canvas: HTMLCanvasElement, op: OpcionesNavegacion): () => void {
  const { camara } = op;
  let espacio = false;
  let arrastre: { id: number; x: number; y: number } | null = null;

  const posicion = (e: MouseEvent): Punto => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const actualizarCursor = () => {
    canvas.style.cursor = arrastre ? "grabbing" : espacio ? "grab" : "";
  };

  const alRueda = (e: WheelEvent) => {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= PX_POR_LINEA;
    else if (e.deltaMode === 2) delta *= canvas.clientHeight;
    const p = posicion(e);
    if (camara.zoomEn(camara.zoom * Math.exp(-delta * SENSIBILIDAD_RUEDA), p.x, p.y)) {
      op.alCambiar();
      op.alMoverCursor?.(camara.aGrilla(p.x, p.y));
    }
  };

  const alPresionar = (e: PointerEvent) => {
    const conMedio = e.button === 1;
    const conEspacio = e.button === 0 && espacio;
    if (!conMedio && !conEspacio) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY };
    actualizarCursor();
  };

  const alMover = (e: PointerEvent) => {
    if (arrastre && e.pointerId === arrastre.id) {
      camara.desplazar(e.clientX - arrastre.x, e.clientY - arrastre.y);
      arrastre.x = e.clientX;
      arrastre.y = e.clientY;
      op.alCambiar();
    }
    const p = posicion(e);
    op.alMoverCursor?.(camara.aGrilla(p.x, p.y));
  };

  const alSoltar = (e: PointerEvent) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    arrastre = null;
    actualizarCursor();
  };

  const alSalir = () => {
    if (!arrastre) op.alMoverCursor?.(null);
  };

  // Evita el autodesplazamiento del botón del medio (Windows) y el pegado (Linux).
  const anularMedio = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  const alBajarTecla = (e: KeyboardEvent) => {
    if (esCampoEditable(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.code === "Space") {
      if (esBoton(e.target)) return;
      e.preventDefault();
      if (!espacio) {
        espacio = true;
        actualizarCursor();
      }
    } else if (e.code === "KeyF" && !e.repeat && !e.shiftKey) {
      e.preventDefault();
      op.alEncuadrar();
    }
  };

  const alSubirTecla = (e: KeyboardEvent) => {
    if (e.code !== "Space") return;
    espacio = false;
    actualizarCursor();
  };

  // Si la ventana pierde el foco con el espacio apretado, no llega el keyup.
  const alPerderFoco = () => {
    espacio = false;
    actualizarCursor();
  };

  canvas.addEventListener("wheel", alRueda, { passive: false });
  canvas.addEventListener("pointerdown", alPresionar);
  canvas.addEventListener("pointermove", alMover);
  canvas.addEventListener("pointerup", alSoltar);
  canvas.addEventListener("pointercancel", alSoltar);
  canvas.addEventListener("pointerleave", alSalir);
  canvas.addEventListener("mousedown", anularMedio);
  canvas.addEventListener("auxclick", anularMedio);
  window.addEventListener("keydown", alBajarTecla);
  window.addEventListener("keyup", alSubirTecla);
  window.addEventListener("blur", alPerderFoco);

  return () => {
    canvas.removeEventListener("wheel", alRueda);
    canvas.removeEventListener("pointerdown", alPresionar);
    canvas.removeEventListener("pointermove", alMover);
    canvas.removeEventListener("pointerup", alSoltar);
    canvas.removeEventListener("pointercancel", alSoltar);
    canvas.removeEventListener("pointerleave", alSalir);
    canvas.removeEventListener("mousedown", anularMedio);
    canvas.removeEventListener("auxclick", anularMedio);
    window.removeEventListener("keydown", alBajarTecla);
    window.removeEventListener("keyup", alSubirTecla);
    window.removeEventListener("blur", alPerderFoco);
  };
}
