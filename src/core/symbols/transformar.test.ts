import { describe, expect, it } from "vitest";
import type { Borne, Rotacion, Transformacion } from "./tipos";
import {
  bornesColocados,
  cajaCuerpo,
  espejarEnPantalla,
  normalizarRotacion,
  rotarEnPantalla,
  transformarBornes,
  transformarDireccion,
  transformarPunto,
} from "./transformar";
import { direccionesAfuera, validarDefinicion } from "./validar";
import { SIMBOLOS } from "./biblioteca";

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

describe("normalizarRotacion", () => {
  it.each([
    [0, 0],
    [360, 0],
    [-90, 270],
    [-360, 0],
    [450, 90],
    [-270, 90],
    [720, 0],
  ] as const)("%i° → %i°", (entrada, esperada) => {
    expect(Object.is(normalizarRotacion(entrada), esperada)).toBe(true);
  });

  it("rechaza lo que no es múltiplo de 90", () => {
    expect(() => normalizarRotacion(45)).toThrow(RangeError);
  });
});

describe("rotarEnPantalla y espejarEnPantalla", () => {
  /** Puntos asimétricos: cualquier error de composición se nota. */
  const PUNTOS = [
    [2, 1],
    [-1, 3],
    [0, -2],
  ] as const;

  it.each(TODAS)("con %o, rotar equivale a girar en pantalla el resultado", (t) => {
    for (const sentido of [90, -90] as const) {
      const u = rotarEnPantalla(t, sentido);
      for (const [x, y] of PUNTOS) {
        const p = transformarPunto(x, y, t);
        // Giro de 90° horario en pantalla (y hacia abajo): (x, y) → (−y, x).
        const esperado = sentido === 90 ? { x: -p.y + 0, y: p.x + 0 } : { x: p.y + 0, y: -p.x + 0 };
        expect(transformarPunto(x, y, u)).toEqual(esperado);
      }
      expect(ROTACIONES).toContain(u.rotacion);
    }
  });

  it.each(TODAS)("con %o, espejar equivale a espejar en pantalla el resultado (x → −x)", (t) => {
    const u = espejarEnPantalla(t);
    for (const [x, y] of PUNTOS) {
      const p = transformarPunto(x, y, t);
      expect(transformarPunto(x, y, u)).toEqual({ x: -p.x + 0, y: p.y });
    }
    expect(ROTACIONES).toContain(u.rotacion);
  });

  it.each(TODAS)("con %o, la rotación siempre queda en 0, 90, 180 o 270 (nunca 360 ni negativa)", (t) => {
    let u = t;
    for (const paso of ["+", "+", "-", "m", "-", "-", "-", "m", "+"] as const) {
      u = paso === "m" ? espejarEnPantalla(u) : rotarEnPantalla(u, paso === "+" ? 90 : -90);
      expect(ROTACIONES).toContain(u.rotacion);
      expect(Object.is(u.rotacion, -0)).toBe(false);
    }
  });

  it.each(TODAS)("con %o, rotar 4 veces y espejar 2 vuelven al estado exacto", (t) => {
    for (const sentido of [90, -90] as const) {
      let u = t;
      for (let i = 0; i < 4; i++) u = rotarEnPantalla(u, sentido);
      expect(u).toEqual(t);
    }
    expect(espejarEnPantalla(espejarEnPantalla(t))).toEqual(t);
  });

  it("no modifican la transformación que reciben", () => {
    const t: Transformacion = { rotacion: 90, espejado: false };
    rotarEnPantalla(t, 90);
    espejarEnPantalla(t);
    expect(t).toEqual({ rotacion: 90, espejado: false });
  });
});

describe("cajaCuerpo y bornes colocados", () => {
  // Un cable no puede atravesar el cuerpo (T13): en cualquier orientación,
  // cada borne queda en el borde de la caja y apunta hacia afuera.
  it("cada borne de la biblioteca queda en el borde de la caja y apunta afuera, en las 8 orientaciones", () => {
    for (const def of SIMBOLOS) {
      for (const t of TODAS) {
        const k = cajaCuerpo(def.tamano, 4, -3, t.rotacion);
        for (const b of bornesColocados(def.bornes, 4, -3, t)) {
          const afuera = direccionesAfuera(b.x - (k.x + k.ancho / 2), b.y - (k.y + k.alto / 2), k.ancho, k.alto);
          expect(afuera, `${def.tipo} ${b.nombre} ${t.rotacion}° ${t.espejado}`).toContain(b.direccion);
        }
      }
    }
  });
});
