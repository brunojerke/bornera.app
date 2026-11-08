// T6: el lienzo dibuja el documento. Comandos desde la consola de desarrollo
// (`bornera`), deshacer y símbolo desconocido.

export const nombre = "El lienzo dibuja el documento";

export default async function (p, comprobar) {
  comprobar("arranca con el documento vacío", (await p.evaluar("bornera.editor.escena.cantidad")) === 0);

  const cantidad = await p.evaluar(`(() => {
    const { editor, comandos: c } = bornera;
    const base = { rot: 0, espejado: false, params: {} };
    editor.agrupar([
      c.colocar(editor.documento, { ...base, tipo: "fuente.fase", x: -8, y: -4, etiqueta: "L" }),
      c.colocar(editor.documento, { ...base, tipo: "pulsador.nc", x: -2, y: -3, etiqueta: "S0" }),
      c.colocar(editor.documento, { ...base, tipo: "contactor.bobina", x: 4, y: 0, etiqueta: "K1" }),
    ]);
    return editor.escena.cantidad;
  })()`);
  comprobar("un grupo de 3 Colocar se ve en la escena", cantidad === 3, cantidad);
  await p.captura("colocado");

  const tras = await p.evaluar("(() => { bornera.editor.deshacer(); return bornera.editor.escena.cantidad; })()");
  comprobar("deshacer el grupo saca los 3 en un paso", tras === 0, tras);

  // Un tipo que no está en la biblioteca se dibuja con "?", con un aviso por tipo (console.warn, no error).
  const desconocidos = await p.evaluar(`(() => {
    const { editor, comandos: c } = bornera;
    editor.ejecutar(c.colocar(editor.documento, { tipo: "inventado.x", x: 0, y: 0, rot: 0, espejado: false, etiqueta: "X1", params: {} }));
    return [[...editor.tiposDesconocidos], editor.escena.cantidad];
  })()`);
  comprobar(
    "un tipo desconocido se dibuja igual y se anota",
    JSON.stringify(desconocidos) === JSON.stringify([["inventado.x"], 1]),
    JSON.stringify(desconocidos),
  );
  await p.captura("desconocido");
}
