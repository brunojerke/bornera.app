# Bornera

## Objetivo
Editor + simulador de circuitos eléctricos liviano. Tiene que correr fluido en una netbook con 2 GB de RAM.

## Reglas
- `src/core` no puede importar nada del DOM ni de las otras capas (`ui/`, `editor/`, `render/`), ni de Svelte. Las dependencias van en un solo sentido, hacia el núcleo.
- Todo cambio al documento pasa por un Comando (deshacer/rehacer).
- Coordenadas siempre en unidades de grilla, nunca en píxeles.
- Cada símbolo nuevo: definición + test de bornes.
- Cada cambio en `sim/`: correr los circuitos de referencia (`npm test`).
- No agregar dependencias sin preguntar.
- Redibujar solo ante cambios; nunca un bucle constante.
- Interfaz en Svelte 5; el lienzo es Canvas 2D propio, sin librerías de dibujo.
- Código y comentarios en español.

## Comandos
- `npm run tauri dev`    app de escritorio con recarga en caliente (abre la ventana)
- `npm run dev`          solo el frontend en el navegador (http://localhost:1420), sin Tauri
- `npm test`             tests una vez (Vitest), incluida la regla de imports de `src/core`
- `npm run test:watch`   tests en modo vigilancia
- `npm run check`        chequeo de tipos completo (svelte-check + `check:core`)
- `npm run check:core`   chequeo de tipos de `src/core` sin la librería DOM
- `npm run check:watch`  svelte-check en modo vigilancia
- `npm run build`        build del frontend en `build/`
- `npm run preview`      sirve el build del frontend
- `npm run tauri build`  instalador de escritorio
