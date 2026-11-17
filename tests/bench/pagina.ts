// Banco de dibujado: corre dentro del navegador headless que abre correr.mjs.
// Arma las escenas de 100, 500 y 2000 símbolos y la de 2000 con cables en un
// Editor, corre los escenarios de escenarios.ts en orden y manda los tiempos
// al script por POST. Con `?escena-t12`, la de cables es la de T12; con
// `?escena-012`, las de 100, 500 y 2000 con los símbolos de 0.1.2; con
// `?comparar`, también sin caché de textos y sin optimizar. Al final, la copia
// de recuperación con 2000 + 3030 cables (F1 de T23), en el IndexedDB del
// perfil temporal: informativa, F1 se juzga en WebView2.

import { CANTIDADES_BANCO, crearEscenaBanco, simbolosEscena012 } from "../../src/render/banco";
import { medirTope, type MedidaTope } from "../../src/editor/medicionTope";
import { SIMBOLOS_BANCO_CABLES } from "../../src/ui/escenas";
import { medirCopia } from "../../src/ui/medirCopia";
import {
  ALTO,
  ANCHO,
  DPR,
  ESCENARIOS,
  OPCIONES,
  abrirEditorCables,
  escenariosCables,
  medir,
  type Medicion,
  type Modo,
} from "./escenarios";

export interface Resultado {
  navegador: string;
  ancho: number;
  alto: number;
  dpr: number;
  mediciones: Medicion[];
  /** MB de heap JS con cada escena armada (null si el navegador no lo informa). */
  memoria: { componentes: number | string; heapMB: number | null }[];
  /** Paso de la previa según los cables que se acomodan (para TOPE_CABLES_PREVIA). */
  tope: MedidaTope[];
  /** La escena con cables medida. */
  escenaCables: "T14a" | "T12";
  /** Las escenas de 100, 500 y 2000 con los símbolos de 0.1.2 (`--escena-012`). */
  escena012: boolean;
  /** El texto de «Medir la copia (F1)» con la escena de 2000 + 3030 cables (T23). */
  copia: string;
}

/** Heap JS en MB, después de recolectar basura si el navegador lo permite. */
function heapMB(): number | null {
  (globalThis as { gc?: () => void }).gc?.();
  const memoria = (performance as { memory?: { usedJSHeapSize: number } }).memory;
  return memoria ? memoria.usedJSHeapSize / 2 ** 20 : null;
}

async function enviar(cuerpo: unknown): Promise<void> {
  await fetch("/__bench", { method: "POST", body: JSON.stringify(cuerpo) });
}

/** Deja respirar al navegador entre mediciones (y que se vea el progreso). */
const respirar = () => new Promise((r) => setTimeout(r, 0));

async function correr(): Promise<void> {
  const estado = document.getElementById("estado")!;
  const parametros = new URLSearchParams(location.search);
  const comparar = parametros.has("comparar");
  const t12 = parametros.has("escena-t12");
  const escena012 = parametros.has("escena-012");
  const modos: Modo[] = comparar ? ["optimizado", "sin caché de textos", "sin optimizar"] : ["optimizado"];
  const resultado: Resultado = {
    navegador: navigator.userAgent,
    ancho: ANCHO,
    alto: ALTO,
    dpr: DPR,
    mediciones: [],
    memoria: [],
    tope: [],
    escenaCables: t12 ? "T12" : "T14a",
    escena012,
    copia: "",
  };

  for (const n of CANTIDADES_BANCO) {
    const escena = escena012 ? crearEscenaBanco(n, 1, simbolosEscena012()) : crearEscenaBanco(n);
    resultado.memoria.push({ componentes: n, heapMB: heapMB() });

    for (const escenario of ESCENARIOS) {
      for (const modo of modos) {
        estado.textContent = `${n} componentes · ${escenario.nombre} · ${modo}`;
        await respirar();
        resultado.mediciones.push({
          componentes: n,
          escenario: escenario.nombre,
          modo,
          ...medir(escena, escenario, OPCIONES[modo]),
        });
      }
    }
  }
  // La de 2000 con cables, en un Editor.
  const ed = abrirEditorCables(t12);
  const derivaciones = ed.documento.hojas[0]!.cables.filter((w) => w.desde.tipo === "cable" || w.hasta.tipo === "cable").length;
  const nombre = `${SIMBOLOS_BANCO_CABLES} + ${ed.escena.cantidadCables - derivaciones} cables` + (derivaciones > 0 ? ` + ${derivaciones} T` : "");
  resultado.memoria.push({ componentes: nombre, heapMB: heapMB() });
  for (const escenario of escenariosCables(t12)) {
    for (const modo of modos) {
      estado.textContent = `${nombre} · ${escenario.nombre} · ${modo}`;
      await respirar();
      resultado.mediciones.push({ componentes: nombre, escenario: escenario.nombre, modo, ...medir(ed.escena, escenario, OPCIONES[modo]) });
    }
  }

  // Paso de la previa según los cables que se acomodan (para fijar el tope).
  estado.textContent = `${nombre} · paso de la previa por cables acomodados`;
  await respirar();
  resultado.tope = medirTope();

  // La copia de recuperación (F1 de T23): la misma medición que el menú de
  // desarrollo y que «Probar la fase 4» (C1).
  resultado.copia = await medirCopia((t) => (estado.textContent = `Copia de recuperación: ${t}`));

  await enviar(resultado);
  estado.textContent = "Listo.";
}

addEventListener("error", (e) => void enviar({ error: String(e.error?.stack ?? e.message) }));
addEventListener("unhandledrejection", (e) => void enviar({ error: String(e.reason?.stack ?? e.reason) }));
correr().catch((e: unknown) => enviar({ error: String((e as Error)?.stack ?? e) }));
