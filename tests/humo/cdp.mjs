// Ayudantes para manejar la app por CDP (Chrome DevTools Protocol) desde las
// pruebas de humo: evaluar en la página, mouse, teclado y capturas. Usa el
// WebSocket que ya trae Node: sin dependencias.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Modificadores de CDP. */
export const ALT = 1;
export const CTRL = 2;
export const MAYUS = 8;

export class Pagina {
  /** Errores de la página (excepciones y console.error) desde la última carga. */
  errores = [];
  /**
   * Diálogos de `beforeunload` aceptados (T15a): salen al navegar con
   * cambios sin guardar. Se aceptan solos, así ninguna prueba se cuelga.
   */
  salidasConCambios = 0;
  #ws;
  #n = 0;
  #pendientes = new Map();
  /** Carpeta para las capturas; null si no se guardan. */
  #capturas;
  /** Prefijo de los nombres de captura (la prueba en curso). */
  prefijo = "";

  constructor(ws, capturas) {
    this.#ws = ws;
    this.#capturas = capturas;
    ws.addEventListener("message", (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.#pendientes.has(d.id)) {
        this.#pendientes.get(d.id)(d);
        this.#pendientes.delete(d.id);
      }
      if (d.method === "Runtime.exceptionThrown") {
        const e = d.params.exceptionDetails;
        this.errores.push(e.exception?.description ?? e.text);
      }
      if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") {
        this.errores.push(d.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      }
      // Solo el diálogo de beforeunload se acepta. Cualquier otro (alert,
      // confirm, prompt) se descarta y cuenta como error de la página: si
      // quedara abierto, la prueba se colgaría hasta el límite.
      if (d.method === "Page.javascriptDialogOpening") {
        const salir = d.params.type === "beforeunload";
        if (salir) this.salidasConCambios++;
        else this.errores.push(`Diálogo inesperado (${d.params.type}): ${d.params.message}`);
        this.cdp("Page.handleJavaScriptDialog", { accept: salir }).catch(() => undefined);
      }
    });
  }

  /** Se conecta a la pestaña `url` del WebSocket de depuración. */
  static async conectar(url, capturas = null) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("No pude conectar con el navegador.")), { once: true });
    });
    const p = new Pagina(ws, capturas);
    await p.cdp("Page.enable");
    await p.cdp("Runtime.enable");
    return p;
  }

  /** Manda un comando CDP; si falla, tira el error. */
  cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.#n;
      this.#pendientes.set(id, (d) => (d.error ? reject(new Error(`${method}: ${d.error.message}`)) : resolve(d.result)));
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evalúa una expresión en la página y devuelve su valor (debe ser serializable). */
  async evaluar(expresion) {
    const r = await this.cdp("Runtime.evaluate", { expression: expresion, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`En la página: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }

  /** Espera a que la expresión dé verdadero (o tira error al pasar `ms`). */
  async esperarA(expresion, ms = 15000) {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      if (await this.evaluar(expresion).catch(() => false)) return;
      await esperar(100);
    }
    throw new Error(`No se cumplió a tiempo: ${expresion}`);
  }

  /** Carga la app de cero (documento vacío) en 1024×600 y espera a que el lienzo esté listo. */
  async abrir(url, ancho = 1024, alto = 600) {
    this.errores = [];
    await this.cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false });
    await this.cdp("Page.navigate", { url });
    await this.esperarA("!!globalThis.bornera?.editor?.vista");
    await esperar(100);
  }

  /** Caja de un elemento en la página ({x, y, ancho, alto, cx, cy}), o null. */
  async caja(selector) {
    return this.evaluar(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, ancho: r.width, alto: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`);
  }

  /** Punto de grilla (gx, gy) del editor activo → coordenadas de la página. */
  async punto(gx, gy) {
    return this.evaluar(`(() => { const r = document.querySelector("canvas").getBoundingClientRect();
      const p = bornera.activo().vista.camara.aPantalla(${gx}, ${gy}); return { x: r.left + p.x, y: r.top + p.y }; })()`);
  }

  /** Mouse. `botones` es la máscara de botones apretados después del evento. */
  mouse(tipo, x, y, { mods = 0, botones = tipo === "mousePressed" ? 1 : 0, boton = "left" } = {}) {
    const button = tipo === "mouseMoved" && botones === 0 ? "none" : boton;
    return this.cdp("Input.dispatchMouseEvent", { type: tipo, x, y, button, buttons: botones, clickCount: 1, modifiers: mods, pointerType: "mouse" });
  }

  async clic(p, mods = 0) {
    await this.mouse("mouseMoved", p.x, p.y, { mods });
    await this.mouse("mousePressed", p.x, p.y, { mods });
    await this.mouse("mouseReleased", p.x, p.y, { mods });
    await esperar(30);
  }

  /** Apretar en `a`, moverse en `pasos` y soltar en `b`. */
  async arrastrar(a, b, { mods = 0, pasos = 8 } = {}) {
    await this.mouse("mouseMoved", a.x, a.y, { mods });
    await this.mouse("mousePressed", a.x, a.y, { mods });
    for (let i = 1; i <= pasos; i++) {
      await this.mouse("mouseMoved", a.x + ((b.x - a.x) * i) / pasos, a.y + ((b.y - a.y) * i) / pasos, { mods, botones: 1 });
    }
    await this.mouse("mouseReleased", b.x, b.y, { mods });
    await esperar(30);
  }

  /** Rueda del mouse en (x, y); deltaY > 0 aleja. */
  rueda(x, y, deltaY) {
    return this.cdp("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY });
  }

  /**
   * Aprieta y suelta una tecla: `key` ("Escape", "b"), `code` ("KeyB") y código de Windows.
   * Con `texto`, la tecla también escribe ese texto (en un campo con foco).
   */
  async tecla(key, code, codigoWindows, mods = 0, texto = undefined) {
    const base = { key, code, windowsVirtualKeyCode: codigoWindows, modifiers: mods };
    await this.cdp("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(texto ? { text: texto } : {}) });
    await this.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    await esperar(30);
  }

  /**
   * Mantiene apretada una tecla: un keyDown, `repeticiones` keyDown con
   * autorrepetición (`e.repeat`) y un keyUp.
   */
  async teclaMantenida(key, code, codigoWindows, mods = 0, repeticiones = 3) {
    const base = { key, code, windowsVirtualKeyCode: codigoWindows, modifiers: mods };
    await this.cdp("Input.dispatchKeyEvent", { type: "keyDown", ...base });
    for (let i = 0; i < repeticiones; i++) {
      await esperar(30);
      await this.cdp("Input.dispatchKeyEvent", { type: "keyDown", ...base, autoRepeat: true });
    }
    await this.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    await esperar(30);
  }

  esc() {
    return this.tecla("Escape", "Escape", 27);
  }

  /**
   * Las descargas van a `carpeta`, sin preguntar (T15a: Guardar en el
   * navegador es una descarga). Con `null`, vuelve a lo de siempre.
   */
  async descargasEn(carpeta) {
    const p = carpeta ? { behavior: "allow", downloadPath: carpeta } : { behavior: "default" };
    try {
      await this.cdp("Browser.setDownloadBehavior", p);
    } catch {
      // Desde la pestaña, algunas versiones solo aceptan la variante vieja.
      await this.cdp("Page.setDownloadBehavior", p);
    }
  }

  /** Guarda una captura si se pidieron (--capturas=CARPETA). */
  async captura(nombre) {
    if (!this.#capturas) return;
    await esperar(100);
    const r = await this.cdp("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(this.#capturas, `${this.prefijo}${nombre}.png`), Buffer.from(r.data, "base64"));
  }

  cerrar() {
    this.#ws.close();
  }
}
