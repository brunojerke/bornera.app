// Cuándo se abre solo el panel de propiedades, y cómo se muestran sus datos.

/**
 * True si el panel tiene que abrirse solo: la selección pasó de vacía a tener
 * algo y el usuario no lo plegó a mano. Si lo plegó, queda plegado hasta que
 * lo vuelva a abrir él (el panel le quita lugar al lienzo en 1024×600).
 */
export function abrirAlSeleccionar(antes: number, despues: number, plegadoPorUsuario: boolean): boolean {
  return antes === 0 && despues > 0 && !plegadoPorUsuario;
}

/** "1 componente seleccionado", "3 componentes seleccionados". */
export function textoCantidad(n: number): string {
  return n === 1 ? "1 componente seleccionado" : `${n} componentes seleccionados`;
}
