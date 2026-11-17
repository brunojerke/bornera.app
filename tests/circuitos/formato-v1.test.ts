// El corpus congelado del formato 1 (T22, D3-A de docs/plan-fase4.md):
// cada archivo de tests/circuitos/formato-v1/ abre, es igual a su JSON y se
// guarda igual. Ver formato-v1.mjs.
//
// La referencia es el archivo mismo, no el código que lo generó: así,
// cambiar un generador (prueba-documentos.ts, los circuitos) no obliga a
// regenerar el corpus. El largo y el sha256 de cada archivo están fijados
// acá: regenerarlo pide el OK de Bruno y se ve en el diff de este test.
// @ts-expect-error sin el paquete @types/node (como vite.config.js)
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deserializar, serializar, serializarPorLineas, type ProblemaArchivo } from "../../src/core/io";
import { deserializarCon } from "../../src/core/io/deserializar";
import type { Migracion } from "../../src/core/io/migraciones";
import { desempaquetar } from "../../src/ui/brn";

const CARPETA = new URL("./formato-v1/", import.meta.url);

interface Congelado {
  largo: number;
  sha256: string;
  /** Los avisos con que abre (los errores no: tiene que abrir). */
  avisos: ProblemaArchivo[];
}

/**
 * Los archivos del corpus: los `.brn.json`, generados una vez por
 * formato-v1.mjs (T22), y un `.brn` real.
 */
const CORPUS: Record<string, Congelado> = {
  // La inversión dibujada a mano en la netbook y guardada por la 0.1.4-alpha.1
  // publicada (gzip de WebView2), copiada sin convertir (Bruno, 2026-11-17).
  "alpha1-inversion.brn": { largo: 721, sha256: "67d3c716c6f9a7f2f1e6a7e5c06fd8a1b8990d06cff11f9de9ca0bf5facf7f1e", avisos: [] },
  "vacio.brn.json": { largo: 159, sha256: "96a64417204ccd6bf224321fe1dc6425bb698ae79676d346c3ff0a20e6ea4d42", avisos: [] },
  "rotados-y-espejados.brn.json": { largo: 7095, sha256: "65664b3928a39caf03f5851823a37977318b2405223c8a6d486f01acf1cda752", avisos: [] },
  "cables-t-libres.brn.json": { largo: 1135, sha256: "ab3dc5ea3de2b3d5721fa52575e8f5b6cccab0f687c7ff7fb977b09d0ea8a8fa", avisos: [] },
  "textos-raros.brn.json": { largo: 476, sha256: "b55bb7f7deb2a6f37ce84f4e526d6111af07a3099798cbcffa4f1dd6300bf4ba", avisos: [] },
  "girado-con-comandos.brn.json": { largo: 1012, sha256: "20ea40b8421702eb413c9955b62ef4968230f111853e0191f18b38f7bf65c5da", avisos: [] },
  "marcha-parada.brn.json": { largo: 1931, sha256: "ad854b34cfb9fb5d3ca99ad118bee45bbe1f985e19292401d590b942b53b0aab", avisos: [] },
  "marcha-parada-dos-n.brn.json": { largo: 2026, sha256: "ce387c60e3b1dcc1ac82573aa2f1c1d5da2f2a22f5824a9a475e2979cb119bf3", avisos: [] },
  "inversion.brn.json": { largo: 3759, sha256: "dbbab15b281bda512dfb42efe106cd251d776ef1d4decb0d1c51d27cd4af105c", avisos: [] },
  "varias-hojas.brn.json": {
    largo: 1209,
    sha256: "9a0e315cc765fddb834d87a7ed0eeb40dca40310280b7e787449f91723f5fc9f",
    avisos: [{ donde: "hojas", mensaje: "Tiene 3 hojas: solo se ve la primera" }],
  },
  "simbolo-desconocido.brn.json": {
    largo: 547,
    sha256: "ffd30452b351aed6037733a4461221cdbc09b7e95bf9053c044bf2a928d1987b",
    avisos: [{ donde: "hojas[0].componentes[1].tipo", mensaje: "El símbolo «prueba.desconocido» de «c2» no está en la biblioteca: se dibuja con «?»" }],
  },
};

const NOMBRES = Object.keys(CORPUS);

/** `.brn.json`: texto por líneas, sin comprimir. Si no, `.brn`: gzip. */
const esPorLineas = (nombre: string): boolean => nombre.endsWith(".brn.json");

function leer(nombre: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(readFileSync(new URL(nombre, CARPETA)) as Uint8Array);
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Abre un archivo del corpus por el camino de la app: bytes → texto → Documento. */
async function abrir(nombre: string) {
  const bytes = leer(nombre);
  const paquete = await desempaquetar(bytes);
  if (!paquete.ok) throw new Error(`${nombre}: no se pudo leer: ${paquete.error}`);
  return { bytes, texto: paquete.texto, r: deserializar(paquete.texto) };
}

describe("tests/circuitos/formato-v1/: el corpus congelado del formato 1 (T22)", () => {
  it("tiene exactamente los archivos fijados", () => {
    const hay = (readdirSync(CARPETA) as string[]).filter((f) => f.endsWith(".brn") || f.endsWith(".brn.json"));
    expect(hay.sort()).toEqual([...NOMBRES].sort());
  });

  it.each(NOMBRES)("%s: no cambió ni un byte (regenerarlo pide el OK de Bruno)", async (nombre) => {
    const bytes = leer(nombre);
    const { largo, sha256: fijado } = CORPUS[nombre]!;
    expect({ largo: bytes.length, sha256: await sha256(bytes) }).toEqual({ largo, sha256: fijado });
  });

  it.each(NOMBRES)("%s: es del formato 1, abre con sus avisos, es igual a su JSON y se guarda igual", async (nombre) => {
    const { bytes, texto, r } = await abrir(nombre);
    const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
    expect(gzip, esPorLineas(nombre) ? "un .brn.json va sin comprimir" : "un .brn va en gzip").toBe(!esPorLineas(nombre));
    expect(JSON.parse(texto).version).toBe(1);
    // Primero los errores: si no abre, que se vea por qué.
    expect(r.ok ? [] : r.errores).toEqual([]);
    if (!r.ok) return;
    expect(r.avisos).toEqual(CORPUS[nombre]!.avisos);
    // La lista blanca no pierde ni cambia nada.
    expect(r.documento).toEqual(JSON.parse(texto));
    if (esPorLineas(nombre)) {
      expect(serializarPorLineas(r.documento)).toBe(texto);
      expect(new TextEncoder().encode(serializarPorLineas(r.documento))).toEqual(bytes);
    } else {
      expect(serializar(r.documento)).toBe(texto);
    }
  });

  // El camino de un archivo viejo, con el corpus real: una migración 1 → 2
  // inyectada que solo sube la versión (el formato real sigue en 1).
  const subir: Migracion = (d) => ({ ...d, version: 2 });

  it.each(NOMBRES)("%s: con una migración 1 → 2 inyectada, abre como formato 2 y con el aviso primero", async (nombre) => {
    const { texto } = await abrir(nombre);
    const r = deserializarCon(texto, { version: 2, migraciones: [subir] });
    expect(r.ok ? [] : r.errores).toEqual([]);
    if (!r.ok) return;
    const aviso = { donde: "version", mensaje: "El archivo es del formato 1: al guardarlo pasa al formato 2" };
    expect(r.avisos).toEqual([aviso, ...CORPUS[nombre]!.avisos]);
    expect(r.documento).toEqual({ ...JSON.parse(texto), version: 2 });
  });
});
