// R11 (T29): conexiones aparentes que ya están en la hoja, con R11-A.

import { describe, expect, it } from "vitest";
import { inversion } from "../circuitos/inversion";
import { marchaParada } from "../circuitos/marchaParada";
import { aparentesHoja, avisosR11, juntarConR11 } from "./aparentes";
import { cablear, colocar, type Comando } from "./comandos";
import { crearDocumento, type Extremo, type Hoja } from "./documento";
import { Historial } from "./historial";
import { geometriaComponente } from "./trazado";
import { contarAvisos, textoAviso, validar, type Aviso } from "./validaciones";

const LAMPARA = "senalizacion.lampara";
const BOBINA = "contactor.bobina";
const FASE = "fuente.fase";

const t = (cable: string, x: number, y: number): Extremo => ({ tipo: "cable", cable, x, y });
const libre = (x: number, y: number): Extremo => ({ tipo: "libre", x, y });
const b = (comp: string, borne: string): Extremo => ({ tipo: "borne", comp, borne });

function armar() {
  const doc = crearDocumento({ titulo: "R11", autor: "", fecha: "2026-11-20" });
  const historial = new Historial(doc);
  const h = doc.hojas[0]!;
  const hacer = (c: Comando) => historial.ejecutar(c);
  const poner = (tipo: string, x: number, y: number, etiqueta = "") => {
    const cmd = colocar(doc, { tipo, x, y, rot: 0, espejado: false, etiqueta, params: {} });
    hacer(cmd);
    return cmd.id;
  };
  const tender = (desde: Extremo, hasta: Extremo, codos: [number, number][] = []) => {
    const cmd = cablear(doc, { desde, hasta, codos });
    hacer(cmd);
    return cmd.id;
  };
  return { doc, h, poner, tender };
}

/** Dónde queda un borne. */
function borneEn(h: Hoja, comp: string, borne: string): { x: number; y: number } {
  const c = h.componentes.find((k) => k.id === comp)!;
  const p = geometriaComponente(c)!.bornes.find((k) => k.borne === borne)!;
  return { x: p.x, y: p.y };
}

const resumen = (avisos: readonly Aviso[]) => avisos.map((a) => (a.regla === "R11" ? `${a.id} ${a.tipo} ${a.x},${a.y}` : `${a.id} ${a.regla}`));

describe("R11: conexiones aparentes en la hoja (T29)", () => {
  it("los circuitos de referencia generados: cero", () => {
    for (const h of [
      marchaParada().doc.hojas[0]!,
      marchaParada({ dosNeutros: true }).doc.hojas[0]!,
      marchaParada({ ramaNC: true }).doc.hojas[0]!,
      inversion().doc.hojas[0]!,
    ]) {
      expect(avisosR11(h)).toEqual([]);
    }
  });

  it("un cable que pasa sobre un borne sin terminar en él: R11 en los dos (M-A), en el borne", () => {
    const a = armar();
    const h1 = a.poner(LAMPARA, 0, 0, "H1");
    const p = borneEn(a.h, h1, "X1");
    const w = a.tender(libre(p.x - 4, p.y), libre(p.x + 4, p.y));
    expect(resumen(avisosR11(a.h))).toEqual([`${h1} borne ${p.x},${p.y}`, `${w} borne ${p.x},${p.y}`]);
    const r11 = avisosR11(a.h);
    expect(textoAviso(r11[0]!)).toBe("Conexión aparente: un cable pasa sobre un borne sin conectarse.");
    expect(contarAvisos(r11)).toEqual({ errores: 0, avisos: 2 });
  });

  it("dos símbolos encimados: cuerpo sobre cuerpo en los dos", () => {
    const a = armar();
    const k1 = a.poner(BOBINA, 0, 0, "K1");
    const k2 = a.poner(BOBINA, 1, 0, "K2");
    const r11 = avisosR11(a.h);
    expect(r11.filter((x) => x.regla === "R11" && x.tipo === "cuerpoCuerpo").map((x) => x.id)).toEqual([k1, k2]);
  });

  it("dos cables encimados de redes distintas: encimado en los dos", () => {
    const a = armar();
    const w1 = a.tender(libre(0, 50), libre(10, 50));
    const w2 = a.tender(libre(5, 50), libre(15, 50));
    const encimados = avisosR11(a.h).filter((x) => x.regla === "R11" && x.tipo === "encimado");
    expect(encimados.map((x) => x.id)).toEqual([w1, w2]);
  });

  it("R11-A: el mismo encimado, con el segundo cable en T sobre el primero (la misma red), no avisa", () => {
    const a = armar();
    const w1 = a.tender(libre(0, 50), libre(10, 50));
    a.tender(t(w1, 5, 50), libre(15, 50));
    expect(aparentesHoja(a.h).some((x) => x.entreCables)).toBe(true);
    expect(avisosR11(a.h)).toEqual([]);
  });

  it("R11-A es por cables: dos fases «L» sin cable entre sí no hacen una red para R11", () => {
    const a = armar();
    const f1 = a.poner(FASE, 0, 0, "L");
    const f2 = a.poner(FASE, 40, 0, "L");
    const p1 = borneEn(a.h, f1, "L");
    const p2 = borneEn(a.h, f2, "L");
    // Los dos cables bajan y van por la misma fila, encimados entre x = 10 y x = 30.
    const y = p1.y + 20;
    const w1 = a.tender(b(f1, "L"), libre(30, y), [[p1.x, y]]);
    const w2 = a.tender(b(f2, "L"), libre(10, y), [[p2.x, y]]);
    const encimados = avisosR11(a.h).filter((x) => x.regla === "R11" && x.tipo === "encimado");
    expect(encimados.map((x) => x.id)).toEqual([w1, w2]);
  });

  it("juntarConR11: cada elemento con sus avisos de validar y después su R11", () => {
    const a = armar();
    const h1 = a.poner(LAMPARA, 0, 0, "");
    const p = borneEn(a.h, h1, "X1");
    const w = a.tender(libre(p.x - 4, p.y), libre(p.x + 4, p.y));
    const todos = juntarConR11(a.h, validar(a.h), avisosR11(a.h));
    expect(todos.map((x) => `${x.id === h1 ? "H" : x.id === w ? "w" : "?"} ${x.regla}`)).toEqual(["H R3", "H R7", "H R7", "H R11", "w R8", "w R11"]);
  });
});
