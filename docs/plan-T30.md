# Plan T30 — Motor de simulación (fase 5)

Aprobado por Bruno el 2026-11-21 con M1-B, M2-A, M3-A, M4-A y M5-A, más 7 ajustes. Manda `docs/plan-fase5.md` (sección 2, D2-B, D3-A, D4-A, D7-C, D10-A). Usa la netlist de T28 (`src/core/sim/netlist.ts`).

## Alcance
- `src/core/sim/motor.ts`, puro y sin DOM: entrar, pulsar y soltar (uno o varios a la vez). No cambia el documento.
- Estado: pulsadores apretados y bobinas con tensión (una por etiqueta, D2-B). Salida: contactos que conducen, cargas encendidas, potencial de cada red (para D9), avisos y si se detuvo.
- **Entrar (D4-A):** `entrarSimulacion(hoja)` no entra si hay errores (R4 con una bobina, una lámpara o un símbolo desconocido) y los devuelve. Respaldo, si igual llegan dos bobinas con la misma etiqueta: la etiqueta tiene tensión si cualquiera la tiene.
- La app no usa el motor hasta T32.

## Criterio
- **Conduce:** el pulsador NA apretado o el NC suelto; el auxiliar según la bobina de su etiqueta (sin bobina, en reposo); el térmico, en reposo.
- **Grupos:** las redes unidas por los contactos que conducen, rehechos de cero en cada iteración (M3-A).
- **Carga encendida:** un potencial en cada borne, distintos y al menos uno fase. Dos neutros de distinto nombre: apagada.
- **Corto:** un grupo con dos potenciales o más (incluye el de cables al entrar, D10-A; igual que la netlist, también entre dos neutros distintos). Se detiene en el estado en que aparece, con la bobina ya cambiada, y marca sus redes (M2-A).
- **Iteración (D2-B):** de las bobinas que tienen que cambiar, cambia la de etiqueta menor en orden natural (K2 antes que K10). Si al recalcular otra de esa lista ya no tiene que cambiar: «Carrera entre K1 y K2».
- **Oscilación:** un estado de bobinas repetido. Se detiene y marca las bobinas que cambian en el ciclo: «Oscila: K1».
- **Tope:** 2 × bobinas + 50 cambios (se inyecta en los tests). Al llegar sin repetir: «No se estabilizó en N pasos», distinto de «Oscila» (ajuste 5).
- **Detenido (D3-A):** pulsar y soltar no hacen nada hasta salir.
- **Cargas en serie (M1-B):** en un estado estable, un grupo sin potencial cuyos bornes son solo de cargas (dos o más; los contactos que conducen no cuentan), con los otros bornes de esas cargas en dos potenciales distintos (L–H1–X–K1–N).
- **Avisos una vez (ajuste 4):** carrera por par y cargas en serie por grupo, una sola vez en cada entrada a Simular, no en cada pulsación.

## Carrera de tres bobinas: resultado esperado (ajuste 2, escrito antes de programar)
- **Caso A, tres enclavadas con un pulsador común** (S1 alimenta las tres ramas; cada rama tiene el NC de las otras dos). Al pulsar S1 cambian las tres. Cambia K1; K2 y K3 ya no. Avisos «Carrera entre K1 y K2» y «Carrera entre K1 y K3». Queda K1 con tensión; K2 y K3 sin. No se detiene. Al soltar, K1 cae sin avisos. Al volver a pulsar, el mismo estado y ningún aviso nuevo.
- **Caso B, la carrera pasa por una tercera** (S1 alimenta K1 y K3; un NA de K1 alimenta K2; la rama de K2 tiene un NC de K3 y la de K3 un NC de K2). Al pulsar cambian K1 y K3. Cambia K1 y K3 sigue. Después cambian K2 y K3; cambia K2 y K3 ya no. Aviso «Carrera entre K2 y K3», no «entre K1 y K3». Quedan K1 y K2; K3 sin. Es el límite del criterio: el par avisado es el del paso en que se pierde el cambio.

## Pasos
1. `motor.ts`: recálculo, iteración, detenciones, avisos y textos.
2. Cálculo lento de referencia en `src/core/sim/prueba-motor.ts`: recorre las redes una por una, sin union-find.
3. `motor.test.ts`:
   - marcha-parada (S2 arranca, al soltar retiene, S1 para)
   - inversión: enclavamiento, y S1 y S2 apretados a la vez dan «Carrera entre K1 y K2» (ajuste 3)
   - 380 V entre L1 y L2; la misma fase apagada; un borne sin potencial; un auxiliar sin bobina
   - casos A y B de tres bobinas; oscilación al entrar; corto por cables al entrar; corto por contacto al pulsar; tope chico en la cadena
   - R4: dos bobinas con la misma etiqueta no dejan entrar (ajuste 1); el respaldo
   - los avisos una vez por entrada; el mismo resultado dos veces; `serializar` igual después de entrar, pulsar, soltar y salir
4. Motor contra el cálculo lento en unos 200 circuitos chicos al azar, semilla fija, con pulsaciones al azar (ajuste 7).
5. `.brn` nuevos (M4-A): `src/core/circuitos/sim.ts` con oscilante, corto (por contacto, M5-A), carrera y cadena (K1 a K5); `tests/circuitos/sim.mjs` los congela; `tests/circuitos/sim.test.ts` los abre y los simula.
6. Humo `t30-brn-sim.mjs`: los cuatro `.brn` abren en la app real sin errores.
7. Tiempo (ajuste 6): el motor no lee el reloj, así que no hay topes con reloj real en `npm test`. Se comprueba que el motor no entra en el build de la app (`npm run build`, sin rastros del motor en `build/`). Si entra, ABBA en WebView2 contra `195ea55` con piso de 1 ms.
8. Cierre con `bornera-cierre`, commit local, sin push.

## Riesgos
- El criterio de carrera también avisa cuando solo una bobina enclava a la otra.
- Costo con 2000 símbolos: iteraciones × redes. Se mide en S1–S5 (T31).
