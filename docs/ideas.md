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

## Hoja 2 de la inversión: aclarar el paso 7
- **Qué:** en el paso 7 de la hoja 2 (`docs/netbook-fase3b.md`), la primera selección tomó la N (el neutro) en vez de lo que se quería. Aclarar ese paso.
- **Cuándo:** si se vuelve a usar la hoja 2. La checklist más simple, el banco con `willReadFrequently`, el factor real de la netbook y `0.1.4` encima de la alpha pasaron a `docs/plan-fase4.md` (T20, D6 y cierre).

## ESP32 o hardware real por USB
- **Qué:** conectar un ESP32 u otro hardware por USB para leer entradas y mover salidas reales desde la simulación.
- **Cuándo:** al final, después de lo demás.
