# Flutter

Compila tu app Flutter para Android (`.apk` + `.aab`) e iOS (`.ipa`, o un `.app`
sin firmar) con `build-mobile.yml` — el build de iOS corre en un runner macOS
gratuito de GitHub, así que no necesitás una Mac.

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
      project_type: flutter
    secrets: inherit
```

## Cómo te detecta la plataforma

Con `project_type: auto` (el default), la plataforma reconoce un proyecto
Flutter por un `pubspec.yaml` en la raíz de `working_directory` que tenga una
clave `flutter:`.

## Qué corre

- **Android**: `flutter build apk --release` + `flutter build appbundle --release`
  en un runner Linux (`ubuntu-latest`).
- **iOS**: `flutter build ipa --release` (con secrets de firma) o
  `flutter build ios --release --no-codesign` (sin firma, empaquetado como
  `.app` comprimido) en `macos-latest`.
- JDK 21 (compartido con los demás frameworks — ver
  [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)) y el canal de Flutter que definas
  con el input `flutter_channel` (default `stable`).

## Notas

- **`android/gradlew` y `gradle-wrapper.jar`**: algunas plantillas recientes de
  Flutter los agregan a `.gitignore`, asumiendo que se regeneran solos. En un
  `git clone` limpio como el que hace CI, si no están committeados, no existen y
  el build falla con `gradlew: not found`. Sacá esas líneas de
  `android/.gitignore` y commiteá los archivos del wrapper — es exactamente lo
  que se corrigió en
  [`examples/flutter-demo/android/.gitignore`](../examples/flutter-demo/android/.gitignore)
  al armar el ejemplo de este repo.
- **Firma de Android**: la plantilla actual de Flutter usa Kotlin DSL
  (`build.gradle.kts`). El patrón `key.properties` para leer los secrets de
  firma está aplicado en
  [`examples/flutter-demo/android/app/build.gradle.kts`](../examples/flutter-demo/android/app/build.gradle.kts)
  — ver [`SIGNING.md`](./SIGNING.md) para el detalle completo.

## Ejemplo real en este repo

[`examples/flutter-demo`](../examples/flutter-demo) — generado con
`flutter create` (no a mano), compilado en cada push por
[`.github/workflows/example-flutter-ci.yml`](../.github/workflows/example-flutter-ci.yml):

```yaml
name: Example Flutter app (self-test)

on:
  push:
    paths:
      - "examples/flutter-demo/**"
  workflow_dispatch:

jobs:
  build:
    uses: ./.github/workflows/build-mobile.yml
    with:
      project_type: flutter
      working_directory: examples/flutter-demo
    secrets: inherit
```

## Ver también

- [`USAGE.md`](./USAGE.md) — inputs disponibles, descargar resultados, notificaciones.
- [`SIGNING.md`](./SIGNING.md) — firma de Android e iOS.
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — errores reales ya vistos.
