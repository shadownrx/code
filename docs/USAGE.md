# Cómo conectar tu repo a la plataforma

Esta plataforma no es un servicio al que subís código: es un **workflow reutilizable
de GitHub Actions** que vive en este repo (`shadownrx/code`). Cualquier equipo con
un proyecto **Flutter**, **React Native**, o una **PWA** (empaquetada con
[Capacitor](https://capacitorjs.com)) en GitHub lo activa agregando un archivo de
una sola línea de `uses:` a su propio repositorio. Cada equipo/repo queda
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
      project_type: auto        # auto | flutter | react-native | pwa
      build_android: true
      build_ios: true
    secrets: inherit            # pasa tus secrets (firma, Slack, etc.) si los configuraste
```

Con esto, cada push a `main` (o cada PR) compila automáticamente:

- **Android** (`.apk` y `.aab`) en un runner Linux (`ubuntu-latest`, gratis e ilimitado
  en repos públicos; con cuota mensual gratis en privados).
- **iOS** (`.ipa` o un `.app` sin firmar) en un runner **macOS** de GitHub
  (`macos-latest`) — corre en la nube, así que **no necesitás una Mac física**.

### Ejemplo real: React Native

Este mismo repo incluye [`examples/react-native-demo`](../examples/react-native-demo),
generado con `npx @react-native-community/cli init` (React Native 0.87) y usado para
probar la plataforma en cada push. El workflow que lo compila es
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

Puntos a tener en cuenta con un proyecto React Native real:

- **Versión de Node**: React Native 0.81+ exige Node ≥ 22.11 (revisá `engines.node` en
  tu `package.json`). El input `node_version` de la plataforma ya usa `22` por
  defecto; si tu proyecto necesita otra versión, pasala explícitamente.
- **`android/app/build.gradle`** (Groovy, no `.kts`, en la plantilla estándar de RN):
  la firma opcional lee `key.properties` con el mismo patrón que Flutter — ver
  [`examples/react-native-demo/android/app/build.gradle`](../examples/react-native-demo/android/app/build.gradle)
  y [`SIGNING.md`](./SIGNING.md).
- **`ios/Podfile`**: la plataforma corre `pod install` antes de compilar, así que no
  hace falta commitear la carpeta `ios/Pods/` ni el `.xcworkspace` generado por
  CocoaPods (ambos quedan afuera del repo vía `.gitignore`, como en cualquier
  proyecto React Native).
- **`android/gradlew`**: a diferencia de algunas plantillas de Flutter recientes, la
  plantilla de React Native SÍ commitea el wrapper de Gradle por defecto — no hace
  falta tocar nada ahí.

### Ejemplo real: PWA (Capacitor) — v1.2

Este mismo repo incluye [`examples/pwa-demo`](../examples/pwa-demo): una PWA
mínima (`www/index.html` + `manifest.webmanifest` + `sw.js`, sin bundler) envuelta
como app nativa con [Capacitor](https://capacitorjs.com) (`npx cap add android` /
`npx cap add ios`). El workflow que la compila es
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

Cómo conectar tu propia PWA:

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
   exclusiones estándar de `.gitignore` que ya trae `npx cap add` — no hace falta
   nada especial).
3. Apuntá `working_directory` a la carpeta de tu proyecto y usá `project_type: pwa`
   (o dejá `auto`: la plataforma detecta Capacitor por la presencia de
   `capacitor.config.ts`/`.json`).

Puntos a tener en cuenta:

- **La plataforma corre `npm run build --if-present` antes de `npx cap sync`** —
  si tu PWA usa un bundler (Vite, webpack, etc.), asegurate de que tu script
  `build` en `package.json` genere el contenido de `webDir`. El ejemplo de este
  repo no tiene bundler, así que ese paso no hace nada (`--if-present` lo omite
  sin error).
- **iOS sin CocoaPods**: Capacitor 7+ resuelve sus dependencias de iOS con Swift
  Package Manager por defecto, no con CocoaPods — no hay `Podfile` ni
  `.xcworkspace` en un proyecto Capacitor nuevo, así que la plataforma compila
  directo contra `ios/App/App.xcodeproj`. Si agregás un plugin que todavía
  requiere CocoaPods, Capacitor genera el `Podfile` solo y `npx cap sync ios` lo
  instala automáticamente — no hace falta que cambies nada del workflow.
- **Firma de Android**: mismo patrón `key.properties` que Flutter/React Native —
  ver [`examples/pwa-demo/android/app/build.gradle`](../examples/pwa-demo/android/app/build.gradle)
  y [`SIGNING.md`](./SIGNING.md).

## 2. Descargar los resultados

Al terminar la ejecución, entrá a la pestaña **Actions** de tu repo → la ejecución
correspondiente → sección **Artifacts**: ahí están `android-build` (APK/AAB) e
`ios-build` (IPA o `.app` comprimido). El resumen (`Summary`) de la ejecución
también muestra el estado de cada plataforma.

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
| `project_type` | `auto` | `auto`, `flutter`, `react-native` o `pwa`. `auto` detecta el tipo leyendo `pubspec.yaml`, `capacitor.config.ts`/`.json`, o `package.json`. |
| `build_android` | `true` | Compilar o no la parte Android. |
| `build_ios` | `true` | Compilar o no la parte iOS. |
| `working_directory` | `.` | Ruta al proyecto, útil en monorepos. |
| `flutter_channel` | `stable` | Versión/canal de Flutter. |
| `node_version` | `22` | Versión de Node para React Native. Revisá el campo `engines.node` de tu `package.json`: React Native 0.81+ requiere Node ≥ 22.11. |
| `create_release` | `false` | Adjuntar artefactos a un GitHub Release cuando corre sobre un tag. |

## Por qué es gratis y multi-equipo

- No hay servidor propio que mantener ni pagar: cada build corre en los runners
  hosteados de GitHub, con los minutos gratis de **cada repo que lo usa** (no los de
  esta plataforma).
- Cualquier cantidad de repos/equipos puede apuntar a este mismo workflow reutilizable
  sin coordinarse entre sí ni compartir cuota — es aislamiento nativo de GitHub Actions.
- El runner `macos-latest` es lo que elimina la necesidad de tener una Mac física para
  compilar iOS.

## ¿Algo falló?

Ver [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — errores reales que ya aparecieron
(no solo teóricos) con su causa y solución.
