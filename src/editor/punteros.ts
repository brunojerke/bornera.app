// Despachador de punteros: lleva los eventos del lienzo (y del arrastre que
// empieza en la paleta) a la herramienta activa del Editor, ya pasados a
// unidades de grilla. La cámara la sigue manejando navegacion.ts, que se
// conecta antes: lo que ella consume (botón del medio, espacio + arrastrar)
// llega con `defaultPrevented` y acá se ignora.
//
// El arrastre desde la paleta usa Pointer Events y no el drag & drop de HTML:
// en Tauri sobre Windows, la ventana intercepta el drag & drop del WebView
// (`dragDropEnabled`) y no llegaría al lienzo.

import type { DefinicionSimbolo } from "../core/symbols";
import type { Camara } from "../render/camara";
import type { Editor } from "./editor";
import type { EventoHerramienta } from "./herramientas/tipos";
import { esCampoEditable } from "./navegacion";

/** Movimiento, en px CSS, a partir del cual apretar en la paleta es arrastrar y no clic. */
export const UMBRAL_ARRASTRE_PX = 4;

export interface OpcionesHerramientas {
  camara: Camara;
  editor: Editor;
}

export interface Herramientas {
  /** Empieza a colocar `def` desde un pointerdown en la paleta. */
  desdePaleta(def: DefinicionSimbolo, e: PointerEvent): void;
  desconectar(): void;
}

export function conectarHerramientas(canvas: HTMLCanvasElement, op: OpcionesHerramientas): Herramientas {
  const { camara, editor } = op;
  /** Hay un arrastre desde la paleta en curso: sus eventos van por window. */
  let arrastrando = false;
  let quitarArrastre: (() => void) | null = null;

  const evento = (e: PointerEvent): EventoHerramienta => {
    const r = canvas.getBoundingClientRect();
    const p = camara.aGrilla(e.clientX - r.left, e.clientY - r.top);
    return { x: p.x, y: p.y, boton: e.button, botones: e.buttons, mayus: e.shiftKey, ctrl: e.ctrlKey };
  };

  const sobreLienzo = (e: PointerEvent): boolean => {
    const r = canvas.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
  };

  // El cursor va en el contenedor: el canvas no tiene cursor propio y lo
  // hereda, salvo cuando la navegación le pone uno (mano al desplazar).
  const contenedor = canvas.parentElement;
  const actualizarCursor = () => {
    if (contenedor) contenedor.style.cursor = editor.herramienta ? "copy" : "";
  };
  const avisoAnterior = editor.alCambiarHerramienta;
  editor.alCambiarHerramienta = () => {
    actualizarCursor();
    avisoAnterior?.();
  };

  const alMover = (e: PointerEvent) => {
    const h = editor.herramienta;
    if (h && !arrastrando) editor.aplicar(h.mover(evento(e)));
  };

  const alPresionar = (e: PointerEvent) => {
    const h = editor.herramienta;
    if (!h || arrastrando || e.defaultPrevented || e.button === 1) return;
    e.preventDefault();
    editor.aplicar(h.presionar(evento(e)));
  };

  const alSalir = () => {
    const h = editor.herramienta;
    if (h && !arrastrando) editor.aplicar(h.salir());
  };

  // Con una herramienta activa, el botón derecho la termina: sin menú del navegador.
  const alMenu = (e: MouseEvent) => {
    if (editor.herramienta) e.preventDefault();
  };

  const alTecla = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !editor.herramienta || esCampoEditable(e.target)) return;
    e.preventDefault();
    terminarArrastre();
    editor.cancelarHerramienta();
  };

  function terminarArrastre() {
    quitarArrastre?.();
    quitarArrastre = null;
    arrastrando = false;
  }

  function desdePaleta(def: DefinicionSimbolo, e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault(); // sin selección de texto ni foco al arrastrar
    terminarArrastre();
    // Clic otra vez en el símbolo que ya se está colocando: se deja de colocar.
    const actual = editor.herramienta;
    if (actual && actual.modo === "clic" && actual.def.tipo === def.tipo) {
      editor.cancelarHerramienta();
      return;
    }
    const h = editor.iniciarColocar(def, "arrastre");
    if (!h) return;

    arrastrando = true;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const id = e.pointerId;
    let movio = false;

    const mover = (m: PointerEvent) => {
      if (m.pointerId !== id) return;
      if (Math.hypot(m.clientX - x0, m.clientY - y0) > UMBRAL_ARRASTRE_PX) movio = true;
      editor.aplicar(sobreLienzo(m) ? h.mover(evento(m)) : h.salir());
    };
    const soltar = (s: PointerEvent) => {
      if (s.pointerId !== id) return;
      terminarArrastre();
      if (sobreLienzo(s)) {
        editor.aplicar(h.soltar(evento(s)));
      } else if (!movio) {
        h.aClic(); // fue un clic en la paleta: ahora se coloca con clic en el lienzo
      } else {
        editor.aplicar(h.soltar(null));
      }
    };
    const cancelar = (c: PointerEvent) => {
      if (c.pointerId !== id) return;
      terminarArrastre();
      editor.cancelarHerramienta();
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", cancelar);
    quitarArrastre = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", cancelar);
    };
  }

  canvas.addEventListener("pointermove", alMover);
  canvas.addEventListener("pointerdown", alPresionar);
  canvas.addEventListener("pointerleave", alSalir);
  canvas.addEventListener("contextmenu", alMenu);
  window.addEventListener("keydown", alTecla);

  return {
    desdePaleta,
    desconectar() {
      terminarArrastre();
      editor.cancelarHerramienta();
      editor.alCambiarHerramienta = avisoAnterior;
      actualizarCursor();
      canvas.removeEventListener("pointermove", alMover);
      canvas.removeEventListener("pointerdown", alPresionar);
      canvas.removeEventListener("pointerleave", alSalir);
      canvas.removeEventListener("contextmenu", alMenu);
      window.removeEventListener("keydown", alTecla);
    },
  };
}
