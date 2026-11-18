<script lang="ts">
  // Esqueleto de la ventana: barra superior, paleta, lienzo, propiedades y estado.
  import "./tema.css";
  import BarraSuperior from "./BarraSuperior.svelte";
  import Paleta from "./Paleta.svelte";
  import Lienzo from "./Lienzo.svelte";
  import PanelPropiedades from "./PanelPropiedades.svelte";
  import BarraEstado from "./BarraEstado.svelte";
  import type { EscenaDesarrollo, Modo } from "./tipos";
  import { esAtajoBanco, siguienteEscenaBanco } from "./escenas";
  import type { Punto } from "../render/camara";
  import { OPCIONES_OPTIMIZADAS, type OpcionesCapas } from "../render/capas";
  import { SIN_SELECCION, type DiagnosticoArrastre, type ResumenSeleccion } from "../editor/editor";
  import { abrirAlSeleccionar, DURACION_AVISO_MS } from "./propiedades";
  import { esAtajoModo, f5CambiaModo, otroModo } from "./modo";
  import { hayModal } from "../editor/punteros";
  import { Editor } from "../editor/editor";
  import { onMount, tick, untrack } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import DialogoDiagnostico from "./DialogoDiagnostico.svelte";
  import DialogoArchivo from "./DialogoArchivo.svelte";
  import DialogoSinGuardar from "./DialogoSinGuardar.svelte";
  import DialogoProbar from "./DialogoProbar.svelte";
  import { probarFase3b as correrFase3b } from "./probarFase3b";
  import { medirCopia as correrMedirCopia, motor } from "./medirCopia";
  import { Autoguardado, avisoFallo } from "./autoguardado";
  import { abrirBase, almacenIndexedDB, candadosWebLocks, idInstancia, motivoFallo, type AlmacenCopias } from "./respaldo";
  import { textoCopias } from "./listaCopias";
  import DialogoRecuperar from "./DialogoRecuperar.svelte";
  import {
    abrirCopia,
    AVISO_DESCARTADA,
    avisoRecuperado,
    copiasParaOfrecer,
    filaRecuperar,
    type CopiaOfrecida,
    type FilaRecuperar,
  } from "./recuperar";
  import type { ProblemaArchivo } from "../core/io";
  import {
    atajoArchivo,
    atajoArchivoActua,
    esTeclaRecarga,
    lineasProblemas,
    nombreDocumento,
    OperacionesArchivo,
    TITULOS,
    tituloVentana,
    type AccionArchivo,
    type RespuestaSinGuardar,
  } from "./archivo";
  import { archivosNavegador, archivosTauri } from "./archivos";
  import { esWindows, Recientes } from "./recientes";
  import { ES_PRERELEASE, VERSION } from "./version";

  /** Corre dentro de Tauri (el escritorio); si no, es el navegador (`npm run dev` y el humo). */
  const enEscritorio = isTauri();

  let modo = $state<Modo>("editar");
  let paletaAbierta = $state(true);
  let propiedadesAbierto = $state(false);
  /** El usuario plegó el panel con el botón: no se vuelve a abrir solo. */
  let propiedadesPlegadoPorUsuario = false;
  let seleccion = $state<ResumenSeleccion>(SIN_SELECCION);
  let zoom = $state(1);
  let cursor = $state<Punto | null>(null);
  /** Tipo del símbolo que se está colocando (para resaltarlo en la paleta). */
  let colocando = $state<string | null>(null);
  /** La herramienta cable está activa (para resaltar su botón en la paleta). */
  let cableActivo = $state(false);
  /** Pista de la herramienta para la barra de estado. */
  let pista = $state<string | null>(null);
  let puedeDeshacer = $state(false);
  let puedeRehacer = $state(false);
  /** El documento tiene cambios sin guardar (T15a). */
  let modificado = $state(false);
  /** `meta.titulo` del documento: va en el título de la ventana si no hay archivo actual. */
  let tituloDocumento = $state("");
  /** Errores y avisos de las validaciones (T19) del editor a la vista; null en las escenas que no se editan. */
  let cuentaAvisos = $state.raw<{ errores: number; avisos: number } | null>(null);
  /** Nombre del archivo actual; null en un documento que nunca se guardó. */
  let archivoActual = $state<string | null>(null);
  /** Diálogo de archivo abierto ("No se puede guardar"…); null si no hay. */
  let dialogoArchivo = $state.raw<{ titulo: string; problemas: readonly ProblemaArchivo[] } | null>(null);
  /** Diálogo de cambios sin guardar abierto (D13-A); null si no hay. */
  let sinGuardar = $state.raw<{ nombre: string; responder: (r: RespuestaSinGuardar) => void } | null>(null);

  function responderSinGuardar(r: RespuestaSinGuardar) {
    const s = sinGuardar;
    sinGuardar = null;
    s?.responder(r);
  }
  /** Aviso de la barra de estado (una acción que no se pudo hacer); se borra solo. */
  let aviso = $state<string | null>(null);
  let temporizadorAviso = 0;

  function avisar(texto: string) {
    aviso = texto;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = window.setTimeout(() => (aviso = null), DURACION_AVISO_MS);
  }
  let lienzo: ReturnType<typeof Lienzo>;
  let panel: ReturnType<typeof PanelPropiedades> | undefined = $state();
  /** Editor de lo que muestra el lienzo: a él van las ediciones del panel. */
  let editorActivo = $state.raw<Editor | null>(null);

  /** Los avisos dicen el tiempo: en desarrollo y en las prereleases (D20). */
  const MEDIR = import.meta.env.DEV || ES_PRERELEASE;

  // ── Archivo (T15a) ───────────────────────────────────────────────────────
  // En el escritorio, diálogos nativos y escritura segura; en el navegador,
  // descargas y <input type="file">.
  // Abrir reciente (T24): solo en el escritorio, en `localStorage` (por
  // origen: `tauri dev` y la app compilada tienen listas separadas).
  const recientes = enEscritorio ? new Recientes(() => window.localStorage, esWindows(navigator.userAgent)) : null;
  /** Las rutas de Abrir reciente; null en el navegador (no se muestra el menú). */
  let listaRecientes = $state.raw<string[] | null>(recientes?.lista() ?? null);

  const operaciones = new OperacionesArchivo({
    archivos: enEscritorio ? archivosTauri : archivosNavegador,
    recientes: recientes && {
      agregar: (ruta) => (listaRecientes = recientes.agregar(ruta)),
      quitar: (ruta) => (listaRecientes = recientes.quitar(ruta)),
    },
    // Lo que se ve: el documento o una escena del banco (D17). Las escenas
    // sin editor ("símbolos" y "vacía") no se guardan.
    mostrado: () => (editorActivo ? { editor: editorActivo, esDocumento: escena === "documento" } : null),
    // Abrir y Nuevo: solo en Editar y viendo el documento (D17).
    reemplazable: () => (puedeAbrir ? editorActivo : null),
    documento: () => lienzo.editorDelDocumento(),
    reemplazar: (documento, opciones) => lienzo.reemplazarDocumento(new Editor(documento, 0, opciones)),
    preguntarSinGuardar: (nombre) =>
      new Promise((responder) => {
        sinGuardar?.responder("cancelar");
        sinGuardar = { nombre, responder };
      }),
    confirmarPanel: () => panel?.confirmar(),
    mostrarProblemas: (titulo, problemas) => (dialogoArchivo = { titulo, problemas }),
    avisar,
    ahora: () => performance.now(),
    medir: MEDIR,
  });
  // El nombre del título: el archivo actual o, después de Recuperar, el original de la copia (T23).
  operaciones.alCambiar = () => (archivoActual = operaciones.nombreVisible);

  function accionArchivo(a: AccionArchivo) {
    if (a === "guardar") void operaciones.guardar();
    else if (a === "guardarComo") void operaciones.guardar(true);
    else if (a === "exportar") void operaciones.exportar();
    else if (a === "abrir") void operaciones.abrir();
    else void operaciones.nuevo();
  }

  // Título de la ventana (D18-B): nombre y marca de cambios. En el escritorio,
  // por setTitle (el título de la ventana no sigue a document.title).
  $effect(() => {
    const titulo = tituloVentana({ archivo: archivoActual, titulo: tituloDocumento, modificado });
    document.title = titulo;
    if (enEscritorio) getCurrentWindow().setTitle(titulo).catch((e) => console.warn("No se pudo poner el título de la ventana", e));
  });

  // ── Copia de recuperación (T23) ──────────────────────────────────────────
  // Cada instancia tiene su id y toma su candado de Web Locks para siempre
  // (D2d-B). La base se abre al montar; si no abre, un aviso y la app sigue.
  // Solo se copia el editor del documento (ver autoguardado.ts).
  const idPropio = idInstancia();
  const candados = candadosWebLocks();
  candados?.tomarPropio(idPropio);
  let almacenCopias: AlmacenCopias | null = null;
  let autoguardado: Autoguardado | null = null;
  /** Por qué no abrió IndexedDB; null si abrió (o todavía no se sabe). */
  let falloCopias: string | null = null;

  onMount(() => {
    let montado = true;
    abrirBase()
      .then((base) => {
        if (!montado) {
          base.close();
          return;
        }
        const almacen = almacenIndexedDB(base);
        const ag = new Autoguardado({
          id: idPropio,
          almacen,
          editor: () => lienzo.editorDelDocumento(),
          archivo: () => {
            // Después de Recuperar, el original de la copia (T23): una copia de la copia lo conserva.
            const a = operaciones.archivoActual ?? operaciones.sugerido;
            return a ? { nombre: a.nombre, ruta: a.ruta } : null;
          },
          version: VERSION,
          // D1: gestos, previas, tramo de cable, y mientras corre «Probar» o una medición.
          ocupado: () => (lienzo?.ocupadoParaCopia() ?? false) || (prueba?.corriendo ?? false),
          avisar,
          ahora: () => performance.now(),
          programar: (f, ms) => window.setTimeout(f, ms),
          cancelar: (t) => clearTimeout(t as number),
        });
        // Otra versión de Bornera quiere subir la base: se la deja y esta instancia no copia más.
        base.onversionchange = () => {
          base.close();
          ag.apagar(avisoFallo(new Error("otra versión de Bornera cambió la base")));
        };
        almacenCopias = almacen;
        autoguardado = ag;
        ag.alCambiarEstado = revisarAdoptada;
        ag.alCambiar();
        // D2c-A: las copias sin dueño, con su candado retenido mientras se decide.
        void copiasParaOfrecer(almacen, candados, idPropio)
          .then((ofrecidas) => {
            if (montado) recuperables = ofrecidas;
            else for (const o of ofrecidas) o.soltar();
          })
          .catch((e) => console.warn("No se pudieron leer las copias de recuperación", e))
          .finally(() => {
            if (montado) recuperacionResuelta = true;
            // Desarrollo (humo): ya se decidió si hay diálogo, sin esperar un tiempo fijo.
            const global = (globalThis as Record<string, unknown>).bornera as Record<string, unknown> | undefined;
            if (import.meta.env.DEV && global) global.recuperacionLista = true;
          });
        if (import.meta.env.DEV) {
          const global = (globalThis as Record<string, unknown>).bornera as Record<string, unknown> | undefined;
          if (global) Object.assign(global, { autoguardado: ag, respaldo: almacen, idInstancia: idPropio });
        }
      })
      .catch((e) => {
        falloCopias = motivoFallo(e);
        avisar(avisoFallo(e));
        if (montado) recuperacionResuelta = true;
      });
    return () => {
      montado = false;
    };
  });

  /** Menú de desarrollo › «Copias de recuperación» (T23, etapa 1: S2 y S3 a mano). */
  async function verCopias() {
    if (prueba?.corriendo || avisoProbar) return;
    const titulo = "Copias de recuperación";
    prueba = { titulo, corriendo: true, texto: "Leyendo las copias…" };
    try {
      const texto = await textoCopias({
        idPropio,
        almacen: almacenCopias,
        fallo: falloCopias,
        candados,
        estado: autoguardado?.estado ?? null,
        version: VERSION,
        motor: motor(),
        fecha: new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "medium" }),
      });
      prueba = { titulo, corriendo: false, texto };
    } catch (e) {
      prueba = { titulo, corriendo: false, texto: `No se pudieron leer las copias: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // ── Recuperar al arrancar (T23, D2c-A) ───────────────────────────────────
  /** Las copias sin dueño que ofrece el diálogo, con su candado retenido; vacío: sin diálogo. */
  let recuperables = $state.raw<CopiaOfrecida[]>([]);
  /** La copia que no abrió: sus problemas y su texto (si hay), para exportarlo tal cual. */
  let copiaRota = $state.raw<{ ofrecida: CopiaOfrecida; lineas: string[]; texto: string | null } | null>(null);
  let recuperando = $state(false);
  /**
   * La copia ajena recuperada: se borra (y se suelta su candado) cuando la
   * copia propia queda escrita o el documento se guarda. Hasta entonces, si
   * Bornera se corta, se vuelve a ofrecer.
   */
  let adoptada: CopiaOfrecida | null = null;

  // ── El archivo del argumento (T25, doble clic en un `.brn`) ────────────────
  // Primero se resuelve la recuperación: se leen las copias y, si hay, se
  // espera a que se cierre su diálogo. Después se abre el archivo. Si en el
  // diálogo se recuperó una copia, Abrir pregunta antes por sus cambios
  // (D2-A). Si IndexedDB no abrió, se abre igual.
  /** La ruta que dio Rust, una sola vez; null cuando ya se usó (o en el navegador). */
  let rutaInicial: Promise<string | null> | null = enEscritorio
    ? invoke<string | null>("archivo_inicial").catch((e) => {
        console.warn("No se pudo leer el archivo del argumento", e);
        return null;
      })
    : null;
  /** Ya se sabe si hay copias para ofrecer (o IndexedDB no abrió). */
  let recuperacionResuelta = $state(false);
  $effect(() => {
    if (!recuperacionResuelta || recuperables.length > 0 || recuperando) return;
    const pedida = rutaInicial;
    if (!pedida) return;
    rutaInicial = null;
    void pedida.then((ruta) => {
      if (ruta) void operaciones.abrirArgumento(ruta);
    });
  });

  const filasRecuperar = $derived.by((): FilaRecuperar[] => {
    const ahora = new Date();
    return recuperables.map((o) => filaRecuperar(o.registro, ahora));
  });

  function revisarAdoptada() {
    const a = adoptada;
    const ag = autoguardado;
    if (!a || !ag || !almacenCopias) return;
    if (!ag.estado.hayCopia && lienzo.editorDelDocumento().modificado) return;
    adoptada = null;
    almacenCopias
      .borrar(a.registro.id)
      .catch((e) => console.warn("No se pudo borrar la copia recuperada", e))
      .finally(() => a.soltar());
  }

  /** Cierra el diálogo; las copias que quedan se ofrecen en el próximo arranque. */
  function cerrarRecuperar() {
    for (const o of recuperables) o.soltar();
    recuperables = [];
    copiaRota = null;
  }

  async function recuperarCopia(id: string) {
    const o = recuperables.find((x) => x.registro.id === id);
    if (!o || !almacenCopias || recuperando) return;
    recuperando = true;
    try {
      const abierta = await abrirCopia(almacenCopias, id);
      if (!abierta.ok) {
        copiaRota = { ofrecida: o, lineas: lineasProblemas(abierta.problemas), texto: abierta.texto };
        return;
      }
      const inicio = performance.now();
      const recuperado = await operaciones.recuperar(abierta.documento, o.registro.archivo);
      if (!recuperado) {
        avisar("No se pudo recuperar ahora: hay otra operación en curso");
        return;
      }
      // Las demás quedan para el próximo arranque.
      for (const x of recuperables) if (x !== o) x.soltar();
      recuperables = [];
      copiaRota = null;
      adoptada = o;
      autoguardado?.copiarPronto();
      if (abierta.avisos.length > 0) dialogoArchivo = { titulo: TITULOS.seAbrioConAvisos, problemas: abierta.avisos };
      await recuperado.cuadro;
      avisar(avisoRecuperado(MEDIR ? Math.round(performance.now() - inicio) : null));
    } finally {
      recuperando = false;
    }
  }

  async function descartarCopia(id: string) {
    const o = recuperables.find((x) => x.registro.id === id);
    if (!o || !almacenCopias || recuperando) return;
    recuperando = true;
    try {
      await almacenCopias.borrar(id);
      o.soltar();
      recuperables = recuperables.filter((x) => x !== o);
      if (copiaRota?.ofrecida === o) copiaRota = null;
      avisar(AVISO_DESCARTADA);
    } catch (e) {
      avisar(avisoFallo(e));
    } finally {
      recuperando = false;
    }
  }

  async function exportarCopia(id: string) {
    const r = copiaRota;
    if (!r || r.ofrecida.registro.id !== id || r.texto === null || recuperando) return;
    recuperando = true;
    try {
      await operaciones.exportarTexto(r.texto, filaRecuperar(r.ofrecida.registro).nombre);
    } finally {
      recuperando = false;
    }
  }

  /** La ventana se está cerrando (ya se respondió el diálogo): `beforeunload` no pregunta otra vez. */
  let cerrando = false;

  // Cerrar la ventana con cambios (D14-A), solo en el escritorio. El cierre se
  // frena siempre y, si se puede cerrar, se destruye la ventana desde acá:
  // así la marca `cerrando` dura solo lo que dura el cierre.
  onMount(() => {
    if (!enEscritorio) return;
    const ventana = getCurrentWindow();
    let quitar: (() => void) | null = null;
    let montado = true;
    void ventana
      .onCloseRequested(async (e) => {
        e.preventDefault();
        if (!(await operaciones.antesDeCerrar())) return;
        // Se cierra bien (sin cambios, guardado o «No guardar»): la copia propia se borra (D2e, hasta 1 s).
        await autoguardado?.cerrar();
        cerrando = true;
        try {
          await ventana.destroy();
        } catch (err) {
          cerrando = false;
          avisar(`No se pudo cerrar la ventana: ${err instanceof Error ? err.message : String(err)}`);
        }
      })
      .then((q) => (montado ? (quitar = q) : q()));
    return () => {
      montado = false;
      quitar?.();
    };
  });

  // Lo que muestra el lienzo (el documento, salvo que se elija una escena de
  // prueba), contador de rendimiento y optimizaciones.
  let escena = $state<EscenaDesarrollo>("documento");
  /** Abrir y Nuevo andan: en Editar y viendo el documento (D17: no en Simular ni en el banco). */
  const puedeAbrir = $derived(modo === "editar" && escena === "documento");
  let rendimiento = $state(false);
  let opciones = $state<OpcionesCapas>({ ...OPCIONES_OPTIMIZADAS });
  let diagnostico = $state<DiagnosticoArrastre>({ modo: "auto", sonda: false });

  /** Prueba automática del arrastre o «Probar la fase 3b»: estado del diálogo (null: cerrado). */
  let prueba = $state<{ titulo: string; corriendo: boolean; texto: string } | null>(null);

  async function probarArrastre() {
    if (prueba?.corriendo) return;
    const titulo = "Diagnóstico del arrastre";
    prueba = { titulo, corriendo: true, texto: "Abriendo la escena de 2000 con cables…" };
    try {
      // Desde T14a, la prueba de aceptación es con 40 cableados.
      escena = "cables";
      await tick();
      // Dos cuadros: la escena nueva ya está conectada y dibujada.
      for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
      const tabla = await lienzo.diagnosticarArrastre({
        progreso: (t) => {
          if (prueba) prueba.texto = `Midiendo: ${t}…`;
        },
      });
      prueba = { titulo, corriendo: false, texto: tabla };
    } catch (e) {
      prueba = { titulo, corriendo: false, texto: `La prueba falló: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  /** Aviso de cambios sin guardar antes de «Probar la fase 3b» (D3-A); null si no hay. */
  let avisoProbar = $state.raw<{ nombre: string; responder: (probar: boolean) => void } | null>(null);

  function responderProbar(probar: boolean) {
    const a = avisoProbar;
    avisoProbar = null;
    a?.responder(probar);
  }

  /**
   * «Probar la fase 3b» (cierre 3b, etapa 4): los escenarios del banco de la
   * checklist de la netbook, en un editor y un lienzo aparte. No toca la hoja
   * ni la escena a la vista; con cambios sin guardar, avisa antes.
   */
  async function probarFase3b() {
    if (prueba?.corriendo || avisoProbar) return;
    if (modificado) {
      const nombre = nombreDocumento(archivoActual, tituloDocumento);
      const probar = await new Promise<boolean>((responder) => (avisoProbar = { nombre, responder }));
      if (!probar) return;
    }
    panel?.confirmar();
    const titulo = "Probar la fase 3b";
    prueba = { titulo, corriendo: true, texto: "Preparando las escenas…" };
    try {
      const tabla = await correrFase3b((t) => {
        if (prueba) prueba.texto = `Probar la fase 3b: ${t}…`;
      });
      prueba = { titulo, corriendo: false, texto: tabla };
    } catch (e) {
      prueba = { titulo, corriendo: false, texto: `La prueba falló: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  /**
   * «Medir la copia (F1)» (T23, etapa 1a): la parte síncrona de la copia de
   * recuperación con la escena de 2000 + cables, armada aparte. No toca la
   * hoja ni su copia, así que no avisa de cambios sin guardar.
   */
  async function medirCopia() {
    if (prueba?.corriendo || avisoProbar) return;
    const titulo = "Medir la copia (F1)";
    prueba = { titulo, corriendo: true, texto: "Medir la copia: preparando…" };
    try {
      const texto = await correrMedirCopia((t) => {
        if (prueba) prueba.texto = `Medir la copia: ${t}…`;
      });
      prueba = { titulo, corriendo: false, texto };
    } catch (e) {
      prueba = { titulo, corriendo: false, texto: `La prueba falló: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  function alCambiarSeleccion(r: ResumenSeleccion) {
    if (abrirAlSeleccionar(seleccion.cantidad, r.cantidad, propiedadesPlegadoPorUsuario)) propiedadesAbierto = true;
    seleccion = r;
  }

  // Antes de cambiar de modo o de escena, el panel confirma lo que se esté
  // escribiendo. F5 y Ctrl+Shift+B llaman a `confirmar` antes de cambiar; los
  // botones ya lo hacen al sacarle el foco al campo. Esto es la red de
  // seguridad (por ejemplo, si un WebView no le saca el foco al hacer clic):
  // el borrador recuerda su editor y su componente, y confirmar de más no hace nada.
  $effect(() => {
    void modo;
    void escena;
    untrack(() => panel?.confirmar());
  });

  function alTecla(e: KeyboardEvent) {
    // F5: alterna Editar/Simular, también con el foco en el campo del panel.
    // La tecla es siempre nuestra: sin esto, el WebView recarga y se pierde el documento.
    if (esAtajoModo(e)) {
      e.preventDefault();
      if (f5CambiaModo({ repetida: e.repeat, modal: hayModal(), gesto: lienzo?.enGesto() ?? false })) {
        panel?.confirmar();
        modo = otroModo(modo);
      }
      return;
    }
    // Ctrl+S, Ctrl+Mayús+S, Ctrl+O y Ctrl+N: también con el foco en el campo
    // del panel (la operación lo confirma antes). La tecla es siempre nuestra:
    // el navegador no abre sus diálogos de guardar ni de abrir.
    const archivo = atajoArchivo(e);
    if (archivo) {
      e.preventDefault();
      if (atajoArchivoActua({ repetida: e.repeat, modal: hayModal(), gesto: lienzo?.enGesto() ?? false })) accionArchivo(archivo);
      return;
    }
    // D15-C: en la app compilada, Ctrl+R, Ctrl+F5 y Mayús+F5 no recargan (se
    // perdería el documento). En desarrollo quedan para recargar.
    if (!import.meta.env.DEV && esTeclaRecarga(e)) {
      e.preventDefault();
      return;
    }
    // F3: contador de rendimiento (y que el navegador no abra "Buscar").
    if (e.key === "F3" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      if (!e.repeat) rendimiento = !rendimiento;
    }
    // Ctrl+Shift+B (oculto, también en la versión compilada): siguiente escena
    // del banco de pruebas. Se anula el atajo del WebView (barra de favoritos).
    // Con un diálogo modal abierto no cambia (como los demás atajos).
    if (esAtajoBanco(e)) {
      e.preventDefault();
      if (!e.repeat && !hayModal()) {
        panel?.confirmar();
        escena = siguienteEscenaBanco(escena);
      }
    }
  }

  /**
   * Recargar o cerrar la página con cambios sin guardar: el navegador pregunta
   * antes (D15-C). En el escritorio, cerrar la ventana lo atiende
   * `onCloseRequested`, que ya preguntó: con `cerrando`, no se pregunta otra
   * vez. Esto cubre la recarga.
   */
  function alSalir(e: BeforeUnloadEvent) {
    if (!modificado || cerrando) return;
    e.preventDefault();
    // Los motores que no miran preventDefault (WebKit viejo) miran esto.
    e.returnValue = "";
  }
</script>

<!-- `storage`: otra ventana de Bornera cambió la lista de recientes (T24). -->
<svelte:window onkeydown={alTecla} onbeforeunload={alSalir} onstorage={() => recientes && (listaRecientes = recientes.lista())} />

<div class="ventana">
  <BarraSuperior
    bind:modo
    {zoom}
    puedeGuardar={editorActivo !== null}
    {puedeAbrir}
    onnuevo={() => accionArchivo("nuevo")}
    onabrir={() => accionArchivo("abrir")}
    recientes={listaRecientes}
    onabrirreciente={(ruta) => void operaciones.abrirReciente(ruta)}
    onmostrarrecientes={() => recientes && (listaRecientes = recientes.lista())}
    onguardar={() => accionArchivo("guardar")}
    onguardarcomo={() => accionArchivo("guardarComo")}
    onexportar={() => accionArchivo("exportar")}
    onacercar={() => lienzo.acercar()}
    onalejar={() => lienzo.alejar()}
    onencuadrar={() => lienzo.encuadrar()}
    puedeDeshacer={modo === "editar" && puedeDeshacer}
    puedeRehacer={modo === "editar" && puedeRehacer}
    ondeshacer={() => lienzo.deshacer()}
    onrehacer={() => lienzo.rehacer()}
    bind:escena
    bind:rendimiento
    bind:opciones
    bind:diagnostico
    onprobararrastre={probarArrastre}
    onprobarfase3b={probarFase3b}
    onmedircopia={medirCopia}
    oncopias={verCopias}
  />
  <main class="centro">
    <Paleta
      bind:abierta={paletaAbierta}
      activo={colocando}
      desactivada={escena !== "documento"}
      onelegir={(def, e) => lienzo.iniciarColocar(def, e)}
      {cableActivo}
      cableDesactivado={modo === "simular" || editorActivo === null}
      oncable={() => lienzo.alternarCable()}
    />
    <Lienzo
      bind:this={lienzo}
      bind:zoom
      bind:cursor
      bind:colocando
      bind:cableActivo
      bind:pista
      bind:puedeDeshacer
      bind:puedeRehacer
      bind:modificado
      bind:tituloDocumento
      bind:cuentaAvisos
      bind:activo={editorActivo}
      {modo}
      {escena}
      {rendimiento}
      {opciones}
      {diagnostico}
      onseleccion={alCambiarSeleccion}
      onaviso={avisar}
      oncambiodocumento={() => autoguardado?.alCambiar()}
    />
    <PanelPropiedades
      bind:this={panel}
      bind:abierto={propiedadesAbierto}
      {seleccion}
      editor={editorActivo}
      soloLectura={modo === "simular"}
      onalternar={(abierto) => (propiedadesPlegadoPorUsuario = !abierto)}
    />
  </main>
  <BarraEstado {modo} {zoom} {cursor} {aviso} {pista} {cuentaAvisos} />
</div>

{#if prueba}
  <DialogoDiagnostico titulo={prueba.titulo} corriendo={prueba.corriendo} texto={prueba.texto} oncerrar={() => (prueba = null)} />
{/if}

{#if recuperables.length > 0}
  <DialogoRecuperar
    copias={filasRecuperar}
    rota={copiaRota
      ? {
          fila: filaRecuperar(copiaRota.ofrecida.registro),
          lineas: copiaRota.lineas,
          puedeExportar: copiaRota.texto !== null,
        }
      : null}
    ocupado={recuperando}
    onrecuperar={recuperarCopia}
    ondescartar={descartarCopia}
    onexportar={exportarCopia}
    oncerrar={cerrarRecuperar}
  />
{/if}

{#if dialogoArchivo}
  <DialogoArchivo titulo={dialogoArchivo.titulo} problemas={dialogoArchivo.problemas} oncerrar={() => (dialogoArchivo = null)} />
{/if}

{#if sinGuardar}
  <DialogoSinGuardar nombre={sinGuardar.nombre} onresponder={responderSinGuardar} />
{/if}

{#if avisoProbar}
  <DialogoProbar nombre={avisoProbar.nombre} onresponder={responderProbar} />
{/if}

<style>
  .ventana {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
  }

  .centro {
    display: flex;
    min-height: 0;
  }
</style>
