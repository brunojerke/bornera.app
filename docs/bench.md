# Banco de dibujado

Resultados de `npm run bench`: tiempo de dibujado de las escenas de prueba con 100, 500 y 2000 símbolos al azar (siempre la misma semilla, así las corridas se pueden comparar). Se corre al final de cada fase, en esta PC y en la netbook.

## Cómo se mide

- Lienzo de 1366×768 (pantalla típica de netbook), dpr 1.
- El navegador es un Chrome, Chromium o Edge headless, que dibuja con el mismo código de la app (`src/render/capas.ts`). Sin GPU (`--disable-gpu`): rasterizado por software, más parecido a una netbook.
- Cada cuadro fuerza el rasterizado (`getImageData` de un píxel), así se mide el dibujo real y no solo el registro de las órdenes.
- 3 cuadros de calentamiento y 25 medidos por caso; se informa la mediana y el p95.
- **Optimizado:** caché de la capa estática, recorte por vista y nivel de detalle. **Sin optimizar:** las tres apagadas (todo se redibuja en cada cuadro, con todo el detalle).
- Escenarios: *Vista al 100 %*, *Acercado al 400 %* y *Encuadrado (F)* rehacen la capa estática en cada cuadro (como un zoom con la rueda). *Desplazar al 100 %* mueve la vista de a 6 px, sin salir del margen del caché (como un arrastre).
- ⚠ = p95 sobre 16,7 ms (no llega a 60 FPS).

## Línea base — 2026-11-07

Commit: «Capas, recorte y banco de pruebas».

- **PC:** notebook con AMD Ryzen 7 170 (gráficos Radeon integrados + NVIDIA GeForce RTX 5050 Laptop, sin usar: rasterizado por software), 15,2 GB de RAM, Windows 11 Home.
- **Navegador:** Microsoft Edge 157.0.4341.42 headless (Chromium 157).
- En esta máquina los tiempos varían ±30 % entre corridas, así que cada celda es la **mediana de 3 corridas** de `npm run bench`.

Tiempo por cuadro en ms (mediana / p95):

| Símbolos | Escenario | Dibujados | Optimizado | Sin optimizar | Mejora |
|---:|---|---:|---:|---:|---:|
| 100 | Vista al 100 % | 64 / 100 | 4,9 / 6,3 | 2,2 / 3,4 | 0,4× |
|  | Acercado al 400 % | 6 / 100 | 2,1 / 3,4 | 1,6 / 2,6 | 0,8× |
|  | Encuadrado (F) | 100 / 100 | 5,1 / 8,9 | 2,6 / 3,7 | 0,5× |
|  | Desplazar al 100 % | 64 / 100 | 0,5 / 0,7 | 2,6 / 3,8 | 5,2× |
| 500 | Vista al 100 % | 84 / 500 | 5,2 / 7,0 | 6,0 / 8,3 | 1,2× |
|  | Acercado al 400 % | 6 / 500 | 2,3 / 3,4 | 5,1 / 7,3 | 2,2× |
|  | Encuadrado (F) | 500 / 500 | 3,6 / 4,8 | 11,3 / 20,9 ⚠ | 3,1× |
|  | Desplazar al 100 % | 84 / 500 | 0,2 / 0,4 | 8,1 / 13,2 | 40,5× |
| 2000 | Vista al 100 % | 83 / 2000 | 5,8 / 8,6 | 18,8 / 27,0 ⚠ | 3,2× |
|  | Acercado al 400 % | 4 / 2000 | 1,8 / 2,7 | 16,9 / 26,5 ⚠ | 9,4× |
|  | Encuadrado (F) | 2000 / 2000 | 7,1 / 10,2 | 32,9 / 42,1 ⚠ | 4,6× |
|  | Desplazar al 100 % | 83 / 2000 | 0,2 / 0,3 | 17,4 / 24,8 ⚠ | 87,0× |

Memoria:

- Heap JS con la escena armada: 1,3 MB (100) · 1,6 MB (500) · 1,8 MB (2000).
- Caché de la capa estática: 9,0 MB (la pantalla más un 25 % de margen hacia cada lado).

Observaciones:

- Desplazar la vista solo copia el caché: menos de 1 ms con cualquier escena.
- Con escenas chicas, rehacer la capa estática cuesta unos 2–3 ms más que sin optimizar, porque el caché abarca 2,25 veces el área de la pantalla. Sigue muy por debajo de 16,7 ms, y se paga solo al hacer zoom o cambiar el contenido.
- Todo el banco tarda unos 8 s en esta PC.
- Pendiente: medir en la netbook. Allí la app corre en WebKitGTK (Linux), no en Chromium, así que este banco sirve sobre todo para comparar fases entre sí.
