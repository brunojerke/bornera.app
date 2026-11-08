// Despachador de punteros: lleva los eventos del lienzo (y del arrastre que
// empieza en la paleta) a la herramienta activa del Editor (Colocar, o
// Seleccionar si no hay otra), ya pasados a unidades de grilla. La cámara la sigue manejando navegacion.ts, que se
// conecta antes: lo que ella consume (botón del medio, espacio + arrastrar)
// llega con `defaultPrevented` y acá se ignora.
//
// El arrastre desde la paleta usa Pointer Events y no el drag & drop de HTML:
// en Tauri sobre Windows, la ventana intercepta el drag & drop del WebView
// (`dragDropEnabled`) y no llegaría al lienzo.
//
// Con el botón izquierdo apretado sobre el lienzo, el puntero se captura: el
// rectángulo de selección sigue al mouse y termina aunque se suelte afuera.
//
// Teclado: Esc y los atajos del editor (atajos.ts: R, M, Supr, Ctrl+Z…) van
// por un solo listener en window, así andan aunque el foco quede en la
// paleta o en un botón. Se ignoran en los campos donde se escribe (el campo
// recibe su letra y su propio Ctrl+Z), con un diálogo modal abierto y cuando
// `atajosActivos` dice que no (modo Simular). Hay un solo listener por
// lienzo: `desconectar` lo quita, y Lienzo desconecta antes de conectar otro
// editor (escenas del banco), así una tecla nunca actúa dos veces.

import type { DefinicionSimbolo } from "../core/symbols";
import type { Camara } from "../render/camara";
import { accionDeTecla, teclaDe } from "./atajos";
import type { Editor } from "./editor";
import { HerramientaColocar } from "./herramientas/colocar";
import { UMBRAL_ARRASTRE_PX, type EventoHerramienta } from "./herramientas/tipos";
import { esCampoEditable } from "./navegacion";

export { UMBRAL_ARRASTRE_PX };

export interface OpcionesHerramientas {
  camara: Camara;
  editor: Editor;
  /**
   * Si se edita ahora (no en modo Simular). Por defecto, sí. En Simular ni
   * los atajos ni el puntero llegan a las herramientas: clic, rectángulo y
   * arrastre no cambian la selección ni el documento. La navegación (rueda,
   * botón del medio, espacio) va aparte y sigue andando.
   */
  atajosActivos?: () => boolean;
}

/** Hay un diálogo modal abierto: el teclado es suyo. */
export function hayModal(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

/**
 * Si el foco está en un campo (la etiqueta del panel), lo suelta: el campo
 * confirma lo escrito en su blur, sobre el componente que se estaba editando,
 * antes de que la herramienta cambie la selección. Sin esto, el pointerdown
 * llega antes que la pérdida de foco (y con preventDefault puede no haberla).
 */
function soltarFocoDeCampo(): void {
  const a = document.activeElement;
  if (a instanceof HTMLElement && esCampoEditable(a)) a.blur();
}

export interface Herramientas {
  /** Empieza a colocar `def` desde un pointerdown en la paleta. */
  desdePaleta(def: DefinicionSimbolo, e: PointerEvent): void;
  /**
   * La cámara cambió (rueda, desplazar, encuadrar, botones de zoom): la
   * herramienta vuelve a mirar qué hay bajo el cursor, que quedó quieto.
   */
  refrescar(): void;
  desconectar(): void;
}

export function conectarHerramientas(canvas: HTMLCanvasElement, op: OpcionesHerramientas): Herramientas {
  const { camara, editor } = op;
  /** Hay un arrastre desde la paleta en curso: sus eventos van por window. */
  let arrastrando = false;
  let quitarArrastre: (() => void) | null = null;

  /** Último puntero sobre el lienzo (px de la ventana); null si salió. */
  let ultimo: { clientX: number; clientY: number; buttons: number } | null = null;

  const editando = () => op.atajosActivos?.() !== false;

  const evento = (e: Pick<PointerEvent, "clientX" | "clientY" | "button" | "buttons" | "shiftKey" | "ctrlKey">): EventoHerramienta => {
    const r = canvas.getBoundingClientRect();
    const p = camara.aGrilla(e.clientX - r.left, e.clientY - r.top);
    return {
      x: p.x,
      y: p.y,
      boton: e.button,
      botones: e.buttons,
      mayus: e.shiftKey,
      ctrl: e.ctrlKey,
      escala: camara.escala,
    };
  };

  const sobreLienzo = (e: PointerEvent): boolean => {
    const r = canvas.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
  };

  // El cursor va en el contenedor: el canvas no tiene cursor propio y lo
  // hereda, salvo cuando la navegación le pone uno (mano al desplazar).
  const contenedor = canvas.parentElement;
  let cursor = "";
  const actualizarCursor = () => {
    const nuevo = editor.cable ? "crosshair" : editor.herramienta ? "copy" : editor.arrastrando ? "move" : "";
    if (contenedor && nuevo !== cursor) contenedor.style.cursor = cursor = nuevo;
  };
  const avisoAnterior = editor.alCambiarHerramienta;
  editor.alCambiarHerramienta = () => {
    actualizarCursor();
    avisoAnterior?.();
  };

  const alMover = (e: PointerEvent) => {
    ultimo = { clientX: e.clientX, clientY: e.clientY, buttons: e.buttons };
    if (arrastrando || !editando()) return;
    editor.aplicar(editor.activa.mover(evento(e)));
    actualizarCursor(); // "move" mientras se arrastra la selección
  };

  const alPresionar = (e: PointerEvent) => {
    soltarFocoDeCampo();
    if (arrastrando || e.defaultPrevented || e.button === 1 || !editando()) return;
    e.preventDefault();
    if (e.button === 0) canvas.setPointerCapture(e.pointerId);
    editor.aplicar(editor.activa.presionar(evento(e)));
  };

  const alSoltar = (e: PointerEvent) => {
    // El arrastre desde la paleta se suelta por su cuenta (en window).
    if (arrastrando || e.button !== 0 || !editando()) return;
    // Con el puntero capturado, el soltar llega aunque sea afuera: la herramienta cable no fija nada ahí.
    editor.aplicar(editor.activa.soltar({ ...evento(e), fuera: !sobreLienzo(e) }));
    actualizarCursor();
  };

  const alCortar = () => {
    if (arrastrando || !editando()) return;
    editor.aplicar(editor.activa.soltar(null));
    actualizarCursor();
  };

  const alSalir = () => {
    ultimo = null;
    if (!arrastrando && editando()) editor.aplicar(editor.activa.salir());
  };

  // Con una herramienta activa, el botón derecho la termina: sin menú del navegador.
  const alMenu = (e: MouseEvent) => {
    if (editor.herramienta) e.preventDefault();
  };

  // Esc: termina Colocar o cancela el cable en curso (sin tramo, termina la
  // herramienta cable); sin herramienta, corta el rectángulo o deselecciona.
  // Los demás atajos van al editor, que decide si se pueden hacer ahora.
  const alTecla = (e: KeyboardEvent) => {
    if (esCampoEditable(e.target)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (editor.herramienta) {
        terminarArrastre();
        editor.escape();
        actualizarCursor();
      } else {
        editor.aplicar(editor.seleccionar.cancelar());
        actualizarCursor();
      }
      return;
    }
    const accion = accionDeTecla(teclaDe(e));
    if (!accion || hayModal() || op.atajosActivos?.() === false) return;
    // Aunque el editor la ignore (en medio de un arrastre), la tecla es
    // nuestra: Ctrl+Y no abre el historial del navegador.
    e.preventDefault();
    editor.accion(accion);
    actualizarCursor();
  };

  function terminarArrastre() {
    quitarArrastre?.();
    quitarArrastre = null;
    arrastrando = false;
  }

  function desdePaleta(def: DefinicionSimbolo, e: PointerEvent) {
    if (e.button !== 0 || !editando()) return;
    e.preventDefault(); // sin selección de texto ni foco al arrastrar
    soltarFocoDeCampo();
    terminarArrastre();
    // Clic otra vez en el símbolo que ya se está colocando: se deja de colocar.
    const actual = editor.herramienta;
    if (actual instanceof HerramientaColocar && actual.modo === "clic" && actual.def.tipo === def.tipo) {
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
  canvas.addEventListener("pointerup", alSoltar);
  canvas.addEventListener("pointercancel", alCortar);
  canvas.addEventListener("pointerleave", alSalir);
  canvas.addEventListener("contextmenu", alMenu);
  window.addEventListener("keydown", alTecla);

  return {
    desdePaleta,
    refrescar() {
      if (arrastrando || !ultimo || !editor.cable || !editando()) return;
      editor.aplicar(editor.activa.mover(evento({ ...ultimo, button: 0, shiftKey: false, ctrlKey: false })));
    },
    desconectar() {
      terminarArrastre();
      editor.cancelarHerramienta();
      editor.alCambiarHerramienta = avisoAnterior;
      actualizarCursor();
      canvas.removeEventListener("pointermove", alMover);
      canvas.removeEventListener("pointerdown", alPresionar);
      canvas.removeEventListener("pointerup", alSoltar);
      canvas.removeEventListener("pointercancel", alCortar);
      canvas.removeEventListener("pointerleave", alSalir);
      canvas.removeEventListener("contextmenu", alMenu);
      window.removeEventListener("keydown", alTecla);
    },
  };
}
