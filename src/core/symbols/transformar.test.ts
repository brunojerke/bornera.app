import { describe, expect, it } from "vitest";
import type { Borne, Rotacion, Transformacion } from "./tipos";
import { transformarBornes, transformarDireccion, transformarPunto } from "./transformar";
import { validarDefinicion } from "./validar";

const ROTACIONES: Rotacion[] = [0, 90, 180, 270];
const TODAS: Transformacion[] = ROTACIONES.flatMap((rotacion) => [
  { rotacion, espejado: false },
  { rotacion, espejado: true },
]);

/** Bornes asimétricos, para que cualquier error de rotación se note. */
const BORNES: Borne[] = [
  { nombre: "A1", x: 0, y: -2, direccion: "arriba" },
  { nombre: "A2", x: 0, y: 2, direccion: "abajo" },
  { nombre: "X", x: 2, y: 1, direccion: "derecha" },
];

describe("transformarPunto", () => {
  it.each([
    [0, { x: 2, y: 1 }],
    [90, { x: -1, y: 2 }],
    [180, { x: -2, y: -1 }],
    [270, { x: 1, y: -2 }],
  ] as const)("rota (2, 1) %i° en sentido horario", (rotacion, esperado) => {
    expect(transformarPunto(2, 1, { rotacion, espejado: false })).toEqual(esperado);
  });

  it("espeja antes de rotar", () => {
    // Espejado: (2, 1) → (−2, 1); después 90°: (−1, −2).
    expect(transformarPunto(2, 1, { rotacion: 90, espejado: true })).toEqual({ x: -1, y: -2 });
  });

  it("no devuelve -0", () => {
    const p = transformarPunto(0, 0, { rotacion: 180, espejado: true });
    expect(Object.is(p.x, 0) && Object.is(p.y, 0)).toBe(true);
  });
});

describe("transformarDireccion", () => {
  it.each([
    [0, "derecha"],
    [90, "abajo"],
    [180, "izquierda"],
    [270, "arriba"],
  ] as const)("con %i° la salida a la derecha pasa a %s", (rotacion, esperada) => {
    expect(transformarDireccion("derecha", { rotacion, espejado: false })).toBe(esperada);
  });

  it("el espejado invierte izquierda y derecha, pero no arriba y abajo", () => {
    const t = { rotacion: 0, espejado: true } as const;
    expect(transformarDireccion("derecha", t)).toBe("izquierda");
    expect(transformarDireccion("izquierda", t)).toBe("derecha");
    expect(transformarDireccion("arriba", t)).toBe("arriba");
    expect(transformarDireccion("abajo", t)).toBe("abajo");
  });
});

describe("transformarBornes", () => {
  it("rota posición y dirección juntas", () => {
    expect(transformarBornes(BORNES, { rotacion: 90, espejado: false })).toEqual([
      { nombre: "A1", x: 2, y: 0, direccion: "derecha" },
      { nombre: "A2", x: -2, y: 0, direccion: "izquierda" },
      { nombre: "X", x: -1, y: 2, direccion: "abajo" },
    ]);
  });

  it("la dirección sigue apuntando hacia afuera del borne después de transformar", () => {
    // En estos bornes la dirección coincide con el lado donde está el borne.
    const exteriores = BORNES.slice(0, 2);
    for (const t of TODAS) {
      for (const b of transformarBornes(exteriores, t)) {
        const lado = b.x > 0 ? "derecha" : b.x < 0 ? "izquierda" : b.y > 0 ? "abajo" : "arriba";
        expect(b.direccion).toBe(lado);
      }
    }
  });

  it("no modifica los bornes originales", () => {
    const copia = BORNES.map((b) => ({ ...b }));
    transformarBornes(BORNES, { rotacion: 270, espejado: true });
    expect(BORNES).toEqual(copia);
  });

  it.each(TODAS)("con %o, los bornes siguen enteros, con los mismos nombres y sin superponerse", (t) => {
    const resultado = transformarBornes(BORNES, t);
    expect(resultado.map((b) => b.nombre)).toEqual(BORNES.map((b) => b.nombre));
    for (const b of resultado) {
      expect(Number.isInteger(b.x) && Number.isInteger(b.y)).toBe(true);
    }
    expect(new Set(resultado.map((b) => `${b.x},${b.y}`)).size).toBe(BORNES.length);
  });

  it("cuatro rotaciones de 90° dejan todo igual", () => {
    let bornes = BORNES;
    for (let i = 0; i < 4; i++) bornes = transformarBornes(bornes, { rotacion: 90, espejado: false });
    expect(bornes).toEqual(BORNES);
  });

  it("espejar dos veces deja todo igual", () => {
    const t = { rotacion: 0, espejado: true } as const;
    expect(transformarBornes(transformarBornes(BORNES, t), t)).toEqual(BORNES);
  });

  it("componer 90° + 90° equivale a 180°", () => {
    const t90 = { rotacion: 90, espejado: false } as const;
    expect(transformarBornes(transformarBornes(BORNES, t90), t90)).toEqual(
      transformarBornes(BORNES, { rotacion: 180, espejado: false }),
    );
  });

  it("un símbolo válido sigue siendo válido después de transformarlo", () => {
    for (const t of TODAS) {
      // Caja cuadrada de 4×4: contiene a los bornes en cualquier rotación.
      const errores = validarDefinicion({
        tipo: "prueba.asimetrico",
        nombre: "Prueba",
        categoria: "mando",
        elemento: "bobina",
        tamano: { ancho: 4, alto: 4 },
        primitivas: [],
        bornes: transformarBornes(BORNES, t),
      });
      expect(errores).toEqual([]);
    }
  });
});
