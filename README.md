# Plataforma de compilación Android + iOS + Electron

Compila apps **Android**, **iOS** y de escritorio (**Electron**, Linux/macOS/
Windows) a partir de un mismo proyecto (Flutter, React Native, PWA con Capacitor,
o Electron), **gratis**, sin necesitar una Mac física para iOS ni una Mac/Windows
física para Electron.

## El problema que resuelve

Compilar para iOS normalmente exige Xcode, que solo corre en macOS. Empaquetar un
Electron para las tres plataformas de escritorio exige tener (o conseguir) una Mac
y una PC con Windows además de Linux. Si tu equipo no tiene esas máquinas, quedás
bloqueado. Esta plataforma elimina ese choque: cada build corre en el runner
**gratuito de GitHub** que corresponde (Linux, **macOS**, o Windows), en la nube,
disparado automáticamente con cada push — vos nunca tocás esas máquinas.

## Cómo funciona

Es un **workflow reutilizable de GitHub Actions** (no un servicio al que subís
código). Cualquier repo de cualquier equipo lo adopta agregando una sola referencia
`uses:` a su propio `.github/workflows/build.yml`:

```yaml
jobs:
  build:
    uses: shadownrx/code/.github/workflows/build-mobile.yml@main
    with:
      project_type: auto   # detecta Flutter, React Native, PWA (Capacitor) o Electron automáticamente
    secrets: inherit
```

Al hacer push, se disparan en paralelo:

- **`build-android`** en un runner Linux → genera `.apk` y `.aab` (Flutter/RN/PWA).
- **`build-ios`** en un runner **macOS** de GitHub → genera `.ipa` (o un `.app` sin
  firmar si todavía no configuraste una cuenta de Apple Developer) (Flutter/RN/PWA).
- **`build-electron`** en Linux + **macOS** + **Windows** en paralelo (matrix) →
  genera `.AppImage`, `.dmg` y `.exe` (proyectos Electron).
- **`notify`** → deja un resumen en la ejecución, opcionalmente notifica a Slack y
  opcionalmente adjunta los artefactos a un GitHub Release.

`project_type` decide qué corre: Electron usa `build-electron`, los otros tres
usan `build-android`/`build-ios` — nunca corren los dos grupos a la vez.

Cada repo que usa este workflow es independiente: sus propios minutos gratis de
Actions, sus propios secrets, sus propios artefactos. No hay backend propio que
mantener ni pagar, por lo que escala a cualquier número de equipos sin costo para
esta plataforma.

## Estructura

```
.github/
  workflows/
    build-mobile.yml             # el workflow reutilizable (el corazón de la plataforma)
    example-flutter-ci.yml       # autotest: corre build-mobile.yml sobre examples/flutter-demo
    example-react-native-ci.yml  # autotest: corre build-mobile.yml sobre examples/react-native-demo
    example-pwa-ci.yml           # autotest: corre build-mobile.yml sobre examples/pwa-demo
    example-electron-ci.yml      # autotest: corre build-mobile.yml sobre examples/electron-demo
  actions/
    detect-project/          # detecta si el repo consumidor es Flutter, React Native, PWA o Electron
docs/
  USAGE.md                   # cómo conectar tu repo, paso a paso (genérico)
  FLUTTER.md                 # guía específica de Flutter
  REACT-NATIVE.md            # guía específica de React Native
  PWA.md                     # guía específica de PWA (Capacitor)
  ELECTRON.md                # guía específica de Electron
  SIGNING.md                 # cómo configurar firma de Android/iOS y notificaciones
  TROUBLESHOOTING.md         # errores frecuentes (reales, ya vistos) y cómo resolverlos
examples/
  flutter-demo/               # app Flutter mínima usada para probar la plataforma
  react-native-demo/          # app React Native mínima usada para probar la plataforma
  pwa-demo/                   # PWA mínima empaquetada con Capacitor, usada para probar la plataforma
  electron-demo/              # app Electron mínima usada para probar la plataforma
cli/
  bin.js                      # configurador interactivo de terminal — ver cli/README.md
  mcp-server.js                # lo mismo, como tool MCP para Cursor/Claude Code/etc.
.cursor/
  mcp.json                     # este repo ya trae la tool de Cursor precargada
Landing/                       # sitio de docs/landing en Astro (vercel.com/docs-like)
```

## Empezar

**Opción rápida — asistente de terminal:** el paquete
[`shadownrx-code`](https://www.npmjs.com/package/shadownrx-code) está
publicado en npm. Ejecutando `npx shadownrx-code` en la raíz del proyecto
(Flutter, React Native, PWA o Electron) se generan las preguntas de
configuración necesarias y se escribe `.github/workflows/build.yml` listo
para usar. Ver [`cli/README.md`](cli/README.md) para el detalle de
instalación y uso.

**Opción tool de editor — Cursor / cualquier cliente MCP:** la misma
funcionalidad, expuesta como una tool que el agente invoca directamente
durante la conversación, sin necesidad de ejecutar un comando manualmente.
Este repositorio incluye `.cursor/mcp.json` preconfigurado (requiere
ejecutar `npm install` en `cli/` una vez) — ver la sección
["Como tool de Cursor"](cli/README.md#como-tool-de-cursor-o-cualquier-cliente-mcp)
de `cli/README.md`.

**Manual:**

1. Leé [`docs/USAGE.md`](docs/USAGE.md) para el flujo general, y después la guía
   de tu framework: [`FLUTTER.md`](docs/FLUTTER.md),
   [`REACT-NATIVE.md`](docs/REACT-NATIVE.md), [`PWA.md`](docs/PWA.md) o
   [`ELECTRON.md`](docs/ELECTRON.md).
2. (Opcional) Leé [`docs/SIGNING.md`](docs/SIGNING.md) para builds firmados y
   notificaciones por Slack.
3. Mirá los proyectos de ejemplo, ya configurados para esta plataforma (firma
   opcional de Android incluida) — cada push a su carpeta dispara su propio
   workflow y compila como prueba viva de que el pipeline funciona:
   - [`examples/flutter-demo`](examples/flutter-demo) — Flutter, ver
     `android/app/build.gradle.kts`, disparado por `example-flutter-ci.yml`.
   - [`examples/react-native-demo`](examples/react-native-demo) — React Native, ver
     `android/app/build.gradle`, disparado por `example-react-native-ci.yml`.
   - [`examples/pwa-demo`](examples/pwa-demo) — PWA empaquetada con Capacitor, ver
     `android/app/build.gradle`, disparado por `example-pwa-ci.yml`.
   - [`examples/electron-demo`](examples/electron-demo) — Electron, compila
     `.AppImage`/`.dmg`/`.exe` en Linux+macOS+Windows, disparado por
     `example-electron-ci.yml`.
4. Si algo falla, mirá [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — reúne
   los errores que ya aparecieron armando esta plataforma (y cómo se resolvieron),
   no solo casos teóricos.

## Costo

- Repos **públicos**: minutos de GitHub Actions ilimitados, incluyendo runners
  macOS y Windows.
- Repos **privados**: cuota mensual gratis de GitHub Actions (los runners macOS y
  Windows consumen minutos a una tasa mayor que Linux dentro de esa cuota — para
  Electron, eso significa que el job `build-electron` gasta más cuota que
  `build-android` por correr en los tres sistemas operativos).
- Firma de iOS para distribución fuera de simulador requiere una cuenta de Apple
  Developer (costo impuesto por Apple, no por esta plataforma) — sin ella, igual se
  generan builds sin firmar para verificar que el proyecto compila. La firma de
  Electron (macOS/Windows) todavía no está soportada por la plataforma; los builds
  salen sin firmar.
