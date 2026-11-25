// T33: dibujo del estado en Simular, en la app real a 1024×600 (docs/plan-T33.md).
//  1. marcha-parada.brn: F5 dibuja los cables por potencial (fase, neutro;
//     sin potencial con el color de Editar, ajuste 3). Mantener S1: K1 y H1
//     rellenas; al soltar siguen. S0 las apaga.
//  2. F5 vuelve a Editar: el lienzo queda igual que antes de entrar.
//  3. corto.brn: al pulsar S1, la red en corto en --conflicto (M-A).
// Con `-- --capturas=CARPETA` guarda las capturas de cada paso.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CTRL, esperar } from "./cdp.mjs";

export const nombre = "Dibujo del estado en Simular";

const O = ["o", "KeyO", 79];
const F5 = ["F5", "F5", 116];
const CIRCUITOS = resolve(dirname(fileURLToPath(import.meta.url)), "../circuitos");

/** "#rrggbb" o "#rgb" → [r, g, b]. */
function rgb(hex) {
  const h = hex.trim().replace("#", "");
  const l = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(l.slice(i, i + 2), 16));
}
const distancia = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));

export default async function (p, comprobar) {
  await p.interceptarSelector();
  try {
    await probar(p, comprobar);
  } finally {
    await p.interceptarSelector(false).catch(() => undefined);
  }
}

async function probar(p, comprobar) {
  const tecla = ([key, code, vk], mods = 0) => p.tecla(key, code, vk, mods);
  const reposo = () =>
    p.evaluar(`new Promise((listo) => { let quietos = 0; const f = () => {
      quietos = bornera.activo().vista.enReposo ? quietos + 1 : 0;
      if (quietos >= 3) listo(true); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  const foto = async (n) => {
    await reposo();
    await p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]");
      (globalThis.__fotos ??= {})["${n}"] = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; })()`);
  };
  const distintos = async (n) => {
    await reposo();
    return p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]");
      const a = globalThis.__fotos["${n}"], b = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      if (a.length !== b.length) return -1; let k = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) k++;
      return k; })()`);
  };
  /** Los colores de los píxeles alrededor del punto de grilla (gx, gy), de 3×3. */
  const alrededor = async (gx, gy) => {
    await reposo();
    return p.evaluar(`(() => { const cv = document.querySelector("canvas[aria-label^=Lienzo]"); const k = cv.width / cv.clientWidth;
      const q = bornera.activo().vista.camara.aPantalla(${gx}, ${gy});
      const d = cv.getContext("2d").getImageData(Math.round(q.x * k) - 1, Math.round(q.y * k) - 1, 3, 3).data;
      const s = []; for (let i = 0; i < d.length; i += 4) s.push([d[i], d[i + 1], d[i + 2]]); return s; })()`);
  };
  const tema = async (nombre) => rgb(await p.evaluar(`getComputedStyle(document.querySelector("canvas[aria-label^=Lienzo]")).getPropertyValue("${nombre}")`));
  /** La distancia del píxel más parecido a `color` alrededor de (gx, gy). */
  const cerca = async (gx, gy, color) => Math.min(...(await alrededor(gx, gy)).map((c) => distancia(c, color)));
  /** Un punto en el medio del tramo más largo de un cable de esa clase; null si no hay. */
  const cableDeClase = (clase) =>
    p.evaluar(`(() => { const ed = bornera.editor;
      for (const w of ed.documento.hojas[0].cables) {
        if (ed.escena.claseDeCable(w.id) !== ${clase}) continue;
        const q = ed.escena.obtenerCable(w.id).puntos; let mejor = null;
        for (let i = 0; i + 3 < q.length; i += 2) { const l = Math.abs(q[i + 2] - q[i]) + Math.abs(q[i + 3] - q[i + 1]);
          if (!mejor || l > mejor.l) mejor = { l, x: (q[i] + q[i + 2]) / 2, y: (q[i + 1] + q[i + 3]) / 2 }; }
        if (mejor && mejor.l >= 2) return { id: w.id, x: mejor.x, y: mejor.y };
      }
      return null; })()`);
  const componente = (etiqueta, tipo) =>
    p.evaluar(`(() => { const c = bornera.editor.documento.hojas[0].componentes.find((x) => x.etiqueta === ${JSON.stringify(etiqueta)} && x.tipo === ${JSON.stringify(tipo)}); return { id: c.id, x: c.x, y: c.y }; })()`);
  const sobre = async (etiqueta, tipo) => {
    const g = await p.evaluar(`(() => { const ed = bornera.activo(); const h = ed.documento.hojas[0];
      const c = h.componentes.find((x) => x.etiqueta === ${JSON.stringify(etiqueta)} && x.tipo === ${JSON.stringify(tipo)});
      for (let dy = -4; dy <= 4; dy += 0.25) for (let dx = -4; dx <= 4; dx += 0.25)
        if (ed.escena.componenteEnPunto(c.x + dx, c.y + dy, 0) === c.id) return { x: c.x + dx, y: c.y + dy };
      return null; })()`);
    if (!g) throw new Error(`No hay un punto sobre ${etiqueta}`);
    return p.punto(g.x, g.y);
  };
  const apretar = async (q) => {
    await p.mouse("mouseMoved", q.x, q.y);
    await p.mouse("mousePressed", q.x, q.y);
    await esperar(30);
  };
  const soltarEn = async (q) => {
    await p.mouse("mouseMoved", q.x, q.y, { botones: 1 });
    await p.mouse("mouseReleased", q.x, q.y);
    await esperar(30);
  };
  const abrir = async (archivo) => {
    await p.evaluar("bornera.editor.__anterior = true");
    p.elegirArchivo(resolve(CIRCUITOS, archivo));
    await tecla(O, CTRL);
    await p.esperarA("bornera.editor.__anterior !== true", 5000);
    await p.esperarA("!bornera.editor.avisos.enReposoR11", 5000);
  };

  const colores = { fase: await tema("--sim-fase"), neutro: await tema("--sim-neutro"), encendida: await tema("--sim-encendida"), simbolo: await tema("--simbolo"), conflicto: await tema("--conflicto"), fondo: await tema("--lienzo") };
  const TOL = 40;

  // ── 1. marcha-parada.brn ──
  await abrir("marcha-parada.brn");
  await foto("editar");
  await tecla(F5);
  await esperar(80);
  await p.captura("t33-reposo");
  const fase = await cableDeClase(1);
  const neutro = await cableDeClase(2);
  const sin = await cableDeClase(0);
  comprobar("F5: hay cables con fase, con neutro y sin potencial", fase !== null && neutro !== null && sin !== null, JSON.stringify({ fase, neutro, sin }));
  if (fase) comprobar("un cable con fase se ve en --sim-fase", (await cerca(fase.x, fase.y, colores.fase)) <= TOL, JSON.stringify(await alrededor(fase.x, fase.y)));
  if (neutro) comprobar("un cable con neutro se ve en --sim-neutro", (await cerca(neutro.x, neutro.y, colores.neutro)) <= TOL, JSON.stringify(await alrededor(neutro.x, neutro.y)));
  if (sin) comprobar("un cable sin potencial, con el color de Editar (ajuste 3)", (await cerca(sin.x, sin.y, colores.simbolo)) <= TOL, JSON.stringify(await alrededor(sin.x, sin.y)));
  comprobar("el lienzo cambió al entrar", (await distintos("editar")) > 0);

  const h1 = await componente("H1", "senalizacion.lampara");
  const k1 = await componente("K1", "contactor.bobina");
  // Adentro del círculo y del rectángulo, lejos de la cruz y del contorno.
  const lampara = () => cerca(h1.x, h1.y - 0.45, colores.encendida);
  const bobina = () => cerca(k1.x + 0.5, k1.y, colores.encendida);
  comprobar("en reposo, H1 y K1 sin relleno", (await lampara()) > TOL && (await bobina()) > TOL);

  const s1 = await sobre("S1", "pulsador.na");
  await apretar(s1);
  await p.captura("t33-s1");
  comprobar("mantener S1: H1 encendida y K1 con tensión, rellenas en --sim-encendida", (await lampara()) <= TOL && (await bobina()) <= TOL, `${await lampara()} / ${await bobina()}`);
  comprobar("S1 se dibuja accionado", await p.evaluar(`bornera.editor.escena.obtener(${JSON.stringify((await componente("S1", "pulsador.na")).id)}).accionado === true`));
  await soltarEn({ x: s1.x + 120, y: s1.y + 60 });
  comprobar("al soltar, siguen rellenas (autorretención)", (await lampara()) <= TOL && (await bobina()) <= TOL);
  await apretar(await sobre("S0", "pulsador.nc"));
  await soltarEn(await sobre("S0", "pulsador.nc"));
  comprobar("S0: H1 y K1 se apagan", (await lampara()) > TOL && (await bobina()) > TOL);

  // ── 2. Salir ──
  await tecla(F5);
  await esperar(80);
  const d = await distintos("editar");
  comprobar("F5 vuelve a Editar: el lienzo queda igual que antes de entrar", d === 0, `${d} píxeles distintos`);
  await p.captura("t33-salir");

  // ── 3. corto.brn ──
  await abrir("corto.brn");
  await tecla(F5);
  await esperar(80);
  const q = await sobre("S1", "pulsador.na");
  await apretar(q);
  await soltarEn(q);
  const corto = await cableDeClase(3);
  comprobar("corto: hay una red en corto", corto !== null);
  if (corto) comprobar("la red en corto se ve en --conflicto (M-A)", (await cerca(corto.x, corto.y, colores.conflicto)) <= TOL, JSON.stringify(await alrededor(corto.x, corto.y)));
  await p.captura("t33-corto");
  await tecla(F5);
  await esperar(80);
  comprobar("corto: F5 sale, sin «•»", !(await p.evaluar("document.title")).includes("•"));
}
