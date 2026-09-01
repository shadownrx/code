# Electron

Compila tu app Electron para Linux (`.AppImage`), macOS (`.dmg`) y Windows
(`.exe`) en paralelo con `build-mobile.yml` — los builds de macOS y Windows
corren en runners gratuitos de GitHub, así que no necesitás esas máquinas.

## Quickstart

```yaml
# .github/workflows/build.yml
name: Build Mobile Apps

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  build:
    uses: shadownrx/code/.github/workflows/build-mobile.yml@main
    with:
      project_type: electron
    secrets: inherit
```

## Conectar tu propia app Electron

1. Necesitás `electron` y `electron-builder` como `devDependencies`, y una
   config `build` en tu `package.json` (`appId`, `productName`,
   `directories.output`, targets por SO). Ver
   [`examples/electron-demo/package.json`](../examples/electron-demo/package.json)
   para una config mínima real que funciona.
2. **Agregá `"publish": null` a la config `build`** — sin esto,
   `electron-builder` intenta generar metadata de auto-actualización incluso
   con `--publish=never`, y explota con
   `Cannot read properties of null (reading 'provider')` si tu `package.json`
   no tiene un campo `repository`. Es un bug real que encontramos armando el
   ejemplo — ver [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md).
3. Usá `project_type: electron` (o dejá `auto`: la plataforma lo detecta por la
   dependencia `electron`/`electron-builder` en `package.json`).

## Qué corre

Un solo job, `build-electron`, como `matrix` sobre `ubuntu-latest`,
`macos-latest` y `windows-latest` a la vez — cada runner empaqueta el target
nativo de su propio sistema operativo (nada de cross-compilar con Wine):

1. `npm ci`
2. `npm run build --if-present` (por si tu renderer usa un bundler)
3. `npx electron-builder --publish=never`

Cada sistema operativo sube su artifact por separado:
`electron-build-ubuntu-latest`, `electron-build-macos-latest`,
`electron-build-windows-latest`.

## Notas

- **Sin firma todavía**: los builds de macOS y Windows salen sin firmar
  (`CSC_IDENTITY_AUTO_DISCOVERY=false` evita que `electron-builder` intente
  usar una identidad ad-hoc del runner). Firmar Electron es un paso pendiente
  de esta plataforma — no está en [`SIGNING.md`](./SIGNING.md) todavía.
- **`build_android`/`build_ios` no aplican**: para `project_type: electron` la
  plataforma usa `build_electron` en su lugar; `build-android`/`build-ios` se
  saltean automáticamente.
- **Formatos de salida**: el paso de recolección busca `.dmg`, `.zip`,
  `.AppImage`, `.deb`, `.rpm`, `.exe`, `.msi` y `.snap` dentro de `dist/`. Si
  tu config `build.<os>.target` usa otro formato, no lo va a encontrar (el job
  sigue en verde igual, con un warning — ver
  [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)).

## Ejemplo real en este repo

[`examples/electron-demo`](../examples/electron-demo): una app Electron
mínima (`main.js` + `preload.js` + `index.html`, sin bundler) empaquetada con
[electron-builder](https://www.electron.build), compilada en cada push por
[`.github/workflows/example-electron-ci.yml`](../.github/workflows/example-electron-ci.yml).
Se validó de verdad, no solo el YAML: corriendo el build localmente se generó
un `.AppImage` real de ~108 MB.

```yaml
name: Example Electron app (self-test)

on:
  push:
    paths:
      - "examples/electron-demo/**"
  workflow_dispatch:

jobs:
  build:
    uses: ./.github/workflows/build-mobile.yml
    with:
      project_type: electron
      working_directory: examples/electron-demo
    secrets: inherit
```

## Ver también

- [`USAGE.md`](./USAGE.md) — inputs disponibles, descargar resultados, notificaciones.
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — errores reales ya vistos.
