// «Copias de recuperación» del menú de desarrollo (T23, etapa 1): las copias
// del almacén, de quién son y si abren, más cómo viene el autoguardado de
// esta instancia. Sirve para verificar S2 y S3 a mano (docs/plan-T23.md) y,
// en la netbook, para ver que la copia sale.
//
// El dueño se mira con `navigator.locks.query()`, sin tomar ningún candado:
// mirar no cambia nada.

import { deserializar } from "../core/io";
import type { EstadoAutoguardado } from "./autoguardado";
import type { AlmacenCopias, Candados, RegistroCopia } from "./respaldo";

const unDecimal = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const entero = new Intl.NumberFormat("es-AR");
const ms = (n: number) => `${unDecimal.format(n)} ms`;
const hora = (fecha: number) => new Date(fecha).toLocaleTimeString("es-AR", { hour12: false });

/** Los primeros 8 caracteres del id, para la tabla. */
export const idCorto = (id: string) => id.slice(0, 8);

/** El nombre de la copia: el del archivo, o el título si nunca se guardó. */
export function nombreCopia(r: Pick<RegistroCopia, "archivo" | "titulo">): string {
  return r.archivo?.nombre ?? `${r.titulo.trim() || "Sin título"} (nunca se guardó)`;
}

export interface DatosListaCopias {
  idPropio: string;
  /** Null si IndexedDB no abrió; `fallo` dice por qué. */
  almacen: AlmacenCopias | null;
  fallo: string | null;
  /** Null si no hay Web Locks. */
  candados: Candados | null;
  estado: EstadoAutoguardado | null;
  version: string;
  motor: string;
  fecha: string;
}

/** La línea del autoguardado de esta instancia. */
export function lineaAutoguardado(e: EstadoAutoguardado | null): string {
  if (!e) return "Autoguardado: no arrancó";
  if (e.apagado) return `Autoguardado: apagado (${e.apagado})`;
  const partes = [`${e.hechas} copias hechas, ${e.fallidas} fallidas, ${e.canceladas} canceladas`];
  if (e.ultima) {
    const c = e.ultima.copia;
    partes.push(
      `la última a las ${hora(e.ultima.fecha)}: paso más largo ${ms(Math.max(...c.pasos))}, ${c.pasos.length} pasos, ` +
        `${ms(c.duracionMs)} en total, ${c.reinicios} reinicios`,
    );
  }
  partes.push(`salida de emergencia: ${e.emergencias} veces${e.emergencias > 0 ? `, máx. ${ms(e.emergenciaMaxMs)}` : ""}`);
  return `Autoguardado: ${partes.join(" · ")}`;
}

/** El texto para copiar: encabezado, autoguardado y una fila por copia, la más nueva primero. */
export async function textoCopias(d: DatosListaCopias): Promise<string> {
  const lineas = [
    `Copias de recuperación · Bornera ${d.version} · ${d.fecha} · ${d.motor}`,
    `Esta instancia: ${idCorto(d.idPropio)} · Web Locks: ${d.candados ? "sí" : "no (sin navigator.locks)"}`,
    lineaAutoguardado(d.estado),
    "",
  ];
  if (!d.almacen) return [...lineas, `IndexedDB no abrió: ${d.fallo ?? "sin motivo"}`].join("\n");
  const registros = (await d.almacen.listar()).sort((a, b) => b.fecha - a.fecha);
  if (registros.length === 0) return [...lineas, "Sin copias."].join("\n");
  const vivos = d.candados ? await d.candados.conDueno() : null;
  lineas.push("| Copia | Dueño | Nombre | Hora | Componentes | Trozos | Caracteres | Abre |", "|---|---|---|---|---|---|---|---|");
  for (const r of registros) {
    const dueno = r.id === d.idPropio ? "esta instancia" : !vivos ? "?" : vivos.has(r.id) ? "otra instancia viva" : "sin dueño";
    const leida = await d.almacen.leer(r.id);
    let abre: string;
    if (!leida.ok) abre = `no: ${leida.problema}`;
    else {
      const a = deserializar(leida.texto);
      abre = a.ok ? "sí" : `no: ${a.errores[0]?.mensaje ?? "?"}`;
    }
    lineas.push(
      `| ${idCorto(r.id)} | ${dueno} | ${nombreCopia(r)} | ${hora(r.fecha)} | ${r.componentes} | ${r.trozos} | ${entero.format(r.caracteres)} | ${abre} |`,
    );
  }
  return lineas.join("\n");
}
