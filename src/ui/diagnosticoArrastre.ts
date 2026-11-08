// Diagnóstico del arrastre (alpha.2): corre la prueba automática del menú de
// desarrollo sobre la vista real, con cuadros y tiempos de verdad.
//
// A cada zoom: selecciona los mismos 40 (los más cercanos al centro, enteros
// en pantalla) y, por cada combinación, los arrastra con el mismo recorrido
// durante 5 s, como lo haría el mouse (por la herramienta Seleccionar).
// Termina con Esc: el documento no cambia.
//
// Dos pasadas por combinación: una sin sonda, de donde salen los tiempos
// (la sonda no los contamina), y otra con la sonda por muestreo, de donde
// sale "dinámica X ms" y cuánto cuesta medir.

import type { DiagnosticoArrastre, Editor } from "../editor/editor";
import type { EventoHerramienta } from "../editor/herramientas/tipos";
import type { MedidaCuadro } from "../render/rendimiento";
import type { Vista } from "../render/vista";
import {
  ARRASTRADOS_DIAGNOSTICO,
  COMBINACIONES,
  DURACION_DIAGNOSTICO_MS,
  recorrido,
  resumirPasada,
  ZOOMS_DIAGNOSTICO,
  type Pasada,
  type ResultadoCombinacion,
} from "./diagnostico";

export interface OpcionesDiagnostico {
  duracionMs?: number;
  zooms?: readonly number[];
  /** Avisa el avance ("58 % · contornos · sin sonda"). */
  progreso?: (texto: string) => void;
}

const cuadro = () => new Promise<number>((r) => requestAnimationFrame(r));

export async function probarArrastre(vista: Vista, editor: Editor, op: OpcionesDiagnostico = {}): Promise<ResultadoCombinacion[]> {
  const duracion = op.duracionMs ?? DURACION_DIAGNOSTICO_MS;
  const zooms = op.zooms ?? ZOOMS_DIAGNOSTICO;
  const opcionesAntes = { ...vista.opciones };
  const diagnosticoAntes: DiagnosticoArrastre = { ...editor.diagnostico };
  const camara = vista.camara;

  // Cada cuadro dibujado, mientras se graba.
  let grabando: Pasada | null = null;
  /** Se avisa en cada cuadro (para esperar a que la pantalla quede nítida). */
  let alCuadro: ((m: MedidaCuadro) => void) | null = null;
  const alDibujarAntes = vista.alDibujar;
  vista.alDibujar = (m) => {
    alDibujarAntes?.(m);
    if (grabando) {
      grabando.instantes.push(performance.now());
      grabando.dibujo.push(m.total);
    }
    alCuadro?.(m);
  };

  /** Pide un cuadro y espera a que no quede nada pendiente (mosaicos, zoom); como mucho 3 s. */
  const nitida = () =>
    new Promise<void>((listo) => {
      const tope = setTimeout(fin, 3000);
      function fin() {
        clearTimeout(tope);
        alCuadro = null;
        listo();
      }
      alCuadro = (m) => {
        if (!m.pendiente && m.esperar === 0) fin();
      };
      vista.invalidar();
    });

  const evento = (x: number, y: number): EventoHerramienta => ({
    x,
    y,
    boton: 0,
    botones: 1,
    mayus: false,
    ctrl: false,
    escala: camara.escala,
  });

  const resultados: ResultadoCombinacion[] = [];
  try {
    for (const zoom of zooms) {
      const caja = vista.contenido?.caja;
      if (!caja) throw new Error("La escena está vacía.");
      camara.zoom = zoom;
      camara.centrar(caja.x + caja.ancho / 2, caja.y + caja.alto / 2, vista.ancho, vista.alto);
      await nitida();

      // Los mismos 40: los más cercanos al centro de la pantalla, enteros adentro.
      const v = camara.visible(vista.ancho, vista.alto);
      const cx = v.x + v.ancho / 2;
      const cy = v.y + v.alto / 2;
      const distancia = (id: string) => {
        const c = editor.escena.obtener(id)!;
        return (c.x - cx) ** 2 + (c.y - cy) ** 2;
      };
      const ids = editor.escena
        .idsEnCaja(v, "contiene")
        .sort((a, b) => distancia(a) - distancia(b))
        .slice(0, ARRASTRADOS_DIAGNOSTICO);
      if (ids.length === 0) throw new Error("No hay componentes en pantalla.");
      // Se aprieta sobre el primero que se elige con un clic en su posición.
      const ancla = ids.map((id) => editor.escena.obtener(id)!).find((c, i) => editor.escena.idEnPunto(c.x, c.y, 0) === ids[i]);
      if (!ancla) throw new Error("No hay un componente donde apretar.");

      for (const comb of COMBINACIONES) {
        const filas: Partial<Record<"sinSonda" | "conSonda", Pasada>> = {};
        for (const sonda of [false, true]) {
          op.progreso?.(`${Math.round(zoom * 100)} % · ${comb.nombre} · ${sonda ? "con sonda" : "sin sonda"}`);
          vista.opciones = { ...opcionesAntes, cacheTextosDinamica: comb.cache };
          editor.diagnostico = { modo: comb.modo, sonda };
          editor.seleccionarIds(ids);
          await nitida();

          editor.tomarMuestras();
          const textos = { ...vista.textosDinamica };
          const pasada: Pasada = { instantes: [], dibujo: [], muestras: [], aciertos: 0, fallos: 0 };
          grabando = pasada;
          editor.aplicar(editor.activa.presionar(evento(ancla.x, ancla.y)));
          const t0 = performance.now();
          for (let t = 0; t < duracion; t = performance.now() - t0) {
            const { dx, dy } = recorrido(t);
            editor.aplicar(editor.activa.mover(evento(ancla.x + dx, ancla.y + dy)));
            await cuadro();
          }
          // Esc: los arrastrados vuelven a su lugar, sin comando.
          editor.aplicar(editor.seleccionar.cancelar());
          grabando = null;
          pasada.muestras = editor.tomarMuestras();
          pasada.aciertos = vista.textosDinamica.aciertos - textos.aciertos;
          pasada.fallos = vista.textosDinamica.fallos - textos.fallos;
          filas[sonda ? "conSonda" : "sinSonda"] = pasada;
          await nitida();
        }
        resultados.push({
          zoom,
          combinacion: comb,
          sinSonda: resumirPasada(filas.sinSonda!),
          conSonda: resumirPasada(filas.conSonda!),
        });
      }
    }
  } finally {
    grabando = null;
    alCuadro = null;
    if (editor.arrastrando) editor.aplicar(editor.seleccionar.cancelar());
    vista.alDibujar = alDibujarAntes;
    vista.opciones = opcionesAntes;
    editor.diagnostico = diagnosticoAntes;
    editor.tomarMuestras();
  }
  return resultados;
}
