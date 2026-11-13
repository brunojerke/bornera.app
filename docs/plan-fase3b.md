# Plan fase 3b — Editor, segunda parte

Decidida el 2026-11-13 (Bruno): las cuatro funciones del editor que quedaron fuera del criterio de la fase 3 forman la fase 3b. Va después de la fase 3, cerrada con la versión 0.1.3, y antes de la fase 4.

Orden: T16 → T17 → T18 → T19.

## Contexto
La fase 3 pasó con la marcha-parada dibujada a mano (T15, `docs/plan-fase3.md`). Su sección "Fuera del criterio de pasaje" dejó para después cuatro funciones de la lista "Funciones del editor" de `docs/arquitectura.md`:
- copiar, cortar, pegar y duplicar (Ctrl+D);
- etiquetado automático (K2, S3…);
- referencias cruzadas bajo cada bobina;
- validaciones en vivo (bornes y cables sueltos en naranja).

**Pasa cuando** (confirmado por Bruno el 2026-11-13): a partir de la marcha-parada, se arma a mano a 1024×600 una inversión de giro con enclavamiento eléctrico entre K1 y K2. La rama de K2 se hace duplicando la de K1 con Ctrl+D, no dibujándola de nuevo. Al terminar:
- no hay bobinas repetidas y cada contacto queda vinculado a su bobina por la etiqueta;
- las referencias cruzadas bajo K1 y K2 son correctas;
- nada queda en naranja;
- el `.brn` dibujado se compara por redes con el archivo congelado `tests/circuitos/inversion.brn` usando `npm run circuito`, como en T15;
- el banco no empeora contra `v0.1.3` en la PC, y la prueba a mano anda en la netbook con Windows.

El armado de referencia, el `inversion.brn` y la comparación se hacen al cerrar la fase, como T15, y se planean después de T19.

## Reglas
Las mismas de la fase 3:
- Una tarea por sesión. Primero el plan (`docs/plan-TNN.md`) y, con el "aprobado" de Bruno, el código.
- Al cerrar cada etapa: `npm test`, `npm run check` y commit local. Si hay algo visible en la app, también su humo `tests/humo/tNN-*.mjs`, y al cerrar la tarea `npm run humo` entero.
- Si la tarea toca el editor o el dibujo: banco contra `v0.1.3` en la PC, con el criterio fijado en el plan antes de medir. A la netbook se va solo si el banco da algo dudoso.
- Sin push ni versión sin autorización de Bruno.

## Tareas

### T16. Copiar, cortar, pegar y duplicar
- **Qué:** Ctrl+C, Ctrl+X, Ctrl+V y Ctrl+D (también Mayús+Supr, Ctrl+Insert y Mayús+Insert). Un solo paso de deshacer y conflictos con la misma regla que Colocar.
- **Plan:** `docs/plan-T16.md`, aprobado el 2026-11-13.
- **Etapa 0 (docs):** hecha.
- **Etapa 1 (núcleo, `src/core/model/portapapeles.ts`):** hecha el 2026-11-13. Detalle en `docs/plan-T16.md`, sección 7.

### T17. Etiquetado automático
- **Qué:** el segundo contactor que se coloca es K2, el tercer pulsador S3, etc. Decidir también qué etiqueta lleva lo pegado: T16 la conserva (D3-A de `docs/plan-T16.md`).
- **Plan:** sin escribir.

### T18. Referencias cruzadas
- **Qué:** debajo de cada bobina, la lista de dónde están sus contactos (los que tienen su misma etiqueta).
- **Plan:** sin escribir.

### T19. Validaciones en vivo
- **Qué:** bornes sin conectar y cables sueltos, marcados en naranja.
- **Plan:** sin escribir.

## Pendientes que vienen de la fase 3
Siguen en `docs/plan-fase3.md`: los "Pendiente aparte" del principio y "UI y símbolos (después de T15)". Uno toca a T16: acelerar `Uniones` cuando llegue pegar (`docs/plan-fase3.md`, T14b). Está en los riesgos de `docs/plan-T16.md`.
