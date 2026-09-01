# React Native

Compila tu app React Native para Android (`.apk` + `.aab`) e iOS (`.ipa`, o un
`.app` sin firmar) con `build-mobile.yml` — el build de iOS corre en un runner
macOS gratuito de GitHub, así que no necesitás una Mac.

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
      project_type: react-native
    secrets: inherit
```

## Cómo te detecta la plataforma

Con `project_type: auto` (el default), la plataforma reconoce un proyecto React
Native por un `package.json` en la raíz de `working_directory` que tenga la
dependencia `"react-native"`.

## Qué corre

- **Android**: `./gradlew assembleRelease bundleRelease` en un runner Linux
  (`ubuntu-latest`), después de `npm ci`.
- **iOS**: `pod install` + `xcodebuild archive` en `macos-latest` — con firma si
  configuraste los secrets, o `-sdk iphonesimulator` sin firma si no.
- JDK 21 y Node (input `node_version`, default `22`).

## Notas

- **Versión de Node**: React Native 0.81+ exige Node ≥ 22.11. Revisá el campo
  `engines.node` de tu `package.json`; el default de la plataforma (`22`) ya lo
  cubre, pero si tu proyecto necesita otra versión pasala explícitamente con
  `node_version`.
- **`android/app/build.gradle`** (Groovy, no `.kts`, en la plantilla estándar de
  RN): la firma opcional lee `key.properties` con el mismo patrón que Flutter —
  ver
  [`examples/react-native-demo/android/app/build.gradle`](../examples/react-native-demo/android/app/build.gradle)
  y [`SIGNING.md`](./SIGNING.md).
- **`ios/Podfile`**: la plataforma corre `pod install` antes de compilar, así
  que no hace falta commitear `ios/Pods/` ni el `.xcworkspace` que genera
  CocoaPods (ambos quedan afuera del repo vía `.gitignore`, como en cualquier
  proyecto React Native).
- **`android/gradlew`**: a diferencia de algunas plantillas de Flutter
  recientes, la plantilla de React Native SÍ commitea el wrapper de Gradle por
  defecto — no hace falta tocar nada ahí.

## Ejemplo real en este repo

[`examples/react-native-demo`](../examples/react-native-demo) — generado con
`npx @react-native-community/cli init` (React Native 0.87), compilado en cada
push por
[`.github/workflows/example-react-native-ci.yml`](../.github/workflows/example-react-native-ci.yml):

```yaml
name: Example React Native app (self-test)

on:
  push:
    paths:
      - "examples/react-native-demo/**"
  workflow_dispatch:

jobs:
  build:
    uses: ./.github/workflows/build-mobile.yml
    with:
      project_type: react-native
      working_directory: examples/react-native-demo
    secrets: inherit
```

## Ver también

- [`USAGE.md`](./USAGE.md) — inputs disponibles, descargar resultados, notificaciones.
- [`SIGNING.md`](./SIGNING.md) — firma de Android e iOS.
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — errores reales ya vistos.
