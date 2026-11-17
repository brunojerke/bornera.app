// «Probar la fase 3b» del menú de desarrollo (cierre 3b, etapa 4; plan en
// docs/plan-cierre-3b.md, sección 7): corre en la app real los escenarios del
// banco de la checklist de la netbook (docs/netbook-fase3b.md, sección B) y
// devuelve la tabla para copiar.
//
// Los escenarios no se copian: se importan de tests/bench/escenarios.ts con
// `import()`, así quedan en un archivo aparte que se pide solo al tocar el
// botón. Corren como en el banco: en un lienzo fuera de pantalla de
// 1366×768, en el mismo orden (primero la escena de 500 y después la de
// 2000 con cables) y con la escena con cables en un Editor propio. La hoja
// del usuario no se toca: ni su editor ni su lienzo.

import { crearEscenaBanco } from "../render/banco";
import { corre, elegir, ESCENARIOS_500, evaluar, OBLIGATORIOS_CABLES, textoParaCopiar, type MedidaFase3b } from "./fase3b";
import { VERSION } from "./version";

/** Deja respirar a la interfaz entre escenarios (y que se vea el progreso). */
const respirar = () => new Promise((r) => setTimeout(r, 0));

/** Motor del WebView o del navegador (Edg/…, Chrome/…), como en el banco. */
function motor(): string {
  const ua = navigator.userAgent;
  return /Edg\/[\d.]+/.exec(ua)?.[0] ?? /Chrome\/[\d.]+/.exec(ua)?.[0] ?? /AppleWebKit\/[\d.]+/.exec(ua)?.[0] ?? ua;
}

/** El banco, cargado una vez (un archivo aparte que se pide la primera vez). */
const cargarBanco = () => import("../../tests/bench/escenarios");

/** Si ya se calentó en este proceso (la 1.ª corrida tras abrir la app). */
let calentado = false;

/**
 * Corre los escenarios y devuelve lo que midió cada uno. `progreso` recibe
 * el nombre del escenario que empieza.
 */
export async function medirFase3b(progreso: (escenario: string) => void = () => {}): Promise<MedidaFase3b[]> {
  const banco = await cargarBanco();
  const medidas: MedidaFase3b[] = [];
  const opciones = banco.OPCIONES.optimizado;

  // La escena de 500, como en el banco (antes que la de cables).
  const escena500 = crearEscenaBanco(500);
  for (const e of elegir(banco.ESCENARIOS, (n) => ESCENARIOS_500.includes(n), ESCENARIOS_500)) {
    progreso(`${e.nombre} con 500`);
    await respirar();
    medidas.push({ escenario: e.nombre, ...banco.medir(escena500, e, opciones) });
  }

  // La de 2000 con cables, en un Editor propio (no el de la hoja).
  try {
    const ed = banco.abrirEditorCables(false);
    for (const e of elegir(banco.escenariosCables(false), corre, OBLIGATORIOS_CABLES)) {
      progreso(e.nombre);
      await respirar();
      medidas.push({ escenario: e.nombre, ...banco.medir(ed.escena, e, opciones) });
    }
  } finally {
    banco.cerrarEditorCables();
  }
  return medidas;
}

/** Corre los escenarios y devuelve la tabla para copiar. */
export async function probarFase3b(progreso: (escenario: string) => void = () => {}): Promise<string> {
  const inicio = performance.now();
  // La 1.ª corrida tras abrir la app es una pasada entera sin medir (T20,
  // docs/plan-fase4.md): en frío, el getImageData con el lienzo en GPU sumaba
  // decenas de ms (B8, B15, B16; docs/bench.md). La corta (1 repetición)
  // tardaba lo mismo.
  let calentamiento = "";
  if (!calentado) {
    await medirFase3b((e) => progreso(`Calentando: ${e}`));
    calentado = true;
    calentamiento = `Con calentamiento (${Math.round((performance.now() - inicio) / 1000)} s) · `;
  }
  const medidas = await medirFase3b(progreso);
  const banco = await cargarBanco();
  const segundos = Math.round((performance.now() - inicio) / 1000);
  const fecha = new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  const encabezado =
    `Probar la fase 3b · Bornera ${VERSION} · ${fecha} · ${motor()} · ${calentamiento}` +
    `lienzo ${banco.ANCHO}×${banco.ALTO} fuera de pantalla · ${segundos} s`;
  return textoParaCopiar(evaluar(medidas), encabezado);
}
