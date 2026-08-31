---
title: Cómo conectar tu repo
description: Cómo agregar el workflow reutilizable a un proyecto Flutter, React Native o PWA.
section: Guías
order: 1
---

Esta plataforma no es un servicio al que subís código: es un **workflow reutilizable
de GitHub Actions** que vive en `shadownrx/code`. Cualquier equipo con un proyecto
**Flutter**, **React Native**, o una **PWA** (empaquetada con
[Capacitor](https://capacitorjs.com)) lo activa agregando un archivo de una sola
línea de `uses:` a su propio repositorio. Cada equipo/repo queda completamente
aislado: usa sus propios minutos gratis de Actions, sus propios secrets y sus
propios artifacts.

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
      project_type: auto        # auto | flutter | react-native | pwa
      build_android: true
      build_ios: true
    secrets: inherit
```

Con esto, cada push a `main` (o cada PR) compila:

- **Android** (`.apk` y `.aab`) en un runner Linux — gratis e ilimitado en repos
  públicos, con cuota mensual gratis en privados.
- **iOS** (`.ipa` o un `.app` sin firmar) en un runner **macOS** de GitHub — corre
  en la nube, así que no necesitás una Mac física.

## Descargar los resultados

Al terminar la ejecución, entrá a **Actions** → la ejecución correspondiente →
**Artifacts**: ahí están `android-build` e `ios-build`. El resumen (`Summary`) de
la ejecución también muestra el estado de cada plataforma.

## Firma de apps

Por defecto los builds son sin firmar. Para producir builds firmados, configurá
los secrets descritos en [Firma de apps](/docs/signing).

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
| `project_type` | `auto` | `auto`, `flutter`, `react-native` o `pwa`. |
| `build_android` | `true` | Compilar o no la parte Android. |
| `build_ios` | `true` | Compilar o no la parte iOS. |
| `working_directory` | `.` | Ruta al proyecto, útil en monorepos. |
| `flutter_channel` | `stable` | Canal de Flutter. |
| `node_version` | `22` | Versión de Node para React Native / PWA. |
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

## Por qué es gratis y multi-equipo

No hay servidor propio que mantener: cada build corre en los runners hosteados de
GitHub, con los minutos gratis de cada repo que lo usa — no los de esta
plataforma. El runner `macos-latest` es lo que elimina la necesidad de tener una
Mac física para compilar iOS.

> Si algo falla, el primer lugar para mirar es
> [Errores y soluciones](/docs/troubleshooting) — reúne fallas reales, no casos
> teóricos.
