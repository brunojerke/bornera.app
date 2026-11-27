# Bornera

Editor y simulador de automatismos eléctricos, liviano y de código abierto. Permite dibujar circuitos de mando y potencia con símbolos IEC 60617 y simular su mando: pulsadores, contactores, relés térmicos, lámparas y motores. Está pensado para correr fluido en equipos de bajos recursos, como las netbooks escolares.

## Estado

**Versión 0.1.6**: editor de circuitos con copiar y pegar, etiquetado, referencias cruzadas y validaciones (fases 3 y 3b), guardar y abrir completo (fase 4): autoguardado con recuperación después de un corte, archivos recientes, doble clic en un `.brn` en Windows y exportación sin comprimir (`.brn.json`), y simulación del mando (fase 5): con F5 se entra a Simular, los pulsadores se accionan manteniendo el botón del mouse (Mayús+clic los deja apretados), los contactores y las lámparas responden y los cables se pintan según su potencial; si el circuito oscila o hay un corto, la simulación se detiene y avisa.

La 0.1.6 (fase 6a) suma la potencia a la biblioteca: **32 símbolos**, en una paleta con dos grupos, Mando y Potencia, con sus subgrupos plegables y una miniatura de cada símbolo (el nombre aparece al pasar el mouse; la búsqueda sigue igual). Entre los nuevos están la red trifásica con neutro, contactores principales, termomagnéticas, diferenciales, guardamotor, seccionador, fusibles, relé térmico, motores, selector, seta de emergencia, final de carrera y bocina. Los contactores, térmicos y protecciones de varios polos se cablean polo por polo y las referencias cruzadas los muestran (por ejemplo «NA 1-2, 3-4, 5-6»). Ya se puede dibujar una inversión de giro completa, con mando y potencia.

En Simular, la red trifásica da potencial a cada fase, los contactos principales siguen a su bobina, el selector y la seta cambian de posición con un clic, el final de carrera se acciona como un pulsador y la bocina se activa igual que la lámpara. Un corto entre fases detiene la simulación. La potencia todavía no se simula del todo: el motor no gira ni cuenta como carga, y las protecciones y el térmico quedan siempre cerrados (no se abren ni disparan).

Un `.brn` guardado con la 0.1.6 no abre en la 0.1.5. El plan completo está en [docs/arquitectura.md](docs/arquitectura.md).

[Descargas](https://github.com/brunojerke/bornera.app/releases) · [Instalar en Windows](#instalar-en-windows)

## Cómo correrlo

Requisitos: [Node.js](https://nodejs.org/) LTS, [Rust](https://rustup.rs/) y los [requisitos de Tauri](https://v2.tauri.app/start/prerequisites/) para tu sistema (en Windows, Microsoft C++ Build Tools y WebView2; en Linux, los paquetes de desarrollo de WebKitGTK).

```sh
npm install
npm run tauri dev   # abre la app de escritorio
```

Otros comandos:

```sh
npm test            # tests
npm run check       # chequeo de tipos
npm run bench       # tiempos de dibujado con 100, 500 y 2000 símbolos (necesita Chrome, Chromium o Edge)
npm run tauri build # genera el instalador
```

## Instalar en Windows

Los instaladores de Windows (`.msi`) todavía no están firmados, así que Windows SmartScreen puede mostrar "Windows protegió su PC". Para instalar, hacé clic en "Más información" y después en "Ejecutar de todas formas".

Para actualizar, instalá el `.msi` nuevo encima, sin desinstalar la versión anterior: queda una sola Bornera. El instalador asocia los archivos `.brn`, así que se abren con doble clic.

Los instaladores los compila GitHub Actions desde este repositorio al publicar un tag `v*` ([`.github/workflows/release.yml`](.github/workflows/release.yml)).

## Privacidad

Bornera no envía datos por red: no tiene telemetría, cuentas ni actualizaciones automáticas. Los circuitos se guardan en los archivos .brn que elegís en tu computadora. Mientras trabajás, Bornera guarda además una copia de recuperación y la lista de archivos recientes en su carpeta de datos, también en tu computadora; la copia se borra al guardar o al cerrar bien.

## Licencia

Bornera es software libre bajo la [Licencia Pública General de GNU, versión 3](LICENSE) (GPL-3.0).
