# Ideas para más adelante

Ideas anotadas por Bruno. No son tareas ni tienen plan: cuando una entra en una fase, se planea ahí (`docs/plan-...`). El orden de las fases está en `docs/arquitectura.md`, «Hoja de ruta por fases».

## Orden de la hoja de ruta
- **Orden** (Bruno, 2026-11-27): 6a (cerrada) → biblioteca 2 → 6b → temporizadores → Automatización industrial → instrumentos y analógicos.
- Las fases 7 (Exportación) y 8 (Distribución) quedan sin ubicar.
- Versiones (D12 de `docs/plan-fase6.md`, cambiada el 2026-11-27): `0.1.6` estable sale al cerrar 6a y 6b sale como `0.1.7`.

## Biblioteca 2
- **Fuentes y transformación:** fuente DC 12/24 V, fuente de corriente AC/DC, fuente variable, trafo monofásico, trafo trifásico, regulador.
- **Protección:** diferencial 3P (sin N).
- **Sensores:** inductivo, capacitivo, fotoeléctrico, presostato, termostato.
- **Cargas:** electroválvula monoestable y biestable.
- **Cuándo:** después de 6a y antes de 6b.

## 6b: simular la potencia
Se suma a lo ya anotado en `docs/plan-fase6.md`, sección 6.
- El motor como carga muestra si gira y en qué sentido (secuencia U-V-W).
- Un clic en el térmico de potencia lo dispara (abre 95-96, cierra 97-98 y corta el mando), con rearme.
- Abrir y cerrar a mano las termomagnéticas y los diferenciales (todos los polos).
- **A decidir:** guardamotor, seccionador, fusibles y botón de prueba del diferencial.
- Relé de control de fases y relé de sobrecorriente.
- Variador y arrancador como símbolo.

## Temporizadores (fase propia)
- **Qué:** temporizadores en la simulación. El motor de simulación necesita un reloj (D3-A de `docs/plan-fase6.md`).
- **Cuándo:** después de 6b.

## Automatización industrial
- **Qué:** PLC, módulos DI/DO, ciclo de scan y ladder; las rampas del variador y del arrancador.
- **Cuándo:** después de los temporizadores. Ver las dos entradas de PLC, más abajo.

## Instrumentos y analógicos
- **Instrumentos:** voltímetro, amperímetro, multímetro, vatímetro, frecuencímetro y osciloscopio. Necesitan un motor de simulación con valores.
- **Paso intermedio posible:** un «voltímetro lógico» que muestre la tensión nominal de la red.
- **Analógicos:** AI/AO, PT100, termopar, presión, humedad y encoder.
- **Cuándo:** al final de este orden, después de Automatización industrial.

## Rótulo o cajetín del plano
- **Qué:** el cuadro de datos del plano dibujado en la hoja, con título, autor, fecha, revisión y hoja.
- **Relación:** la fase 7 (Exportación) ya pide el PDF «con rótulo y marco». El `.brn` ya guarda título, autor y fecha.
- **Cuándo:** sin fecha; a más tardar, con la fase 7.

## PLC genérico como símbolo
- **Qué:** un PLC como componente de la hoja, con sus bornes de entradas y salidas, que se dibuja y se cablea como cualquier símbolo. Sin programa ni simulación.
- **Cuándo:** después de la fase 4.

## PLC simulado con ladder básico (fase propia)
- **Qué:** programar el PLC en escalera y simularlo junto con el circuito. Contactos NA y NC, bobina, set/reset, temporizador TON, contador y ciclo de scan.
- **Cuándo:** una fase propia después de la fase 5 (simulación de mando). Lo eligió Bruno el 2026-11-16. Desde el 2026-11-27 es parte de «Automatización industrial», después de los temporizadores.
- **Relación:** `docs/arquitectura.md` lo tiene en «Después del MVP» («a largo plazo, PLC en escalera»). La hoja de ruta se actualiza cuando se planee la fase.

## Abaratar `ReferenciasHoja.reflejar` al borrar y deshacer
- **Qué:** en *Borrar y deshacer uno con cables al 31 %* (escena con cables de 2000), `referencias.reflejar` suma unos 0,34 ms a cada paso. Es el 87 % de lo que sube el paso contra `v0.1.3`: de 0,5 a 0,8 ms de mediana en el banco.
- **Relación:** salió del desglose del cierre de la fase 3b, etapa 3 (`docs/bench.md`). El paso se informa y no juzga: lo que juzga es el por gesto, que sube por los contornos de aviso.
- **Cuándo:** sin fecha. Si en la netbook un paso de borrar o deshacer se nota, antes.

## Optimizar B10 (Rehacer con referencias) para la netbook
- **Qué:** B10 da 118–139 ms en la netbook, ×6,2 contra la PC (C4, fase 4). Es informativa, no juzga. Va junto con la entrada de arriba: las dos son el costo de `referencias.reflejar`.
- **Cuándo:** sin fecha; antes si en la fase 5 se nota al rehacer.

## `tests/bench/correr.mjs` espera 10 min si Vite falla
- **Qué:** cuando Vite falla al transformar la página del banco, `correr.mjs` espera el límite de 10 min en vez de cortar con el primer error. En un worktree nuevo hace falta `npx svelte-kit sync` antes de medir (T27).
- **Cuándo:** tarea chica, sin fecha.

## `problemasTrazado` no marca el punto de T existente
- **Qué:** un tramo nuevo que pasa por el punto de una T que ya está (su extremo sobre otro cable) no lo marca ahí; la T, vista desde ella, sí («cruce»). El par sale igual en otro punto, encimado con la T o con su anfitrión, así que W lo rechaza igual y la previa de pegar marca el par; falta solo la marca en ese punto.
- **Relación:** apareció en `codosBanco` (2026-11-22), en el pegado al azar de `tests/portapapeles-banco.test.ts` con la escena nueva. El control de pegar tiene la excepción `cruceEnTExistente` (`src/core/model/prueba-portapapeles.ts`) y `trazado.test.ts` un `it.fails` que se pone rojo cuando se arregle: entonces se saca la excepción.
- **Cuándo:** tarea aparte, con su ABBA (toca W, la previa de pegar y R11 en vivo).

## Ícono propio de la app
- **Qué:** un ícono propio para Bornera (el instalador y la ventana).
- **Cuándo:** tarea aparte, sin fecha (pedido de Bruno, 2026-11-20).

## Seguimiento de las frías B1 y B3
- **Qué:** B1 frío queda fuera del rango en todas las mediciones de la fase 4. B3 máx. frío vuelve en la netbook (21,7 ms en C4). Informan; no juzgan (regla de las frías de C4).
- **Cuándo:** se vuelve a mirar en las mediciones de la fase 5.

## Hoja 2 de la inversión: aclarar el paso 7
- **Qué:** en el paso 7 de la hoja 2 (`docs/netbook-fase3b.md`), la primera selección tomó la N (el neutro) en vez de lo que se quería. Aclarar ese paso.
- **Cuándo:** si se vuelve a usar la hoja 2. La checklist más simple, el banco con `willReadFrequently`, el factor real de la netbook y `0.1.4` encima de la alpha pasaron a `docs/plan-fase4.md` (T20, D6 y cierre).

## ESP32 o hardware real por USB
- **Qué:** conectar un ESP32 u otro hardware por USB para leer entradas y mover salidas reales desde la simulación.
- **Cuándo:** al final, después de lo demás.

## Menú de configuración de la app
- **Qué:** un menú de configuración de la app (no del `.brn`): prender o apagar el etiquetado, y elegir los prefijos y el número inicial.
- **Cuándo:** después de la fase 5 (Bruno, 2026-11-17).
