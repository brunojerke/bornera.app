// Documento del banco de pruebas: los mismos componentes que la escena del
// banco (render/banco.ts), pero en un Documento, para abrirlo en un Editor y
// poder seleccionar, colocar y deshacer con 2000 símbolos (Ctrl+Shift+B).
//
// Se arma de cero, como al abrir un archivo: no es un cambio a un documento
// que ya existe, por eso no pasa por comandos (no hay nada que deshacer).

import { crearDocumento, generarId, type Documento } from "../core/model/documento";
import { generarBanco } from "../render/banco";

export function documentoBanco(cantidad: number, semilla = 1): Documento {
  const doc = crearDocumento({ titulo: `Banco de ${cantidad}`, autor: "", fecha: "2026-01-01" });
  doc.hojas[0]!.componentes = generarBanco(cantidad, semilla).map((c) => ({
    id: generarId(doc),
    tipo: c.def.tipo,
    x: c.x,
    y: c.y,
    rot: c.rotacion,
    espejado: c.espejado,
    etiqueta: c.etiqueta ?? "",
    params: {},
  }));
  return doc;
}
