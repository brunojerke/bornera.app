import { describe, expect, it } from "vitest";
import { deserializar, serializar } from "../io";
import { invariantes } from "../io/prueba-invariantes";
import { Borrar, CambiarEtiqueta, cablear, colocar, Mover } from "../model/comandos";
import type { Documento, Extremo } from "../model/documento";
import { compararRedes, SIN_COMPARAR_REDES } from "./compararRedes";
import { marchaParada } from "./marchaParada";

const base = (): Documento => marchaParada().doc;

/**
 * El documento con los ids renumerados (c1 → c21, w1 → w21) y los componentes
 * y los cables en el orden inverso: como un archivo armado en otra sesión, en
 * otro orden.
 */
function renumerado(doc: Documento, suma: number): Documento {
  const id = (s: string): string => s.replace(/^([a-z]+)(\d+)$/, (_, prefijo: string, n: string) => `${prefijo}${Number(n) + suma}`);
  const extremo = (e: Extremo): Extremo =>
    e.tipo === "borne" ? { ...e, comp: id(e.comp) } : e.tipo === "cable" ? { ...e, cable: id(e.cable) } : { ...e };
  const hoja = doc.hojas[0]!;
  return {
    ...doc,
    contadores: Object.fromEntries(Object.entries(doc.contadores).map(([k, v]) => [k, v + suma])),
    hojas: [
      {
        ...hoja,
        componentes: hoja.componentes.map((c) => ({ ...c, id: id(c.id) })).reverse(),
        cables: hoja.cables.map((w) => ({ ...w, id: id(w.id), desde: extremo(w.desde), hasta: extremo(w.hasta) })).reverse(),
      },
    ],
  };
}

describe("compararRedes: un .brn contra la marcha-parada por \"etiqueta·borne\"", () => {
  it("el armado movido, con otros ids y en otro orden: sin diferencias", () => {
    const { doc, historial } = marchaParada();
    const hoja = doc.hojas[0]!;
    const antes = hoja.componentes.map((c) => [c.x, c.y]);
    historial.ejecutar(new Mover([...hoja.componentes.map((c) => c.id), ...hoja.cables.map((w) => w.id)], 7, 3));
    expect(doc.hojas[0]!.componentes.map((c) => [c.x, c.y])).toEqual(antes.map(([x, y]) => [x! + 7, y! + 3]));

    const otro = renumerado(doc, 20);
    expect(invariantes(otro)).toEqual([]);
    expect(deserializar(serializar(otro))).toEqual({ ok: true, documento: otro, avisos: [] });
    const idsBase = new Set([...base().hojas[0]!.componentes, ...base().hojas[0]!.cables].map((x) => x.id));
    expect([...otro.hojas[0]!.componentes, ...otro.hojas[0]!.cables].some((x) => idsBase.has(x.id))).toBe(false);

    expect(compararRedes(otro, base())).toEqual([]);
  });

  it("sin el cable de retención (w5, K1·14 → S1·14): dice qué red se partió", () => {
    const { doc, historial, cables } = marchaParada();
    historial.ejecutar(new Borrar([cables[4]!]));
    expect(compararRedes(doc, base())).toEqual([
      "Se partió la red {S1·14, K1·14, K1·A1, H1·X1}: quedó en {S1·14, K1·A1, H1·X1} y {K1·14}.",
    ]);
  });

  it("con S0 puenteado (un cable de S0·11 a S0·12): dice qué redes se unieron", () => {
    const { doc, historial, comp } = marchaParada();
    historial.ejecutar(
      cablear(doc, {
        desde: { tipo: "borne", comp: comp.s0, borne: "11" },
        hasta: { tipo: "borne", comp: comp.s0, borne: "12" },
        codos: [
          [-3, 3],
          [-3, 7],
        ],
      }),
    );
    expect(compararRedes(doc, base())).toEqual(["Se unieron las redes {L·L, S0·11} y {S0·12, S1·13, K1·13}."]);
  });

  it("la variante con dos Neutro \"N\" sin cable entre ellos: sin diferencias (se unen por nombre), también con \"n \"", () => {
    const variante = marchaParada({ dosNeutros: true });
    expect(compararRedes(variante.doc, base())).toEqual([]);
    variante.historial.ejecutar(new CambiarEtiqueta(variante.comp.neutro2!, "n "));
    expect(variante.doc.hojas[0]!.componentes.find((c) => c.id === variante.comp.neutro2)!.etiqueta).toBe("n ");
    expect(compararRedes(variante.doc, base())).toEqual([]);
  });

  it("componentes: falta, sobra, repetido y fuentes (una \"N\" de más no es repetida)", () => {
    const { doc, historial, comp } = marchaParada();
    const poner = (tipo: string, x: number, etiqueta: string): string => {
      const cmd = colocar(doc, { tipo, x, y: 40, rot: 0, espejado: false, etiqueta, params: {} });
      historial.ejecutar(cmd);
      return cmd.id;
    };
    historial.ejecutar(new Borrar([comp.h1]));
    const s2 = poner("pulsador.na", 0, "S2");
    const k1 = poner("contactor.bobina", 5, "k1 ");
    const l1 = poner("fuente.fase", 10, "L1");
    poner("fuente.neutro", 15, "N");
    const sinNombre = poner("fuente.fase", 20, "");

    expect(compararRedes(doc, base())).toEqual([
      'Falta "H1" (senalizacion.lampara).',
      `Hay 2 "K1" (contactor.bobina): ${comp.k1Bobina}, ${k1}.`,
      `Sobra "S2" (pulsador.na, ${s2}).`,
      `Sobra "L1" (fuente.fase, ${l1}): fuente con un nombre de red nuevo.`,
      `Sobra una fuente sin nombre de red (fuente.fase, ${sinNombre}).`,
      SIN_COMPARAR_REDES,
    ]);
  });
});
