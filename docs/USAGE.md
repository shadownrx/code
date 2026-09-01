# Cómo conectar tu repo a la plataforma

Esta plataforma no es un servicio al que subís código: es un **workflow reutilizable
de GitHub Actions** que vive en este repo (`shadownrx/code`). Cualquier equipo con
un proyecto **Flutter**, **React Native**, una **PWA** (empaquetada con
[Capacitor](https://capacitorjs.com)), o una app de escritorio **Electron** en
GitHub lo activa agregando un archivo de una sola línea de `uses:` a su propio
repositorio. Cada equipo/repo queda
completamente aislado: usa sus propios minutos gratis de Actions, sus propios
secretos y sus propios artefactos. No hay backend compartido, ni cuentas, ni
límites impuestos por esta plataforma.

## 1. Agregar el workflow a tu repo

> Atajo: `npx shadownrx-code` (una vez publicado; por ahora, `node cli/bin.js`
> desde el repo clonado), parado en tu proyecto, te hace un par de preguntas y
> escribe este archivo por vos — ver [`cli/README.md`](../cli/README.md). Lo
> que sigue es el mismo resultado, a mano.

Creá `.github/workflows/build.yml` en tu proyecto:

```yaml
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
      project_type: auto        # auto | flutter | react-native | pwa | electron
      build_android: true
      build_ios: true
    secrets: inherit            # pasa tus secrets (firma, Slack, etc.) si los configuraste
```

Con esto, cada push a `main` (o cada PR) compila automáticamente:

- **Android** (`.apk` y `.aab`) en un runner Linux (`ubuntu-latest`, gratis e ilimitado
  en repos públicos; con cuota mensual gratis en privados).
- **iOS** (`.ipa` o un `.app` sin firmar) en un runner **macOS** de GitHub
  (`macos-latest`) — corre en la nube, así que **no necesitás una Mac física**.
- Si `project_type` es `electron`, en cambio, corre **`build-electron`**: Linux +
  macOS + Windows en paralelo (`.AppImage`, `.dmg`, `.exe`) — tampoco necesitás
  esas máquinas.

### Guías por framework

El paso 1 de arriba es el mismo para los cuatro; cada framework tiene su propia
guía con el detalle real (cómo se detecta, notas específicas, y el ejemplo que
se autoprueba en CI en este repo):

- [`FLUTTER.md`](./FLUTTER.md)
- [`REACT-NATIVE.md`](./REACT-NATIVE.md)
- [`PWA.md`](./PWA.md) (Capacitor)
- [`ELECTRON.md`](./ELECTRON.md)

## 2. Descargar los resultados

Al terminar la ejecución, entrá a la pestaña **Actions** de tu repo → la ejecución
correspondiente → sección **Artifacts**: ahí están `android-build` (APK/AAB) e
`ios-build` (IPA o `.app` comprimido), o —para Electron— `electron-build-ubuntu-latest`,
`electron-build-macos-latest` y `electron-build-windows-latest`. El resumen
(`Summary`) de la ejecución también muestra el estado de cada plataforma.

## 3. Firma de apps (opcional)

Por defecto los builds son **sin firmar** (sirven para probar que compila, correr en
simulador/emulador, o distribución interna simple). Para producir builds firmados
listos para tiendas, configurá los secrets descritos en [`SIGNING.md`](./SIGNING.md).

## 4. Notificaciones (opcional)

- El resumen de cada ejecución (`Summary`) siempre se genera automáticamente, gratis,
  sin configuración.
- Si agregás el secret `SLACK_WEBHOOK_URL`, además se manda un mensaje a Slack con el
  resultado y el link a la ejecución.
- Si activás `create_release: true` y el workflow corre sobre un tag (`v1.2.3`), los
  artefactos se adjuntan automáticamente a un GitHub Release. Para esto tu workflow
  llamador necesita otorgar permiso de escritura explícitamente (una reusable workflow
  no puede pedir más permisos de los que el llamador le da):

  ```yaml
  jobs:
    build:
      permissions:
        contents: write
      uses: shadownrx/code/.github/workflows/build-mobile.yml@main
      with:
        create_release: true
      secrets: inherit
  ```

## Inputs disponibles

| Input | Default | Descripción |
|---|---|---|
| `project_type` | `auto` | `auto`, `flutter`, `react-native`, `pwa` o `electron`. `auto` detecta el tipo leyendo `pubspec.yaml`, `capacitor.config.ts`/`.json`, o `package.json`. |
| `build_android` | `true` | Compilar o no la parte Android. Ignorado si `project_type` es `electron`. |
| `build_ios` | `true` | Compilar o no la parte iOS. Ignorado si `project_type` es `electron`. |
| `build_electron` | `true` | Compilar o no Electron (Linux + macOS + Windows). Solo aplica si `project_type` es `electron`. |
| `working_directory` | `.` | Ruta al proyecto, útil en monorepos. |
| `flutter_channel` | `stable` | Versión/canal de Flutter. |
| `node_version` | `22` | Versión de Node para React Native, PWA y Electron. Revisá el campo `engines.node` de tu `package.json`: React Native 0.81+ requiere Node ≥ 22.11. |
| `create_release` | `false` | Adjuntar artefactos a un GitHub Release cuando corre sobre un tag. |

## Por qué es gratis y multi-equipo

- No hay servidor propio que mantener ni pagar: cada build corre en los runners
  hosteados de GitHub, con los minutos gratis de **cada repo que lo usa** (no los de
  esta plataforma).
- Cualquier cantidad de repos/equipos puede apuntar a este mismo workflow reutilizable
  sin coordinarse entre sí ni compartir cuota — es aislamiento nativo de GitHub Actions.
- El runner `macos-latest` es lo que elimina la necesidad de tener una Mac física para
  compilar iOS (o un Electron para macOS); `windows-latest` hace lo mismo para el
  target de Windows de Electron.

## ¿Algo falló?

Ver [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — errores reales que ya aparecieron
(no solo teóricos) con su causa y solución.
