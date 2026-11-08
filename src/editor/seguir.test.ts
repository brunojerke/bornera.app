import { describe, expect, it } from "vitest";
import { entornoLineal, planearTransformacion, prepararTransformacion, type Operacion } from "../core/model/seguir";
import { documentoBancoCables } from "./banco";
import { Editor } from "./editor";

/** Los ids de los `n` componentes con cables más cercanos al centro de la hoja. */
function cableadosDelCentro(editor: Editor, n: number): string[] {
  const hoja = editor.documento.hojas[0]!;
  const conCable = new Set<string>();
  for (const w of hoja.cables) for (const e of [w.desde, w.hasta]) if (e.tipo === "borne") conCable.add(e.comp);
  const cx = hoja.componentes.reduce((s, c) => s + c.x, 0) / hoja.componentes.length;
  const cy = hoja.componentes.reduce((s, c) => s + c.y, 0) / hoja.componentes.length;
  return hoja.componentes
    .filter((c) => conCable.has(c.id))
    .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
    .slice(0, n)
    .map((c) => c.id);
}

describe("planear con la consulta del editor (T14a)", () => {
  const editor = new Editor(documentoBancoCables(2000));
  const hoja = editor.documento.hojas[0]!;
  const lineal = entornoLineal(hoja);
  const grupo = cableadosDelCentro(editor, 40);
  const casos: [string, string[], Operacion][] = [
    ["40 cableados, mover", grupo, { tipo: "mover", dx: 3, dy: 2 }],
    ["40 cableados, mover lejos", grupo, { tipo: "mover", dx: -11, dy: 7 }],
    ["40 cableados, girar", grupo, { tipo: "rotar", sentido: 90 }],
    ["40 cableados, espejar", grupo, { tipo: "espejar" }],
    ["uno, mover", grupo.slice(0, 1), { tipo: "mover", dx: 1, dy: 0 }],
    ["uno, girar", grupo.slice(5, 6), { tipo: "rotar", sentido: -90 }],
  ];

  it.each(casos)("%s: la indexada da lo mismo que la lineal en 2000 + 3000", (_, ids, op) => {
    const a = planearTransformacion(hoja, ids, op, lineal);
    const b = planearTransformacion(hoja, ids, op, editor.entornoPlan());
    expect(b.rechazo?.motivo ?? null).toBe(a.rechazo?.motivo ?? null);
    expect(new Set(b.rechazo?.conflictos.map((c) => c.clave) ?? [])).toEqual(new Set(a.rechazo?.conflictos.map((c) => c.clave) ?? []));
    expect(b.plan.cables).toEqual(a.plan.cables);
    expect(b.plan.componentes).toEqual(a.plan.componentes);
  });

  it("preparar una vez y planear varios puntos da lo mismo que planear de cero", () => {
    const prep = prepararTransformacion(hoja, grupo, editor.entornoPlan());
    for (const [dx, dy] of [
      [1, 0],
      [4, -3],
      [-2, 5],
      [1, 0],
    ] as const) {
      const op: Operacion = { tipo: "mover", dx, dy };
      const r = prep.planear(op);
      const s = planearTransformacion(hoja, grupo, op, editor.entornoPlan());
      expect(r.plan.cables).toEqual(s.plan.cables);
      expect(r.rechazo?.motivo ?? null).toBe(s.rechazo?.motivo ?? null);
    }
  });
});
