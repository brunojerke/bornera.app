import { describe, expect, it } from "vitest";
import { entornoLineal, planearSinAtajoParaTests, planearTransformacion, prepararTransformacion, type Operacion } from "../core/model/seguir";
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

describe("todo seleccionado en el banco (atajo de la hoja entera)", () => {
  const ev = (x: number, y: number) => ({ x, y, boton: 0, botones: 1, mayus: false, ctrl: false, escala: 20 });
  const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  it("2000 + 3030: el plan es el mismo con y sin atajo (mover, R, Mayús+R y M), con la consulta del editor", () => {
    const editor = new Editor(documentoBancoCables(2000));
    const hoja = editor.documento.hojas[0]!;
    const todo = [...hoja.componentes.map((c) => c.id), ...hoja.cables.map((w) => w.id)];
    expect(prepararTransformacion(hoja, todo, editor.entornoPlan()).todaLaHoja).toBe(true);
    const ops: Operacion[] = [
      { tipo: "mover", dx: 2, dy: 1 },
      { tipo: "rotar", sentido: 90 },
      { tipo: "rotar", sentido: -90 },
      { tipo: "espejar" },
    ];
    for (const op of ops) {
      const con = planearTransformacion(hoja, todo, op, editor.entornoPlan());
      expect(con.rechazo, op.tipo).toBeNull();
      expect(con, op.tipo).toEqual(planearSinAtajoParaTests(hoja, todo, op, editor.entornoPlan()));
    }
  });

  it("arrastrar y soltar con todo, R y M: deshacer y rehacer exactos, y los bornes con cable siguen al día", () => {
    const editor = new Editor(documentoBancoCables(2000));
    const hoja = editor.documento.hojas[0]!;
    const todo = [...hoja.componentes.map((c) => c.id), ...hoja.cables.map((w) => w.id)];
    const antes = copia(editor.documento);
    const bornesAntes = editor.bornesConCable.entradas();
    const { x: x0, y: y0 } = hoja.componentes[0]!;
    editor.seleccionarIds(todo);
    const h = editor.seleccionar;
    editor.aplicar(h.presionar(ev(x0 + 0.2, y0 + 0.2)));
    for (let k = 1; k <= 4; k++) editor.aplicar(h.mover(ev(x0 + 0.2 + k, y0 + 0.2 + (k % 2))));
    editor.aplicar(h.soltar(ev(x0 + 4.2, y0 + 0.2)));
    expect(editor.puedeDeshacer).toBe(true);
    expect(hoja.componentes[0]).toMatchObject({ x: x0 + 4, y: y0 });
    const movido = copia(editor.documento);
    for (const accion of ["rotar", "espejar"] as const) {
      expect(editor.accion(accion), accion).toBe(true);
      expect(editor.bornesConCable.entradas()).toEqual(bornesAntes);
      editor.deshacer();
      expect(editor.documento, accion).toEqual(movido);
    }
    editor.deshacer();
    expect(editor.documento).toEqual(antes);
    editor.rehacer();
    expect(editor.documento).toEqual(movido);
    expect(editor.bornesConCable.entradas()).toEqual(bornesAntes);
  });
});
