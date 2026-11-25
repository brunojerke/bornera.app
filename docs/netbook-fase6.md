# Netbook con Windows — cierre de 6a (fase 6)

Para imprimir. Plan: `docs/plan-fase6.md`, secciones 4 y 5 (C2 arma esta hoja; C3 es el día de la netbook). Cada fila tiene su **«Pasa si»**. Los topes son los de la **netbook**, no los de la PC.

Versión instalada: `0.1.6-alpha.____` · Fecha: ________ · Hora de inicio: ________

> **Ojo: el mismo día, en la PC.** Los cocientes netbook / PC solo valen si la PC se mide **el mismo día**, con **el mismo instalador** (`.msi` del mismo tag), **el mismo protocolo** (3 aperturas × fría + caliente) y en las condiciones del banco. Ver «La PC el mismo día», al final.

> **Nombres de los textos (corregido respecto de la fase 5).** En la fase 5 los archivos quedaron al revés de la hoja (`n…` en la PC). Desde esta fase, el nombre dice la máquina con todas las letras: **`netbook1-fria.txt`** en la netbook y **`pc1-fria.txt`** en la PC, cada uno en su carpeta.

## Antes de empezar
1. ☐ Netbook **enchufada**.
2. ☐ Modo de energía en **«Mejor rendimiento»** (Configuración › Sistema › Energía).
3. ☐ Cerrar todas las otras apps.
4. ☐ En el pendrive, de `tests/circuitos/` del repo: `inversion.brn` e `inversion-potencia.brn`. Y esta hoja.
5. ☐ Crear en el pendrive una carpeta `fase6-netbook` para los textos de «Copiar».

## Fila 0. Instalar la alpha.1 encima de la 0.1.5

> **El instalador sale del borrador.** El `.msi` lo arma `release.yml` en GitHub, en un **borrador** (no es público), recién cuando se sube el tag `v0.1.6-alpha.1`. El tag y su push los hago yo **solo con tu autorización escrita**. Sin ese paso, no hay `.msi` para bajar.

**Regla:** la 0.1.5 se instaló con el `.msi`, así que esta también va con el `.msi`. Mezclar `.msi` con el instalador `.exe` (NSIS) deja dos «Bornera».

1. En GitHub, en el repo de Bornera: **Releases**. El borrador dice «Draft» y se llama `v0.1.6-alpha.1`.
2. Abrir el borrador. En **Assets**, bajar el archivo que termina en **`.msi`** y copiarlo al pendrive.
3. En la netbook, **sin desinstalar** la 0.1.5, doble clic en el `.msi`.
4. Si Windows muestra «Windows protegió su PC» (SmartScreen): **«Más información»** y después **«Ejecutar de todas formas»**. El instalador no está firmado.
5. Seguir el instalador hasta el final.
6. Configuración › Aplicaciones › Aplicaciones instaladas: buscar «Bornera».
7. Abrir Bornera y mirar la versión.

| ☐ | Pasa si |
|---|---|
| ☐ | Hay **una sola** «Bornera» en la lista, y la app muestra la versión `0.1.6-alpha.1` |

> **No volver a la 0.1.5 con archivos nuevos.** Un `.brn` guardado con la 0.1.6 **no abre** en la 0.1.5. Los `.brn` de esta prueba quedan en la netbook o en el pendrive; no se abren en una 0.1.5.

## Fila 1. «Probar la fase 6» (3 aperturas × fría + caliente)

Cada **apertura** es abrir Bornera, correr la prueba dos veces y cerrarla. La **1.ª corrida** es **fría** (incluye el calentamiento y tarda más): solo informa. La **2.ª** es **caliente**: la que decide.

Pasos (repetir en las aperturas 1, 2 y 3; en los nombres, el número es el de la apertura):
1. Abrir Bornera. Si aparece «Bornera no se cerró bien», elegir **Descartar**.
2. En **Editar** (no en Simular): menú de desarrollo (la llave) › «Cierre de fase» › **«Probar la fase 6…»**. No tocar nada mientras corre.
3. Al terminar sale el diálogo con la tabla. Clic en **«Copiar»**.
4. Pegar en el Bloc de notas y guardar en la carpeta `fase6-netbook` del pendrive como `netbook1-fria.txt` (en la apertura 2, `netbook2-fria.txt`; en la 3, `netbook3-fria.txt`). Cerrar el diálogo.
5. Otra vez «Probar la fase 6…», «Copiar» y guardar en la misma carpeta como `netbook1-caliente.txt` (`netbook2-caliente.txt`, `netbook3-caliente.txt`).
6. Cerrar Bornera con la X.

| Apertura | Fría guardada | Caliente guardada |
|---|---|---|
| 1 | ☐ `netbook1-fria.txt` | ☐ `netbook1-caliente.txt` |
| 2 | ☐ `netbook2-fria.txt` | ☐ `netbook2-caliente.txt` |
| 3 | ☐ `netbook3-fria.txt` | ☐ `netbook3-caliente.txt` |

**Cómo se juzga** (regla vigente, `docs/plan-fase6.md` §4):
- **S6 y P1:** cada valor se toma de las 3 calientes. Pasa si la **mediana de las 3 ≤ tope** y el **máximo ≤ tope + máx(1 ms, 10 %)**. La tabla de la app dice «pasa» o «no pasa» por corrida; esta hoja juzga las 3 juntas.
- **S1:** informa (se anota contra su tope de la fase 5, 300 ms).
- **P2:** informa. Es **una por apertura** (la de la fría y la de la caliente son la misma: se toma la de la 1.ª); se anotan las 3 y su mediana, y se compara con la PC en C3.
- **Las frías:** solo informan (dentro del rango de las calientes del mismo día más 1 ms).
- El resto de la tabla (B1–B16, F1–F3, S2–S5) queda en los textos; lo juzgo yo en C3 con la regla vigente.

| # | Qué mide | Tope | Máx. admitido | Cal. 1 | Cal. 2 | Cal. 3 | ☐ |
|---|---|---|---|---|---|---|---|
| S6 | Entrar a Simular, escena de potencia 2000 al 31 %, hasta nítido (máx. de 5) | 300 ms | 330 ms | | | | ☐ |
| P1 | Dibujar las miniaturas de la paleta de cero (máx. de 5) | 50 ms | 55 ms | | | | ☐ |
| S1 | Entrar a Simular, mando 2000 al 31 %, hasta nítido (máx. de 5) | informa (300 ms) | — | | | | — |
| P2 | Arranque: de abrir la app al primer cuadro nítido del lienzo (una por apertura) | informa | — | | | | — |

También: ☐ el encabezado de la tabla dice **«con disco»** (si dice «sin disco», anotarlo: no es la app instalada).

## Fila 2. La paleta, a mano

A 1024×600 (la pantalla de la netbook), con Bornera maximizada. Hoja nueva (Archivo › Nuevo).

1. Mirar la paleta entera, bajando con la rueda: grupos **Mando** y **Potencia**, y sus subgrupos (Alimentación, Entradas, Contactos, Bobinas, Señalización; Protección, Maniobra, Cargas, Fuentes).
2. Contar las miniaturas: tienen que ser **32**. Pasar el mouse por encima de algunas: aparece el nombre (tooltip).
3. **Plegar** un subgrupo (clic en su título), por ejemplo «Protección»: sus miniaturas desaparecen. **Desplegarlo**: vuelven, nítidas.
4. En el subgrupo **Cargas**, **arrastrar** «Motor trifásico» a la hoja y soltarlo.
5. Cambiar a tema **oscuro** y volver a mirar las miniaturas. Volver al claro.
6. En el buscador, escribir **«termo»**. Borrar la búsqueda.

| ☐ | Pasa si |
|---|---|
| ☐ | Se ven las **32 miniaturas**, nítidas (no borrosas ni cortadas), con su tooltip |
| ☐ | Plegar oculta el subgrupo y desplegar lo devuelve con las miniaturas dibujadas |
| ☐ | El Motor trifásico queda en la hoja, en la grilla, con su etiqueta (M1) |
| ☐ | En oscuro las miniaturas se ven con los colores del tema |
| ☐ | Con «termo» quedan las **4 termomagnéticas**; al borrar, vuelve toda la paleta |

## Fila 3. Dibujar la inversión con potencia

1. Hoja nueva. Dibujar a mano la inversión de giro completa: trifásica + N, Q1 3P, K1 y K2 principales, F2 térmico, M1; mando con F1, S0–S2, 95-96 y los enclavamientos (como `inversion-potencia.brn`).
2. Guardar como `inversion-a-mano.brn` en el pendrive. Cerrar Bornera y volver a abrir ese archivo.

| ☐ | Pasa si |
|---|---|
| ☐ | Sin avisos en el contador |
| ☐ | Abre igual que se guardó |

(En la PC, con el archivo del pendrive, corro `npm run circuito` con `BORNERA_BASE=inversion-potencia`.)

## Fila 4. Simular

1. Abrir `inversion-a-mano.brn` (o `inversion-potencia.brn`). **F5**. Clic en el **selector** y en la **seta** (cada clic alterna). Mantener S1 y soltar. **F5**.
2. Abrir `inversion.brn`. **F5**. Mantener **S1** y soltar. Mantener **S2** y soltar. Mantener **S0** y soltar. Mantener **S2** y soltar. **F5**.

| ☐ | Pasa si |
|---|---|
| ☐ | Selector y seta alternan con un clic |
| ☐ | Q1 y F2 quedan cerrados (un clic no hace nada) |
| ☐ | M1 no da corto ni «cargas en serie» |
| ☐ | `inversion.brn` como en la fase 5: S1 entra K1, S2 no entra con K1 adentro, S0 apaga, después S2 entra K2 |
| ☐ | Al salir con F5, el título **no** tiene «•» |

## Al terminar
1. ☐ Abrir Bornera. Si aparece «Bornera no se cerró bien», **Descartar** en cada copia que quede. Cerrar.
2. ☐ Llevar de vuelta la carpeta `fase6-netbook` con los **6 textos** (`netbook1-fria.txt` … `netbook3-caliente.txt`), `inversion-a-mano.brn` y esta hoja con lo anotado.

## La PC el mismo día

> **Destacado.** En la PC, el mismo día que la netbook, con el **`.msi` del mismo tag** instalado, **el mismo protocolo** (3 aperturas × fría + caliente) y en las condiciones del banco: **enchufada, «Mejor rendimiento», apps cerradas, sin otra Bornera abierta**.

1. Instalar el mismo `.msi` (fila 0, pasos 3 a 7).
2. Hacer la fila 1 entera, guardando en `C:\Users\jerke\Downloads\fase6-pc\` como `pc1-fria.txt`, `pc1-caliente.txt` … `pc3-caliente.txt` (fuera del repo).
3. Copiar la carpeta `fase6-netbook` del pendrive a `C:\Users\jerke\Downloads\fase6-netbook\`.
4. Pasarme las dos carpetas. K **no** se recalcula (D1-D de la fase 5: K1 = 3, K2 = 5,5); en C3 anoto los cocientes netbook / PC y P2.

## Resultados (para pasarme)
- Fila 0: versión ________ · una sola Bornera ☐
- S6 (3 calientes): ____ / ____ / ____ ms · P1: ____ / ____ / ____ ms
- S1: ____ / ____ / ____ ms · P2 (por apertura): ____ / ____ / ____ ms
- Frías fuera del rango: ______________________
- Filas 2 ☐ 3 ☐ 4 ☐
- Sorpresas: ____________________________________________
