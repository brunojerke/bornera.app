// Diagnóstico del arrastre (alpha.2, con cables desde T14a): corre la prueba
// automática del menú de desarrollo sobre la vista real, con cuadros y
// tiempos de verdad.
//
// A cada zoom: selecciona los mismos 40 (los más cercanos al centro, enteros
// en pantalla; en la escena con cables, el grupo del centro, con lugar
// alrededor) y, por cada combinación, los arrastra con el mismo recorrido
// durante 5 s, como lo haría el mouse (por la herramienta Seleccionar).
// Termina con Esc: el documento no cambia. Cada movimiento que cambia de
// punto de grilla se mide aparte (el paso: herramienta, plan de la previa y
// pista), solo si la previa vale: uno rechazado corta el plan antes y
// mediría de menos. Con cables, si la mayoría se rechaza la prueba falla.
//
// Dos pasadas por combinación: una sin sonda, de donde salen los tiempos
// (la sonda no los contamina), y otra con la sonda por muestreo, de donde
// sale "dinámica X ms" y cuánto cuesta medir.
//
// Con cables, al final: soltar los 40 en un lugar que vale (tiene que dar un
// paso; se deshace), arrastrar y soltar con todo seleccionado (el paso de la
// previa y el soltar; después se deshace), reconectar un extremo libre (T14c:
// el paso por clase de destino y el soltar; después se deshace) y el paso de
// la previa según los cables que se acomodan (para TOPE_CABLES_PREVIA).

import { grupoCentralBanco } from "../editor/banco";
import type { DiagnosticoArrastre, Editor } from "../editor/editor";
import type { EventoHerramienta } from "../editor/herramientas/tipos";
import { gestoReconexion } from "../editor/medicionReconectar";
import { medirTope } from "../editor/medicionTope";
import type { MedidaCuadro } from "../render/rendimiento";
import type { Vista } from "../render/vista";
import {
  ARRASTRADOS_DIAGNOSTICO,
  COMBINACIONES,
  DURACION_DIAGNOSTICO_MS,
  mediana,
  PASOS_ARRASTRE_TODO,
  recorrido,
  resumirPasada,
  VUELTAS_RECONECTAR,
  ZOOMS_DIAGNOSTICO,
  type ExtrasDiagnostico,
  type Pasada,
  type PasoMedido,
  type ResultadoCombinacion,
  type ResultadoReconectar,
  type ResultadoSoltar,
} from "./diagnostico";

export interface OpcionesDiagnostico {
  duracionMs?: number;
  zooms?: readonly number[];
  /** Avisa el avance ("58 % · contornos · sin sonda"). */
  progreso?: (texto: string) => void;
}

export interface ResultadoDiagnostico {
  combinaciones: ResultadoCombinacion[];
  extras: ExtrasDiagnostico;
}

const cuadro = () => new Promise<number>((r) => requestAnimationFrame(r));

export async function probarArrastre(vista: Vista, editor: Editor, op: OpcionesDiagnostico = {}): Promise<ResultadoDiagnostico> {
  const duracion = op.duracionMs ?? DURACION_DIAGNOSTICO_MS;
  const zooms = op.zooms ?? ZOOMS_DIAGNOSTICO;
  const opcionesAntes = { ...vista.opciones };
  const diagnosticoAntes: DiagnosticoArrastre = { ...editor.diagnostico };
  const camara = vista.camara;
  const conCables = editor.escena.cantidadCables > 0;

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

  /** Un id seleccionado donde un clic en su posición lo elige (para apretar ahí). */
  const anclaDe = (ids: readonly string[]) =>
    ids.map((id) => editor.escena.obtener(id)).find((c, i) => c !== undefined && editor.escena.idEnPunto(c.x, c.y, 0) === ids[i]) ?? null;

  const resultados: ResultadoCombinacion[] = [];
  let soltar: ResultadoSoltar | null = null;
  let soltarGrupo: ExtrasDiagnostico["soltarGrupo"] = null;
  let reconectar: ResultadoReconectar | null = null;
  let tope: ExtrasDiagnostico["tope"] = [];
  /** Con cables, los 40 del grupo del centro (los mismos en los dos zooms). */
  const grupo = conCables ? grupoCentralBanco(editor.documento).filter((id) => editor.escena.obtener(id)) : null;
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
      // Con cables, el grupo del centro: el caso de T14a (sus cables siguen en la previa).
      const ids =
        grupo ??
        editor.escena
          .idsEnCaja(v, "contiene")
          .filter((id) => !editor.escena.esCable(id))
          .sort((a, b) => distancia(a) - distancia(b))
          .slice(0, ARRASTRADOS_DIAGNOSTICO);
      if (ids.length === 0) throw new Error("No hay componentes en pantalla.");
      const ancla = anclaDe(ids);
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
          const pasada: Pasada = { instantes: [], dibujo: [], muestras: [], aciertos: 0, fallos: 0, pasos: [], rechazados: 0 };
          grabando = pasada;
          editor.aplicar(editor.activa.presionar(evento(ancla.x, ancla.y)));
          let punto = "0,0";
          const t0 = performance.now();
          for (let t = 0; t < duracion; t = performance.now() - t0) {
            const { dx, dy } = recorrido(t);
            const p0 = performance.now();
            editor.aplicar(editor.activa.mover(evento(ancla.x + dx, ancla.y + dy)));
            const ms = performance.now() - p0;
            // Solo los que cambian de punto de grilla: los otros no planean.
            const nuevo = `${Math.round(dx)},${Math.round(dy)}`;
            if (nuevo !== punto) {
              // La pista dice por qué no se puede soltar ahí: la previa quedó a
              // rayas con ✕. Ese paso no cuenta para el tiempo.
              if (editor.pista !== null) pasada.rechazados++;
              else pasada.pasos.push(ms);
            }
            punto = nuevo;
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
          if (conCables && 2 * pasada.rechazados > pasada.rechazados + pasada.pasos.length)
            throw new Error(
              `El arrastre de los ${ids.length} se rechazó en ${pasada.rechazados} de ${pasada.rechazados + pasada.pasos.length} puntos ` +
                `(${Math.round(zoom * 100)} %, ${comb.nombre}): no mide el arrastre.`,
            );
        }
        resultados.push({
          zoom,
          combinacion: comb,
          sinSonda: resumirPasada(filas.sinSonda!),
          conSonda: resumirPasada(filas.conSonda!),
        });
      }
    }

    if (conCables) {
      vista.opciones = { ...opcionesAntes };
      editor.diagnostico = { ...diagnosticoAntes };
      soltarGrupo = await soltarLosDelGrupo(grupo!);
      soltar = await soltarTodo();
      reconectar = await reconectarExtremo();
      op.progreso?.("paso de la previa según los cables que se acomodan");
      await cuadro();
      editor.seleccionarIds([]);
      tope = medirTope();
    }
  } finally {
    grabando = null;
    alCuadro = null;
    if (editor.arrastrando || editor.reconectando) editor.aplicar(editor.seleccionar.cancelar());
    vista.alDibujar = alDibujarAntes;
    vista.opciones = opcionesAntes;
    editor.diagnostico = diagnosticoAntes;
    editor.tomarMuestras();
  }
  return { combinaciones: resultados, extras: { soltar, soltarGrupo, tope, reconectar } };

  /** Pide un cuadro y espera el primero (devuelve su dibujo, ms) y a que la pantalla quede nítida; como mucho 5 s. */
  function primerCuadroYNitida(): Promise<number> {
    let primero = -1;
    return new Promise<number>((listo) => {
      const tope = setTimeout(fin, 5000);
      function fin() {
        clearTimeout(tope);
        alCuadro = null;
        listo(Math.max(0, primero));
      }
      alCuadro = (m) => {
        if (primero < 0) primero = m.total;
        if (!m.pendiente && m.esperar === 0) fin();
      };
      vista.invalidar();
    });
  }

  /** Los 40 del grupo, soltados en (3, 2): tiene que dar un paso (si no, falla). Mide el soltar y deshace. */
  async function soltarLosDelGrupo(ids: readonly string[]): Promise<{ comando: number }> {
    op.progreso?.(`soltar los ${ids.length} en un lugar que vale`);
    const caja = vista.contenido!.caja!;
    camara.zoom = zooms[0]!;
    camara.centrar(caja.x + caja.ancho / 2, caja.y + caja.alto / 2, vista.ancho, vista.alto);
    editor.seleccionarIds(ids);
    await nitida();
    const ancla = anclaDe(ids);
    if (!ancla) throw new Error("No hay un componente donde apretar.");
    const hechos = () => (editor.historial as unknown as { hechos: unknown[] }).hechos.length;
    const antes = hechos();
    editor.aplicar(editor.activa.presionar(evento(ancla.x, ancla.y)));
    editor.aplicar(editor.activa.mover(evento(ancla.x + 1, ancla.y)));
    await cuadro();
    editor.aplicar(editor.activa.mover(evento(ancla.x + 3, ancla.y + 2)));
    await nitida();
    const t0 = performance.now();
    editor.aplicar(editor.activa.soltar(evento(ancla.x + 3, ancla.y + 2)));
    const comando = performance.now() - t0;
    if (hechos() === antes) throw new Error(`Soltar los ${ids.length} en (3, 2) no dio un paso: no mide el arrastre.`);
    await nitida();
    editor.deshacer();
    editor.seleccionarIds([]);
    await nitida();
    return { comando };
  }

  /**
   * Todo seleccionado, al primer zoom: se aprieta, se arrastra dos puntos y
   * se suelta (un Mover con todo rígido). Mide el soltar, el primer cuadro y
   * hasta que queda nítida; después deshace.
   */
  async function soltarTodo(): Promise<ResultadoSoltar> {
    op.progreso?.("soltar con todo seleccionado");
    const caja = vista.contenido!.caja!;
    camara.zoom = zooms[0]!;
    camara.centrar(caja.x + caja.ancho / 2, caja.y + caja.alto / 2, vista.ancho, vista.alto);
    const todos = editor.escena.idsEnCaja(caja, "toca");
    editor.seleccionarIds(todos);
    await nitida();
    const v = camara.visible(vista.ancho, vista.alto);
    const ancla = anclaDe(editor.escena.idsEnCaja(v, "contiene").filter((id) => !editor.escena.esCable(id)));
    if (!ancla) throw new Error("No hay un componente donde apretar.");
    const pasos = (editor.historial as unknown as { hechos: unknown[] }).hechos.length;
    editor.aplicar(editor.activa.presionar(evento(ancla.x, ancla.y)));
    editor.aplicar(editor.activa.mover(evento(ancla.x + 1, ancla.y)));
    await cuadro();
    // El paso de la previa con todo seleccionado: cada movimiento cambia de
    // punto de grilla (el primero, que pasa el umbral y oculta todo, no cuenta).
    const pasosPrevia: number[] = [];
    for (let k = 1; k <= PASOS_ARRASTRE_TODO; k++) {
      const p0 = performance.now();
      editor.aplicar(editor.activa.mover(evento(ancla.x + 1 + (k % 4), ancla.y + (k % 2))));
      pasosPrevia.push(performance.now() - p0);
      await cuadro();
    }
    editor.aplicar(editor.activa.mover(evento(ancla.x + 2, ancla.y + 1)));
    await nitida();
    // El primer cuadro después de soltar y el momento en que queda nítida.
    const t0 = performance.now();
    editor.aplicar(editor.activa.soltar(evento(ancla.x + 2, ancla.y + 1)));
    const comando = performance.now() - t0;
    const aplicado = (editor.historial as unknown as { hechos: unknown[] }).hechos.length > pasos;
    const primerCuadro = await primerCuadroYNitida();
    const hastaNitida = performance.now() - t0;
    if (aplicado) editor.deshacer();
    editor.seleccionarIds([]);
    await nitida();
    return {
      seleccionados: todos.length,
      comando,
      primerCuadro,
      hastaNitida,
      aplicado,
      paso: { mediana: mediana(pasosPrevia), maximo: Math.max(...pasosPrevia), cantidad: pasosPrevia.length },
    };
  }

  /**
   * Reconectar un extremo libre (T14c), al primer zoom con la cámara en el
   * extremo: el gesto de medicionReconectar. Aprieta sobre el extremo y pasa
   * al primer destino (empieza; no cuenta); recorre los destinos
   * VUELTAS_RECONECTAR veces, un cuadro por destino, con el paso aparte por
   * clase (válidos y rechazados después de rutear; los de antes de rutear no
   * se miden); suelta en el destino válido (comando, primer cuadro y hasta
   * nítida) y deshace.
   */
  async function reconectarExtremo(): Promise<ResultadoReconectar> {
    op.progreso?.("reconectar un extremo libre");
    camara.zoom = zooms[0]!;
    const g = gestoReconexion(editor, camara.escala);
    camara.centrar(g.x, g.y, vista.ancho, vista.alto);
    editor.seleccionarIds([]);
    await nitida();
    const hechos = () => (editor.historial as unknown as { hechos: unknown[] }).hechos.length;
    const antes = hechos();
    editor.aplicar(editor.activa.presionar(evento(g.x, g.y)));
    editor.aplicar(editor.activa.mover(evento(g.recorrido[0]!.x, g.recorrido[0]!.y)));
    if (!editor.reconectando) throw new Error(`Apretar sobre el extremo de ${g.id} en (${g.x}, ${g.y}) no empezó a reconectar.`);
    await cuadro();
    const validos: number[] = [];
    const ruteados: number[] = [];
    let rechazadosAntes = 0;
    for (let v = 0; v < VUELTAS_RECONECTAR; v++) {
      for (let i = v === 0 ? 1 : 0; i < g.recorrido.length; i++) {
        const p = g.recorrido[i]!;
        const p0 = performance.now();
        editor.aplicar(editor.activa.mover(evento(p.x, p.y)));
        const ms = performance.now() - p0;
        if (p.clase === "valido") validos.push(ms);
        else if (p.clase === "rechazoRuteado") ruteados.push(ms);
        else rechazadosAntes++;
        await cuadro();
      }
    }
    editor.aplicar(editor.activa.mover(evento(g.soltar.x, g.soltar.y)));
    await nitida();
    const t0 = performance.now();
    editor.aplicar(editor.activa.soltar(evento(g.soltar.x, g.soltar.y)));
    const comando = performance.now() - t0;
    const aplicado = hechos() > antes;
    const primerCuadro = await primerCuadroYNitida();
    const hastaNitida = performance.now() - t0;
    if (aplicado) editor.deshacer();
    editor.seleccionarIds([]);
    await nitida();
    const medido = (v: readonly number[]): PasoMedido => ({ mediana: mediana(v), maximo: v.length ? Math.max(...v) : 0, cantidad: v.length });
    return {
      cable: g.id,
      lado: g.lado,
      soltarEn: g.soltar.texto,
      paso: medido(validos),
      pasoRechazado: medido(ruteados),
      rechazadosAntes,
      comando,
      primerCuadro,
      hastaNitida,
      aplicado,
    };
  }
}
