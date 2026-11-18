# Netbook con Windows — cierre de la fase 4

Para imprimir. Plan: `docs/plan-fase4.md`, sección 6 (C2 arma esta hoja; C4 es el día de la netbook). Cada fila tiene su **«Pasa si»**. Los topes son los de la **netbook**, no los de la PC.

Versión instalada: `0.1.4-alpha.____` · Fecha: ________ · Hora de inicio: ________

> **Ojo: el mismo día, en la PC.** K1 y K2 (cuánto más lenta es la netbook que la PC) solo valen si la PC se mide **el mismo día**, con **el mismo instalador** (`.msi` del mismo tag), **el mismo protocolo** (3 aperturas × fría + caliente) y en las condiciones del banco: enchufada, «Mejor rendimiento», apps cerradas. Ver la sección «K1 y K2» al final.

## Antes de empezar
1. ☐ Netbook **enchufada**.
2. ☐ Modo de energía en **«Mejor rendimiento»** (Configuración › Sistema › Energía).
3. ☐ Cerrar todas las otras apps.
4. ☐ En el pendrive: `marcha-parada.brn` (de `tests/circuitos/` del repo) y esta hoja.
5. ☐ Crear en el pendrive una carpeta `fase4` para los textos de «Copiar».

## Fila 0. Instalar la alpha.N

> **El instalador sale del borrador.** El `.msi` lo arma `release.yml` en GitHub, en un **borrador** (no es público), recién cuando se sube el tag `v0.1.4-alpha.N`. El tag y su push los hago yo **solo con tu autorización escrita** (etapa C3). Sin ese paso, no hay `.msi` para bajar.

**Regla:** la alpha.1 se instaló con el `.msi`, así que esta también va con el `.msi`. Mezclar `.msi` con el instalador `.exe` (NSIS) deja dos «Bornera».

1. En GitHub, en el repo de Bornera: **Releases**. El borrador dice «Draft» y se llama `v0.1.4-alpha.N`.
2. Abrir el borrador. En **Assets**, bajar el archivo que termina en **`.msi`** y copiarlo al pendrive.
3. En la netbook, **sin desinstalar** la alpha.1, doble clic en el `.msi`.
4. Windows muestra «Windows protegió su PC» (SmartScreen), porque el instalador no está firmado. Clic en **«Más información»** y después en **«Ejecutar de todas formas»**.
5. Seguir el instalador hasta el final.
6. Configuración › Aplicaciones › Aplicaciones instaladas: buscar «Bornera».
7. Abrir Bornera y mirar la versión.

| ☐ | Pasa si |
|---|---|
| ☐ | Hay **una sola** «Bornera» en la lista, y la app muestra la versión `0.1.4-alpha.N` |

## Fila 1. «Probar la fase 4» (3 aperturas × fría + caliente)

Cada **apertura** es abrir Bornera, correr la prueba dos veces y cerrarla:
- La **1.ª corrida** es **fría**: incluye la pasada de calentamiento y tarda más. Es normal.
- La **2.ª corrida** es **caliente**: la que decide.

Pasos (repetir 3 veces: apertura 1, 2 y 3; en los nombres, el número es el de la apertura):
1. Abrir Bornera. Si aparece «Bornera no se cerró bien», elegir **Descartar**.
2. Menú de desarrollo (la llave) › «Cierre de fase» › **«Probar la fase 4…»**. No tocar nada mientras corre.
3. Al terminar sale el diálogo con la tabla (B1–B16 y F1–F3). Clic en **«Copiar»**.
4. Abrir el Bloc de notas, pegar (Ctrl+V) y guardar en el pendrive como `fase4\n1-fria.txt` (en la apertura 2, `n2-fria.txt`; en la 3, `n3-fria.txt`). Cerrar el diálogo de la tabla.
5. Otra vez «Probar la fase 4…» (paso 2), «Copiar» y guardar como `fase4\n1-caliente.txt` (o `n2-`, `n3-`).
6. Cerrar Bornera con la X.

| Apertura | Fría guardada | Caliente guardada |
|---|---|---|
| 1 | ☐ `n1-fria.txt` | ☐ `n1-caliente.txt` |
| 2 | ☐ `n2-fria.txt` | ☐ `n2-caliente.txt` |
| 3 | ☐ `n3-fria.txt` | ☐ `n3-caliente.txt` |

**Cómo se juzga:**
- **F1, F2 y F3:** cada uno pasa si su **máximo** (F2 y F3: el máximo de 5 vueltas) queda **dentro del tope en las 3 corridas calientes**. La tabla de la app ya dice «pasa» o «no pasa» con el tope de la netbook.
- **B1–B16:** con la regla vigente, la mediana de cada corrida contra los topes de la 3b (los de `docs/netbook-fase3b.md`, sección B). B10 solo informa.
- **Las frías:** solo informan, con la regla de C4 (cada fila, dentro del rango de las calientes del mismo día más 1 ms). No deciden.

| # | Qué mide | Tope netbook | Caliente 1 | Caliente 2 | Caliente 3 | ☐ Pasa si |
|---|---|---|---|---|---|---|
| F1 | Copia de recuperación con 2000 + 3030 cables: máximo de la parte síncrona | ≤ 50 ms | | | | ☐ las 3 ≤ 50 ms |
| F2 | Guardar 2000 (sin el comando): máximo de 5 vueltas | ≤ 1 s | | | | ☐ las 3 ≤ 1 s |
| F3 | Abrir 2000 hasta el primer cuadro (sin el comando): máximo de 5 vueltas | ≤ 3 s | | | | ☐ las 3 ≤ 3 s |
| B1–B16 | Filas de la 3b | las de la 3b | | | | ☐ cada fila dentro de su tope (B10 solo se anota) |

También: ☐ el encabezado de la tabla dice **«con disco»** (si dice «sin disco», anotarlo: no es la app instalada).

## Filas 2, 3 y 3b. Recuperar después de un corte (T23)

**Finalizar tarea** siempre sobre la app **Bornera** del Administrador de tareas (Ctrl+Mayús+Esc), no sobre los procesos «Microsoft Edge WebView2».

### Fila 2. Recuperar
1. Abrir Bornera y abrir `marcha-parada.brn`.
2. Arrastrar **S1** dos lugares a la derecha.
3. Esperar **15 s sin tocar nada** (así sale la copia de recuperación).
4. Administrador de tareas › Bornera › **Finalizar tarea**.
5. Abrir Bornera. Sale «Bornera no se cerró bien»: clic en **Recuperar**.

| ☐ | Pasa si |
|---|---|
| ☐ | S1 está corrido, el título tiene «•» y Deshacer está desactivado |

Cerrar con «No guardar».

### Fila 3. Descartar
1. Repetir los pasos 1 a 4 de la fila 2.
2. Abrir Bornera. En «Bornera no se cerró bien», clic en **Descartar**.
3. Cerrar Bornera y volver a abrirla.

| ☐ | Pasa si |
|---|---|
| ☐ | No vuelve a preguntar |

### Fila 3b. Dos Bornera abiertas
1. Abrir Bornera **dos veces** (dos ventanas).
2. En cada una, cambiar algo (por ejemplo, mover un símbolo) y esperar 15 s.
3. Administrador de tareas: **Finalizar tarea** sobre la **primera** Bornera.
4. En la segunda: menú de desarrollo › «Cierre de fase» › **«Copias de recuperación…»**.

| ☐ | Pasa si |
|---|---|
| ☐ | La segunda sigue viva y se puede editar (no queda en blanco ni se cierra), y la copia de la primera dice «sin dueño» |

Cerrar la segunda con «No guardar».

## Filas 4, 5, 5b y 5c. Archivos y pulsadores (T24–T27)

### Fila 4. Doble clic en el archivo (T25 y T27)
1. Con Bornera cerrada, en el Explorador: doble clic en `marcha-parada.brn`.

| ☐ | Pasa si |
|---|---|
| ☐ | Bornera abre con ese archivo. La parada dice **S0** y la marcha **S1** |

Cerrar Bornera.

### Fila 5. Abrir reciente y Ctrl+D de los pulsadores (T24 y T27)
1. Abrir Bornera y abrir `marcha-parada.brn`.
2. Cerrar Bornera y volver a abrirla.
3. Flecha junto a **Abrir** › `marcha-parada.brn`.
4. Clic en **S0** (la parada).
5. **Mayús+clic** en **S1** (la marcha). Quedan los dos seleccionados.
6. **Ctrl+D**. Abajo sale el aviso «No hay lugar al lado: mové la copia y hacé clic para soltarla.», y la copia queda pegada al mouse.
7. Mover el mouse hacia la izquierda y **soltarla en una zona vacía a la izquierda, sin tapar ningún componente**: un clic.
8. Mirar los nombres de la copia.
9. Cerrar con **«No guardar»**.

| ☐ | Pasa si |
|---|---|
| ☐ | El archivo abre desde la lista, **sin** el aviso de «permiso» |
| ☐ | Ctrl+D avisó «No hay lugar al lado» |
| ☐ | La copia de la parada dice **S2** y la copia de la marcha dice **S3** |
| ☐ | Los originales siguen siendo S0 (parada) y S1 (marcha), en su lugar |

### Fila 5b. Exportar sin comprimir (T21)
1. Abrir `marcha-parada.brn`.
2. «Exportar sin comprimir (.brn.json)…» **cuatro veces**, escribiendo en el diálogo, una por vez: `x`, `x.brn`, `x.json` y `x.brn.json` (decir que sí a reemplazar).
3. **Guardar como**, escribiendo `x.brn.json`.
4. **Abrir**: mirar que la lista muestra los `.brn.json`. Abrir `x.brn.json`.
5. Mover algo y **Ctrl+S**.
6. Abrir `x.brn.json` con el Bloc de notas.

| ☐ | Pasa si |
|---|---|
| ☐ | Las cuatro exportaciones dejan `x.brn.json` (nunca `x.brn.json.brn`, `x.brn.brn.json` ni `x.json`), sin aviso de «permiso» |
| ☐ | Guardar como no deja `x.brn.json.brn` |
| ☐ | Abrir muestra los `.brn.json`; Ctrl+S quita la «•» |
| ☐ | En el Bloc de notas hay un componente por línea |

Cerrar Bornera. Borrar los `x.*` que quedaron.

### Fila 5c. Borrar un cable con T colgando (T26 y T27)
1. Abrir `marcha-parada.brn`. La parada dice S0 y la marcha S1.
2. Clic (sin Mayús) en el cable que baja de **S1·14** a **K1·A1**, en el tramo entre la T y A1.
3. **Supr**.
4. Mirar la barra de abajo.
5. **Ctrl+Z**.

| ☐ | Pasa si |
|---|---|
| ☐ | Se borra también el cable de la T que va a H1, y la barra dice «Se borró también 1 cable en T.» |
| ☐ | Ctrl+Z trae los dos cables, con H1 conectada |

Cerrar con «No guardar».

## Fila 6. La 0.1.4 final (otro día, etapa C5)
**No se hace hoy.** Va cuando exista el borrador de `v0.1.4`.
1. Bajar el `.msi` del borrador de `v0.1.4`, igual que en la fila 0 (con el paso de SmartScreen).
2. Instalarlo **encima** de la alpha.N, sin desinstalar.

| ☐ | Pasa si |
|---|---|
| ☐ | Una sola «Bornera», versión `0.1.4`, y la lista de recientes sigue |

## Al terminar
1. ☐ Abrir Bornera. Si aparece «Bornera no se cerró bien», clic en **Descartar** en cada copia que quede (deben borrarse todas las de esta prueba). Cerrar.
2. ☐ Llevar de vuelta en el pendrive la carpeta `fase4` con los **6 textos** (`n1-fria.txt` … `n3-caliente.txt`) y esta hoja con lo anotado.

## K1 y K2: el mismo día, en la PC

> **Destacado.** Los números de la PC tienen que ser:
> - **del mismo día** que la netbook;
> - con el **`.msi` del mismo tag** que se instaló en la netbook (el mismo borrador de `v0.1.4-alpha.N`), instalado en la PC;
> - con **el mismo protocolo**: 3 aperturas × (1 fría + 1 caliente);
> - en las condiciones del banco: **PC enchufada, «Mejor rendimiento», apps cerradas, sin otra Bornera abierta**.

En la PC:
1. Instalar el mismo `.msi` (fila 0, pasos 3 a 7).
2. Hacer la fila 1 entera, guardando en `C:\Users\jerke\Downloads\fase4-pc\` como `p1-fria.txt`, `p1-caliente.txt` … `p3-caliente.txt` (fuera del repo, para no dejar archivos sueltos).
3. Copiar la carpeta `fase4` del pendrive a `C:\Users\jerke\Downloads\fase4\`.
4. En PowerShell, en la carpeta del repo (solo las calientes cuentan para K):

```powershell
$pc = "C:\Users\jerke\Downloads\fase4-pc"; $nb = "C:\Users\jerke\Downloads\fase4"; node tests/bench/calcular-factores.mjs "--pc=$pc\p1-caliente.txt,$pc\p2-caliente.txt,$pc\p3-caliente.txt" "--netbook=$nb\n1-caliente.txt,$nb\n2-caliente.txt,$nb\n3-caliente.txt"
```

Por qué a mano y no `probar-webview2.mjs --salida=pc.json`: ese script exige dos exes y los alterna en bloques A B B A, así que no da 3 aperturas de un mismo exe. A mano, el protocolo es idéntico al de la netbook.

5. Copiar la tabla que imprime y la línea «K1 (pasos sin dibujo) = … · K2 (gestos con dibujo) = …».

Qué significan:
- **K1:** cuántas veces más lenta es la netbook en los pasos sin dibujo (B1, B2, B4, B5, B7, B10, B12, B13, F1 y F2).
- **K2:** lo mismo en los gestos con dibujo (B3, B6, B11, B14, B16 y F3).
- Si **K1 > 3** o **K2 > 5,5**, se decide en C4 con las opciones A–D de `docs/plan-fase4.md` (sección 6).

## Resultados (para pasarme)
- Fila 0: versión ________ · una sola Bornera ☐
- F1 máx. (3 calientes): ____ / ____ / ____ ms
- F2 máx.: ____ / ____ / ____ ms · F3 máx.: ____ / ____ / ____ ms
- B1–B16 que no pasan: ______________________
- Frías fuera del rango: ______________________
- Filas 2 ☐ 3 ☐ 3b ☐ 4 ☐ 5 ☐ 5b ☐ 5c ☐
- K1 = ______ · K2 = ______
- Sorpresas: ____________________________________________
