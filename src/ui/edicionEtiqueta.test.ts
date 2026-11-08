import { describe, expect, it, vi } from "vitest";
import { colocar } from "../core/model/comandos";
import { documentoNuevo, Editor } from "../editor/editor";
import { EdicionEtiqueta, type DestinoEtiqueta } from "./edicionEtiqueta";

/** Destino falso: anota cada etiqueta aplicada. */
function destino(): DestinoEtiqueta & { llamadas: [string, string][] } {
  const llamadas: [string, string][] = [];
  return {
    llamadas,
    cambiarEtiqueta: vi.fn((id: string, etiqueta: string) => {
      llamadas.push([id, etiqueta]);
      return true;
    }),
  };
}

/** Editor con dos bobinas (K1 y K2) y una fase (L). */
function conEditor() {
  const editor = new Editor(documentoNuevo());
  const ids = [
    ["contactor.bobina", "K1"],
    ["contactor.bobina", "K2"],
    ["fuente.fase", "L"],
  ].map(([tipo, etiqueta], i) => {
    const c = colocar(editor.documento, { tipo: tipo!, x: i * 10, y: 0, rot: 0, espejado: false, etiqueta: etiqueta!, params: {} });
    editor.ejecutar(c);
    return c.id;
  });
  const pasos = () => (editor.historial as unknown as { hechos: unknown[] }).hechos.length;
  const etiqueta = (id: string) => editor.documento.hojas[0]!.componentes.find((c) => c.id === id)!.etiqueta;
  return { editor, ids, pasos, etiqueta };
}

describe("EdicionEtiqueta", () => {
  it("escribir letra por letra no aplica nada; confirmar da un solo paso", () => {
    const { editor, ids, pasos, etiqueta } = conEditor();
    const e = new EdicionEtiqueta();
    const antes = pasos();
    e.empezar(editor, ids[0]!, "K1", false);
    let t = "";
    for (const letra of "KM10ABC") {
      t += letra;
      e.escribir(t);
    }
    expect(pasos()).toBe(antes);
    expect(etiqueta(ids[0]!)).toBe("K1");
    expect(e.confirmar("enter")).toBe("aplicado");
    expect(pasos()).toBe(antes + 1);
    expect(etiqueta(ids[0]!)).toBe("KM10ABC");
  });

  it("Enter y después blur: un solo paso", () => {
    const { editor, ids, pasos } = conEditor();
    const e = new EdicionEtiqueta();
    const antes = pasos();
    e.empezar(editor, ids[0]!, "K1", false);
    e.escribir("K5");
    expect(e.confirmar("enter")).toBe("aplicado");
    expect(e.confirmar("salir")).toBe("nada");
    expect(pasos()).toBe(antes + 1);
  });

  it("Esc y después blur: ningún paso, el borrador no se aplica", () => {
    const { editor, ids, pasos, etiqueta } = conEditor();
    const e = new EdicionEtiqueta();
    const antes = pasos();
    e.empezar(editor, ids[0]!, "K1", false);
    e.escribir("K5");
    expect(e.cancelar()).toBe(true);
    expect(e.confirmar("salir")).toBe("nada");
    expect(e.confirmar("enter")).toBe("nada");
    expect(pasos()).toBe(antes);
    expect(etiqueta(ids[0]!)).toBe("K1");
  });

  it("confirmar varias veces (clic en el lienzo, cambio de escena, F5) aplica una sola vez", () => {
    const d = destino();
    const e = new EdicionEtiqueta();
    e.empezar(d, "c1", "K1", false);
    e.escribir("K2");
    expect(e.confirmar("salir")).toBe("aplicado");
    expect(e.confirmar("salir")).toBe("nada");
    expect(e.confirmar("enter")).toBe("nada");
    expect(d.llamadas).toEqual([["c1", "K2"]]);
  });

  it("si el texto no cambió, no normaliza, no valida ni da paso (un 'k1' o 'K#1' de un .brn queda igual)", () => {
    for (const base of ["k1", "K#1", "Ñ", "", "  X  "]) {
      const d = destino();
      const e = new EdicionEtiqueta();
      e.empezar(d, "c1", base, base === "");
      expect(e.error).toBeNull();
      expect(e.confirmar("salir")).toBe("sinCambios");
      e.empezar(d, "c1", base, false);
      expect(e.confirmar("enter")).toBe("sinCambios");
      expect(d.llamadas).toEqual([]);
    }
  });

  it("escribir y volver al mismo texto tampoco da paso", () => {
    const d = destino();
    const e = new EdicionEtiqueta();
    e.empezar(d, "c1", "k1", false);
    e.escribir("k12");
    e.escribir("k1");
    expect(e.confirmar("salir")).toBe("sinCambios");
    expect(d.llamadas).toEqual([]);
  });

  it("al confirmar, quita los espacios de los lados y pasa a mayúsculas; si queda igual, sin paso", () => {
    const d = destino();
    const e = new EdicionEtiqueta();
    e.empezar(d, "c1", "K1", false);
    e.escribir("  km2 ");
    expect(e.confirmar("enter")).toBe("aplicado");
    e.empezar(d, "c1", "K1", false);
    e.escribir(" k1 ");
    expect(e.confirmar("enter")).toBe("sinCambios");
    expect(d.llamadas).toEqual([["c1", "KM2"]]);
  });

  it("con error, Enter no confirma y la edición sigue; al salir vuelve al valor confirmado sin paso", () => {
    const d = destino();
    const e = new EdicionEtiqueta();
    e.empezar(d, "c1", "K1", false);
    e.escribir("K 1");
    expect(e.error).toBe("Sin espacios");
    expect(e.confirmar("enter")).toBe("error");
    expect(e.activa).toBe(true);
    e.escribir("W".repeat(13));
    expect(e.error).toBe("Máximo 12 caracteres");
    expect(e.confirmar("salir")).toBe("revertido");
    expect(e.activa).toBe(false);
    expect(d.llamadas).toEqual([]);
  });

  it("una fuente no puede quedar sin nombre de red; otro componente sí", () => {
    const d = destino();
    const e = new EdicionEtiqueta();
    e.empezar(d, "f1", "L", true);
    e.escribir("");
    expect(e.error).toBe("La alimentación necesita un nombre de red");
    expect(e.confirmar("salir")).toBe("revertido");
    e.empezar(d, "c1", "K1", false);
    e.escribir("");
    expect(e.confirmar("salir")).toBe("aplicado");
    expect(d.llamadas).toEqual([["c1", ""]]);
  });

  it("confirma sobre el componente con el que empezó, aunque la selección cambie", () => {
    const { editor, ids, etiqueta } = conEditor();
    const e = new EdicionEtiqueta();
    editor.seleccionarIds([ids[0]!]);
    e.empezar(editor, ids[0]!, "K1", false);
    e.escribir("K7");
    editor.seleccionarIds([ids[1]!]); // clic en otro antes del blur
    expect(e.confirmar("salir")).toBe("aplicado");
    expect(etiqueta(ids[0]!)).toBe("K7");
    expect(etiqueta(ids[1]!)).toBe("K2");
  });

  it("confirma sobre el editor con el que empezó (cambio de escena)", () => {
    const a = conEditor();
    const b = conEditor();
    const e = new EdicionEtiqueta();
    e.empezar(a.editor, a.ids[0]!, "K1", false);
    e.escribir("K8");
    expect(e.confirmar("salir")).toBe("aplicado");
    expect(a.etiqueta(a.ids[0]!)).toBe("K8");
    expect(b.etiqueta(b.ids[0]!)).toBe("K1");
  });

  it("si el componente ya no existe, se descarta sin paso", () => {
    const { editor, ids, pasos } = conEditor();
    const e = new EdicionEtiqueta();
    e.empezar(editor, ids[0]!, "K1", false);
    e.escribir("K9");
    editor.seleccionarIds([ids[0]!]);
    editor.accion("borrar");
    const antes = pasos();
    expect(e.confirmar("salir")).toBe("sinCambios");
    expect(pasos()).toBe(antes);
  });

  it("un cambio de afuera no pisa lo escrito, pero Esc vuelve al valor nuevo", () => {
    const e = new EdicionEtiqueta();
    const d = destino();
    e.empezar(d, "c1", "K1", false);
    e.escribir("K5");
    e.actualizarBase("c1", "K3");
    expect(e.texto).toBe("K5");
    expect(e.base).toBe("K3");
    e.actualizarBase("c2", "X"); // otro componente: no le importa
    expect(e.base).toBe("K3");
  });

  it("sin escribir, el texto sigue al valor de afuera y no lo pisa al salir", () => {
    const d = destino();
    const e = new EdicionEtiqueta();
    e.empezar(d, "c1", "K1", false);
    e.actualizarBase("c1", "K3");
    expect(e.texto).toBe("K3");
    expect(e.confirmar("salir")).toBe("sinCambios");
    expect(d.llamadas).toEqual([]);
  });

  it("en una fuente, avisa a qué red pasa mientras se escribe", () => {
    const e = new EdicionEtiqueta();
    e.empezar(destino(), "f1", "L", true);
    expect(e.redNueva).toBeNull();
    e.escribir("l1");
    expect(e.redNueva).toBe("L1");
    e.escribir(" l ");
    expect(e.redNueva).toBeNull(); // misma red
    e.escribir("L 1");
    expect(e.redNueva).toBeNull(); // con error no se anuncia
  });
});
