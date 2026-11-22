# Netbook con Windows — cierre de la fase 5

Para imprimir. Plan: `docs/plan-fase5.md`, secciones 3 y 4 (C2 arma esta hoja; C3 es el día de la netbook). Cada fila tiene su **«Pasa si»**. Los topes son los de la **netbook**, no los de la PC.

Versión instalada: `0.1.5-alpha.____` · Fecha: ________ · Hora de inicio: ________

> **Ojo: el mismo día, en la PC.** Los cocientes netbook / PC de S1–S5 solo valen si la PC se mide **el mismo día**, con **el mismo instalador** (`.msi` del mismo tag), **el mismo protocolo** (3 aperturas × fría + caliente) y en las condiciones del banco. Ver «La PC el mismo día», al final.

## Antes de empezar
1. ☐ Netbook **enchufada**.
2. ☐ Modo de energía en **«Mejor rendimiento»** (Configuración › Sistema › Energía).
3. ☐ Cerrar todas las otras apps.
4. ☐ En el pendrive, de `tests/circuitos/` del repo: `marcha-parada.brn`, `inversion.brn`, `oscilante.brn`, `corto.brn`, `carrera.brn` y `avisos-fase5.brn`. Y esta hoja.
5. ☐ Crear en el pendrive una carpeta `fase5` para los textos de «Copiar».

## Fila 0. Instalar la alpha.N encima de la 0.1.4

> **El instalador sale del borrador.** El `.msi` lo arma `release.yml` en GitHub, en un **borrador** (no es público), recién cuando se sube el tag `v0.1.5-alpha.N`. El tag y su push los hago yo **solo con tu autorización escrita** (etapa C3). Sin ese paso, no hay `.msi` para bajar.

**Regla:** la 0.1.4 se instaló con el `.msi`, así que esta también va con el `.msi`. Mezclar `.msi` con el instalador `.exe` (NSIS) deja dos «Bornera».

1. En GitHub, en el repo de Bornera: **Releases**. El borrador dice «Draft» y se llama `v0.1.5-alpha.N`.
2. Abrir el borrador. En **Assets**, bajar el archivo que termina en **`.msi`** y copiarlo al pendrive.
3. En la netbook, **sin desinstalar** la 0.1.4, doble clic en el `.msi`.
4. Si Windows muestra «Windows protegió su PC» (SmartScreen): **«Más información»** y después **«Ejecutar de todas formas»**.
5. Seguir el instalador hasta el final.
6. Configuración › Aplicaciones › Aplicaciones instaladas: buscar «Bornera».
7. Abrir Bornera y mirar la versión.

| ☐ | Pasa si |
|---|---|
| ☐ | Hay **una sola** «Bornera» en la lista, y la app muestra la versión `0.1.5-alpha.N` |

## Fila 1. «Probar la fase 5» (3 aperturas × fría + caliente)

Cada **apertura** es abrir Bornera, correr la prueba dos veces y cerrarla. La **1.ª corrida** es **fría** (incluye el calentamiento y tarda más). La **2.ª** es **caliente**: la que decide.

Pasos (repetir en las aperturas 1, 2 y 3; en los nombres, el número es el de la apertura):
1. Abrir Bornera. Si aparece «Bornera no se cerró bien», elegir **Descartar**.
2. En **Editar** (no en Simular): menú de desarrollo (la llave) › «Cierre de fase» › **«Probar la fase 5…»**. No tocar nada mientras corre.
3. Al terminar sale el diálogo con la tabla (B1–B16, F1–F3 y S1–S5). Clic en **«Copiar»**.
4. Pegar en el Bloc de notas y guardar en el pendrive como `fase5\n1-fria.txt` (`n2-`, `n3-`). Cerrar el diálogo.
5. Otra vez «Probar la fase 5…», «Copiar» y guardar como `fase5\n1-caliente.txt` (`n2-`, `n3-`).
6. Cerrar Bornera con la X.

| Apertura | Fría guardada | Caliente guardada |
|---|---|---|
| 1 | ☐ `n1-fria.txt` | ☐ `n1-caliente.txt` |
| 2 | ☐ `n2-fria.txt` | ☐ `n2-caliente.txt` |
| 3 | ☐ `n3-fria.txt` | ☐ `n3-caliente.txt` |

**Cómo se juzga:**
- **S1–S5:** cada valor (cada número, en S2 y S4) se toma de las 3 calientes. Pasa si la **mediana de las 3 ≤ tope** y el **máximo ≤ tope + máx(1 ms, 10 %)**. La tabla de la app dice «pasa» o «no pasa» por corrida; esta hoja juzga las 3 juntas.
- **F1–F3:** el máximo dentro del tope en las 3 calientes.
- **B1–B16:** la mediana de cada corrida contra los topes de la 3b (`docs/netbook-fase3b.md`, sección B). B10 solo informa.
- **Las frías:** solo informan (regla de C4 de la fase 4: dentro del rango de las calientes del mismo día más 1 ms).

| # | Qué mide | Tope | Máx. admitido | Cal. 1 | Cal. 2 | Cal. 3 | ☐ |
|---|---|---|---|---|---|---|---|
| S1 | Entrar a Simular, mando 2000 al 31 %, hasta nítido (máx. de 5) | 300 ms | 330 ms | | | | ☐ |
| S2 | Pulsar y soltar una marcha-parada, sin dibujo (mediana / máx. de 20) | 5 / 16 ms | 6 / 17,6 ms | | | | ☐ |
| S3 | Cadena de 100 relés, sin dibujo (máx.) | 50 ms | 55 ms | | | | ☐ |
| S4 | Pulsar con dibujo al 31 % (máx. de cuadro / por gesto) | 33 / 100 ms | 36,3 / 110 ms | | | | ☐ |
| S5 | R11 en la hoja entera, 2000 + 3030 cables (máx.) | 300 ms | 330 ms | | | | ☐ |
| F1 | Copia de recuperación, parte síncrona (máx.) | 50 ms | — | | | | ☐ las 3 |
| F2 | Guardar 2000 (máx. de 5) | 1 s | — | | | | ☐ las 3 |
| F3 | Abrir 2000 hasta el primer cuadro (máx. de 5) | 3 s | — | | | | ☐ las 3 |
| B1–B16 | Filas de la 3b | las de la 3b | — | | | | ☐ |

También: ☐ el encabezado de la tabla dice **«con disco»** (si dice «sin disco», anotarlo: no es la app instalada).

## Filas 2 a 5. Simular (T29–T33)

En Simular: **mantener apretado** el botón del mouse sobre un pulsador lo acciona hasta soltarlo; **Mayús+clic** lo deja fijado hasta otro clic. Una carga prendida y una bobina con tensión se ven **rellenas**; los contactos, en su estado.

### Fila 2. Marcha-parada
1. Doble clic en `marcha-parada.brn`. **F5**.
2. Mantener **S1** y soltar. Mantener **S0** y soltar. **F5**.

| ☐ | Pasa si |
|---|---|
| ☐ | Con S1 entran **K1** y **H1**, y siguen al soltar (autorretención) |
| ☐ | Con S0 se apagan, y siguen apagados al soltar |
| ☐ | Al salir con F5, el título **no** tiene «•» |

### Fila 2b. Perder la ventana (Alt+Tab)
1. En `marcha-parada.brn`, **F5**. **Mayús+clic en S1**: queda fijado; entran K1 y H1.
2. **Mantener** el botón del mouse sobre **S0** (K1 y H1 se apagan) y, **sin soltarlo**, **Alt+Tab** a otra ventana. Soltar el mouse ahí.
3. Volver a Bornera con Alt+Tab y mirar.
4. Clic en **S1** (lo desfija). **F5**.

| ☐ | Pasa si |
|---|---|
| ☐ | Al pasar a la otra ventana, **S0 se suelta**: K1 y H1 vuelven a entrar |
| ☐ | **S1 sigue fijado** (accionado) al volver |
| ☐ | Al salir con F5, sin «•» |

### Fila 3. Inversión
1. Abrir `inversion.brn`. **F5**.
2. Mantener **S1** y soltar. Mantener **S2** y soltar. Mantener **S0** y soltar. Mantener **S2** y soltar. **F5**.

| ☐ | Pasa si |
|---|---|
| ☐ | Con S1 entra **K1** (H1) |
| ☐ | Con K1 adentro, S2 **no** hace entrar a K2 |
| ☐ | S0 apaga todo |
| ☐ | Después, con S2 entra **K2** (H2) y K1 no. Sin «•» al salir |

### Fila 4. Oscilante, corto y carrera (T30)
1. `oscilante.brn`: **F5**. Mirar la barra. **F5**.
2. `corto.brn`: **F5** (H1 prendida). Mantener **S1**. Mirar la barra. **F5**.
3. `carrera.brn`: **F5**. Mantener **S1** y soltar. Mirar la barra. **F5**.

| ☐ | Pasa si |
|---|---|
| ☐ | Oscilante: al entrar avisa **«Oscila: K1»**, queda detenido y marcado |
| ☐ | Corto: al pulsar avisa **«Cortocircuito entre L y N»** y queda detenido |
| ☐ | Carrera: avisa **«Carrera entre K1 y K2»**, queda K1 y no se detiene |
| ☐ | En los tres, F5 sale |

### Fila 5. Avisos R10 y R11 (T29)
1. Abrir `avisos-fase5.brn`. Esperar a que aparezcan los avisos (R11 se calcula en reposo, al terminar de abrir).
2. **F5**. **F5**.

| ☐ | Pasa si |
|---|---|
| ☐ | El contador de avisos muestra **R10** (Fase «L» junto a «l1») y **R11** (las lámparas con un cable encima) |
| ☐ | F5 entra igual (son avisos, no errores) y vuelve a salir |

## Fila 6. La 0.1.5 final (otro día, etapa C4)
**No se hace hoy.** Va cuando exista el borrador de `v0.1.5`.
1. Bajar el `.msi` del borrador de `v0.1.5`, igual que en la fila 0.
2. Instalarlo **encima** de la alpha.N, sin desinstalar.

| ☐ | Pasa si |
|---|---|
| ☐ | Una sola «Bornera», versión `0.1.5`, y la lista de recientes sigue |

## Al terminar
1. ☐ Abrir Bornera. Si aparece «Bornera no se cerró bien», **Descartar** en cada copia que quede. Cerrar.
2. ☐ Llevar de vuelta la carpeta `fase5` con los **6 textos** y esta hoja con lo anotado.

## La PC el mismo día

> **Destacado.** En la PC, el mismo día que la netbook, con el **`.msi` del mismo tag** instalado, **el mismo protocolo** (3 aperturas × fría + caliente) y en las condiciones del banco: **enchufada, «Mejor rendimiento», apps cerradas, sin otra Bornera abierta**.

1. Instalar el mismo `.msi` (fila 0, pasos 3 a 7).
2. Hacer la fila 1 entera, guardando en `C:\Users\jerke\Downloads\fase5-pc\` como `p1-fria.txt` … `p3-caliente.txt` (fuera del repo).
3. Copiar la carpeta `fase5` del pendrive a `C:\Users\jerke\Downloads\fase5\`.
4. Pasarme las dos carpetas. K **no** se recalcula (D1-D: K1 = 3, K2 = 5,5); en C3 anoto los cocientes netbook / PC de S1–S5.

## Resultados (para pasarme)
- Fila 0: versión ________ · una sola Bornera ☐
- S1 (3 calientes): ____ / ____ / ____ ms · S2: ____ / ____ / ____ ms
- S3: ____ / ____ / ____ ms · S4: ____ / ____ / ____ ms · S5: ____ / ____ / ____ ms
- F1: ____ / ____ / ____ ms · F2: ____ / ____ / ____ ms · F3: ____ / ____ / ____ ms
- B1–B16 que no pasan: ______________________
- Frías fuera del rango: ______________________
- Filas 2 ☐ 2b ☐ 3 ☐ 4 ☐ 5 ☐
- Sorpresas: ____________________________________________
