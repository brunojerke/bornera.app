# Plan fase 5 — Simulación de mando

Aprobado por Bruno el 2026-11-20, con sus ajustes. Donde difiere de «Motor de simulación» (`docs/arquitectura.md`), manda este plan; arquitectura se pone al día en C5.

## 0. Estado y alcance
- `main` = `origin/main` = `7ed51e4`, árbol limpio. Fase 4 cerrada; `v0.1.4` publicada.
- **Alcance:** simular el mando (pulsar y soltar, bobinas que cambian sus contactos por etiqueta, lámparas, autorretención y enclavamiento), conexiones aparentes, etiquetas de red en la netlist y aviso de L junto con L1, L2 o L3.
- **Pasa cuando** (hoja de ruta): la marcha-parada con enclavamiento funciona y su test pasa: un test del núcleo pulsa y suelta sobre `marcha-parada.brn` e `inversion.brn` y mira bobinas y lámparas; también el humo de T32 y la netbook.
- **Fuera:** CC, interruptor, fusible, trifásica y motores (fase 6); tensión incorrecta. **Térmico y temporizadores:** la biblioteca no los tiene (`termico` es solo un tipo de accionamiento), así que quedan fuera. Un símbolo desconocido no conduce ni es carga.

## 1. Tareas
Una por sesión; cierran con `bornera-cierre` (y banco si tocan `sim/` o el dibujo).

| Tarea | Qué | Opus |
|---|---|---|
| T28 | **Primero**, un test temporal pasa `problemasTrazado` y `problemasComponente` por el corpus `formato-v1/` y los `.brn` de referencia: si hay aparentes, se frena y se avisa a Bruno. Después, netlist en `src/core/sim/`: etiquetas de red, borne → red y potencial (D7). Plan aprobado: `docs/plan-T28.md` (≤ 5 ms PC, ≤ 27,5 ms netbook). **Cerrada** (2026-11-20, `ced57c7`): netlist funcional y probada. Presupuesto propio en la PC **NO PASÓ** (5,64 y 6,71 ms de máximo): tope absoluto sin ABBA, con un ruido mayor que la parte propia (`redes()`, sin cambios, varió de 2,49 a 3,89 ms de máximo). No se cambia el tope ni se vuelve a medir. Netbook (27,5 ms): **PENDIENTE**, no corrida | xhigh |
| T29 | R10 (L junto con L1, L2 o L3) y R11 (conexiones aparentes, D6), avisos. **R11-A** (Bruno, 2026-11-20): R11 no avisa encimados entre cables que ya están en la misma red (`cables-t-libres`: w4 en T sobre w3 y encimado); el corpus no se toca. Plan aprobado: `docs/plan-T29.md` (I-A, M-A, L-A, T-A, H-A; ABBA contra `b6dbeee`) | alto |
| T30 | Motor en `src/core/sim/`: recálculo (D2), carreras, oscilación y corto (D3), cargas en serie. Tests del criterio; `serializar` igual antes y después de simular. `.brn` nuevos: oscilante, corto, carrera y cadena | xhigh |
| T31 | Banco: escena de mando 2000, S1–S5, «Probar la fase 5» y `--fase5` en `probar-webview2.mjs` (S1 y S4 completas en T33). **Netlist (Bruno, 2026-11-20):** se controla dentro de S1 (54,5 ms PC / 300 ms netbook), con ABBA y en condiciones de banco (enchufada, «Mejor rendimiento», apps cerradas). Si S1 no pasa, la primera candidata es el stash de T28 («T28 optimizacion sin mejora medible»: clave natural una vez por etiqueta, mapa borne → red sin copiar, cada símbolo buscado una vez) | alto |
| T32 | Modo Simular: entrar (D4), pulsar y soltar (D5), bloqueos, salir y avisos. Humo `t32-simular.mjs` con el criterio y la prueba: abrir un `.brn`, entrar, pulsar, soltar y salir lo deja byte a byte igual, sin «•» | alto |
| T33 | Dibujo del estado (D8, D9). Humo con capturas; S1 y S4 en la PC | alto |

**Cierre:** C1 «Probar la fase 5» en la PC, ABBA contra `7ed51e4` (Opus alto). C2 `0.1.5-alpha.N` y `docs/netbook-fase5.md` (Opus alto). C3 netbook y PC el mismo día (Sonnet). C4 `0.1.5` y fila 6 (Opus alto). C5 docs y Obsidian (Sonnet).

## 2. Modelo de simulación
- **Entrar:** la netlist se arma una vez: redes por cables más etiquetas de red. Arranca en reposo.
- **Estado:** pulsadores apretados y bobinas con tensión. No es documento: sin Comandos, ni `.brn`, ni historial, ni autoguardado.
- **Potencial** (D7): papel del símbolo más nombre. Fase «L1» y Fase «L2» son distintos; Fase «N» y Neutro «N», también.
- **Recálculo**, con cada pulsar o soltar (nunca en bucle):
  1. Cada contacto que conduce une sus dos redes: el pulsador por su estado, el auxiliar por la bobina de su etiqueta (sin bobina, en reposo). Las cargas no unen.
  2. Cada grupo recibe los potenciales de sus fuentes. **Cortocircuito:** un conductor sin carga une dos potenciales distintos.
  3. Una carga se enciende si sus dos bornes tienen potenciales distintos: fase y neutro, o dos fases (una bobina de 380 V entre L1 y L2). La misma fase en los dos, o un borne sin potencial: apagada. Si su otro borne solo llega a cargas: aviso «cargas en serie».
  4. Cambia una bobina (D2) y vuelta a 1.
- **Carrera:** si van a cambiar varias y, al cambiar la primera, otra ya no cambia, el resultado depende del orden. Queda el de la etiqueta menor y avisa «carrera entre K1 y K2».
- **Estable:** ninguna bobina cambia. **Tope:** 2 × bobinas + 50 iteraciones. Antes, si un estado se repite, es oscilación (el motor es determinista: repetir es un ciclo).
- **Si oscila o hay corto** (D3): se detiene en el último estado, marca lo que cambia o la red en corto y avisa en la barra.
- **Bloqueado:** lo que cambia el documento: herramientas, panel, deshacer, rehacer, cortar, pegar, borrar, etiquetar, Nuevo, Abrir, recientes, Recuperar y escenas del banco. **Sigue:** zoom, desplazar, Guardar, Exportar y cerrar.
- **Salir:** F5 o «Editar», también con algo apretado. El estado se descarta; el documento queda igual, sin «•».

## 3. Banco
Topes de la netbook fijados acá, antes de medir. PC = netbook / K, con K1 = 3 y K2 = 5,5 (D1); si da < 1 ms, 1 ms (resolución, lección de B14).

| # | Qué | Netbook | PC | K |
|---|---|---|---|---|
| S1 | Entrar a Simular, escena de mando 2000 al 31 %, hasta el cuadro nítido; máx. de 5 vueltas | ≤ 300 ms | ≤ 54,5 | K2 |
| S2 | Pulsar y soltar una marcha-parada de esa escena, sin dibujo; mediana / máx. de 20 | ≤ 5 / 16 ms | ≤ 1,7 / 5,3 | K1 |
| S3 | Cadena de 100 relés en esa escena: de pulsar a que entran los 100, sin dibujo; máx. | ≤ 50 ms | ≤ 16,7 | K1 |
| S4 | Pulsar con dibujo al 31 %: máx. de cuadro / por gesto hasta nítido | ≤ 33 / 100 ms | ≤ 6,0 / 18,2 | K2 |
| S5 | R11 en la hoja entera (escena de F1–F3: 2000 + 3030 cables); máx. | ≤ 300 ms | ≤ 100,0 | K1 |

- **B10 y B14:** topes sin cambios (los de la 3b; B10 informativa en la netbook). Por el ×6,2 de B10, si S1 pasa de 48 ms en la PC (300 / 6,2), se avisa antes de la netbook. De B14 sale el piso de 1 ms.
- **Escena de mando 2000:** marcha-paradas repetidas más una cadena de 100 relés, con sus cables (T31).
- **Juicio:** el máximo de cada corrida caliente ≤ tope: PC en C1, netbook en C3 (las 3). Las frías informan (regla de C4, fase 4). Si una fila falla en la PC, se frena y se consulta, sin volver a medir.
- **No regresión:** B1–B16 con D6b-C (ABBA contra `7ed51e4`, medianas calientes, ≤ 1 ms o ≤ 10 %, lentos ±1, B9 mismo escalón). F1–F3 con sus topes (PC 9 ms, 1 s, 1 s; netbook 50 ms, 1 s, 3 s). R11 en vivo entra en B1, B4, B13 y quizá F3.
- K no se recalcula; se anotan los cocientes de S1–S5.

## 4. Netbook (cierre, `.msi` del borrador)
| # | Paso | Pasa si |
|---|---|---|
| 0 | Instalar el `.msi` de `0.1.5-alpha.N` encima de la 0.1.4 | Una sola «Bornera», alpha.N |
| 1 | «Probar la fase 5»: 3 aperturas × (fría + caliente), «Copiar» cada vez; la PC el mismo día | S1–S5 ≤ tope en las 3 calientes; B y F, regla vigente |
| 2 | Doble clic en `marcha-parada.brn`, F5. Mantener S1 y soltar; mantener S0 y soltar; F5 | Con S1 entran K1 y H1 y siguen al soltar; con S0 se apagan y siguen así. Sin «•» |
| 3 | `inversion.brn`, F5: S1; mantener S2; S0; S2 | K1 entra; con K1, K2 no entra; S0 apaga; con S2 entra K2 y K1 no |
| 4 | `oscilante.brn`, `corto.brn` y `carrera.brn` (T30), F5 y pulsar | Avisa en cada uno; los dos primeros se detienen; F5 sale |
| 5 | `avisos-fase5.brn` (T29), F5 | El contador muestra R10 y R11, y F5 entra igual |
| 6 | `.msi` de `0.1.5` encima de la alpha | Una sola «Bornera», 0.1.5; recientes siguen |

## 5. Decisiones (Bruno, 2026-11-20)
| # | Elegida | Qué |
|---|---|---|
| D1 | D | K1 = 3 y K2 = 5,5 para los topes de la PC (sección 3) |
| D2 | B, con aviso | De a una bobina, la de etiqueta menor primero (K1, K2, K10); las carreras se avisan (sección 2) |
| D3 | A | Oscila o hay corto: se detiene en el último estado, marca y avisa; los pulsadores no responden hasta salir |
| D4 | A | Solo los errores impiden entrar: F5 dice cuáles y queda en Editar. Los avisos (R1–R3, R5–R11 y R4 entre pulsadores) no. **Errores:** R4 cuando el grupo de la etiqueta repetida tiene una bobina, una lámpara o un símbolo desconocido. La fase 5 no suma errores (D10-A) |
| D5 | B | Mantener el botón del mouse; vuelve al soltarlo en cualquier lado o al perder la ventana. Mayús+clic lo deja apretado hasta otro clic |
| D6 | A | R11, aviso en vivo e incremental, como R1–R9 |
| D7 | C | El símbolo da el papel y la etiqueta el nombre (sección 2). Una Fase «X» es otra fase: entre L y X una carga se enciende, y unirlas es corto |
| D8 | A | Capa estática, invalidando solo la región que cambió |
| D9 | B | Cables por potencial, cargas encendidas y contactos dibujados en su estado |
| D10 | A | Corto por cables (sin contactos de por medio): lo detecta el motor al entrar a Simular, se detiene y avisa (D3). Sin costo mientras se edita |

**Descartadas:** D1-A, el medido: flojo con dibujo (S1 de 111 ms en la PC ≈ 690 en la netbook). D2-A, oscilación falsa entre enclavadas; D2-C, dos caminos. D3-B y C, no se ve bien el estado. D4-B, un modo que no simula; D4-C, engaña. D5-A, no prueba dos a la vez; D5-C, es un interruptor. D6-B, queda viejo; D6-C, bloquea algo que simula. D7-A y B, otro nombre sin potencial o error. D8-B, repinta 3030 cables por cuadro; D8-C, memoria. D9-A y C, sin contactos o sin cables.

**D10, corto por cables: elegida A (Bruno, 2026-11-20).** T19 dejó para la fase 5 su «R10»: Fase y Neutro, o dos fases, en la misma red por cables, sin contactos. R10 y R11 de este plan son números nuevos.
- A. Solo al entrar: el motor lo ve en reposo, se detiene y avisa (D3) ★. Pro: sin costo al editar. Contra: se ve recién al simular.
- B. Regla en vivo, error. Pro: se ve al cablear. Contra: `redes()` en cada comando de cable (1,1–1,6 ms con 2000 en la PC, T19).
- C. Regla en vivo, aviso. Contra: el mismo costo, y al entrar igual se detiene.

## 6. Verificado, supuesto y riesgos
- **Verificado (2026-11-20):** git y `v0.1.4`. `redes` ya une por nombre. 8 símbolos, sin interruptor, CC, térmico ni temporizador. Simular es una cáscara (F5, panel solo lectura, sin herramientas, deshacer ni Abrir). R4 es el único error. `src/core/sim/` vacío.
- **Verificado (T28, paso 1):** corpus `formato-v1/`, `marcha-parada.brn`, `inversion.brn`, `tildes.brn` y los generados (`marchaParada()` con y sin `dosNeutros` o `ramaNC`, `inversion()`): 0 aparentes entre redes distintas; 1 en la misma red (R11-A).
- **Verificado (T28):** la netlist une por papel + nombre (D7) y marca el corto por cables sin error (D10-A); su presupuesto propio de 5 ms en la PC no pasó (ver T28). Pasa a controlarse dentro de S1 (T31).
- **Supuesto:** que la netlist entra en S1 y R11 de 2000 en S5.
- **Riesgos:** S1 dominado por el redibujo (D8-A pinta solo lo que tiene tensión). R11 en vivo sube B1 o B4 (se consulta). Una carrera de tres bobinas puede escapar al criterio (`carrera.brn`). WebKitGTK, secundario.
- **Sesiones:** 11 a 12 (T30 quizá 2).
- **Con autorización de Bruno:** push, tags `v0.1.5-alpha.N` y `v0.1.5`, publicar y dependencias (ninguna prevista).
