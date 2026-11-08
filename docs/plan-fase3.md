# Plan fase 3 — Editor

Aprobado el 2026-11-07, con cambios: T15a (`.brn`), ids estables al rehacer, bornes enteros después de rotar y T14 partido en T14a/T14b.

Orden: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14a → T14b → T15a → T15.

## Contexto
La fase 2 quedó cerrada (0.1.2 medida en la netbook: casi 0 cuadros >16 ms). La fase 3 según `docs/arquitectura.md`:
paleta, colocar, mover, rotar, borrar, cables con codos, selección y deshacer/rehacer.
**Pasa cuando:** se puede dibujar a mano una marcha-parada completa.

Estado del código hoy:
- `src/core/model/documento.ts` no tiene componentes ni cables. Tampoco hay comandos.
- La capa estática (`src/render/capas.ts`) solo se puede invalidar entera: `invalidarEstatica()` → `mosaicos.vaciar()`. En el editor, cada cambio rehace toda la pantalla en 3–8 cuadros y se ve la grilla vacía mientras tanto. Por eso la invalidación parcial va primero.
- `Escena` (`src/render/escena.ts`) es inmutable: guarda las cajas en un `Float64Array` armado en el constructor.
- Hay 5 símbolos. Para la marcha-parada falta una fuente (L, N).

Regla para todas las tareas: una tarea por sesión, primero el plan y después el código. Al terminar: `npm test`, `npm run check`, commit y una línea en Bornera.md.
Desde T8 (2026-11-08), cada tarea con algo visible en la app suma su prueba `tests/humo/tNN-*.mjs` y al cerrar se corre `npm run humo` entero.

Nota: T15a adelanta a esta fase lo básico de la fase 4 (formato `.brn`). La fase 4 queda para el autoguardado, las migraciones y los circuitos de referencia.

---

## Bloque A — Base de rendimiento para editar

### T1. Invalidación parcial de mosaicos
- **Qué:** `Capas.invalidarRegion(caja: Caja)`, en unidades de grilla, y `Vista.invalidarRegion(caja)`, que también pide un cuadro.
  - Nivel actual: los mosaicos que tocan la caja (ampliada 1 px físico por antialiasing) se marcan `sucio`, pero no se borran. Se siguen mostrando hasta que se rehacen, así nunca aparece la grilla vacía.
  - En `rehacerMosaicos`, los sucios visibles tienen prioridad sobre todo lo demás. Los sucios del margen van con los pendientes del margen.
  - Niveles viejos (`mosaicos.viejos`): se descartan los que tocan la caja, porque tienen contenido desactualizado.
  - Si el zoom está en curso (`k !== mos.k`), los sucios del nivel actual se rehacen cuando el zoom se detiene, como ahora.
  - `invalidarEstatica()` sigue existiendo para tema, opciones y escena entera.
- **Archivos:** `src/render/mosaicos.ts` (campo `sucio`, `marcarSucios(i0,j0,i1,j1)`, `descartarViejosEn(caja)`), `src/render/capas.ts`, `src/render/vista.ts`.
- **Terminado cuando:** cambiar la caja de un símbolo rehace solo los mosaicos que lo tocan (1–4 al 100 %), en el mismo cuadro, sin mostrar mosaicos vacíos.
- **Prueba** (`capas.test.ts`, con los falsos de `falsos.ts`):
  - Una región dentro de un mosaico → se rehace 1 y los demás no se tocan (contar `drawImage`/órdenes por mosaico).
  - Una región en la esquina de 4 mosaicos → se rehacen 4.
  - Un mosaico sucio se sigue componiendo (no hay `pintarVacio` en ese cuadro).
  - Un mosaico viejo que toca la región se descarta; uno que no la toca se conserva.
  - Región fuera de pantalla y margen → no se rehace nada y no se pide cuadro.

### T2. Escena editable con índice espacial
- **Qué:** `EscenaEditable implements Contenido` (en `src/render/`), con `agregar`, `quitar` y `actualizar` por id. Cada operación devuelve la caja afectada (vieja ∪ nueva) para pasarla a `invalidarRegion`. El recorte usa un índice espacial en lugar del barrido lineal. `Escena` queda para el banco.
- **Índice espacial:** grilla de hash (celdas de 16 unidades), en `src/editor/indiceEspacial.ts` o en `src/render/` si la escena lo necesita. No importa nada del DOM, así sirve para dibujar y para elegir bajo el mouse. Consultas: `enCaja(caja)` y `enPunto(x, y)`.
- **Terminado cuando:** mover un símbolo en la escena de 2000 invalida solo su región, y el recorte da lo mismo que el barrido lineal.
- **Prueba:**
  - 2000 cajas al azar: `enCaja` y `enPunto` dan lo mismo que la búsqueda lineal.
  - `actualizar` mueve la caja y la consulta en la posición vieja ya no lo devuelve.
  - Banco: escenario nuevo "editar" (mover 1 símbolo 20 veces en 2000). Cuadro máximo <16 ms y como mucho 4 mosaicos por cambio. Los escenarios existentes no empeoran más de 10 %.
- **Hecho (2026-11-07):** el índice quedó en `src/render/indiceEspacial.ts` (la escena lo necesita y `render` no puede importar de `editor`). El banco usa `EscenaEditable` en todos los escenarios. Contra 0.1.2, por cuadro igual y 0 cuadros lentos. Por gesto, el ruido de la PC (±45 %) no deja confirmar el 10 %: queda para la netbook con F3.

---

## Bloque B — Modelo y comandos (`src/core/model`, sin DOM)

### T3. Componentes en el documento
- **Qué:** `Hoja.componentes: Componente[]` con `{ id, tipo, x, y, rot, espejado, etiqueta, params }`, tal como el `.brn` del plan (sin ñ ni tildes en las claves). `Hoja.cables` vacío por ahora. Más funciones de consulta: `buscarComponente` y `generarId`.
- **Terminado cuando:** el documento puede tener componentes y `crearDocumento` sigue andando.
- **Prueba:** `documento.test.ts`: crear, buscar e ids únicos. `check:core` pasa.
- **Hecho (2026-11-08):** se agrega `espejado`. `generarId` usa `Documento.contadores` (uno por prefijo, solo sube y se guarda en el `.brn`): un id borrado nunca se reutiliza. `Cable` queda solo con `id` hasta T12.

### T4. Comandos e historial
- **Qué:** la interfaz `Comando { aplicar(doc): Cambio; deshacer(doc): Cambio }`. `Cambio` lista los ids tocados, para que la vista sepa qué invalidar. `Historial` ilimitado con `ejecutar`, `deshacer`, `rehacer` y `agrupar` (varios comandos = un solo paso de deshacer). Ejecutar algo nuevo borra lo que había para rehacer.
  - Comandos: `Colocar`, `Mover` (varios ids, dx/dy enteros), `Rotar` (±90 sobre el centro del grupo, ajustado a la grilla), `Espejar`, `Borrar` y `CambiarEtiqueta`.
- **Terminado cuando:** todo cambio al documento pasa por un comando.
  - Rehacer `Colocar` o `Borrar` reutiliza el mismo id: el id se fija al construir el comando, no al aplicarlo. Así un comando posterior que nombre ese id (`Mover`, `Cablear`) sigue valiendo después de deshacer y rehacer.
- **Prueba:** por cada comando, aplicar y después deshacer deja el documento igual (`toEqual` contra una copia profunda), y rehacer reproduce el resultado. Agrupar deshace todo junto. Las coordenadas quedan siempre enteras.
  - Colocar → deshacer → rehacer: el componente tiene el mismo id. Lo mismo para Borrar → deshacer → rehacer.
  - Colocar, Mover, deshacer los dos, rehacer los dos: el Mover encuentra su componente.
  - Rotar (90, 180, 270, con y sin espejado, de a uno y en grupo con centro fraccionario): **todos los bornes** de los componentes rotados quedan en coordenadas enteras (posición + `transformarBornes`). Si el centro del grupo cae en media unidad, el centro se redondea antes de rotar, para que eso no pase.
- **Hecho (2026-11-08):** `src/core/model/comandos.ts` y `historial.ts`. Redondear el centro con `Math.round` corría el grupo (4 × +90 lo movía hasta 4 unidades); se rota sobre el centro exacto y, si ancho y alto tienen paridad distinta, se corre (+½, −½) con ancho impar y (−½, +½) con ancho par: girar y volver deja el grupo igual, también con negativos. `Espejar` es espejo horizontal en pantalla (`rot → 360 − rot`). Cada comando arma un `Map` id→componente por llamada. `Cambio` = `{ componentes }`; T12 suma `cables`.

### T5. Símbolo: fuente monofásica
- **Qué:** `FUENTE_MONOFASICA` con bornes L y N, comportamiento `fuente` y categoría `fuentes`, en `biblioteca.ts`. Es lo único que falta para la marcha-parada.
- **Terminado cuando:** aparece en `SIMBOLOS` y pasa `validar`.
- **Prueba:** test de bornes en `biblioteca.test.ts`, con el mismo patrón que los otros 5.
- **Hecho (2026-11-08):** tipo `fuente.monofasica`, 2×4, círculo con onda; L (0,−2) arriba y N (0,2) abajo.
- **Reemplazada (2026-11-08, después de T7):** como en CADe_SIMU, la fuente pasa a ser dos símbolos sueltos de un borne, en Fuentes. `FASE` (`fuente.fase`, "Fase (L)", 2×2): barra arriba y borne `L` en (0, 1) hacia abajo. `NEUTRO` (`fuente.neutro`, "Neutro (N)", 2×2): barra abajo y borne `N` en (0, −1) hacia arriba. La etiqueta es el nombre de la red (se coloca con "L" o "N" por `etiquetaInicial` y se edita: L1, L2, L3). No dibujan el nombre del borne (`mostrarNombresBornes: false`): se vería dos veces. Ver "Etiquetas de red" en [Para la fase 4](#para-la-fase-4).

---

## Bloque C — Editor sobre el lienzo

Las herramientas van en `src/editor/herramientas/`. Reciben eventos ya pasados a unidades de grilla (`{ x, y, botones, mayus, ctrl }`) y devuelven comandos o pedidos de redibujo. Así se prueban en Vitest sin DOM. `navegacion.ts` sigue solo con la cámara; el despachador de eventos de punteros de `Lienzo.svelte` reparte entre la navegación y la herramienta activa.

### T6. El lienzo dibuja el documento
- **Qué:** un `Editor` (en `src/editor/editor.ts`) que tiene el `Documento`, el `Historial` y la `EscenaEditable`, y traduce cada `Cambio` a `escena.actualizar` + `vista.invalidarRegion`. La app arranca con el documento vacío. Las escenas de prueba pasan a vivir solo en el menú de desarrollo y en Ctrl+Shift+B.
- **Terminado cuando:** un comando ejecutado desde la consola se ve en pantalla y deshacerlo lo saca, sin rehacer la pantalla entera.
- **Prueba:** test del `Editor` con una vista falsa: ejecutar `Colocar` llama a `invalidarRegion` con la caja del símbolo (no a `invalidarEstatica`), y deshacer invalida la misma caja.
- **Hecho (2026-11-08):** `src/editor/editor.ts`. Cada componente del `Cambio` invalida su propia caja: si se unieran, dos lejanos marcarían toda la pantalla. La escena nueva `"documento"` es la predeterminada, y Ctrl+Shift+B recorre 100 → 500 → 2000 → vacía → documento. El `Editor` vive lo que vive el `Lienzo`, así cambiar de escena no pierde el documento. En dev, `window.bornera = { editor, comandos }`. Un tipo de símbolo desconocido no se omite: se dibuja `SIMBOLO_DESCONOCIDO` (cuadrado con "?", sin bornes) con un aviso por tipo. La prueba en la netbook pasa a después de T9.

### T7. Paleta real y colocar
- **Qué:** `Paleta.svelte` sale de `SIMBOLOS`, agrupada por categoría. Al arrastrar desde la paleta o hacer clic y después clic en el lienzo, se ve una vista previa en la capa dinámica, ajustada a la grilla. Al soltar se ejecuta `Colocar`. Esc cancela.
- **Terminado cuando:** se pueden colocar los 6 símbolos con ajuste a la grilla.
- **Prueba:** test de la herramienta: una secuencia de eventos produce un `Colocar` en coordenadas enteras, y Esc no produce nada. Prueba manual en 1024×600.
- **Hecho (2026-11-08):** `src/editor/herramientas/colocar.ts` (pura) y `src/editor/punteros.ts` (DOM). El arrastre desde la paleta usa Pointer Events, no el drag & drop de HTML: en Tauri sobre Windows la ventana lo intercepta (`dragDropEnabled`). Apretar sin moverse más de 4 px es clic: la herramienta queda activa para colocar varios iguales; Esc, botón derecho o clic otra vez en el ítem la terminan. La previa (color `--acento`) pide un cuadro solo al cambiar de punto de grilla y nunca invalida mosaicos. El buscador filtra sin tildes ni mayúsculas; las categorías vacías no se muestran. Etiqueta vacía al colocar hasta el etiquetado automático. Prueba de humo con Edge headless a 1024×600 (CDP): 6 arrastres, clic-clic, Esc y soltar fuera.

### T8. Selección
- **Qué:** clic sobre un componente (con `enPunto` del índice), Mayús+clic para sumar y quitar, rectángulo arrastrando en vacío (con `enCaja`), y Esc o clic en vacío para deseleccionar. Resaltado en la capa dinámica. El panel de propiedades se abre al seleccionar.
- **Terminado cuando:** la selección funciona con 2000 símbolos sin cuadros lentos.
- **Prueba:** tests de la herramienta (clic, Mayús y rectángulo que toca o contiene). Con F3 en la escena de 2000, ningún cuadro >16 ms al seleccionar.
- **Hecho (2026-11-08):** `src/editor/herramientas/seleccionar.ts`, la herramienta por defecto (interfaz común `Herramienta`). La selección es estado de la interfaz (`Editor.seleccion`): no pasa por comandos ni se deshace; lo que se borra o se deshace sale de ella. Rectángulo de izquierda a derecha = contiene (cuerpo del símbolo entero adentro), de derecha a izquierda = toca (a rayas). El clic elige con la caja del símbolo o la de su etiqueta (no los huecos de los nombres de bornes), con 3 px de tolerancia; si hay varios encimados, el de arriba. Apretar sobre uno de un grupo mantiene el grupo hasta soltar sin mover (para T9). `EscenaEditable` guarda por lugar una `FormaEleccion` (cuerpo + zonas): `idEnPunto`/`idsEnCaja` no miran qué es cada elemento, así T12 suma los cables con sus tramos como zonas. El resaltado son rectángulos en la capa dinámica (`render/resaltado.ts`), solo los visibles, todos en un solo relleno (`Renderer.rectangulos`, marcos con par-impar: trazar 300 rectángulos costaba el doble). Seleccionar no invalida mosaicos. El panel se abre solo al seleccionar, salvo que el usuario lo haya plegado; muestra los datos (solo lectura) o la cantidad. Las escenas 100/500/2000 de Ctrl+Shift+B se abren en un `Editor` aparte (`documentoBanco`), así se selecciona con 2000 en la versión compilada. Banco: "Seleccionar al 31 %" y "Arrastre con todo seleccionado al 31 %", 0 cuadros lentos en la PC; con 2000 todo seleccionado, la mediana del arrastre pasa de 0,8 a 3,2 ms: mirar con F3 en la netbook.

### T9. Mover arrastrando
- **Qué:** arrastrar la selección. Al empezar, los seleccionados salen de la capa estática (una sola invalidación por región) y se dibujan en la dinámica. Al soltar se ejecuta un `Mover`: un paso de deshacer y otra invalidación. Esc durante el arrastre los devuelve a su lugar.
- **Terminado cuando:** arrastrar no rehace mosaicos en cada movimiento del mouse.
- **Prueba:** test: un arrastre con 30 movimientos da exactamente 1 comando y 2 invalidaciones. Banco o F3: el arrastre de 1 símbolo en 2000 no produce cuadros lentos.
- **Hecho (2026-11-08):** la herramienta Seleccionar arrastra la selección cuando se aprieta sobre un elemento seleccionado y se pasa el umbral (con Mayús no arrastra). dx/dy = `Math.round` del recorrido; pide cuadro solo al cambiar de punto de grilla. `EscenaEditable.ocultar/mostrar`: el oculto sigue en el índice (se elige y se resalta) pero la estática no lo dibuja, y cambiarlo o quitarlo no invalida nada. Al soltar, el `Mover` se ejecuta con los componentes todavía ocultos y recién después vuelven: 2 invalidaciones por componente (caja vieja al empezar, nueva al terminar). Volver al punto de partida o Esc: sin comando. **Cambio a T2/T6:** `actualizar` devuelve la caja vieja y la nueva por separado (una sola si una contiene a la otra), no su unión: deshacer un movimiento largo ya no marca la franja intermedia. Con más de 200 visibles arrastrados (`LIMITE_ARRASTRE_COMPLETO`) se dibujan solo los contornos de los cuerpos. El presupuesto de mosaicos descuenta lo que tarda la capa dinámica (sin eso, *Mover todo* con 100 daba un cuadro de 18 ms). **Cambio a la cámara:** al redimensionar queda fija la esquina superior izquierda, no el centro: abrir el panel de propiedades al seleccionar corría todo ~5 unidades bajo el mouse (desde T8) y el arrastre soltaba la pieza corrida. Banco: *Mover 1 al 31 %* y *Mover todo al 31 %*, 0 cuadros lentos (máx. 2,1 ms con 1 en 2000). Prueba de humo `t09-mover.mjs`.
- **Abierto (2026-11-08), medido en la netbook con v0.1.3-alpha.1:** con 213 seleccionados, alejado (10–25 %, contornos) anda bien (máx. 9–18 ms). Al 58–73 %, con unos 40 visibles completos: promedio 18–22 ms, picos 25–37 ms y hasta 50 cuadros lentos en 5 s. En la PC, el banco no muestra que los textos sean la causa principal: los 40 completos cuestan 1–1,5 ms por cuadro y el caché de textos ahorra 0–0,4 ms de eso. **v0.1.3-alpha.2, de diagnóstico:** menú de desarrollo también en prereleases, con interruptores para el arrastre (caché de textos en la dinámica, apagado por defecto; modo completos / sin textos / sin textos ni bornes / contornos / sin dibujar) y una prueba automática (los mismos 40, 5 s por combinación, al 58 % y al 73 %, con y sin sonda) que da una tabla copiable. La sonda (`InfoDinamico.medir`) mide por muestreo: los 3 primeros cuadros del arrastre y después 1 cada 15. F3 muestra "Capa dinámica". Todavía sin `ModoArrastre` ni límite por tiempo. **Aceptación en la netbook** (40 al 58–73 %): promedio < 16 ms, picos < 25 ms y menos de 10 cuadros lentos en 5 s.

### T10. Rotar, espejar, borrar y deshacer en la interfaz
- **Qué:** R rota, M espeja y Supr borra la selección. Ctrl+Z / Ctrl+Y y los botones de la barra superior, que se desactivan si no hay nada para deshacer o rehacer. Ninguno se dispara mientras se escribe en un campo (reusar `esCampoEditable` de `navegacion.ts`).
  - R y M también rotan/espejan la vista previa mientras se coloca.
- **Terminado cuando:** todo se puede deshacer y rehacer desde el teclado y los botones.
- **Prueba:** test del mapa de atajos a comandos y prueba manual.

### T11. Panel de propiedades
- **Qué:** con un componente seleccionado, se pueden editar la etiqueta (con `CambiarEtiqueta` al confirmar, no en cada tecla), la rotación y el espejado. Con varios seleccionados, se muestra cuántos son.
- **Terminado cuando:** cambiar la etiqueta se ve en el lienzo y se deshace en un paso.
- **Prueba:** test del `Editor`: cambiar la etiqueta invalida la caja vieja ∪ la nueva (puede ser más larga).

---

## Bloque D — Cables

### T12. Cables en el modelo y en la escena
- **Qué:** `Cable { id, puntos: [x, y][] ortogonales, desde, hasta }`. Los extremos pueden ir a un borne `{ comp, borne }` o a un punto de otro cable. Comandos `Cablear` y `BorrarCable`. La `EscenaEditable` dibuja los cables en la capa estática, con su caja en el índice. `Borrar` de un componente también borra o suelta sus cables.
- **Terminado cuando:** un cable creado por comando se ve y se deshace.
- **Prueba:** aplicar y deshacer = igual. Validar que los puntos son enteros y los tramos solo horizontales o verticales. Borrar un componente con 2 cables y deshacer recupera todo.

### T13. Herramienta cable (W)
- **Qué:** W activa la herramienta. Al pasar el mouse se resaltan los bornes libres. Un clic en un borne empieza el cable, el codo en ángulo recto es automático (sale en la dirección del borne) y cada clic en vacío fija un codo. Un clic en un borne o en un cable termina. Esc cancela el tramo actual. El cable en curso va en la capa dinámica.
- **Terminado cuando:** se puede cablear entre dos bornes con 0, 1 o 2 codos.
- **Prueba:** tests puros del ruteo (`codos(desde, dirección, hasta)`) para cada combinación de direcciones. Test de la secuencia de clics → `Cablear`.

### T14a. Extremos que siguen al borne
- **Qué:** `Mover`, `Rotar` y `Espejar` actualizan los extremos de los cables conectados a bornes de los componentes tocados y rehacen el tramo final para que siga ortogonal (sale en la dirección del borne transformado), dentro del mismo comando (un paso de deshacer). Si los dos extremos de un cable van a componentes que se mueven juntos, el cable entero se traslada sin rehacer codos.
- **Extremo sobre un cable que se mueve** (cable B que termina en un punto del cable A, una T):
  - El extremo de B se guarda como `{ cable: idA, x, y }`: el punto exacto, entero.
  - Después de cambiar A, si (x, y) sigue sobre A, B no cambia.
  - Si no, el extremo de B pasa al punto entero de A más cercano a (x, y), en general la proyección perpendicular sobre el tramo que se corrió. Después se rehace el tramo final de B, ortogonal.
  - Si eso cambia a B, se repite con los cables que terminan en B. Se recorre en anchura y cada cable se ajusta una sola vez por comando, así un ciclo no cuelga.
  - El extremo nunca queda suelto en silencio: siempre sigue conectado a A. Si A se borra, el extremo de B queda libre en su punto (`desde`/`hasta` sin conexión), y deshacer lo reconecta.
- **Terminado cuando:** mover o rotar un contactor cableado deja todos los cables conectados y ortogonales, incluidas las derivaciones en T.
- **Prueba:**
  - Mover y rotar un componente con cables: los extremos coinciden con los bornes transformados y todos los tramos son ortogonales. Deshacer = igual.
  - T: mover el componente de A de modo que se corra el tramo donde llega B → el extremo de B queda sobre A, ortogonal. Un movimiento que no toca ese tramo → B no cambia.
  - Cadena A ← B ← C y un ciclo: termina y cada cable se ajusta una vez.
  - Borrar A deja a B con el extremo libre; deshacer lo reconecta.

### T14b. Uniones
- **Qué:** las uniones (puntos donde se juntan 3 o más conexiones: extremos de cables, bornes y puntos de cable donde llega una T) se calculan solas a partir del documento. No se guardan en el `.brn`. Se dibujan como puntos rellenos en la capa estática; al cambiar un cable se invalida la caja de las uniones viejas y nuevas.
- **Terminado cuando:** las T muestran su punto y las L no.
- **Prueba:** una T da 1 unión, una L da 0 y una cruz de dos cables sin empalme da 0. Dos cables que terminan en el mismo borne dan 1.

---

## Bloque E — Cierre de la fase

### T15a. Guardar y abrir `.brn`
- **Qué:** se adelanta lo básico de la fase 4.
  - En `src/core/io/` (sin DOM): `serializar(doc) → string` y `deserializar(texto) → Documento`, con validación que informa qué falla (sin romper el programa).
  - En la interfaz, guardar (Ctrl+S) y abrir. La compresión gzip con `CompressionStream` vive fuera de `core`.
  - En Tauri, diálogo de archivo. Si hace falta un plugin (`@tauri-apps/plugin-dialog`/`fs`), **antes se pregunta** porque es una dependencia nueva. Si no, descarga/carga del navegador.
  - Autoguardado y migraciones quedan para la fase 4.
- **Terminado cuando:** un circuito con componentes y cables se guarda, se cierra, se abre y queda idéntico.
- **Prueba:**
  - Ida y vuelta: `deserializar(serializar(doc))` `toEqual` `doc`, para un documento vacío, uno con componentes rotados y espejados y uno con cables y T.
  - Lo mismo pasando por gzip (test en `src/ui` o `src/editor`).
  - Archivos dañados (JSON roto, `formato` ajeno, `version` futura, tipo de símbolo desconocido, cable hacia un id inexistente): cada uno da un error con mensaje y no tira excepción.
  - Las claves de la salida, sin ñ ni tildes.

### T15. Aceptación: marcha-parada
- **Qué:**
  - Test automático en `src/core`: armar la marcha-parada solo con comandos (Fase "L" arriba, S0 NC, S1 NA, K1 13-14 en paralelo con S1, bobina K1, lámpara H1 en paralelo con la bobina, Neutro "N" abajo) y verificar la conectividad esperada por bornes, por cables.
  - La bobina y la lámpara pueden ir a dos Neutro "N" distintos sin cable entre ellos: el test anota qué redes se unirían por nombre (base para la fase 4), sin simular. Ese mismo documento queda como base para `tests/circuitos/` en la fase 4.
  - El test también la guarda y la abre (T15a) y compara.
  - Prueba manual: dibujarla a mano en la netbook, guardarla, cerrar la app y volver a abrirla.
  - `npm run bench` y medición F3.
- **Terminado cuando:** el test pasa, se dibuja a mano sin trabas en 1024×600 y el banco no empeora más de 10 % respecto de 0.1.2.
- **Cierre:** versión 0.1.3, nota "Medición 0.1.3 - netbook.md" y fase 3 tildada en Bornera.md.

### Fuera del criterio de pasaje (se pueden diferir)
Están en la sección "Editor" del plan, pero el criterio de la fase no los pide:
- copiar, cortar, pegar y duplicar (Ctrl+D);
- etiquetado automático (K2, S3…);
- referencias cruzadas bajo cada bobina;
- validaciones en vivo (bornes y cables sueltos en naranja).

Propuesta: hacerlos después de T15, como T16–T19, antes de abrir la fase 4.

---

## Para la fase 4

### Etiquetas de red
- Las alimentaciones con el **mismo nombre de red** quedan conectadas entre sí aunque no haya cable, como etiquetas de red. El nombre se compara **sin espacios a los lados y en mayúsculas**: "l1 " y "L1" son la misma red.
- En `Fase` y `Neutro`, el nombre de red de su único borne es la **etiqueta del componente**.
- En la simulación: se unen en el paso 1 (netlist, union-find). El nombre es también el potencial del paso 3: L, L1, L2, L3 son fases y N es neutro. El paso 4 marca cortocircuito si una red recibe dos fases distintas, o fase y neutro (por ejemplo, una Fase con etiqueta "N").
- **Validación:** avisar si un documento mezcla "L" con "L1", "L2" o "L3" (casi siempre es un error: la fase monofásica no está unida a ninguna de las trifásicas). Es un aviso, no un error.

### Fuentes trifásicas (cuando se agreguen los símbolos de potencia)
- Tres variantes: L1-L2-L3, L1-L2-L3-N y L1-L2-L3-N-PE. **Cada borne se une a la red con su mismo nombre** (el borne L2 a la red "L2", el PE a la red "PE").
- Por eso la regla de etiquetas de red es **por borne**, no solo por componente: cada borne de alimentación tiene un nombre de red. En `Fase`/`Neutro` sale de la etiqueta del componente; en la trifásica, del nombre del borne. La netlist une todos los bornes con el mismo nombre de red (normalizado igual).

---

## Verificación general
- En cada tarea: `npm test` (incluye la regla de imports de `src/core`) y `npm run check`.
- Desde T2: `npm run bench` con el escenario "editar".
- En T8, T9 y T15: F3 en la netbook con la escena de 2000.
- Documentación: la decisión de invalidación por región (T1) va en "Decisión - Invalidación por región.md" y se enlaza desde "Decisión - Capa estática en mosaicos".
