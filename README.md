# Bornera

Editor y simulador de automatismos eléctricos, liviano y de código abierto. Permite dibujar circuitos de mando y potencia con símbolos IEC 60617 (la simulación está en desarrollo): pulsadores, contactores, relés térmicos, lámparas y motores. Está pensado para correr fluido en equipos de bajos recursos, como las netbooks escolares.

## Estado

**Versión 0.1.3**: editor de circuitos (fase 3), con la fase 3b en curso (copiar y pegar, etiquetado, referencias cruzadas y validaciones). La simulación llega en la fase 5. El plan completo está en [docs/arquitectura.md](docs/arquitectura.md).

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

Los instaladores los compila GitHub Actions desde este repositorio al publicar un tag `v*` ([`.github/workflows/release.yml`](.github/workflows/release.yml)).

## Privacidad

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

Bornera no envía datos por red: no tiene telemetría, cuentas ni actualizaciones automáticas.

## Licencia

Bornera es software libre bajo la [Licencia Pública General de GNU, versión 3](LICENSE) (GPL-3.0).
