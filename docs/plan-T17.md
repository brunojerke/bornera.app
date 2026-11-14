# Plan T17 — Etiquetado automático

**Aprobado el 2026-11-14** con las decisiones de la tabla de abajo. Segunda tarea de la fase 3b (`docs/plan-fase3b.md`).

**Estado de git al planear (verificado):** `main` en `d969019` (cierre de T16), árbol limpio, 5 commits por delante de `origin/main`, sin push. El tag `v0.1.3` está en local.

## Decisiones (Bruno, 2026-11-14)

| D | Elegida | Qué |
|---|---|---|
| D-cuándo | **A + C** | Se numera al colocar. Además, un comando "Etiquetar los vacíos", que rellena solo los componentes sin etiqueta; los contactos seguidores y las fuentes quedan fuera del comando. Abrir un archivo nunca renumera. Sin "Renumerar hoja". |
| D-prefijos | **A, letras clásicas** | Campo `prefijoEtiqueta` en `DefinicionSimbolo`. K (bobina), S (pulsadores), H (lámpara); F, M y Q cuando lleguen esos símbolos. Alternativa no elegida: IEC 81346-2 estricta (contactor de potencia en Q, lámpara en P). |
| D-número | **A** | El menor libre desde 1. Rellena huecos. S0 solo se pone a mano. |
| D-contactos | **A** | Un contacto auxiliar nuevo queda vacío. Lo marca T19. |
| D-duplicar y pegar | **C** | Solo se renumera lo que choca con la hoja, por grupo (regla completa en la sección 2). |
| D-borrar | **A** | Quedan huecos. Borrar no renumera nada. |
| D-manuales | **B + b** | Lo escrito a mano se respeta siempre. Si repite la etiqueta de otro, una nota de texto en el panel, sin naranja. Renombrar una bobina arrastra a sus contactos, con las condiciones de la sección 2. |
| D-deshacer | **confirmada** | Colocar y pegar llevan la etiqueta dentro de su comando: un paso. "Etiquetar los vacíos" y el renombrado con arrastre son un paso cada uno. Rehacer repite lo guardado. |
| D-Fuentes | **confirmada** | Todo `elemento: "fuente"` queda fuera de colocar, pegar y "Etiquetar los vacíos". |
| D-previa | **como se propuso** | La previa de Colocar muestra la etiqueta que va a recibir. La de pegar muestra las originales y resuelve al hacer clic. |

**Otras definiciones de Bruno:**
- La numeración va en el armado del comando (`src/editor/armarEtiquetas.ts`), no dentro de `colocar()` del núcleo. `marchaParada()` y `tests/circuitos/marcha-parada.brn` no cambian.
- Las etiquetas usadas quedan en memoria y se invalidan con cada comando, no con cada `pointermove`.
- `CambiarEtiqueta` del núcleo no cambia.
- El contacto auxiliar NC y los cambios a `compararRedes` van en una tarea corta aparte, **T17b**, después de T17 y antes de T18 (`docs/plan-fase3b.md`).

**Ajustes al empezar la etapa 1 (Bruno, 2026-11-14):**
- El archivo del editor se llama `src/editor/armarEtiquetas.ts` (su test, `armarEtiquetas.test.ts`), no `etiquetado.ts`, para no repetir el nombre de `src/core/model/etiquetado.ts`.
- **D1.** `esFuente` y `esSeguidor` van en `src/core/symbols/tipos.ts`: `validarDefinicion` los usa sin que `symbols` importe de `model`. Seguidor: definición con accionamiento que no es a mano, sin nombrar el térmico (los pulsadores siguen numerándose con S).
- **D2.** Un símbolo desconocido (un tipo que no está en la biblioteca) es un titular sin prefijo: su etiqueta queda reservada. No se duplica, no se renumera y no se rellena.
- **D3.** La regla 6 de pegar cambia: la primera bobina en (y, x) encabeza el grupo (sección 2).
- **D4.** Al pegar, solo la bobina arrastra a sus contactos.
- `CambiarEtiquetas` valida y normaliza cada etiqueta con las reglas de `etiquetas.ts` (trim y mayúsculas; una fuente no puede quedar vacía). Un id cuya etiqueta no cambia no entra al mapa.
- Test al azar: el invariante deja fuera las etiquetas vacías. El ayudante que simula el armado del editor es provisorio: en la etapa 2 el mismo test pasa por `armarEtiquetas.ts` (y se muda fuera de `src/core`, que no puede importar el editor).

## 1. Estado verificado (2026-11-14, sobre `d969019`)

- **Dónde vive la etiqueta:** `Componente.etiqueta`, un texto (`src/core/model/documento.ts:27`). No hay marca de "manual" o "automática". El documento acepta cualquier texto y `deserializar` no la mira: un `.brn` con etiquetas repetidas o vacías abre tal cual.
- **Reglas actuales** (`src/core/model/etiquetas.ts`): se valida solo al editar, no se exige unicidad, y se normaliza con `trim` y mayúsculas (`normalizarEtiqueta`).
- **Cambiar etiqueta:** `CambiarEtiqueta(id, etiqueta)` (`src/core/model/comandos.ts:673`), de a un componente, vía `Editor.cambiarEtiqueta` (`src/editor/editor.ts:625`). Con varios seleccionados el panel muestra la etiqueta y no la edita. El borrador del panel es `src/ui/edicionEtiqueta.ts`.
- **Colocar:** `HerramientaColocar.comando()` (`src/editor/herramientas/colocar.ts:197`) usa `def.etiquetaInicial ?? ""`. Solo Fase ("L") y Neutro ("N") la tienen; todo lo demás entra vacío. La previa dibuja `etiquetaInicial` (`editor.ts:1504`).
- **Pegar y duplicar** (T16, D3-A): `trasladar` copia la etiqueta (`src/core/model/portapapeles.ts:174`). `pegar()` da las ids al construir y el comando `Pegar` guarda el lote armado, así que rehacer repite lo mismo. Ctrl+V y Ctrl+D pasan por `Editor.crearPegado` (`editor.ts:872`), que se llama al hacer clic (o al duplicar) con el documento de ese momento. Duplicar la rama de K1 deja hoy dos bobinas K1.
- **Biblioteca** (`src/core/symbols/biblioteca.ts`): 7 símbolos (Fase, Neutro, pulsador NA y NC, bobina, auxiliar NA, lámpara). No hay tabla de prefijos, ni protecciones, motores o selector.
- **Vínculo contacto-bobina:** hoy es solo `accionamiento: "bobina"` en la definición (`src/core/symbols/tipos.ts:74`) y el texto de `docs/arquitectura.md` ("Los contactos se vinculan a su bobina por etiqueta"). No existe `src/core/sim`: T17 es el primer código que usa ese vínculo.
- **Fuentes:** `nombreDeFuente` (`src/core/model/redes.ts:63`) da el nombre de red desde la etiqueta normalizada. En Fase y Neutro la etiqueta no puede quedar vacía (`validarEtiqueta`).
- **`compararRedes`** (`src/core/circuitos/compararRedes.ts`): agrupa por etiqueta normalizada y tipo. Dos iguales que no sean fuente salen como repetido (l. 77), y nombra cada borne "etiqueta·borne".
- **Marcha-parada:** `marchaParada()` (`src/core/circuitos/marchaParada.ts`) usa `colocar` y `CambiarEtiqueta` del núcleo, con S0, S1, K1 (auxiliar), K1 (bobina) y H1. `tests/circuitos/marcha-parada.brn` está empaquetado (se lee con `desempaquetar`).
- **Comandos:** `Grupo` aplica los suyos de a uno; `CambiarEtiqueta` busca el componente en todo el documento en cada `aplicar`. Un `Grupo` de 2000 sería cuadrático, como pasó con `Cablear` en T16.
- **Criterio de la fase 3b:** ya está en `docs/plan-fase3b.md` (inversión de giro duplicando la rama de K1).

### Supuestos (a verificar)
- **S1.** K, S, H, F, M, Q es la designación clásica (IEC 60750 / DIN 40719) y la que ya usa el programa. IEC 81346-2 estricta pondría el contactor de potencia en Q y la lámpara en P. No se verificó contra la norma.
- **S2.** Juntar las etiquetas usadas es una pasada por los componentes de la hoja y cuesta menos de 1 ms con 2000.
- **S3.** `HerramientaColocar` puede pedirle la etiqueta al editor al armar el comando sin cambiar su forma de trabajo (hoy recibe `revisar` de la misma manera).

## 2. Diseño

### Palabras
- **Fuente:** `elemento: "fuente"`. Su etiqueta es el nombre de la red. T17 no la toca nunca.
- **Seguidor:** contacto con accionamiento que no es a mano (`esSeguidor`, D1). Su etiqueta dice a quién sigue. Hoy, solo el auxiliar NA; cuando llegue, también el contacto del térmico.
- **Titular:** todo lo demás (bobina, pulsadores, lámpara). Es lo que se numera. Un símbolo desconocido es titular sin prefijo (D2).
- **Choca:** una etiqueta choca si, normalizada y no vacía, es la de un titular que ya está en la hoja. Los seguidores y las fuentes nunca cuentan como choque.

### Catálogo: `prefijoEtiqueta`
- Campo opcional en `DefinicionSimbolo` (`src/core/symbols/tipos.ts`): "K" en la bobina, "S" en los dos pulsadores, "H" en la lámpara.
- Las fuentes y los seguidores no lo llevan. Un titular sin prefijo se coloca vacío.
- `validarDefinicion` y un test exigen que cada símbolo sea fuente, seguidor o tenga prefijo (solo letras mayúsculas).

### Núcleo: `src/core/model/etiquetado.ts` (reglas puras, sin DOM)
- `esTitular(def)` y `prefijoDe(def)`. `esFuente` y `esSeguidor` están en `src/core/symbols/tipos.ts` (D1).
- `etiquetasDeTitulares(hoja)`: el conjunto de etiquetas normalizadas no vacías de los titulares.
- `menorLibre(usadas, prefijo)`: `prefijo + n` con el menor n ≥ 1 que no esté en `usadas`. "K01" ocupa el 1: se comparan los números, no los textos.
- `etiquetarLote(usadas, lote)`: las etiquetas nuevas de un lote que se pega, con la regla de abajo. Devuelve id → etiqueta solo para lo que cambia.
- `conEtiquetas(recorte, cambios)`: el recorte con esas etiquetas; es lo que el editor le pasa a `pegar()`.
- `etiquetarVacios(hoja)`: id → etiqueta para los titulares vacíos, en orden (y, x).
- `planRenombrarBobina(hoja, id, nueva)`: `{ cambios, arrastre, motivo }`. `cambios` es id → etiqueta de lo que cambia (la bobina y, si corresponde, sus contactos). `motivo` dice por qué no hubo arrastre cuando había contactos con la etiqueta vieja (`otra_bobina_vieja` u `otra_bobina_nueva`); si no, es null.
- Los números salen de un contador por prefijo que solo avanza: con 2000 que chocan no se recorre la lista 2000 veces.
- Comando nuevo `CambiarEtiquetas` en `comandos.ts`: cambia varias etiquetas con una sola pasada por la hoja y guarda las anteriores. Un paso de deshacer. Valida y normaliza cada etiqueta con `etiquetas.ts`. `CambiarEtiqueta` queda como está.

### Regla al pegar y duplicar (D-duplicar C)
1. `usadas` arranca con las etiquetas de los titulares de la hoja, como está al hacer clic.
2. Los titulares del lote que **no** chocan conservan su etiqueta, y esa etiqueta se suma a `usadas` (nadie del lote la puede recibir).
3. Los titulares del lote que chocan se recorren en orden estable, por posición (y, x) y, a igualdad, en el orden del recorte. Cada uno recibe el menor libre de su prefijo y lo suma a `usadas`. Si su símbolo no tiene prefijo, conserva.
4. Si el que choca es una bobina, los contactos seguidores **del lote** con su misma etiqueta toman la nueva junto con ella. Solo la bobina arrastra (D4).
5. Los contactos del lote sin su bobina en el lote conservan la etiqueta: son otro contacto del mismo contactor.
6. Si el lote trae varias bobinas con la misma etiqueta, la primera en orden (y, x) encabeza el grupo. Si choca con la hoja, toma el número nuevo y los contactos del lote con esa etiqueta la siguen; las demás bobinas reciben cada una su número, sin contactos. Si no choca, todo conserva (D3, cambiada el 2026-11-14).
7. Los titulares vacíos del lote quedan vacíos: no chocan. Los rellena "Etiquetar los vacíos".
8. Las fuentes conservan siempre.

Ejemplos: duplicar la rama de K1 (S1, K1 auxiliar, K1 bobina, H1) da S2, K2, K2 y H2. Un lote con las bobinas K1 y K3 sobre una hoja que ya las tiene da K2 y K4, si están libres. Cortar y pegar conserva todo, porque al pegar ya no hay nada con esos nombres.

Se calcula al hacer clic, con el documento de ese momento, igual que las ids (E1-A de T16). El comando `Pegar` guarda el lote ya etiquetado: rehacer repite las mismas etiquetas.

### Editor: `src/editor/armarEtiquetas.ts` (armado de los comandos)
- Guarda en memoria las etiquetas de los titulares de la hoja. Se invalida con cada comando (ejecutar, deshacer, rehacer) y al cambiar de documento, nunca con `pointermove`. Se vuelve a calcular recién cuando alguien las pide.
- **Colocar:** `HerramientaColocar` recibe del editor la etiqueta al armar el comando. Para un titular con prefijo es el menor libre; para una fuente, su `etiquetaInicial`; para un seguidor o un titular sin prefijo, vacío. La etiqueta va dentro del `Colocar`: un paso. `colocar()` del núcleo no cambia.
- **Previa de Colocar:** muestra la etiqueta que va a recibir. En modo clic se actualiza después de cada colocación y de cada deshacer, junto con `revisarDeNuevo`.
- **Pegar y duplicar:** `crearPegado` aplica `etiquetarLote` al lote antes de armar el `Pegar`. La previa de pegar sigue mostrando las etiquetas originales.
- **Etiquetar los vacíos:** acción del editor que arma un `CambiarEtiquetas`. Si no hay ninguno, avisa y no hace paso. El lugar en la interfaz (botón, menú o atajo) se define en la etapa 2.
- **Renombrar con arrastre (D-manuales b):** `Editor.cambiarEtiqueta` pasa a armar el comando con `planRenombrarBobina`. Si el componente es una bobina, sus contactos seguidores con la etiqueta vieja pasan a la nueva solo si se cumplen las tres:
  - la etiqueta vieja no está vacía;
  - hay una sola bobina con la etiqueta vieja;
  - ninguna otra bobina tiene ya la nueva.

  Si alguna no se cumple, cambia solo la bobina y el panel muestra la nota. En los dos casos es un único paso de deshacer (un `CambiarEtiquetas`).

### Panel (D-manuales B)
- Nota de texto bajo el campo, sin naranja, cuando la etiqueta del titular seleccionado es la de otro titular de la hoja ("Ya hay otra bobina K1").
- Nota cuando un renombrado de bobina no arrastró a los contactos, con el motivo.
- No bloquea nada. Los textos se revisan con Bruno en la etapa 2.

### Reparto con T19
- **T17:** nunca crea un choque por su cuenta (colocar, pegar, duplicar y etiquetar los vacíos) y pone la nota del panel.
- **T19:** marca en el lienzo dos bobinas con la misma etiqueta, los contactos sin bobina y los componentes sin etiqueta.

## 3. Tests (Vitest)

### Núcleo: `src/core/model/etiquetado.test.ts` y `biblioteca.test.ts`
- Cada símbolo es fuente, seguidor o tiene prefijo.
- `menorLibre`: vacío da 1; rellena huecos (borro K2, el próximo es K2); "K01" ocupa el 1; "k1 " normalizada ocupa el 1; S0 no cambia nada; otra letra no cuenta.
- Con contactos "K2" sin bobina y K1 ocupada, la próxima bobina colocada es K2 (Bruno, etapa 1).
- `etiquetarLote`:
  - la rama de K1 duplicada da S2, K2 (auxiliar), K2 (bobina) y H2;
  - dos bobinas que chocan, K1 y K3, dan K2 y K4 si están libres;
  - un contacto sin su bobina en el lote conserva;
  - un titular que no choca conserva y reserva su número;
  - dos bobinas K1 con contactos K1, pegadas en una hoja con K1: ningún contacto pegado queda en K1 (la primera bobina en (y, x) se los lleva y la otra recibe su número); sin K1 en la hoja, todo conserva (D3);
  - un símbolo desconocido conserva y reserva su etiqueta (D2);
  - los vacíos quedan vacíos;
  - Fase y Neutro intactas;
  - el orden (y, x) decide el reparto, no el orden del recorte.
- `etiquetarVacios`: solo titulares vacíos, en orden (y, x); ni seguidores ni fuentes.
- `planRenombrarBobina`:
  - arrastra a los contactos cuando se cumplen las tres condiciones;
  - renombrar una bobina vacía no arrastra a los contactos vacíos;
  - renombrar a una etiqueta que ya tiene otra bobina no arrastra;
  - con dos bobinas de la etiqueta vieja no arrastra.
- `CambiarEtiquetas`: aplicar, deshacer y rehacer exactos; un id que no existe tira y no cambia nada; valida y normaliza.
- `CambiarEtiquetas` sobre 2000 componentes en un solo paso, con deshacer y rehacer exactos, y no es un `Grupo` (Bruno, etapa 1).
- **Al azar con semilla fija:** secuencias de colocar, borrar, pegar, duplicar, deshacer y rehacer. Después de cada paso: nunca dos titulares con la misma etiqueta no vacía (ninguna se escribe a mano en la secuencia), Fase y Neutro intactas, `validarHoja` en 0, y deshacer todo más rehacer todo da el mismo documento. El ayudante que arma los comandos como el editor es provisorio hasta la etapa 2.
- **`compararRedes` con contactos vacíos:** un test que fija lo que informa hoy con un auxiliar sin etiqueta. Lo que haya que cambiar va en T17b.
- `marchaParada()` da el mismo documento que antes y `tests/circuitos/marcha-parada.test.ts` pasa sin tocar el `.brn`.

### Editor: `src/editor/armarEtiquetas.test.ts` y los que ya existen
- El test al azar del núcleo, pasando por `armarEtiquetas.ts` en lugar del ayudante provisorio.
- Colocar: la segunda bobina es K2 y el tercer pulsador S3 (NA y NC comparten la S); colocar, borrar y volver a colocar rellena el hueco; el auxiliar entra vacío; la Fase entra "L".
- Colocar es un solo paso; deshacer y rehacer dan la misma etiqueta.
- La previa de Colocar lleva la etiqueta que después tiene el componente.
- Las etiquetas en memoria no se recalculan al mover el mouse, y sí después de un comando.
- Ctrl+D de la rama de K1: S2, K2, K2 y H2 en un paso; repetido, S3, K3, K3 y H3.
- Cortar y pegar conserva las etiquetas. Pegar en un documento nuevo conserva.
- Etiquetar los vacíos: un paso; sin vacíos, aviso y ningún paso.
- Renombrar una bobina desde el panel: con arrastre y sin arrastre, un paso en los dos casos.
- La nota del panel (`src/ui/propiedades.test.ts`).
- Los tests de T16 que esperaban la etiqueta conservada al duplicar se ajustan a D-duplicar C.

## 4. Humo, banco y netbook (criterio fijado antes de medir)

### Humo: `tests/humo/t17-etiquetado.mjs` a 1024×600
- Colocar dos bobinas y tres pulsadores: K1, K2, S1, S2 y S3. La previa muestra la etiqueta.
- Borrar K1 y colocar otra bobina: K1.
- Un auxiliar nuevo queda vacío. Fase y Neutro entran "L" y "N".
- Armar la rama de K1 y Ctrl+D: S2, K2, K2 y H2. Ctrl+Z y Ctrl+Y exactos.
- Ctrl+X y pegar en otro lado: las mismas etiquetas.
- Renombrar la bobina K2 a K5 en el panel: su contacto pasa a K5 y un Ctrl+Z vuelve los dos.
- Escribir a mano una etiqueta que ya existe: se acepta y aparece la nota.
- Etiquetar los vacíos.
- `validarHoja` en 0 al final.
- Al cerrar la tarea, `npm run humo` entero.

### Banco (PC enchufada, modo Mejor rendimiento, apps cerradas)
Numerar recorre la hoja, así que se mide. Escena con cables (2000 componentes + 3000 cables), al 31 %:

| Escenario | Pasa si |
|---|---|
| *Pegar 500 y deshacer* | mediana del paso ≤ 4,8 ms: los 3,8 ms de T16 más max(10 %, 1 ms); 0 cuadros lentos |
| *Duplicar todo (2000) y deshacer* | paso con mediana ≤ 150 ms y máximo ≤ 300 ms, y además mediana ≤ 46,8 ms (10 % sobre los 42,5 ms de T16), repetido en dos tandas; 0 lentos |
| *Etiquetar los vacíos (2000) y deshacer* (nuevo) | cada paso con mediana ≤ 40 ms y máximo ≤ 80 ms; 0 lentos |

**Sin regresión** en los escenarios que ya existen, contra `v0.1.3`: `git fetch --tags`, worktree en `v0.1.3`, ABBA ×3 y dos tandas (regla de `docs/plan-T16.md`, sección 4). No pasa si sube más de 10 % y se repite en la tanda 2, o si aparece un cuadro lento donde `v0.1.3` tiene 0. Las 2 celdas de 100 que ya quedaron como "no pasa por resolución del reloj" siguen igual.

Si algo no pasa, se frena y se presentan opciones antes de optimizar.

### Netbook
Solo si en la PC un paso pasa la mitad de su tope o aparece un cuadro lento. Si no, va en la medición de cierre de la fase 3b.

## 5. Etapas
Cada etapa es una sesión, cierra con `/bornera-cierre` y hace commit local. Sin push ni versión.

| Etapa | Qué | Modelo |
|---|---|---|
| 0 | Docs: este plan, `plan-fase3b.md` (T17 apunta acá, T17b anotada) y Obsidian. Commit solo de docs. **Hecha el 2026-11-14.** | la sesión del plan |
| 1 | Núcleo: `prefijoEtiqueta` en el catálogo, `src/core/model/etiquetado.ts`, `CambiarEtiquetas` y sus tests, con los de al azar. `npm test` y `npm run check`. **Hecha el 2026-11-14** (resultado abajo). | Opus xhigh |
| 2 | Editor y panel: `src/editor/armarEtiquetas.ts`, Colocar y su previa, pegar y duplicar, "Etiquetar los vacíos", renombrado con arrastre y las notas del panel. Tests del editor. Prueba a mano en `npm run dev`. | Opus alto |
| 3 | Humo t17 y banco: escenario nuevo, las tres mediciones y la regresión contra `v0.1.3`, `docs/bench.md`. | Opus alto |
| 4 | Cierre: este plan, `plan-fase3b.md`, `arquitectura.md`, Obsidian y `npm run humo` entero. | Sonnet |

### Etapa 1, resultado (2026-11-14)
- **Catálogo:** `prefijoEtiqueta` en `DefinicionSimbolo`: K en la bobina, S en los dos pulsadores y H en la lámpara. `esFuente` y `esSeguidor` en `src/core/symbols/tipos.ts`. `validarDefinicion` exige que cada símbolo sea fuente, seguidor o tenga prefijo, y que el prefijo sea solo letras mayúsculas.
- **`src/core/model/etiquetado.ts`:** `esTitular`, `prefijoDe`, `etiquetasDeTitulares`, `menorLibre`, `etiquetarLote` (reglas 1 a 8, con la regla 6 de D3), `conEtiquetas`, `etiquetarVacios` y `planRenombrarBobina`. Los números salen de un contador por prefijo que solo avanza.
- **`CambiarEtiquetas`** en `comandos.ts`: valida y normaliza al construir, una pasada por las hojas en `aplicar` y en `deshacer`, y una fuente no puede quedar vacía.
- **Tests:** `etiquetado.test.ts` (36), con los dos que pidió Bruno: contactos "K2" sin bobina, y 2000 componentes en un paso, que no es un `Grupo`. Más casos en `validar.test.ts`, `biblioteca.test.ts` y `compararRedes.test.ts` (auxiliar vacío: fija lo que informa hoy).
- **Al azar** (semilla 20261114, 400 operaciones, unos 90 ms): en esa corrida hubo 176 titulares renumerados al pegar, 42 contactos que siguieron a su bobina y 8 "Etiquetar los vacíos". Con la regla del choque anulada a propósito, falla en la operación 7.
- **Tests que ya existían y cambiaron:**
  - El `PULSADOR` de `validar.test.ts` lleva prefijo S.
  - La bobina de prueba de `transformar.test.ts` lleva prefijo K.
  - `editor.test.ts`: `SIMBOLO_DESCONOCIDO` queda sin prefijo a propósito (D2), así que su validación espera ahora dos reparos (sin prefijo y sin bornes) en lugar de uno.
- **Verificación:** `npm test` 1525 bien (1 salteado: `circuito`, sin `BORNERA_BRN`), `npm run check` sin errores, `npm run humo` 579 de 579. Sin banco: la etapa no toca el editor ni el dibujo. Se mide en la etapa 3.
- **Para la etapa 2:**
  - Renombrar una bobina a vacío arrastra a sus contactos a vacío, porque las tres condiciones no lo impiden. Revisarlo con Bruno junto con las notas del panel.
  - El test al azar se muda fuera de `src/core` y pasa por `armarEtiquetas.ts`.
  - `CambiarEtiqueta` (de a uno) sigue sin validar ni normalizar en el núcleo: lo hace el panel.

## 6. Riesgos
- **Contactos huérfanos que se enganchan solos.** Los seguidores no cuentan como choque: si hay contactos "K2" sin bobina y K1 está ocupada, la próxima bobina que se coloque es K2 y esos contactos pasan a seguirla. Puede ser lo buscado (se dibujaron primero los contactos) o no. T19 marca los contactos sin bobina.
- **El enclavamiento no se resuelve solo.** Un contacto de enclavamiento "K2" dentro de la rama de K1 que se duplica sigue siendo K2 en la copia, y tiene que ser K1. Se corrige a mano.
- **El menor libre reutiliza números.** Un K2 borrado, que ya salió impreso, se vuelve a dar. Es lo elegido (D-número A).
- **Lo pegado vacío sigue vacío.** Hace falta "Etiquetar los vacíos" o T19 para verlo.
- **Tests de T16 que cambian.** Los que esperan la etiqueta conservada al duplicar encima de la original pasan a esperar la nueva.
- **Dónde va "Etiquetar los vacíos"** a 1024×600: se define en la etapa 2.

## 7. Fuera de T17
- **T17b** (después de T17, antes de T18): el símbolo contacto auxiliar NC, que el enclavamiento del criterio de la fase necesita y hoy no existe, y `compararRedes` con varios NA de una misma bobina (hoy salen como repetidos) y con contactos vacíos.
- **T19:** el naranja en el lienzo para etiquetas repetidas, contactos sin bobina y vacíos, y el pendiente del naranja de la previa de pegar.
- "Renumerar hoja" completo: no se hace (D-cuándo).
