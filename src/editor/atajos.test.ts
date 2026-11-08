import { describe, expect, it } from "vitest";
import { accionDeTecla, type Accion, type Tecla } from "./atajos";

/** Tecla con `key`; el `code` sale de la letra si es una (como en un teclado latino). */
function t(key: string, mods: Partial<Tecla> = {}): Tecla {
  const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key;
  return { key, code, ctrl: false, mayus: false, alt: false, meta: false, repeat: false, ...mods };
}

describe("accionDeTecla", () => {
  it.each<[string, Tecla, Accion | null]>([
    ["R", t("r"), "rotar"],
    ["Mayús+R", t("R", { mayus: true }), "rotarAntihorario"],
    ["Bloq Mayús + R (key R, sin Mayús)", t("R"), "rotar"],
    ["Bloq Mayús + Mayús+R (key r, con Mayús)", t("r", { mayus: true }), "rotarAntihorario"],
    ["M", t("m"), "espejar"],
    ["Bloq Mayús + M", t("M"), "espejar"],
    ["Mayús+M: libre", t("M", { mayus: true }), null],
    ["Supr", t("Delete"), "borrar"],
    ["Retroceso", t("Backspace"), "borrar"],
    ["Mayús+Supr: libre (cortar)", t("Delete", { mayus: true }), null],
    ["Ctrl+Z", t("z", { ctrl: true }), "deshacer"],
    ["Ctrl+Z con Bloq Mayús", t("Z", { ctrl: true }), "deshacer"],
    ["Ctrl+Y", t("y", { ctrl: true }), "rehacer"],
    ["Ctrl+Mayús+Z", t("Z", { ctrl: true, mayus: true }), "rehacer"],
    ["Ctrl+Mayús+Y: nada", t("Y", { ctrl: true, mayus: true }), null],
    ["Ctrl+R (recargar): nada", t("r", { ctrl: true }), null],
    ["Ctrl+M: nada", t("m", { ctrl: true }), null],
    ["Ctrl+Supr: nada", t("Delete", { ctrl: true }), null],
    ["Alt+R: nada", t("r", { alt: true }), null],
    ["Meta+R: nada", t("r", { meta: true }), null],
    ["Alt+Ctrl+Z (AltGr): nada", t("z", { ctrl: true, alt: true }), null],
    ["otra letra", t("q"), null],
    ["espacio", t(" ", { code: "Space" }), null],
    ["Escape: lo maneja aparte el despachador", t("Escape"), null],
  ])("%s", (_, tecla, esperada) => {
    expect(accionDeTecla(tecla)).toBe(esperada);
  });

  it("R, M, Supr y Retroceso no se repiten al mantener la tecla", () => {
    for (const k of ["r", "m", "Delete", "Backspace"]) {
      expect(accionDeTecla(t(k, { repeat: true }))).toBeNull();
    }
    expect(accionDeTecla(t("R", { mayus: true, repeat: true }))).toBeNull();
  });

  it("deshacer y rehacer sí se repiten", () => {
    expect(accionDeTecla(t("z", { ctrl: true, repeat: true }))).toBe("deshacer");
    expect(accionDeTecla(t("y", { ctrl: true, repeat: true }))).toBe("rehacer");
  });

  it("con una distribución no latina usa la posición física", () => {
    // Teclado ruso: la tecla de la R física escribe "к".
    expect(accionDeTecla({ ...t("к"), code: "KeyR" })).toBe("rotar");
    expect(accionDeTecla({ ...t("я", { ctrl: true }), code: "KeyZ" })).toBe("deshacer");
  });
});
