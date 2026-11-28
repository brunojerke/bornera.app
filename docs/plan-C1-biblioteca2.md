# Plan C1 de la biblioteca 2 — cierre

**Aprobado por Bruno el 2026-11-28** (D-C1-1 A, D-C1-2 A, con ajustes 1 a 3). Parte de `a4400f9`. Sin `.msi`, push, tag ni publicación.

## Alcance
- Base de circuito `biblioteca2` (`src/core/circuitos/biblioteca2.ts`): el circuito de la sección 0 de `plan-biblioteca2.md`. `npm run circuito` con `BORNERA_BASE=biblioteca2` pasa; `formato-v1/` abre igual.
- **D-C1-1 A:** `.brn` congelado (`tests/circuitos/biblioteca2.brn` + `.mjs` + test) y humo `c1-biblioteca2.mjs`.
- Prueba a mano: la hace Bruno.
- Docs: `arquitectura.md`, `ideas.md`, `bench.md`, notas (a) y (b) de la 0.1.7, C1 hecha en `plan-biblioteca2.md`.

## Medición (fijada antes de medir)
- **D-C1-2 A:** se mide primero, con el exe de A armado con el árbol limpio.
- A = exe de `a4400f9` (`0.1.6-c1a.1` solo en `package.json` durante el build, revertida; árbol limpio verificado). B = worktree temporal en `5f8a529` + cherry-pick de `8ad3886` (entró limpio, `6fe5600`), `npm ci`, `0.1.6-c1b.1`; se borra al cerrar.
- ABBA `probar-webview2.mjs --exe=A,B --fase6 --base-fase6`, 3 bloques, fría + caliente.
- Regla de `plan-T40.md`, sin cambios: B1–B16 D6b-C (B2 decide 1.º); F por tope; S1–S6 por tope y no regresión (S1 y S4 solo tope); P1 solo por tope (mediana ≤ 9,1; máx. ≤ 10,1; B dibuja 32); P2 A ≤ B + máx(1 ms, 10 %).
- `netlist-node` (3 procesos × 5 vueltas, orden A B B A): máx. de A ≤ B + máx(1 ms, 10 %); 5 ms solo informa. Frías informan.
- **Timeout o fila que falla:** se registra «no pasa» y se consulta a Bruno, sin repetir. Las reglas no se cambian después de medir.
- **Condiciones (ajuste 1):** enchufada, «Mejor rendimiento», LegionSpace en Performance; cerrados Administrador de tareas, Configuración, Edge y otras apps; LegionSpace y el overlay de NVIDIA abiertos (son de la base). Bruno confirma antes de medir.
- Supuesto: P2 y `netlist-node` suman T39 y T40 contra `5f8a529`; cada una pasó contra su base.

## Ajuste de dibujo (Bruno, 2026-11-28, después del ABBA)
Solo dibujo; ningún borne se movió (los `.brn` guardados no cambian; `formato-v1/` y `biblioteca2.brn` iguales). Criterio: nombre de borne contra contorno; medido con un script temporal (distancia de la caja del nombre al dibujo, reposo y accionado) y con capturas a zoom 100 %.
- **Motor de continua:** A1 y A2 pisaban el círculo (r 1,5). Círculo r 1; «M» de alto 0,8 y el signo de continua más arriba.
- **EV biestable:** B1 y B2 pisaban las vías. Campo nuevo `ladoNombre` en `Borne` (solo dibujo, gira con el símbolo): B1 y B2 a la derecha. El cable de la bobina corrida (accionada) iba en diagonal desde y ±1,6 y pisaba B1: ahora va en escuadra por y ±1 (también A1-A2 y la monoestable).
- **Conmutada:** los 5 nombres tocaban la caja (y ±1,2): caja de y −1 a 1.
- **Trafo trifásico:** 1U y 2U pisaban las diagonales, 1V y 2V casi tocaban el círculo: círculos r 1,15 (antes 1,3) y codos en y ±2,1 (antes ±2,4).
- Sin cambios: continua, variable, trafo mono, variac, diferencial 3P, sensores, presostato y termostato. El 11 del presostato y del termostato NC queda a 0,14 de la cuchilla abierta: es la geometría del final de carrera NC (y del 95-96), que ya existía.
- Sin ABBA nuevo: el exe medido no lo incluye (anotado en `bench.md`).
- **Test permanente** `src/render/rotulos.test.ts` (Bruno): en los 49, reposo y accionado, ningún nombre a menos de 0,1 de grilla de una primitiva. Seis excepciones con nombre, de la 0.1.6 (termomagnéticas 1P a 4P, guardamotor, motor trifásico); el test falla si una deja de fallar. Su arreglo, pendiente antes de la 0.1.7 (`ideas.md`).
- `ladoNombre` no va al `.brn`: el archivo guarda por componente `id`, `tipo`, `x`, `y`, `rot`, `espejado`, `etiqueta` y `params`; `src/core/io` no lee la definición.
- Prueba a mano (Bruno, 2026-11-28): pasa (clic en B1 enciende K1, Y1 y M1; mantener B2 los apaga; sin avisos). `npm run circuito` sobre su `pruebac1.brn` contra `biblioteca2`: misma partición (10 redes, 23 bornes).

## Ajuste 3 (`ideas.md`)
- Antes de la 0.1.7: los «ocios cortos» en WebView2 (copias por partes de unos 5 s, vistos en T40): causa y si necesita plazo propio.
- 6b: un sensor PNP real es de continua; hoy anda con alterna porque el motor no distingue AC de DC.
