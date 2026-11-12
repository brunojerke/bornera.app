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
  import { tick, untrack } from "svelte";
  import DialogoDiagnostico from "./DialogoDiagnostico.svelte";
  import DialogoArchivo from "./DialogoArchivo.svelte";
  import DialogoSinGuardar from "./DialogoSinGuardar.svelte";
  import type { ProblemaArchivo } from "../core/io";
  import {
    atajoArchivo,
    atajoArchivoActua,
    esTeclaRecarga,
    OperacionesArchivo,
    tituloVentana,
    type AccionArchivo,
    type RespuestaSinGuardar,
  } from "./archivo";
  import { archivosNavegador } from "./archivos";
  import { ES_PRERELEASE } from "./version";

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

  // ── Archivo (T15a) ───────────────────────────────────────────────────────
  // En esta etapa, siempre con los archivos del navegador (descargas y
  // <input type="file">); el escritorio llega en la etapa 4.
  const operaciones = new OperacionesArchivo({
    archivos: archivosNavegador,
    // Lo que se ve: el documento o una escena del banco (D17). Las escenas
    // sin editor ("símbolos" y "vacía") no se guardan.
    mostrado: () => (editorActivo ? { editor: editorActivo, esDocumento: escena === "documento" } : null),
    // Abrir y Nuevo: solo en Editar y viendo el documento (D17).
    reemplazable: () => (puedeAbrir ? editorActivo : null),
    reemplazar: (documento) => lienzo.reemplazarDocumento(new Editor(documento)),
    preguntarSinGuardar: (nombre) =>
      new Promise((responder) => {
        sinGuardar?.responder("cancelar");
        sinGuardar = { nombre, responder };
      }),
    confirmarPanel: () => panel?.confirmar(),
    mostrarProblemas: (titulo, problemas) => (dialogoArchivo = { titulo, problemas }),
    avisar,
    ahora: () => performance.now(),
    medir: import.meta.env.DEV || ES_PRERELEASE,
  });
  operaciones.alCambiar = () => (archivoActual = operaciones.archivoActual?.nombre ?? null);

  function accionArchivo(a: AccionArchivo) {
    if (a === "guardar") void operaciones.guardar();
    else if (a === "guardarComo") void operaciones.guardar(true);
    else if (a === "abrir") void operaciones.abrir();
    else void operaciones.nuevo();
  }

  // Título de la ventana (D18-B): nombre y marca de cambios. En el escritorio
  // irá por setTitle (etapa 4).
  $effect(() => {
    document.title = tituloVentana({ archivo: archivoActual, titulo: tituloDocumento, modificado });
  });

  // Lo que muestra el lienzo (el documento, salvo que se elija una escena de
  // prueba), contador de rendimiento y optimizaciones.
  let escena = $state<EscenaDesarrollo>("documento");
  /** Abrir y Nuevo andan: en Editar y viendo el documento (D17: no en Simular ni en el banco). */
  const puedeAbrir = $derived(modo === "editar" && escena === "documento");
  let rendimiento = $state(false);
  let opciones = $state<OpcionesCapas>({ ...OPCIONES_OPTIMIZADAS });
  let diagnostico = $state<DiagnosticoArrastre>({ modo: "auto", sonda: false });

  /** Prueba automática del arrastre: estado del diálogo (null: cerrado). */
  let prueba = $state<{ corriendo: boolean; texto: string } | null>(null);

  async function probarArrastre() {
    if (prueba?.corriendo) return;
    prueba = { corriendo: true, texto: "Abriendo la escena de 2000 con cables…" };
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
      prueba = { corriendo: false, texto: tabla };
    } catch (e) {
      prueba = { corriendo: false, texto: `La prueba falló: ${e instanceof Error ? e.message : String(e)}` };
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
   * `onCloseRequested` (etapa 4); esto cubre la recarga.
   */
  function alSalir(e: BeforeUnloadEvent) {
    if (!modificado) return;
    e.preventDefault();
    // Los motores que no miran preventDefault (WebKit viejo) miran esto.
    e.returnValue = "";
  }
</script>

<svelte:window onkeydown={alTecla} onbeforeunload={alSalir} />

<div class="ventana">
  <BarraSuperior
    bind:modo
    {zoom}
    puedeGuardar={editorActivo !== null}
    {puedeAbrir}
    onnuevo={() => accionArchivo("nuevo")}
    onabrir={() => accionArchivo("abrir")}
    onguardar={() => accionArchivo("guardar")}
    onguardarcomo={() => accionArchivo("guardarComo")}
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
      bind:activo={editorActivo}
      {modo}
      {escena}
      {rendimiento}
      {opciones}
      {diagnostico}
      onseleccion={alCambiarSeleccion}
      onaviso={avisar}
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
  <BarraEstado {modo} {zoom} {cursor} {aviso} {pista} />
</div>

{#if prueba}
  <DialogoDiagnostico corriendo={prueba.corriendo} texto={prueba.texto} oncerrar={() => (prueba = null)} />
{/if}

{#if dialogoArchivo}
  <DialogoArchivo titulo={dialogoArchivo.titulo} problemas={dialogoArchivo.problemas} oncerrar={() => (dialogoArchivo = null)} />
{/if}

{#if sinGuardar}
  <DialogoSinGuardar nombre={sinGuardar.nombre} onresponder={responderSinGuardar} />
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
