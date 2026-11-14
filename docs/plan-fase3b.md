# Plan fase 3b — Editor, segunda parte

Decidida el 2026-11-13 (Bruno): las cuatro funciones del editor que quedaron fuera del criterio de la fase 3 forman la fase 3b. Va después de la fase 3, cerrada con la versión 0.1.3, y antes de la fase 4.

Orden: T16 → T17 → T17b → T18 → T19.

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

**En la netbook, al cerrar la fase, junto con la prueba de la inversión** (decisión de Bruno, 2026-11-13; T16 no espera por esto):
- *Duplicar todo (2000)*: en la PC, en las condiciones de T15, tarda 42,5 ms de mediana y 55,8 de máximo; el tope es 150/300 ms. En la primera corrida, con la PC inestable, dio ~116 ms (`docs/plan-T16.md`, sección 9).
- La previa de pegar con `TOPE_PREVIA_PEGAR = 160`: en la netbook con Mint, unas 6 veces más lenta que la PC según T14a, la revisión por punto podría pasar los 16 ms. Verificarlo ahí. En la PC, toda la serie hasta 500 da p95 ≤ 5 ms, y el tope se revisa con lo que dé la netbook.
- **Desde T17** (`docs/plan-T17.md`, "Vigente para el cierre de la fase 3b"): *Duplicar todo (2000)* pasó justo en la PC contra `d969019` (59,35 y 59,79 ms) y *Pegar 500* suma de 0,55 a 0,9 ms. Medir las dos en la netbook, junto con el tope 160.

## Reglas
Las mismas de la fase 3:
- Una tarea por sesión. Primero el plan (`docs/plan-TNN.md`) y, con el "aprobado" de Bruno, el código.
- Al cerrar cada etapa: `npm test`, `npm run check` y commit local. Si hay algo visible en la app, también su humo `tests/humo/tNN-*.mjs`, y al cerrar la tarea `npm run humo` entero.
- Si la tarea toca el editor o el dibujo: banco contra `v0.1.3` en la PC, con el criterio fijado en el plan antes de medir. A la netbook se va solo si el banco da algo dudoso.
- **Topes de los escenarios que `v0.1.3` no tiene** (regla nueva de Bruno, 2026-11-14, desde T17): se fijan contra el commit anterior a la tarea, medido en la misma sesión con ABBA ×3 y dos tandas, no contra números de otro día. Un día la PC midió el mismo código hasta un 30 % más lento (T17, sección 4). La netbook, al cierre de la fase, sigue siendo la que decide.
- Sin push ni versión sin autorización de Bruno.

## Tareas

### T16. Copiar, cortar, pegar y duplicar
- **Qué:** Ctrl+C, Ctrl+X, Ctrl+V y Ctrl+D (también Mayús+Supr, Ctrl+Insert y Mayús+Insert). Un solo paso de deshacer y conflictos con la misma regla que Colocar.
- **Plan:** `docs/plan-T16.md`, aprobado el 2026-11-13.
- **Etapa 0 (docs):** hecha.
- **Etapa 1 (núcleo, `src/core/model/portapapeles.ts`):** hecha el 2026-11-13. Detalle en `docs/plan-T16.md`, sección 7.
- **Etapa 2 (editor: atajos, `HerramientaPegar`, Ctrl+D):** hecha el 2026-11-13. Detalle en `docs/plan-T16.md`, sección 8.
- **Etapa 3 (humo t16 y banco):** hecha el 2026-11-13. `TOPE_PREVIA_PEGAR` = 160 (limitado hasta la netbook), contra `v0.1.3` pasa salvo 2 celdas de 100 por resolución del reloj. Detalle en `docs/plan-T16.md`, sección 9, y en `docs/bench.md`.
- **Etapa 4 (cierre, solo docs):** hecha el 2026-11-13. Detalle en `docs/plan-T16.md`, sección 10.
- **T16 hecha el 2026-11-13.** La medición en la netbook queda para el cierre de la fase (arriba).

### T17. Etiquetado automático
- **Qué:** el segundo contactor que se coloca es K2, el tercer pulsador S3, etc. Lo pegado y lo duplicado se renumera solo si choca con la hoja, la bobina junto con sus contactos (reemplaza a D3-A de `docs/plan-T16.md`). Comando "Etiquetar los vacíos" y renombrado de bobina que arrastra a sus contactos.
- **Plan:** `docs/plan-T17.md`, aprobado el 2026-11-14.
- **Etapa 0 (docs):** hecha el 2026-11-14.
- **Etapa 1 (núcleo):** `prefijoEtiqueta` en el catálogo, `src/core/model/etiquetado.ts` y `CambiarEtiquetas`, con tests. Hecha el 2026-11-14.
- **Etapa 2 (editor y panel):** `src/editor/armarEtiquetas.ts`, Colocar y su previa, pegar y duplicar, "Etiquetar los vacíos" (botón del panel sin selección), renombrado con arrastre y las notas del panel. Hecha el 2026-11-14.
- **Etapa 3 (humo t17 y banco):** hecha el 2026-11-14. Humo t17 con 32 comprobaciones. *Etiquetar los vacíos* pasa sus topes fijos. Pegar 500 y Duplicar todo pasan con el criterio relativo a `d969019` (cambio de criterio de Bruno). Contra `v0.1.3`, 3 celdas sin editor quedan aceptadas como ruido. Detalle en `docs/plan-T17.md` (sección 4 y etapa 3) y en `docs/bench.md`.
- **Etapa 4 (cierre, solo docs):** hecha el 2026-11-14. Detalle en `docs/plan-T17.md` (etapa 4 y "Vigente para el cierre de la fase 3b").
- **T17 hecha el 2026-11-14.** Sigue T17b. Para la netbook, al cierre de la fase: Duplicar todo (2000), que pasó justo en la PC (59,35 y 59,79 ms), Pegar 500 y el tope 160 de la previa.

### T17b. Contacto auxiliar NC y `compararRedes`
Tarea corta, después de T17 y antes de T18 (decisión de Bruno, 2026-11-14). Sale de dos hallazgos al planear T17:
- **Contacto auxiliar NC:** no existe en la biblioteca, y el enclavamiento eléctrico del criterio de la fase lo necesita. Definición y test de bornes.
- **`compararRedes`:** hoy da por repetidos dos auxiliares NA de una misma bobina (misma etiqueta y mismo tipo), y con T17 un contacto nuevo queda sin etiqueta. Decidir cómo los compara.
- **Plan:** sin escribir.

### T18. Referencias cruzadas
- **Qué:** debajo de cada bobina, la lista de dónde están sus contactos (los que tienen su misma etiqueta).
- **Plan:** sin escribir.

### T19. Validaciones en vivo
- **Qué:** bornes sin conectar y cables sueltos, marcados en naranja.
- **Plan:** sin escribir.
- **Pendiente (de T16):** el naranja de la previa de pegar en conflicto (`--aviso`) choca con el naranja de las validaciones en vivo. Decidir cómo se distinguen.

## Pendientes que vienen de la fase 3
Siguen en `docs/plan-fase3.md`: los "Pendiente aparte" del principio y "UI y símbolos (después de T15)". Uno toca a T16: acelerar `Uniones` cuando llegue pegar (`docs/plan-fase3.md`, T14b). Está en los riesgos de `docs/plan-T16.md`.
