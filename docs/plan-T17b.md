# Plan T17b — Contacto auxiliar NC y `compararRedes`

**Aprobado el 2026-11-14** con las decisiones de la tabla de abajo. Tarea corta de la fase 3b (`docs/plan-fase3b.md`), después de T17 y antes de T18.

**Estado de git al planear (verificado):** `main` en `85ecec0` (cierre de T17), árbol limpio, 10 commits por delante de `origin/main`, sin push.

**Por qué existe:** el criterio de cierre de la fase 3b (inversión de giro con enclavamiento eléctrico, `tests/circuitos/inversion.brn`, `npm run circuito`) necesita un contacto auxiliar NC, que no existe. Además, `compararRedes` da por repetidos dos auxiliares NA de una misma bobina y no define qué hace con un contacto sin etiqueta, que con T17 es como entra todo contacto nuevo.

## Decisiones (Bruno, 2026-11-14)

| D | Elegida | Qué |
|---|---|---|
| D1 bornes | **A, numeración fija** | NC 21-22 y NA 13-14, como dice `docs/arquitectura.md` (tabla de símbolos). Dos NA de una misma K1 se llaman los dos 13-14. El número de orden (13-14, 23-24, 31-32…) queda como tarea aparte, a revisar al planear T18 (`docs/plan-fase3b.md`). |
| D2a contactos repetidos | **A, firma por redes** | Varios contactos de la misma etiqueta y tipo se comparan como multiconjunto de firmas: tipo, etiqueta y las dos redes donde caen sus bornes (sección 2). |
| D2b contactos vacíos | **informar** | En el dibujo, cada contacto seguidor sin etiqueta es una diferencia con mensaje propio. En la base, `compararRedes` tira: la base tiene que estar completa. |
| D3 banco | **escena fija** | `generarBanco` usa por defecto una lista fija con los 7 tipos de `v0.1.3`, no `SIMBOLOS`. El sha256 de `ESCENA_ACTUAL` no cambia. Sin banco. |
| Límite de duplicar | **test + pendiente de T19** | Al duplicar la rama de K1 con su NC "K2" de enclavamiento, la copia queda con NC "K2" (debería ser K1). Se fija con un test y el aviso va como pendiente de T19, no de T17b. |
| `inversion.brn` | **fuera de T17b** | Se arma al cierre de la fase 3b, como estaba. |

## 1. Estado verificado (2026-11-14, sobre `85ecec0`)

- **Biblioteca** (`src/core/symbols/biblioteca.ts`): 7 símbolos. El dibujo IEC 60617-07-02-03 del NC ya existe (`contactoNC()`, el del pulsador NC), con el tope a la derecha.
- **Simulación:** `src/core/sim/` está vacío. El "inverso a la bobina" del NC es solo dato (`elemento: "contacto_nc"` con `accionamiento: "bobina"`). Lo usa recién la fase 4.
- **Etiquetado (T17):** `etiquetado.ts` decide por `accionamiento === "bobina"` (`sigueABobina`) y por `esSeguidor`, no por el tipo. El editor (`src/editor`), la interfaz (`src/ui`) y el dibujo (`src/render`) no miran qué clase de contacto es. Por lectura, el NC entra vacío, sigue a su bobina al pegar o duplicar, se arrastra al renombrarla y "Etiquetar los vacíos" no lo toca. Lo confirman los tests de la etapa 1.
- **`.brn`:** se lee por `buscarSimbolo(tipo)`. Un tipo nuevo no cambia la versión del formato. Los archivos viejos no lo tienen.
- **Banco:** `generarBanco(n)` toma `SIMBOLOS` por defecto (`src/render/banco.ts`). Un símbolo más cambiaría la escena con la misma semilla, como pasó en `c638a35` con Fase y Neutro. De ahí D3.
- **Conteos de "7 símbolos" escritos a mano:** `biblioteca.test.ts`, `colocar.test.ts`, `comandos.test.ts` (un caso con 7 posiciones), `prueba-documentos.ts` (comentario) y el humo `t07-colocar.mjs`. El humo `t15` busca los símbolos de la paleta por nombre: no se toca.
- **`compararRedes`** (`src/core/circuitos/compararRedes.ts`): nombra cada borne "etiqueta·borne". Si dos componentes comparten etiqueta y tipo, salen como "Hay 2…" y las redes no se comparan. Un auxiliar sin etiqueta da hoy "Falta "K1"" y "Sobra un componente sin etiqueta" (test de T17 que fija eso).

### Supuestos (a verificar)
- ~~Que `src/core/model/portapapeles.ts` no tenga nada que dependa del tipo de contacto.~~ **Verificado en la etapa 1 (2026-11-14):** Ctrl+C / Ctrl+V y Ctrl+D con la bobina en el lote llevan al NC a K2 junto con el NA (`src/editor/armarEtiquetas.test.ts`, "Editor: contacto auxiliar NC").
- ~~Que "Contacto auxiliar NC" entre en la paleta a 1024×600.~~ El humo `t07` (8 símbolos) lo arrastra al lienzo sin tocar el paso de 80 px de las columnas.

## 2. Diseño

### Símbolo `contactor.auxiliar_nc`
- Nombre visible "Contacto auxiliar NC", categoría `mando`, caja 2×4, `primitivas: contactoNC()`.
- `elemento: "contacto_nc"`, `accionamiento: "bobina"`, sin `prefijoEtiqueta` (seguidor: entra vacío).
- Bornes `21` en (0, −2) hacia arriba y `22` en (0, 2) hacia abajo. `ladoNombresBornes: "izquierda"`: el tope está a la derecha.
- En `SIMBOLOS`, justo después del auxiliar NA: sale al lado en la paleta.
- Escena de prueba (`src/render/escenaPrueba.ts`): etiqueta "K1".

### Banco (D3)
- `TIPOS_ESCENA_013`: los 7 tipos de `SIMBOLOS` en `v0.1.3`, en su orden. `generarBanco` y `crearEscenaBanco` los usan por defecto, buscados por tipo como `simbolosEscena012`.
- El test de `ESCENA_ACTUAL` (sha256 de 100, 500 y 2000) no cambia: es la prueba de que la escena es la misma. Como tampoco cambia el dibujo de ningún símbolo existente, no se mide.

### `compararRedes` (D2a y D2b)
Palabras: **contacto repetido** es un seguidor (`esSeguidor`) cuya etiqueta normalizada y tipo comparte con otro de la misma hoja. Los titulares repetidos (dos bobinas K1) siguen siendo error, como hoy.

1. **Vacíos (D2b).** Si la base tiene un seguidor sin etiqueta, tira. En el dibujo, cada seguidor sin etiqueta da `Contacto sin etiqueta (tipo, id): no sigue a ninguna bobina.` en lugar del genérico "Sobra un componente sin etiqueta". Cuenta como diferencia y las redes no se comparan, como con cualquier diferencia de componentes.
2. **Componentes.** Los grupos de contactos repetidos se comparan por cantidad (multiconjunto): `Hay 3 "K1" (contactor.auxiliar_na); la base tiene 2.` La base pasa a admitir contactos repetidos.
3. **Redes.** Los bornes no repetidos se nombran "etiqueta·borne", como hoy. Los de un contacto repetido, por su id, solo dentro de la comparación.
4. **Firmas.** Cada red se identifica por su **ancla**: la lista ordenada de sus nombres "etiqueta·borne" conocidos. La firma de un contacto repetido es (tipo, etiqueta, ancla de la red de su primer borne, ancla de la del segundo). Las firmas de la base y del dibujo se comparan como multiconjunto. Los contactos que se emparejan pasan a tener nombre conocido ("K1·13#1", estable entre los dos documentos) y anclan sus redes.
5. **Vuelta iterativa.** Si una red solo tiene bornes de contactos repetidos (por ejemplo, dos repetidos en serie), su ancla está vacía. Se repite el paso 4 con lo ya identificado. **Tope:** tantas vueltas como contactos repetidos haya. También se corta si una vuelta no identifica a nadie. Lo que queda sin identificar se informa como diferencia (`No se pudo identificar "K1" (tipo): …`). Nunca cicla.
6. **Al final**, con todos los nombres conocidos, se compara la partición como hoy (se partió, se unieron). Una firma del dibujo que no está en la base se informa con sus dos redes.

Dos contactos en paralelo entre las mismas redes tienen firmas idénticas: son intercambiables y dan 0 diferencias.

`marcha-parada.brn` no tiene contactos repetidos ni vacíos: tiene que seguir dando 0 diferencias sin tocar el archivo.

## 3. Tests (Vitest)

### Etapa 1: símbolo, etiquetado, `.brn` y banco
- **`biblioteca.test.ts`:**
  - NC con bornes 21 y 22 en (0, ∓2), en las 4 rotaciones y espejado, con coordenadas enteras.
  - `contacto_nc` con `accionamiento: "bobina"`, el dibujo dentro de la caja y `validarDefinicion` sin errores.
  - Los seguidores pasan a ser `[NA, NC]` y hay 8 símbolos. Se ajustan los demás conteos.
- **Etiquetado** (`etiquetado.test.ts`, `armarEtiquetas.test.ts`):
  - Colocar un NC: entra vacío.
  - "Etiquetar los vacíos" no lo toca.
  - Renombrar K1 a K5 arrastra al NC K1, y también al NA si lo hay.
  - Pegar y duplicar con la bobina en el lote: el NC la sigue. **Este test cierra el supuesto del portapapeles.**
  - **Límite conocido:** duplicar la rama de K1 con su NC "K2" de enclavamiento (sin bobina K2 en la hoja). La copia queda con bobina K2, NA K2 y NC K2: el NC conserva porque su bobina no está en el lote. El test fija este comportamiento; el aviso es pendiente de T19.
- **`.brn`:** un documento con NC se guarda y se abre igual.
- **Banco:** el sha256 de `ESCENA_ACTUAL` sigue igual y `generarBanco` no incluye el NC.
- **Humo `t07`:** pasa a esperar 8 símbolos en esta etapa y no en la 3 (ajuste de Bruno, 2026-11-14), para que `npm run humo` entero quede en verde al cerrar cada etapa.
- **Test al azar de `src/editor/uniones.test.ts`:** elegía los tipos de `SIMBOLOS`. Con 8, la semilla 20261111 daba otra secuencia y no llegaba a la cobertura mínima (147 aceptadas contra más de 150). Ningún resultado estaba mal: la corrida recorría otra cosa. Igual que D3, esa corrida usa `TIPOS_ESCENA_013` y vuelve a dar la secuencia de siempre, con los mismos umbrales. Se suma una **segunda corrida con `SIMBOLOS` completa** (incluye el NC), con la semilla 20261112, la primera probada que llega a todos los umbrales sin bajarlos. Las dos comprueban que cada tipo de su lista se haya colocado.

### Etapa 2: `compararRedes`
- Dos NA de K1 en la base y en el dibujo (con otros ids, otro orden y movido): 0 diferencias.
- Los dos NA cruzados entre sus redes (el caso que un multiconjunto de redes no ve): diferencia.
- Tres NA de K1 contra dos en la base: diferencia de cantidad.
- **En serie:** dos NA de K1, con una red intermedia que solo tiene bornes repetidos. 0 diferencias contra una base igual, y diferencia si uno se corre de red.
- **En paralelo:** dos NA de K1 entre las mismas redes (firmas idénticas). 0 diferencias contra una base igual, y diferencia si uno se corre de red.
- **Tope de la vuelta:** un caso que no se puede identificar termina con diferencia y no cicla.
- Un NC vacío en el dibujo: el mensaje de D2b. Base con un contacto vacío: tira.
- El test de T17 "un contacto auxiliar sin etiqueta: lo que informa hoy" pasa al mensaje nuevo.
- `tests/circuitos/marcha-parada.brn` congelado contra `marchaParada()`: 0 diferencias (`tests/circuitos/marcha-parada.test.ts`).

### Etapa 1: resultados (2026-11-14)
- **Vitest:** 1581 tests en verde (1 saltado, `npm run circuito` sin `BORNERA_BRN`). **`npm run check`:** 0 errores. **Humo entero:** 611 de 611. **Banco:** no se corre (D3): el sha256 de `ESCENA_ACTUAL` no cambia.
- **Hecho:** `CONTACTO_AUXILIAR_NC` en `biblioteca.ts` y en `SIMBOLOS` (8 símbolos). `TIPOS_ESCENA_013` y `simbolosEscena013()` en `src/render/banco.ts`, por defecto en `generarBanco` y `crearEscenaBanco`. El NC "K1" en la escena de prueba.
- **Tests nuevos:** bornes y dibujo del NC, seguidores `[NA, NC]`, etiquetado del núcleo y del editor (colocar, pegar, duplicar, vacíos, renombrar), `.brn` con NC, escena fija del banco, NC al lado del NA en la paleta.
- **Límite fijado** (`etiquetado.test.ts` y `armarEtiquetas.test.ts`): al duplicar la rama de K1 con su NC "K2" de enclavamiento, todo queda en K2. Pendiente de T19.
- **Expectativas cambiadas:** de 7 a 8 símbolos en los conteos. En `comandos.test.ts`, el caso de rotar todos los símbolos gana una 8.ª posición, (2, 3), que mantiene la caja impar×par, y "Borrar varios en varias hojas" corre sus ids (c8 pasa a la hoja 1). En `uniones.test.ts`, lo de arriba.

## 4. Humo, banco y netbook

- **Humo** `tests/humo/t17b-contacto-nc.mjs` a 1024×600: la paleta muestra "Contacto auxiliar NC", se arrastra al lienzo, entra vacío con los bornes 21 y 22, se guarda y se reabre igual. `t07` pasa a esperar 8 símbolos **desde la etapa 1** (ajuste de Bruno). Al cerrar cada etapa, `npm run humo` entero.
- **Banco:** no se mide (D3). No cambia la escena ni el dibujo de ningún símbolo existente.
- **Netbook:** nada nuevo. Sigue lo vigente para el cierre de la fase 3b (`docs/plan-T17.md`).

## 5. Etapas

Cada una en una sesión, con commit local y `/bornera-cierre`. Sin push ni versión.

| Etapa | Qué | Modelo sugerido |
|---|---|---|
| 0 | Docs: este plan, `plan-fase3b.md` (T17b apunta acá, tarea aparte del número de orden, pendiente de T19) y Obsidian. Commit solo de docs. **Hecha el 2026-11-14.** | Sonnet |
| 1 | Símbolo NC, escena fija del banco, conteos (también el humo `t07`), escena de prueba, tests de símbolo, etiquetado, portapapeles y `.brn`. **Hecha el 2026-11-14.** | Opus alto |
| 2 | `compararRedes` (D2a y D2b), sus tests y el congelado de la marcha-parada. | Opus xhigh (lógica del núcleo) |
| 3 | Humo t17b, `npm run humo` entero y cierre de docs (este plan, `plan-fase3b.md`, Obsidian). | Sonnet |

En PowerShell, `npm.cmd`.

## 6. Riesgos
- **La escena del banco cambia sin querer:** si `generarBanco` sigue tomando `SIMBOLOS` en algún lado (bench, `src/editor/banco.ts`), la escena cambia. Lo detecta el sha256 de `ESCENA_ACTUAL`.
- **Firmas con anclas vacías:** circuitos con muchos contactos repetidos encadenados pueden quedar sin identificar aunque sean iguales. El tope evita que cicle; si pasa con un circuito real, se informa y se revisa.
- **Mensajes de `compararRedes`:** el test de T17 que fijaba el mensaje de un auxiliar vacío cambia a propósito.

## 7. Fuera de T17b
- **Número de orden de contactos auxiliares** (13-14, 23-24, 31-32…): tarea aparte, a revisar al planear T18 (`docs/plan-fase3b.md`).
- **Aviso del NC de enclavamiento que queda con la etiqueta vieja al duplicar:** pendiente de T19.
- **`tests/circuitos/inversion.brn`:** al cierre de la fase 3b.
- **Simulación del NC:** fase 4.
