// Busca un Chrome, Chromium o Edge instalado, para el banco (tests/bench) y
// las pruebas de humo (tests/humo). Sin dependencias: el navegador lo pone la
// máquina.

import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

function candidatos() {
  const env = process.env;
  if (process.platform === "win32") {
    const raices = [env["PROGRAMFILES"], env["PROGRAMFILES(X86)"], env["LOCALAPPDATA"]].filter(Boolean);
    return raices.flatMap((r) => [
      join(r, "Google", "Chrome", "Application", "chrome.exe"),
      join(r, "Chromium", "Application", "chrome.exe"),
      join(r, "Microsoft", "Edge", "Application", "msedge.exe"),
    ]);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }
  const nombres = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "microsoft-edge"];
  const carpetas = (env["PATH"] ?? "").split(delimiter).filter(Boolean);
  return nombres.flatMap((n) => carpetas.map((c) => join(c, n)));
}

/**
 * Ruta del navegador: la pedida (opción --navegador o variable
 * BORNERA_NAVEGADOR) o el primero que encuentre.
 */
export function buscarNavegador(pedido = process.env["BORNERA_NAVEGADOR"]) {
  if (pedido) {
    if (!existsSync(pedido)) throw new Error(`No existe el navegador indicado: ${pedido}`);
    return pedido;
  }
  const encontrado = candidatos().find((c) => existsSync(c));
  if (!encontrado) {
    throw new Error(
      "No encontré Chrome, Chromium ni Edge. Instalá uno o indicá la ruta con " +
        "--navegador=RUTA o la variable BORNERA_NAVEGADOR.",
    );
  }
  return encontrado;
}
