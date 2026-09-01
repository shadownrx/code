# PWA (Capacitor)

Empaqueta tu PWA como app nativa Android (`.apk` + `.aab`) e iOS (`.ipa`, o un
`.app` sin firmar) usando [Capacitor](https://capacitorjs.com) — el build de
iOS corre en un runner macOS gratuito de GitHub, así que no necesitás una Mac.

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
      project_type: pwa
    secrets: inherit
```

## Conectar tu propia PWA

1. Si todavía no la envolviste, agregá Capacitor a tu proyecto:
   ```bash
   npm install @capacitor/core @capacitor/android @capacitor/ios
   npm install -D @capacitor/cli
   npx cap init "Mi App" com.miempresa.miapp --web-dir dist   # o build/, www/, etc.
   npx cap add android
   npx cap add ios
   ```
   `--web-dir` debe apuntar a la carpeta donde tu bundler deja el build de
   producción de la PWA (`dist/`, `build/`, `www/`...).
2. Commiteá `capacitor.config.json`/`.ts`, `android/` e `ios/` (con las mismas
   exclusiones estándar de `.gitignore` que ya trae `npx cap add` — no hace
   falta nada especial).
3. Usá `project_type: pwa` (o dejá `auto`: la plataforma detecta Capacitor por
   la presencia de `capacitor.config.ts`/`.json`).

## Qué corre

- **Android**: `npm run build --if-present` + `npx cap sync android`, después
  `./gradlew assembleRelease bundleRelease`, en `ubuntu-latest`.
- **iOS**: `npm run build --if-present` + `npx cap sync ios`, después
  `xcodebuild archive` directo contra `ios/App/App.xcodeproj`, en
  `macos-latest`.

## Notas

- **La plataforma corre `npm run build --if-present` antes de `npx cap sync`**
  — si tu PWA usa un bundler (Vite, webpack, etc.), asegurate de que tu script
  `build` en `package.json` genere el contenido de `webDir`. El ejemplo de este
  repo no tiene bundler, así que ese paso no hace nada (`--if-present` lo omite
  sin error).
- **iOS sin CocoaPods**: Capacitor 7+ resuelve sus dependencias de iOS con
  Swift Package Manager por defecto, no con CocoaPods — no hay `Podfile` ni
  `.xcworkspace` en un proyecto Capacitor nuevo, así que la plataforma compila
  directo contra `ios/App/App.xcodeproj` con `-scheme App` (nombre fijo del
  template, no hace falta autodetectarlo). Si agregás un plugin que todavía
  requiere CocoaPods, Capacitor genera el `Podfile` solo y `npx cap sync ios`
  lo instala automáticamente — no hace falta que cambies nada del workflow.
- **Firma de Android**: mismo patrón `key.properties` que Flutter/React
  Native, con una diferencia — la plantilla de Capacitor no define un
  `signingConfig` de `debug` explícito, así que sin `key.properties` el build
  de release queda directamente sin firmar (no cae a la firma debug como en
  Flutter/RN). Ver
  [`examples/pwa-demo/android/app/build.gradle`](../examples/pwa-demo/android/app/build.gradle)
  y [`SIGNING.md`](./SIGNING.md).

## Ejemplo real en este repo

[`examples/pwa-demo`](../examples/pwa-demo): una PWA mínima
(`www/index.html` + `manifest.webmanifest` + `sw.js`, sin bundler) envuelta con
`npx cap add android` / `npx cap add ios`, compilada en cada push por
[`.github/workflows/example-pwa-ci.yml`](../.github/workflows/example-pwa-ci.yml):

```yaml
name: Example PWA (Capacitor) app (self-test)

on:
  push:
    paths:
      - "examples/pwa-demo/**"
  workflow_dispatch:

jobs:
  build:
    uses: ./.github/workflows/build-mobile.yml
    with:
      project_type: pwa
      working_directory: examples/pwa-demo
    secrets: inherit
```

## Ver también

- [`USAGE.md`](./USAGE.md) — inputs disponibles, descargar resultados, notificaciones.
- [`SIGNING.md`](./SIGNING.md) — firma de Android e iOS.
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — errores reales ya vistos.
