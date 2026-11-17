// Corpus congelado del formato 1 (T22, D3-A de docs/plan-fase4.md):
// tests/circuitos/formato-v1/. Son `.brn.json` (la forma por líneas de T21)
// armados con el código de la app el día que se generaron, más un `.brn` real
// guardado por la 0.1.4-alpha.1 publicada, que se copia a mano, sin convertir.
// Los abre `formato-v1.test.ts`, que fija el largo y el sha256 de cada uno.
//
// CONGELADO: este script se corrió UNA vez. Si la carpeta ya tiene algún
// `.brn.json`, no escribe nada. Ningún test lo regenera. Regenerarlo pide el
// OK de Bruno (como `inversion.brn`): se borran a mano los `.brn.json`, se
// corre `node tests/circuitos/formato-v1.mjs` y se actualizan los sha256 del
// test. Cuando el formato cambie, estos archivos no se regeneran: tienen que
// seguir abriendo (con sus migraciones).
//
// Antes de escribir, cada documento tiene que abrir con los avisos esperados,
// ser igual a su JSON y volver a guardarse igual. Si uno falla, no se escribe
// ninguno. Importar este módulo no genera nada.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const CARPETA = fileURLToPath(new URL("./formato-v1/", import.meta.url));
const RAIZ = fileURLToPath(new URL("../..", import.meta.url));

/** Codos de un cable en L entre dos puntos (ninguno si están alineados). */
function enL(a, b) {
  return a.x === b.x || a.y === b.y ? [] : [[a.x, b.y]];
}

/**
 * Los documentos del corpus, con los avisos que tienen que dar al abrir.
 * `m` son los módulos de la app cargados con Vite.
 */
function documentos(m) {
  const { crearDocumento, generarId } = m.documento;
  const { borneDe } = m.cables;
  const { docRotados, docCables, docTextos, docComandos, datos, meta } = m.prueba;
  const borne = (c, nombre) => ({ tipo: "borne", comp: c.id, borne: nombre });

  // Tres hojas: en las dos primeras, un pulsador NC y una lámpara con un cable
  // en L y otro a un punto libre; la tercera, vacía.
  function variasHojas() {
    const doc = crearDocumento({ ...meta, titulo: "Varias hojas" });
    doc.hojas.push({ nombre: "Hoja 2", componentes: [], cables: [] }, { nombre: "Hoja 3", componentes: [], cables: [] });
    [0, 1].forEach((h) => {
      const hoja = doc.hojas[h];
      const s = { id: generarId(doc), ...datos("pulsador.nc", h * 20, 0), etiqueta: `S${h + 1}` };
      const l = { id: generarId(doc), ...datos("senalizacion.lampara", h * 20 + 10, 8), etiqueta: `H${h + 1}` };
      hoja.componentes.push(s, l);
      const b12 = borneDe(s, "12");
      const x1 = borneDe(l, "X1");
      const x2 = borneDe(l, "X2");
      hoja.cables.push(
        { id: generarId(doc, "w"), desde: borne(s, "12"), hasta: borne(l, "X1"), codos: enL(b12, x1) },
        { id: generarId(doc, "w"), desde: borne(l, "X2"), hasta: { tipo: "libre", x: x2.x, y: x2.y + 4 }, codos: [] },
      );
    });
    return doc;
  }

  // Un símbolo que no está en la biblioteca, sin cables: abre con «?» (D5-A).
  function simboloDesconocido() {
    const doc = crearDocumento({ ...meta, titulo: "Símbolo desconocido" });
    const hoja = doc.hojas[0];
    const s = { id: generarId(doc), ...datos("pulsador.na", 0, 0), etiqueta: "S1" };
    const x = { id: generarId(doc), ...datos("prueba.desconocido", 10, 0, 90, true), etiqueta: "X1", params: { nota: "sin cables" } };
    hoja.componentes.push(s, x);
    const b14 = borneDe(s, "14");
    hoja.cables.push({ id: generarId(doc, "w"), desde: borne(s, "14"), hasta: { tipo: "libre", x: b14.x, y: b14.y + 4 }, codos: [] });
    return { doc, desconocido: x.id };
  }

  const desconocido = simboloDesconocido();
  return [
    { nombre: "vacio", doc: crearDocumento({ titulo: "", autor: "", fecha: "" }), avisos: [] },
    { nombre: "rotados-y-espejados", doc: docRotados(), avisos: [] },
    { nombre: "cables-t-libres", doc: docCables(), avisos: [] },
    { nombre: "textos-raros", doc: docTextos(), avisos: [] },
    { nombre: "girado-con-comandos", doc: docComandos().doc, avisos: [] },
    { nombre: "marcha-parada", doc: m.marchaParada.marchaParada().doc, avisos: [] },
    { nombre: "marcha-parada-dos-n", doc: m.marchaParada.marchaParada({ dosNeutros: true }).doc, avisos: [] },
    { nombre: "inversion", doc: m.inversion.inversion().doc, avisos: [] },
    { nombre: "varias-hojas", doc: variasHojas(), avisos: [{ donde: "hojas", mensaje: "Tiene 3 hojas: solo se ve la primera" }] },
    {
      nombre: "simbolo-desconocido",
      doc: desconocido.doc,
      avisos: [
        {
          donde: "hojas[0].componentes[1].tipo",
          mensaje: `El símbolo «prueba.desconocido» de «${desconocido.desconocido}» no está en la biblioteca: se dibuja con «?»`,
        },
      ],
    },
  ];
}

/** El texto `.brn.json` de un documento, revisado. Tira si algo no da. */
function textoRevisado({ nombre, doc, avisos }, io) {
  const texto = io.serializarPorLineas(doc);
  const falla = (que) => new Error(`${nombre}: ${que}`);
  if (JSON.parse(texto).version !== 1) throw falla("no es del formato versión 1");
  if (texto.replaceAll("\n", "") !== io.serializar(doc)) throw falla("sin los saltos de línea no es el .brn");
  const r = io.deserializar(texto);
  if (!r.ok) throw falla(`no abre: ${JSON.stringify(r.errores)}`);
  if (!isDeepStrictEqual(r.avisos, avisos)) throw falla(`abre con otros avisos: ${JSON.stringify(r.avisos)}`);
  if (!isDeepStrictEqual(r.documento, doc)) throw falla("lo que abre no es igual al documento");
  if (!isDeepStrictEqual(r.documento, JSON.parse(texto))) throw falla("lo que abre no es igual a su JSON");
  if (io.serializarPorLineas(r.documento) !== texto) throw falla("al volver a guardarlo, el texto cambia");
  return texto;
}

async function generar() {
  if (existsSync(CARPETA) && readdirSync(CARPETA).some((f) => f.endsWith(".brn.json"))) {
    throw new Error(`${CARPETA} ya tiene el corpus. Está congelado: regenerarlo pide el OK de Bruno (ver el comentario de este script).`);
  }
  const { createServer } = await import("vite");
  const servidor = await createServer({
    root: RAIZ,
    logLevel: "error",
    clearScreen: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const cargar = (ruta) => servidor.ssrLoadModule(ruta);
    const io = await cargar("/src/core/io/index.ts");
    const m = {
      documento: await cargar("/src/core/model/documento.ts"),
      cables: await cargar("/src/core/model/cables.ts"),
      prueba: await cargar("/src/core/io/prueba-documentos.ts"),
      marchaParada: await cargar("/src/core/circuitos/marchaParada.ts"),
      inversion: await cargar("/src/core/circuitos/inversion.ts"),
    };
    const { SIMBOLOS } = await cargar("/src/core/symbols/index.ts");

    const lista = documentos(m);
    // Todos los símbolos en las 4 rotaciones, con y sin espejo.
    const rotados = lista.find((d) => d.nombre === "rotados-y-espejados").doc.hojas[0].componentes;
    for (const s of SIMBOLOS) {
      for (const rot of [0, 90, 180, 270]) {
        for (const espejado of [false, true]) {
          if (!rotados.some((c) => c.tipo === s.tipo && c.rot === rot && c.espejado === espejado)) {
            throw new Error(`rotados-y-espejados: falta ${s.tipo} con rot ${rot} y espejado ${espejado}`);
          }
        }
      }
    }
    // Primero se revisan todos; si uno falla, no se escribe ninguno.
    const archivos = lista.map((d) => ({ ruta: join(CARPETA, `${d.nombre}.brn.json`), texto: textoRevisado(d, io) }));
    mkdirSync(CARPETA, { recursive: true });
    for (const { ruta, texto } of archivos) {
      // UTF-8 sin BOM, con "\n": `*.brn.json -text` en .gitattributes.
      const bytes = new TextEncoder().encode(texto);
      writeFileSync(ruta, bytes, { flag: "wx" });
      console.log(`${ruta}: ${bytes.length} bytes`);
    }
  } finally {
    await servidor.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  generar().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
