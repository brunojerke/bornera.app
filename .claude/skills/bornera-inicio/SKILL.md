---
name: "bornera-inicio"
description: "Arranca o retoma una tarea o etapa de Bornera (T14a, T14b, T15a) en una sesión nueva con poco contexto. Revisa git, ubica la tarea en el plan y presenta un plan para aprobar antes de programar."
---

# Inicio de sesión en Bornera

Bornera es un editor y simulador de automatismos eléctricos (Tauri 2, Svelte 5, TypeScript, Canvas 2D). El objetivo de esta skill es retomar una tarea gastando pocos tokens y sin programar antes de que Bruno apruebe el plan.

Si se recibe un argumento, es la tarea o etapa a retomar. Si no, se toma la tarea actual del plan.

## Pasos

1. **Revisar git**
   - Correr `git status --short --branch` y `git log --oneline -5`.
   - Si hay cambios sin commit, frenar y mostrarlos: pueden ser trabajo sin terminar de otra sesión.
   - Si Bruno indicó un commit esperado, confirmar que HEAD sea ese commit o descienda de él.

2. **Ubicar la tarea**
   - Buscar el plan vigente en `docs/` (hoy `docs/plan-fase3.md`) y localizar la tarea con búsqueda de texto.
   - Leer solo la sección de esa tarea y lo que ella referencie.

3. **Reconstruir lo hecho**
   - Usar `git show --stat` en los commits de la tarea.
   - Abrir solo los archivos necesarios para la etapa. No recorrer todo el repo: el costo de contexto es el motivo de esta skill.

4. **Presentar el plan y frenar**
   - Mostrar estado verificado, alcance de la etapa, pasos, tests y mediciones, riesgos y decisiones que necesita Bruno.
   - Separar lo verificado de lo que se supone.
   - Indicar el modelo y el esfuerzo sugeridos para la etapa: Sonnet para retomar, documentar o cerrar; Opus alto para programar o preparar una release; Opus xhigh para planear una tarea nueva o tocar la lógica del núcleo. Si el modelo actual es más caro que lo necesario, avisar a Bruno para que lo cambie con /model.
   - Esperar un "aprobado" explícito antes de programar.

## Límites

- Una tarea por sesión. Si aparece otra cosa, anotarla como pendiente.
- Durante esta skill no se modifica el código ni se hace commit o push.
- No lanzar subagentes para buscar: usar búsqueda de texto y lectura directa. Si hace falta uno, lanzarlo con el modelo más barato que alcance (haiku o sonnet), nunca opus.
- Se puede crear un test temporal para diagnosticar si se borra después, el árbol queda limpio y se informa el resultado.
- Las respuestas son cortas y precisas, en español.
