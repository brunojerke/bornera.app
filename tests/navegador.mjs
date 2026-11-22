// Busca un Chrome, Chromium o Edge instalado, para el banco (tests/bench) y
// las pruebas de humo (tests/humo). Sin dependencias: el navegador lo pone la
// máquina.

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
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

/**
 * Cierra el navegador con todo su árbol de procesos y espera su salida. En
 * Windows, `kill()` solo mata el proceso principal y los hijos de Edge siguen
 * vivos con el perfil abierto (el borrado del perfil falla con EPERM), así que
 * se usa `taskkill /T /F` sobre el pid propio (nunca por nombre de imagen).
 */
export async function cerrarNavegador(navegador, salida) {
  if (navegador.exitCode === null) {
    if (process.platform === "win32" && navegador.pid !== undefined) {
      try {
        execFileSync("taskkill", ["/PID", String(navegador.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        navegador.kill();
      }
    } else {
      navegador.kill();
    }
    await salida;
  }
}

/** Borra el perfil temporal; si no puede, avisa y sigue (no cambia el código de salida). */
export function borrarPerfil(perfil) {
  try {
    rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (e) {
    console.error(`Aviso: no pude borrar el perfil temporal ${perfil} (${e instanceof Error ? e.message : e}).`);
  }
}
