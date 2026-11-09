---
name: bornera-release
description: Prepara una prerelease o release de Bornera, como 0.1.3-alpha.5. Verifica el repo, alinea la versión en package.json, Cargo.toml y tauri.conf.json y muestra los comandos. No crea tags ni hace push sin autorización explícita.
---

# Preparar una versión de Bornera

Publicar un tag dispara el release del repo público y es difícil de deshacer limpiamente. Por eso esta skill prepara todo y deja la publicación en manos de Bruno.

El argumento es la versión, por ejemplo `0.1.3-alpha.5`. Si falta, preguntarla.

## Pasos

1. **Comprobar el repo**
   - Correr `git status --short --branch` y `git log --oneline -5`.
   - Si hay cambios sin commit, frenar y mostrarlos.
   - Comprobar con `git tag --list` y `git ls-remote --tags origin` que el tag `v<versión>` no exista.
   - Correr `npm test`, `npm run check` y `npm run humo`. Si algo falla, frenar.

2. **Comprobar el estado de la tarea**
   - Revisar el plan vigente en `docs/`.
   - Una prerelease puede salir con una tarea abierta solo si lo único que falta es medirla en la netbook. Indicarlo en el resumen y no presentarla como terminada.

3. **Alinear la versión**
   - Localizar `package.json`, `Cargo.toml` y `tauri.conf.json`, normalmente estos dos últimos en `src-tauri/`.
   - Mostrar la versión actual de cada uno.
   - Si difieren de la pedida, actualizarlos, junto con los lockfiles que correspondan.
   - Volver a leerlos para confirmar que los tres coinciden.
   - Si la versión es final y no prerelease, revisar la compatibilidad de la versión con WiX antes de seguir, porque el instalador MSI tiene un formato de versión más restringido.
   - Correr `npm run check` después de cambiar la versión.

4. **Crear el commit de versión**
   - Hacer un commit separado con el mensaje `Versión <versión>`.

5. **Mostrar los comandos y frenar**
   - Mostrar la rama, el commit, los cambios desde el tag anterior y estos comandos, sin ejecutarlos:

   ```bash
   git push origin <rama>
   git tag -a v<versión> -m "Bornera <versión>"
   git push origin v<versión>
   ```

   - Si después Bruno autoriza explícitamente la publicación de esa versión, ejecutarlos y luego informar el estado del workflow si `gh` está disponible.
   - Una autorización anterior no vale para otra versión.

## Después de publicar

Recordar lo que queda por probar en la netbook (Linux Mint, WebKitGTK, 1024×600), con los criterios de aceptación de la tarea si existen.
