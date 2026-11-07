// Regla de arquitectura: las dependencias van en un solo sentido, hacia el núcleo.
// src/core solo puede importarse a sí mismo: nada de src/ui, src/editor, src/render
// ni ninguna otra capa, y nada de Svelte.
// Corre con `npm test`, así que un import prohibido rompe los tests.
import { describe, expect, it } from "vitest";

/** Código fuente de cada archivo .ts de src/core, indexado por su ruta. */
const archivosCore = import.meta.glob<string>("../src/core/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Paquetes prohibidos en el núcleo (Svelte, SvelteKit y sus módulos virtuales). */
const PAQUETES_SVELTE = [/^svelte(\/|$)/, /^@sveltejs\//, /^\$app\//];

/** Alias de SvelteKit que apuntan fuera del núcleo ($lib = src/lib). */
const ALIAS_EXTERNOS = [/^\$lib(\/|$)/];

/** Extrae los especificadores de todos los import/export ... from y import() de un archivo. */
function extraerImports(fuente: string): string[] {
  const patron =
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  return [...fuente.matchAll(patron)].map((m) => (m[1] ?? m[2]) as string);
}

/** Resuelve un import relativo contra la carpeta del archivo; devuelve la ruta desde la raíz. */
function resolver(archivo: string, especificador: string): string {
  const partes = archivo.replace(/^\.\.\//, "").split("/").slice(0, -1);
  for (const segmento of especificador.split("/")) {
    if (segmento === "..") partes.pop();
    else if (segmento !== ".") partes.push(segmento);
  }
  return partes.join("/");
}

/** Devuelve el motivo si el import está prohibido en src/core, o null si está permitido. */
function motivoProhibido(archivo: string, especificador: string): string | null {
  if (especificador.endsWith(".svelte")) return "importa un componente .svelte";
  if (especificador.startsWith(".")) {
    const destino = resolver(archivo, especificador);
    if (destino === "src/core" || destino.startsWith("src/core/")) return null;
    // Nombra la capa (src/ui, src/editor, src/render...) para que el error sea claro.
    const capa = destino.split("/").slice(0, 2).join("/");
    return `importa desde ${capa}, fuera del núcleo`;
  }
  if (PAQUETES_SVELTE.some((p) => p.test(especificador))) return "importa Svelte/SvelteKit";
  if (ALIAS_EXTERNOS.some((p) => p.test(especificador))) return "importa $lib, fuera del núcleo";
  return null;
}

describe("arquitectura: src/core", () => {
  it("encuentra archivos del núcleo para revisar", () => {
    expect(Object.keys(archivosCore).length).toBeGreaterThan(0);
  });

  it("no importa de ninguna otra capa ni de Svelte", () => {
    const violaciones: string[] = [];
    for (const [archivo, fuente] of Object.entries(archivosCore)) {
      for (const especificador of extraerImports(fuente)) {
        const motivo = motivoProhibido(archivo, especificador);
        if (motivo) violaciones.push(`${archivo}: "${especificador}" (${motivo})`);
      }
    }
    expect(violaciones).toEqual([]);
  });

  // Prueba la propia regla, para que no pase en verde por un regex roto.
  it("detecta imports prohibidos", () => {
    const archivo = "../src/core/model/x.ts";
    const fuente = [
      'import { onMount } from "svelte";',
      "import { writable } from 'svelte/store';",
      'import Paleta from "../../ui/Paleta.svelte";',
      'import type { Tema } from "../../ui/tema";',
      'export * from "../../ui";',
      'import { Seleccion } from "../../editor/seleccion";',
      'import type { Renderer } from "../../render/renderer";',
      'import { algo } from "../../../vite.config";',
      'const m = await import("$app/navigation");',
      'import { util } from "$lib/util";',
      'import { crearDocumento } from "./documento";',
      'import { algo } from "../sim/solver";',
      'import { otro } from "../../core/io/brn";',
    ].join("\n");
    const motivos = extraerImports(fuente).map((e) => motivoProhibido(archivo, e));
    expect(motivos).toEqual([
      "importa Svelte/SvelteKit",
      "importa Svelte/SvelteKit",
      "importa un componente .svelte",
      "importa desde src/ui, fuera del núcleo",
      "importa desde src/ui, fuera del núcleo",
      "importa desde src/editor, fuera del núcleo",
      "importa desde src/render, fuera del núcleo",
      "importa desde vite.config, fuera del núcleo",
      "importa Svelte/SvelteKit",
      "importa $lib, fuera del núcleo",
      null,
      null,
      null,
    ]);
  });
});
