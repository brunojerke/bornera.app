# Ideas para más adelante

Ideas anotadas por Bruno. No son tareas ni tienen plan: cuando una entra en una fase, se planea ahí (`docs/plan-...`). El orden de las fases está en `docs/arquitectura.md`, «Hoja de ruta por fases».

## Rótulo o cajetín del plano
- **Qué:** el cuadro de datos del plano dibujado en la hoja, con título, autor, fecha, revisión y hoja.
- **Relación:** la fase 7 (Exportación) ya pide el PDF «con rótulo y marco». El `.brn` ya guarda título, autor y fecha.
- **Cuándo:** sin fecha; a más tardar, con la fase 7.

## PLC genérico como símbolo
- **Qué:** un PLC como componente de la hoja, con sus bornes de entradas y salidas, que se dibuja y se cablea como cualquier símbolo. Sin programa ni simulación.
- **Cuándo:** después de la fase 4.

## PLC simulado con ladder básico (fase propia)
- **Qué:** programar el PLC en escalera y simularlo junto con el circuito. Contactos NA y NC, bobina, set/reset, temporizador TON, contador y ciclo de scan.
- **Cuándo:** una fase propia después de la fase 5 (simulación de mando). Lo eligió Bruno el 2026-11-16.
- **Relación:** `docs/arquitectura.md` lo tiene en «Después del MVP» («a largo plazo, PLC en escalera»). La hoja de ruta se actualiza cuando se planee la fase.

## Abaratar `ReferenciasHoja.reflejar` al borrar y deshacer
- **Qué:** en *Borrar y deshacer uno con cables al 31 %* (escena con cables de 2000), `referencias.reflejar` suma unos 0,34 ms a cada paso. Es el 87 % de lo que sube el paso contra `v0.1.3`: de 0,5 a 0,8 ms de mediana en el banco.
- **Relación:** salió del desglose del cierre de la fase 3b, etapa 3 (`docs/bench.md`). El paso se informa y no juzga: lo que juzga es el por gesto, que sube por los contornos de aviso.
- **Cuándo:** sin fecha. Si en la netbook un paso de borrar o deshacer se nota, antes.

## Banco con `willReadFrequently` (antes de usar «Probar» otra vez)
- **Qué:** el banco lee píxeles con `getImageData` sobre un lienzo que queda en GPU, y eso hace lentas las corridas frías de «Probar la fase 3b» (B8, B15 y B16 en la netbook: la 1ª corrida tras abrir). Probar la opción B: crear el contexto del banco con `willReadFrequently: true`.
- **Relación:** cierre de la fase 3b, `docs/netbook-fase3b.md`, «Resultados en la netbook». Se verificó la causa en la PC.
- **Cuándo:** antes de volver a usar «Probar» en la netbook.

## Factor real de la netbook para los topes por gesto
- **Qué:** los topes de la netbook salen de ×2,5 sobre la PC, pero B10 (rehacer por gesto, 124,5 ms contra 22,6 en la PC) indica un factor cercano a ×5. Medir el factor real y usarlo para los topes por gesto de las fases siguientes.
- **Relación:** B10 pasó a informativo en el cierre de la fase 3b; decide B11 (cuadros).
- **Cuándo:** al armar los topes de la fase 4.

## Hoja 2 y checklist de la netbook más simples
- **Qué:** en el paso 7 de la hoja 2, la primera selección tomó la N (el neutro) en vez de lo que se quería. Aclarar ese paso y simplificar la checklist (menos filas, menos hojas).
- **Cuándo:** antes de la próxima checklist de netbook.

## Criterio de la fase 4: `0.1.4` se instala encima de la alpha
- **Qué:** al cerrar la fase 4, `0.1.4` estable se instala encima de `0.1.4-alpha.N` sin desinstalar, como 0.1.3 sobre alpha.11. Hay que probarlo en la netbook.
- **Relación:** Bruno movió `0.1.4` al cierre de la fase 4 (2026-11-17, cambio de D3 en `docs/plan-cierre-3b.md`). La versión sigue en `0.1.4-alpha.1`; las prereleases de la fase 4 son `0.1.4-alpha.2`, `.3`…
- **Cuándo:** al cerrar la fase 4.

## ESP32 o hardware real por USB
- **Qué:** conectar un ESP32 u otro hardware por USB para leer entradas y mover salidas reales desde la simulación.
- **Cuándo:** al final, después de lo demás.
