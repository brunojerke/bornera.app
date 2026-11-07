# Bornera

Editor y simulador de automatismos eléctricos, liviano y de código abierto. Permite dibujar circuitos de mando y potencia con símbolos IEC 60617 y simularlos en el mismo lugar: pulsadores, contactores, relés térmicos, lámparas y motores. Está pensado para correr fluido en equipos de bajos recursos, como las netbooks escolares.

## Estado

**En desarrollo.** Todavía no hay una versión usable: el proyecto está en su fase inicial. El plan completo está en [docs/arquitectura.md](docs/arquitectura.md).

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

## Licencia

Bornera es software libre bajo la [Licencia Pública General de GNU, versión 3](LICENSE) (GPL-3.0).
