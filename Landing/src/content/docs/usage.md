---
title: Cómo conectar tu repo
description: Cómo agregar el workflow reutilizable a un proyecto Flutter, React Native, PWA o Electron.
section: Guías
order: 1
---

Esta plataforma no es un servicio al que subís código: es un **workflow reutilizable
de GitHub Actions** que vive en `shadownrx/code`. Cualquier equipo con un proyecto
**Flutter**, **React Native**, una **PWA** (empaquetada con
[Capacitor](https://capacitorjs.com)), o una app de escritorio **Electron** lo
activa agregando un archivo de una sola línea de `uses:` a su propio repositorio.
Cada equipo/repo queda completamente aislado: usa sus propios minutos gratis de
Actions, sus propios secrets y sus propios artifacts.

> Atajo: [`npx shadownrx-code`](/docs/cli) parado en tu proyecto hace las
> preguntas necesarias y escribe el archivo por vos. Lo que sigue es el mismo
> resultado, a mano.

## Agregar el workflow

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
    secrets: inherit
```

Con esto, cada push a `main` (o cada PR) compila:

- **Android** (`.apk` y `.aab`) en un runner Linux — gratis e ilimitado en repos
  públicos, con cuota mensual gratis en privados.
- **iOS** (`.ipa` o un `.app` sin firmar) en un runner **macOS** de GitHub — corre
  en la nube, así que no necesitás una Mac física.
- Si `project_type` es `electron`, en cambio, corre **Linux + macOS + Windows**
  en paralelo (`.AppImage`, `.dmg`, `.exe`) — tampoco necesitás esas máquinas.

## Descargar los resultados

Al terminar la ejecución, entrá a **Actions** → la ejecución correspondiente →
**Artifacts**: ahí están `android-build` e `ios-build`, o —para Electron—
`electron-build-ubuntu-latest`, `electron-build-macos-latest` y
`electron-build-windows-latest`. El resumen (`Summary`) de la ejecución también
muestra el estado de cada plataforma.

## Firma de apps

Por defecto los builds son sin firmar. Para producir builds firmados, configurá
los secrets descritos en [Firma de apps](/docs/signing). La firma de Electron
todavía no está soportada por la plataforma; sus builds siempre salen sin
firmar.

## Notificaciones

- El resumen de cada ejecución se genera siempre, sin configuración.
- Con el secret `SLACK_WEBHOOK_URL` configurado, además se manda un mensaje a
  Slack con el resultado y el link a la ejecución.
- Con `create_release: true`, si el workflow corre sobre un tag, los artifacts se
  adjuntan a un GitHub Release. Esto requiere que tu workflow llamador otorgue
  `permissions: contents: write` explícitamente:

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
| `project_type` | `auto` | `auto`, `flutter`, `react-native`, `pwa` o `electron`. |
| `build_android` | `true` | Compilar o no la parte Android. Ignorado si `project_type` es `electron`. |
| `build_ios` | `true` | Compilar o no la parte iOS. Ignorado si `project_type` es `electron`. |
| `build_electron` | `true` | Compilar o no Electron (Linux + macOS + Windows). Solo aplica si `project_type` es `electron`. |
| `working_directory` | `.` | Ruta al proyecto, útil en monorepos. |
| `flutter_channel` | `stable` | Canal de Flutter. |
| `node_version` | `22` | Versión de Node para React Native, PWA y Electron. |
| `create_release` | `false` | Adjuntar artifacts a un GitHub Release en tags. |

## Ejemplo real: React Native

El repo incluye `examples/react-native-demo` (React Native 0.87), compilado en
cada push por `example-react-native-ci.yml`. React Native 0.81+ exige Node ≥
22.11 — el default de `node_version` ya es `22`.

## Ejemplo real: PWA (Capacitor)

El repo incluye `examples/pwa-demo`: una PWA mínima envuelta con
`npx cap add android/ios`. La plataforma corre `npm run build --if-present` antes
de `npx cap sync`. Capacitor 7+ resuelve iOS con Swift Package Manager, no
CocoaPods — no hace falta `pod install` en un proyecto nuevo.

## Ejemplo real: Electron

El repo incluye `examples/electron-demo`, compilado en Linux, macOS y Windows en
paralelo por `example-electron-ci.yml`, usando `electron-builder` con
`--publish=never`.

## Por qué es gratis y multi-equipo

No hay servidor propio que mantener: cada build corre en los runners hosteados de
GitHub, con los minutos gratis de cada repo que lo usa — no los de esta
plataforma. El runner `macos-latest` es lo que elimina la necesidad de tener una
Mac física para compilar iOS (o un Electron para macOS); `windows-latest` hace lo
mismo para el target de Windows de Electron.

> Si algo falla, el primer lugar para mirar es
> [Errores y soluciones](/docs/troubleshooting) — reúne fallas reales, no casos
> teóricos.
