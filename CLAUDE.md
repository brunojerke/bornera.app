# Bornera

## Objetivo
Editor + simulador de circuitos eléctricos liviano. Tiene que correr fluido en una netbook con 4 GB de RAM.

## Reglas
- `src/core` no puede importar nada del DOM ni de las otras capas (`ui/`, `editor/`, `render/`), ni de Svelte. Las dependencias van en un solo sentido, hacia el núcleo.
- Todo cambio al documento pasa por un Comando (deshacer/rehacer). Única excepción: `generarId` sube `Documento.contadores` fuera de un Comando, porque el contador solo sube y no se deshace; si deshacer lo bajara, un id ya usado por el historial o por un cable se volvería a dar. Se llama al construir el comando, no al aplicarlo.
- Coordenadas siempre en unidades de grilla, nunca en píxeles.
- Cada símbolo nuevo: definición + test de bornes.
- Cada cambio en `sim/`: correr los circuitos de referencia (`npm test`).
- No agregar dependencias sin preguntar.
- Redibujar solo ante cambios; nunca un bucle constante.
- Interfaz en Svelte 5; el lienzo es Canvas 2D propio, sin librerías de dibujo.
- Código y comentarios en español.
- Identificadores en código y claves/valores del formato `.brn` sin ñ ni tildes (`tamano`, `proteccion`, `manual_momentaneo`). Los textos visibles para el usuario sí llevan ortografía correcta ("Protección", "Tamaño").

## Comandos
- `npm run tauri dev`    app de escritorio con recarga en caliente (abre la ventana)
- `npm run dev`          solo el frontend en el navegador (http://localhost:1420), sin Tauri
- `npm test`             tests una vez (Vitest), incluida la regla de imports de `src/core`
- `npm run test:watch`   tests en modo vigilancia
- `cargo test` (en `src-tauri`)  tests de Rust (`elegir_archivo`, el archivo del argumento de T25). Se corre al cerrar junto con `npm test` y `npm run check`
- `npm run bench`        banco de dibujado (100/500/2000 símbolos) en un Chrome/Edge headless, sin abrir la ventana
- `node tests/bench/abrir-node.mjs`  abrir y guardar el banco de 2000 + cables en Node, sin navegador (serializar, deserializar, gzip + deserializar); `--procesos=N`, `--json`
- `node tests/bench/netlist-node.mjs`  netlist de T28 con el banco de 2000 + cables en Node, sin navegador; juzga el máximo contra 5 ms (PC) o 27,5 ms (netbook) y mide aparte `redes()`; `--maquina=pc|netbook`, `--procesos=N` (3), `--vueltas=N` (5), `--json`
- `node tests/bench/r11-tramos-node.mjs`  R11 en reposo (T29) con reloj real en Node, escena oficial 2000 + cables: tramo más largo y cuántos pasan de 4 ms, marcando los que tuvieron una GC; solo informa (no está en `npm test`); `--veces=N` (3), `--json`
- `node tests/bench/f1-webview2.mjs`  F1 de T23 (parte síncrona de la copia de recuperación) en WebView2, con el exe de release (`npm run tauri build -- --no-bundle`); solo Windows y sin otra Bornera abierta; `--procesos=N`, `--exe=A,B` (intercala), `--borrar-base` (solo para intercalar con un exe de la etapa 1a; borra las copias del perfil), `--json`. Desde la etapa 5 informa aparte la salida de emergencia (3 copias forzadas de una vez por proceso)
- `node tests/bench/probar-webview2.mjs --exe=A,B`  ABBA de B1–B16 («Probar la fase 3b») en WebView2 entre dos exes de release (A = la que se prueba, B = la base), con el juicio de la regla D6b-C (calientes: ≤ 1 ms o ±10 %, lentos ±1, B9 mismo escalón); solo Windows y sin otra Bornera abierta; `--bloques=N` (3), `--corridas=N` (2: fría y caliente), `--salida=RUTA` (textos crudos), `--json`; `--fase4`: A corre «Probar la fase 4» y B «Probar la fase 3b», y además juzga F1–F3 de A con los topes de la PC (C1) e informa las frías (regla de C4) y los valores K; `--fase5` (T31): A corre «Probar la fase 5» y B «Probar la fase 4», y además juzga S1–S5 de A con los topes de la PC (mediana de las calientes ≤ tope y máx. ≤ tope + máx(1 ms, 10 %)), con el desglose de S1 y la pared de S5; `--base-fase5` (T32): con `--fase5`, B también corre «Probar la fase 5» y se suma la no regresión de S (mediana de A ≤ la de B + máx(1 ms, 10 %)) con el cierre del ajuste 1 de T32 (S5 solo sobre el tope y sin regresión: «causa conocida»). Desde T33, S4 (cuadro / gesto con dibujo, más la cadena de 100 que solo informa) y R-A: S1 y S4 solo por tope, su no regresión informa
- `node tests/bench/calcular-factores.mjs --pc=A --netbook=B`  K1 y K2 (netbook / PC, C4) de los textos de «Copiar» de «Probar la fase 4» (`.txt` por corrida, o el `.json` de `--salida`)
- `npm run humo`         pruebas de humo de la app real en Chrome/Edge headless a 1024×600 (`tests/humo/*.mjs`: `tNN-*.mjs` por tarea o con nombre de tema; `-- t08` corre una, `-- --capturas=CARPETA` guarda capturas). Cada tarea suma ahí sus comprobaciones
- `npm run circuito`     compara un `.brn` dibujado a mano con un circuito base, por redes (ruta en `BORNERA_BRN`; sin ella se saltea). La base va en `BORNERA_BASE`: `marcha-parada` (por defecto), `inversion` o `inversion-potencia` (fase 6, T36). Paso para PowerShell en `docs/archivo/plan-T15.md` sección 5 y en `docs/netbook-fase3b.md` sección E
- `npm run check`        chequeo de tipos completo (svelte-check + `check:core`)
- `npm run check:core`   chequeo de tipos de `src/core` sin la librería DOM
- `npm run check:watch`  svelte-check en modo vigilancia
- `npm run build`        build del frontend en `build/`
- `npm run preview`      sirve el build del frontend
- `npm run tauri build`  instalador de escritorio
