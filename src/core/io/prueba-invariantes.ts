// Auxiliar de los tests del formato .brn (T15a). Solo lo importan los tests:
// el código de la app no lo usa.
import { indexarHoja, recorridoCable, seApoyaEn, validarHoja } from "../model/cables";
import type { Documento } from "../model/documento";

/** Invariantes de un documento que abre: cada hoja válida, sin ciclos de apoyos y sin T en el extremo de su anfitrión. */
export function invariantes(doc: Documento): string[] {
  const fallas: string[] = [];
  doc.hojas.forEach((hoja, h) => {
    for (const p of validarHoja(hoja)) fallas.push(`hoja ${h}, ${p.id}: ${p.mensaje}`);
    const indice = indexarHoja(hoja);
    for (const w of hoja.cables) {
      if (seApoyaEn(indice, w.id, w.id)) fallas.push(`hoja ${h}, ${w.id}: ciclo de apoyos`);
      for (const e of [w.desde, w.hasta]) {
        if (e.tipo !== "cable") continue;
        const anfitrion = indice.cables.get(e.cable);
        const p = anfitrion && recorridoCable(indice, anfitrion);
        if (!p) continue;
        const n = p.length;
        if ((p[0] === e.x && p[1] === e.y) || (p[n - 2] === e.x && p[n - 1] === e.y)) fallas.push(`hoja ${h}, ${w.id}: T en el extremo de ${e.cable}`);
      }
    }
  });
  return fallas;
}
