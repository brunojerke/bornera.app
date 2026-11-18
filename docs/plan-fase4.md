# Plan fase 4 — Guardar y abrir

**Aprobado por Bruno el 2026-11-17** con las opciones D1-C (sin «Transformar re-rutea»), D2a-A, D2b-C, D2c-A, D2d-B, D2e-A, D3-A, D4-C, D5-A, D6a-B, D6b-C, D7-A y D8-A, más sus ajustes, ya incorporados abajo. Las decisiones están en la sección 3. Las descartadas van en una línea cada una.

**Orden:** T20 → T21 → T22 → T23 → T24 → T25 → T26 → T27 → cierre (sección 6). T26 es independiente y puede adelantarse. Este plan fija qué hace cada tarea. El detalle (pasos, archivos exactos, tests uno por uno) lo arma la sesión de cada tarea con la skill `bornera-inicio`, antes de programar.

**Reglas** (las de la 3b):
- Una tarea por sesión, con el plan aprobado antes de programar.
- Cada etapa cierra con `npm test`, `npm run check` y un commit local.
- Si algo se ve en la app, suma su humo `tests/humo/tNN-*.mjs`. Al cerrar la tarea, `npm run humo` entero.
- Si toca el dibujo o el guardar: banco con el criterio fijado antes de medir. En los escenarios que `v0.1.3` no tiene, contra el commit anterior a la tarea, con ABBA ×3.
- Sin push, tags ni dependencias sin autorización.

## 1. Estado al aprobar
En `docs/archivo/plan-fase4-tareas.md` (`9d8c710`, versión `0.1.4-alpha.1`), junto con los supuestos S1–S8.

## 2. Criterio de pasaje (D5-A)
**Pasa cuando**, con un circuito cambiado y sin guardar:
1. Se corta Bornera sin cerrarla (Administrador de tareas › Finalizar tarea).
2. Al abrirla, ofrece recuperarlo.
3. Lo recuperado es idéntico a la última copia, con el título con «•» y Deshacer desactivado.
4. Si pasaron 10 s sin comandos antes del corte, no se pierde nada.

Cómo se prueba:
- **Test automático:** el humo `t23-autoguardado.mjs` corta la página con CDP (sin `beforeunload`), abre otra con el mismo perfil, recupera y compara el documento campo por campo.
- **Netbook:** filas 2 y 3 de la checklist, y F1 ≤ 50 ms.
- La compatibilidad del formato (D5-B) no es criterio de la fase: queda como test obligatorio de T22.

## 3. Decisiones

| # | Elegida | Qué |
|---|---|---|
| D1 | C sin Transformar | Lo de arquitectura (autoguardado, migraciones, corpus, `.brn.json`), más abrir recientes, asociar `.brn` (solo Windows) y la T suelta. |
| D2a | A | La copia va en IndexedDB del webview, con `durability: "strict"`. Un solo camino para el navegador y el escritorio, que el humo puede probar. |
| D2b | C | Con cambios sin copiar, la copia sale a los 10 s sin comandos o a los 60 s del primer cambio sin copia, lo que llegue antes. Nunca durante un gesto: va en `requestIdleCallback`, con `setTimeout` de respaldo. La copia es solo `serializar` más una escritura asíncrona, sin la prueba D22-B ni gzip. Las escenas del banco no se copian. |
| D2c | A | Al arrancar, el diálogo «Bornera no se cerró bien» con Recuperar y Descartar. Esc deja la decisión para el próximo arranque. Ver «Detalle de D2c» abajo. |
| D2d | B | Una copia por instancia (id al azar). La instancia viva se marca con Web Locks y se ofrecen solo las copias sin dueño. Si S2 falla: un latido cada 10 s, y la copia queda sin dueño a los 30 s. |
| D2e | A | La copia se borra al guardar bien, al cerrar sin cambios o con «No guardar», al pasar a otro documento con Nuevo o Abrir (después de «¿Guardar los cambios?») y con Descartar. Nunca sola al arrancar. |
| D3 | A | Migraciones ya: funciones puras sobre el JSON leído, entre las etapas 3 y 4 de `deserializar`, con un test 1 → 2 de prueba. `VERSION_FORMATO` sigue en 1. Más un corpus congelado (T22). |
| D4 | C | Ítem «Exportar sin comprimir (.brn.json)…». Escribe una copia aparte, sin cambiar el archivo actual ni la marca «•». El formato lo da la extensión: Ctrl+S sobre un `.brn.json` abierto lo escribe sin comprimir. Un componente o cable por línea. |
| D5 | A | Recuperar después de un corte (sección 2). |
| D6a | B | Factores ×3 para pasos sin dibujo y ×5,5 para gestos con dibujo. Se recalculan al cierre con la PC y la netbook el mismo día, para la fase 5. |
| D6b | C | Probar `willReadFrequently` en la PC: se queda si las corridas frías quedan como las calientes y las calientes no se mueven más de ±10 %. Si no, calentamiento. |
| D7 | A | Borrar un cable borra en el mismo comando los cables en T que cuelgan de él, recursivamente. Aviso «Se borraron también N cables en T»; Ctrl+Z los trae. |
| D8 | A | Alcance de fs `**/*.brn` y `**/*.brn.json` (y sus `.tmp`), sin dependencias. |

**Detalle de D2c:**
- Recuperar abre la copia con el nombre del archivo («Sin título» si no tenía), marcada «•» y con el historial vacío.
- Guardar pide dónde, con la ruta original sugerida.
- Si la copia no abre, muestra los problemas y ofrece exportarla tal cual.
- Con varias copias, el diálogo las lista.

**Descartadas:** en `docs/archivo/plan-fase4-tareas.md`.

## 4. Tareas (T20–T27 cerradas)

El detalle de cada tarea (qué, pruebas, «Hecho», mediciones), el estado al aprobar y las decisiones descartadas están en `docs/archivo/plan-fase4-tareas.md`.

| Tarea | Qué | Commits | Resultado |
|---|---|---|---|
| T20 | Banco listo para la netbook (D6b-C) | `504dd9b`–`5a51c2b` | `willReadFrequently` no se queda; queda la pasada de calentamiento entera |
| T21 | Exportar sin comprimir `.brn.json` (D4-C) | `66e2a9a`, `26814c9` | Hecho |
| T22 | Migraciones y corpus del formato (D3-A) | `153c5ad`, `32c32b4` | Hecho |
| T23 | Autoguardado y recuperación (D2, D5-A) | `0929a36`–`93c379d` | F1 en WebView2: 3,4 ms. D5-A pasa en el humo y a mano |
| T24 | Alcance de archivos y Abrir reciente (D8-A) | `86284c3` | Hecho |
| T25 | Asociar `.brn` en Windows | `67e9c4c` | S5 pasa con el `.msi` |
| T26 | Borrar un cable con T colgando (D7-A) | `5cf70f2` | B16 pasa |
| T27 | Pulsadores NC desde S0 y NA desde S1 | `6d3ac66` | Las filas del `Numerador`, iguales. WebView2: B5 2.º y B11 máx. no pasan, con causa conocida |

**Supuestos abiertos:** S6 (el MSI de `0.1.4` reemplaza la alpha: fila 6) y S8 (WebKitGTK, secundario). Los demás, en el archivo.

### Reglas de medición vigentes
**D6b-C** (Bruno, 2026-11-17):
- **Cómo se mide:** en la PC enchufada, en «Mejor rendimiento», con las apps cerradas. Los exes salen de `tauri build --no-bundle`, sin instalar. Antes y después se miden en la misma sesión. Cada apertura hace una corrida fría y una caliente. Si una corrida da un valor raro, se repite y se anota.
- **Qué se compara:** cada fila B1–B16 de «Copiar». En las filas de cuadros cuentan el máx. y los lentos.
- **Juicio:** sobre la mediana de las calientes. Es igual si la diferencia es ≤ 1 ms o ≤ 10 %. Los lentos, ±1. B9, el mismo escalón.

**Las frías en C4** (Bruno, 2026-11-17):
- Una corrida fría pasa si cada fila queda dentro del rango de las calientes del mismo día, más un piso de 1 ms.
- Los máximos sueltos no deciden solos.

## 5. Topes

| # | Qué | PC | Netbook | Origen |
|---|---|---|---|---|
| F1 | Copia de recuperación con 2000 + 3030 cables: **máximo** de la parte síncrona | ≤ 9 ms en WebView2 (regla abajo) | ≤ 50 ms | 0.1.2 (ningún cuadro > 50 ms) y D6a |
| F2 | Guardar 2000 sin el comando: serializar + gzip + escribir un `.brn` temporal; máx. de 5 vueltas | ≤ 1 s (decide en C1) | ≤ 1 s (decide en C4) | D20 |
| F3 | Abrir 2000 sin el comando: leer + desempaquetar + deserializar + armar la escena + primer cuadro; máx. de 5 vueltas | ≤ 1 s (decide en C1) | ≤ 3 s (decide en C4) | D20; netbook, Bruno 2026-11-18 |
| B1–B16 | Filas de la 3b, sin cambios (no regresión) | las de la 3b | las de la 3b (B10 informativa) | cierre 3b |
| K1, K2 | Factor netbook / PC: pasos sin dibujo / gestos con dibujo | — | se anota | D6a-B |

**Regla de F1** (Bruno, 2026-11-17, fijada antes de medir):
- El tope de la netbook es sobre el máximo.
- En Node, `serializar` da 13,2 ms de máximo, que por ×5,5 son ~73 ms: no pasaría.
- Por eso, **si en WebView2 de la PC el máximo de la copia pasa de 9 ms (50 / 5,5), T23 hace `serializar` por partes o con caché por objeto antes de ir a la netbook.**

## 6. Cierre de la fase 4

| Etapa | Qué | Modelo |
|---|---|---|
| C1 | «Probar la fase 4» en el menú de desarrollo: «Probar la fase 3b» más F1, F2, F3, K1 y K2, con «Copiar» | Opus alto |
| C2 | `docs/netbook-fase4.md`: una hoja, la checklist de abajo | Sonnet |
| C3 | `0.1.4-alpha.N` con la skill `bornera-release`. Tag y push con autorización | Opus alto |
| C4 | Netbook (Bruno), y «Probar la fase 4» en la PC el mismo día para K1 y K2. Yo paso los números. Las frías se juzgan con la regla de C4 (T20) | Sonnet |
| C5 | `0.1.4`: probar lo que se publica. Ver los pasos abajo | Opus alto |
| C6 | Docs (arquitectura: fase 4 cerrada y factores para la fase 5) y Obsidian | Sonnet |

**Pasos de C5:**
1. Commit de versión `0.1.4`.
2. **Con autorización escrita de Bruno**, push del tag `v0.1.4`. `release.yml` arma el borrador, que no es público.
3. Se baja el instalador del borrador y se prueba en la netbook (fila 6).
4. Si pasa, Bruno publica el borrador. Si falla, se borran el tag (local y remoto) y el borrador, con el OK de Bruno.

### C1. «Probar la fase 4» (Bruno, 2026-11-18)
- **Qué hace:**
  - Es un ítem del menú de desarrollo. Ese menú sale en desarrollo y en las prereleases (`mostrarMenuDesarrollo`), así que va en el `.msi` de la alpha.N para la netbook.
  - Corre B1–B16 igual que «Probar la fase 3b», con la pasada de calentamiento la 1.ª vez. Después corre F1 (la medición de «Medir la copia (F1)»), F2 y F3.
  - «Copiar» da todas las filas, con el grupo K de cada una.
- **F2 y F3:**
  - No usan los comandos Guardar ni Abrir. No tocan recientes, autoguardado, título ni «modificado».
  - Usan el mismo documento que F1: la escena del banco de 2000 + 3030 cables.
  - El archivo temporal lleva un nombre único (`.brn`, en la carpeta temporal del sistema) y se borra en un `finally`.
  - En el navegador (humo) no hay disco: escriben y leen en memoria, y el encabezado dice «sin disco».
  - **Si hace falta tocar capacidades o fs, se frena y se consulta a Bruno.**
- **K1 y K2:**
  - K1 (pasos sin dibujo): B1, B2, B4 y B5 (medianas), B7, B10, B12, B13 (p95), F1 (mediana) y F2.
  - K2 (gestos con dibujo): B3, B6, B11 y B14 (máximos), B16 (por gesto) y F3.
  - Quedan fuera B8 (%), B9 (escalón) y B15 (lentos).
  - El factor es la mediana, en el grupo, de los cocientes netbook/PC de cada fila. Lo calcula una función pura con test, a partir de los dos textos de «Copiar».

**Criterio de C1** (fijado antes de medir):
- **Medición:** en WebView2, con las condiciones de D6b-C, sin otra Bornera abierta.
  - Se comparan el exe de C1 (A) y el de `6d3ac66` (B). El de B sale de un worktree temporal, con `npx svelte-kit sync` antes.
  - Se corre `probar-webview2.mjs --exe=A,B --bloques=3`: 6 aperturas por exe, con una fría y una caliente en cada una. A corre «Probar la fase 4» y B, «Probar la fase 3b».
- **B1–B16:** D6b-C sobre las medianas calientes.
  - Si una fila no pasa y el diff de C1 no pasa por esa ruta, queda «no pasa, causa conocida», sin volver a medir.
  - Si el diff pasa por esa ruta, se frena y se consulta a Bruno.
- **F1:** ≤ 9 ms de máximo en cada corrida caliente de A (regla de F1). Las frías se informan.
- **F2 y F3:** ≤ 1 s, sobre el máximo de 5 vueltas, en todas las corridas de A, frías y calientes.
- **Seguimiento:** B1 y B3 máx. fríos, con la regla de las frías en C4. Informan, y se comparan con T26 (B1 ×3, B3 máx. ×2) y con T27.
- **K1 y K2:** en C1 solo se anotan los valores de la PC. El factor sale en C4.
- No se vuelve a medir para que algo pase.

### C4. Si K1 > 3 o K2 > 5,5 (propuesta; decide Bruno en C4)
Los factores de D6a-B (×3 y ×5,5) dieron los topes de PC derivados de la netbook: hoy, solo F1 (9 ms = 50 / 5,5). Los topes de la netbook de la fase 4 se juzgan en la netbook, así que un factor mayor no cambia lo que ya pasó allá.
- **A. Recalcular para la fase 5:** los topes de PC de la fase 5 se derivan con el K medido. En la fase 4 no cambia nada.
- **B. A, y revisar F1 de PC:** si 50 / K2 da menos que el F1 de la PC medido en C1, se anota que el tope de 9 ms quedaba flojo. Lo que decide es el F1 de la netbook.
- **C. Repetir C4 otro día** si K pasa en más de un 30 % (K1 > 3,9 o K2 > 7,2), por si la netbook vino en un estado raro (energía, Windows Update). Recién después se fija el factor.
- **D. Conservador:** para la fase 5 se usa el mayor entre el K medido y el factor anterior.

**Checklist de la netbook** (una hoja). **Regla:** la `0.1.4` se instala con el mismo tipo de instalador que la alpha instalada. Mezclar MSI y NSIS deja dos «Bornera». `release.yml` arma solo el `.msi`, así que los pasos 0 y 6 usan el `.msi`. Bruno confirma que la alpha.1 se instaló con el `.msi`.

| # | Paso | Pasa si |
|---|---|---|
| 0 | Enchufada, en «Mejor rendimiento». Instalar el `.msi` de `0.1.4-alpha.N` encima de la alpha.1 | Una sola «Bornera», versión alpha.N |
| 1 | Menú de desarrollo › «Probar la fase 4», 3 veces seguidas, con «Copiar» cada vez | Las filas con tope pasan (mediana de las 3) |
| 2 | T23 (en la PC, en `tauri dev`, pasó el 2026-11-18). Abrir `marcha-parada.brn`, arrastrar S1 dos unidades a la derecha y esperar 15 s sin tocar nada. Administrador de tareas › Bornera › Finalizar tarea (sobre la app Bornera, no sobre los procesos «Microsoft Edge WebView2»; T23, ajuste 3). Abrir Bornera › **Recuperar** | S1 corrido, título con «•», Deshacer desactivado |
| 3 | T23 (en la PC, en `tauri dev`, pasó el 2026-11-18). Repetir el paso 2 hasta Finalizar tarea. Abrir › **Descartar**. Cerrar y volver a abrir | No vuelve a preguntar |
| 3b | T23 (en la PC pasó el 2026-11-17). Abrir Bornera dos veces; en cada una, cambiar algo y esperar 15 s. Finalizar tarea sobre la **primera** (la app Bornera). En la segunda, menú de desarrollo › «Copias de recuperación…» | La segunda sigue viva y editable (no queda en blanco ni se cierra); la copia de la primera dice «sin dueño» |
| 4 | T25 (en la PC, con el `.msi` local, pasó el 2026-11-18). Explorador: doble clic en `marcha-parada.brn` | Bornera abre con ese archivo |
| 5 | T24 (en la PC, en `tauri dev`, pasó el 2026-11-18). Abrir `marcha-parada.brn`, cerrar Bornera y volver a abrirla. Flecha junto a Abrir › `marcha-parada.brn` | Abre, sin el aviso de «permiso» |
| 5b | T21 (en la PC, con el `.msi` local de T25, pasó el 2026-11-18). «Exportar sin comprimir (.brn.json)…» cuatro veces, escribiendo en el diálogo `x`, `x.brn`, `x.json` y `x.brn.json`. Guardar como, escribiendo `x.brn.json`. Abrir ese `x.brn.json`, mover algo y Ctrl+S | Las cuatro exportaciones dejan `x.brn.json` (nunca `x.brn.json.brn`, `x.brn.brn.json` ni `x.json`) y sin «permiso». Guardar como no deja `x.brn.json.brn`. Abrir muestra los `.brn.json`; Ctrl+S quita la «•» y el archivo tiene un componente por línea (Bloc de notas) |
| 5c | T26. Abrir `marcha-parada.brn`. Clic (sin Mayús) en el cable que baja de S1·14 a K1·A1, entre la T y A1, y Supr. Después Ctrl+Z | Se borran también el cable de la T de H1 y la barra dice «Se borró también 1 cable en T.». Ctrl+Z trae los dos, con H1 conectada |
| 6 | Instalar el `.msi` de `0.1.4` (del borrador) encima de la alpha.N, sin desinstalar | Una sola «Bornera», versión 0.1.4, la lista de recientes sigue |

## 7. Riesgos
- **F1 no pasa en la PC:** `serializar` por partes (vuelve a empezar si el historial cambia en el medio) o caché por objeto, antes de la netbook.
- **S2 falla:** queda el latido. Single-instance sería una dependencia, a decidir con Bruno.
- **Una copia que no abre** (el editor deja colocar fuera de ±10 000, pendiente de T15a): se muestran los problemas y se ofrece exportarla tal cual.
- **S6 falla** (el MSI no reemplaza la alpha): se frena antes de publicar el borrador y se decide con Bruno.
- **La asociación de archivos** solo se prueba con la app instalada. **Nota (2026-11-18):** en la PC pasó con el `.msi` local (T25); falta la fila 4 en la netbook.
- **`csp: null` con el alcance amplio de D8:** no hay una vía conocida de inyección (lienzo y textos escapados por Svelte). La CSP queda como tarea aparte.
- **La cascada de T26 borra de más:** se ve en el aviso y se deshace con Ctrl+Z.
- **WebKitGTK (Mint):** secundario, no bloquea (S8).
- **Smart App Control en la PC (2026-11-17):** está activado y bloquea las DLL de Rust que se compilan, así que `tauri dev` no compila. T23 (S2, S3 y F1 en WebView2), T24 (a mano en `tauri dev`) y T25 lo necesitan. Desactivarlo no tiene vuelta atrás sin restablecer Windows: lo decide Bruno. **Nota (2026-11-18):** Bruno lo desactivó y `tauri dev` compila (T23 y T24 se probaron a mano).

## 8. Fuera de la fase 4
- **Fase 5, antes de simular:** conexiones aparentes, etiquetas de red en la netlist y aviso de L con L1, L2 o L3.
- **Fase 6:** fuentes trifásicas.
- **Asociar `.brn` en Linux** (`.deb` y AppImage, tipo MIME): T25 es solo para Windows.
- **Tareas aparte, sin fecha:**
  - Transformar re-rutea al rehacer.
  - Número de orden de los auxiliares (probable primera migración real).
  - Cajas descentradas.
  - `referencias.reflejar`.
  - Optimizar *Encuadrar (F)*.
  - CSP.
  - «Copias recientes» (D2e-B).
  - PLC como símbolo (`docs/ideas.md`).
  - `tests/bench/correr.mjs` espera los 10 min del límite cuando Vite falla al transformar la página: debería cortar con el primer error. En un worktree nuevo hace falta `svelte-kit sync` antes de medir (T27).
- **Descartado por dependencias:** single-instance y persisted-scope, salvo pedido de Bruno.

## 9. Necesita autorización de Bruno
- Push de `main`.
- Tags `v0.1.4-alpha.N` y su push.
- Tag `v0.1.4` y su push (con autorización escrita), publicar el borrador, y borrar el tag o el borrador si falla.
- Cualquier dependencia nueva. No se espera ninguna.

## Etapa 0 (docs) — hecha el 2026-11-17
Este plan, `docs/arquitectura.md` (fase 4 y formato), la skill `bornera-inicio`, la fila 7 de `docs/plan-cierre-3b.md`, `docs/ideas.md` y Obsidian. Commit local, sin push.
