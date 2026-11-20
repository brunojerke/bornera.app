# Plan T29 — Avisos R10 y R11 (fase 5)

Aprobado por Bruno el 2026-11-20 con I-A, M-A, L-A, T-A y H-A, más 5 ajustes. Manda `docs/plan-fase5.md` (T29, D4, D6, D7, D10-A, R11-A).

## Alcance
- **R10** (aviso): una Fase con etiqueta normalizada «L» y otra Fase con «L1», «L2» o «L3» en la hoja. Compara etiquetas normalizadas («l1» cuenta como «L1»). Marca cada Fase «L» (L-A).
- **R11** (aviso): conexión aparente que ya está en la hoja (las mismas de `problemasTrazado` y `problemasComponente`). Marca los dos elementos del par (M-A). **R11-A:** no avisa un encimado entre dos cables de la misma red. El corpus no se toca.
- Ninguno impide entrar a Simular (D4). La fase 5 no suma errores.

## Misma red sin `redes()` de la hoja (ajuste 1)
- **En vivo (`avisosHoja`):** desde uno de los dos cables se recorre su red con la vecindad que ya mantiene el editor para R6 (`r6Local`): los extremos hacia un borne o un cable, los cables colgados en T y los cables del mismo borne. Es la semántica de `redes()` sin `unirPorNombre`. Corta al llegar al otro cable. Cuesta lo que la red de ese cable, no la hoja, y solo corre si hay un encimado cable–cable.
- **Hoja entera (`validar`, al abrir):** `redes()` una sola vez y solo si apareció algún encimado cable–cable.
- La misma red es por cables, sin uniones por nombre: la opción conservadora, que calla menos.

## Pasos
1. Verificar sin código: el índice (`ConsultaEscena`) ya está al día cuando corre `reflejar`; pegar y duplicar no revisan lo que choca dentro del recorte (verificado: `problemasPegado`); cuánto tarda R11 en la hoja entera (2000 + 3030 cables) en Node. Test temporal, se borra.
2. R10 en `validaciones.ts`, con sus tests.
3. R11 en el núcleo: `aparentes(hoja, consulta)` con claves sin repetir y R11-A. Tests: el corpus y los `.brn` de referencia dan 0; `cables-t-libres` da 0.
4. `avisosHoja`: R10 por el camino de las etiquetas; R11 en vivo (I-A), con los componentes y cables del cambio más los ya marcados, cruzados contra el resto con el índice espacial existente, nunca todos contra todos (ajuste 2).
5. Interfaz: texto, panel y anillo. F5 entra con R10 y R11.
6. Humo `t29-avisos.mjs` (ajuste 4): abrir un `.brn` con un encimado da R11; mover para sacarlo lo quita; deshacer lo muestra y rehacer lo saca; copiar el par encimado y pegarlo marca la copia; R10 con «L» y «l1»; F5 entra.
7. Banco ABBA (abajo).
8. Cierre con `bornera-cierre`, commit local, sin push.

## Banco (fijado antes de medir)
- **Filas que toca R11:** B1–B6, B10–B14 y B16 (ejecutan un comando).
- **Filas de control:** B7, B8 y B9 (previa de pegar, sin comando) y B15 (encuadrar).
- **Medición:** `node tests/bench/probar-webview2.mjs --exe=A,B`, 3 bloques × (fría + caliente). A = T29; B = `b6dbeee`, compilado en un worktree temporal sin el stash. Los dos con `npm run tauri build -- --no-bundle`. La PC, en la misma sesión, enchufada, «Mejor rendimiento», apps cerradas y sin otra Bornera.
- **Topes (T-A):** en las calientes, A − B ≤ máx(1 ms, 10 %) en mediana y máximo de B1, B2, B4, B5, B10, B12, B13 y B16. El piso de ruido es 1 ms. Cuadros (B3, B6, B11, B14): lentos ±1. B9: mismo escalón. Las frías informan.
- **Ruido (ajuste 3):** si una fila de control sale de la regla, se repite el ABBA entero una sola vez. Si vuelve a salir, se frena y se consulta.
- **Si una fila tocada no pasa:** se frena y se consulta. El tope no cambia.
- **Hoja entera (H-A):** informativa en Node; el juicio queda para S5 (T31), con ABBA.
- Netbook: fuera de T29, pendiente.

## Riesgos
- B1 (duplicar 2000) y B4 (pegar 500) hacen trabajo nuevo proporcional al cambio.
- Una red muy grande hace caro el recorrido de R11-A, pero solo cuando hay un encimado cable–cable.
