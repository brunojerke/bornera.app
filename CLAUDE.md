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
- `npm run bench`        banco de dibujado (100/500/2000 símbolos) en un Chrome/Edge headless, sin abrir la ventana
- `npm run humo`         pruebas de humo de la app real en Chrome/Edge headless a 1024×600 (`tests/humo/*.mjs`: `tNN-*.mjs` por tarea o con nombre de tema; `-- t08` corre una, `-- --capturas=CARPETA` guarda capturas). Cada tarea suma ahí sus comprobaciones
- `npm run circuito`     compara un `.brn` dibujado a mano con la marcha-parada base, por redes (ruta en `BORNERA_BRN`; sin ella se saltea). Paso para PowerShell en `docs/plan-T15.md` sección 5
- `npm run check`        chequeo de tipos completo (svelte-check + `check:core`)
- `npm run check:core`   chequeo de tipos de `src/core` sin la librería DOM
- `npm run check:watch`  svelte-check en modo vigilancia
- `npm run build`        build del frontend en `build/`
- `npm run preview`      sirve el build del frontend
- `npm run tauri build`  instalador de escritorio
