---
name: bornera-cierre
description: Cierra una tarea o etapa de Bornera con tests, check, humo, bench si corresponde, plan, commit local, Obsidian y resumen en términos eléctricos. Usar al cerrar o commitear una tarea. No hace push ni publica.
---

# Cierre de tarea en Bornera

El objetivo es que cada cierre deje evidencia real y un registro útil para retomar. Si se recibe un argumento, es la tarea o etapa a cerrar. Si incluye "con revisión", hacer también el paso 3.

## Pasos

1. **Revisar el alcance**
   - Correr `git status --short` y `git diff --stat`.
   - Si hay cambios ajenos a la tarea, frenar y mostrarlos.

2. **Verificar**
   - Correr `npm test`, `npm run check` y `npm run humo`.
   - Correr `npm run bench` si la tarea toca dibujo, arrastre, planificación, mosaicos u otro camino sensible al rendimiento.
   - Si algo falla, corregirlo solo si pertenece a la tarea. Si no, frenar e informar.
   - No relajar una prueba para que pase. Cada expectativa modificada se justifica ante Bruno, porque un verde obtenido así no prueba nada.
   - **Acentos:** correr `git grep -nIP '\x{FFFD}|\x{C3}|\x{C2}|\x{E2}\x{20AC}'`. Tiene que dar vacío. Si encuentra algo, corregirlo a mano con la herramienta Edit, nunca con PowerShell (`Set-Content` u `Out-File` cambian la codificación y rompen más acentos), y volver a correr la búsqueda.
   - No decir que algo quedó "reparado" sin mostrar la búsqueda vacía.

3. **Revisión independiente (solo si se pidió)**
   - Lanzar un subagente de solo lectura con el plan de la tarea y el diff, sin el razonamiento de la implementación.
   - Pedirle errores concretos con archivo y línea.
   - Mostrar los hallazgos a Bruno antes del commit. No hacer por cuenta propia cambios de alcance.

4. **Actualizar el plan**
   - Registrar en el plan vigente de `docs/` lo hecho, los resultados, las decisiones y lo pendiente.
   - Si falta una medición de aceptación, como la de la netbook, dejar la tarea abierta y decir exactamente qué falta.

5. **Hacer el commit local**
   - Formato: `Fase N, Tnn (i/n): resumen`, u omitir `(i/n)` si la tarea tiene una sola parte.
   - No hacer push, no crear tags y no publicar.
   - Después del commit, correr `git grep -nIP '\x{FFFD}|\x{C3}|\x{C2}|\x{E2}\x{20AC}' HEAD` y comprobar que da vacío, para confirmar lo que quedó guardado y no solo la copia de trabajo.

6. **Actualizar Obsidian**
   - Ubicar el vault con la variable `BORNERA_VAULT`. Si no existe, preguntar la ruta; no adivinarla.
   - Actualizar `10 Proyectos/Bornera/Bornera.md` con sesión, errores resueltos y pendientes.
   - Crear `Decisión - <tema>.md` solo para decisiones nuevas que convenga recordar.
   - Crear `Medición - <tema> - <equipo>.md` si hubo resultados de banco o netbook.
   - Las notas van en español.

## Resumen final

Mantenerlo breve y usar este orden:

- **Qué cambió:** explicado en términos eléctricos, por ejemplo qué pasa con bornes, cables y conexiones al mover un contactor.
- **Verificación:** cantidad de tests y resultado de check, humo y bench.
- **Commit:** hash y mensaje.
- **No probado o pendiente:** decirlo siempre, sobre todo lo que depende de la netbook.
