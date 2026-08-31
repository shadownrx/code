# Plataforma de compilación Android + iOS

Compila apps **Android** e **iOS** a partir de un mismo proyecto (Flutter o React
Native), **gratis**, sin necesitar una Mac física para generar los builds de iOS.

## El problema que resuelve

Compilar para iOS normalmente exige Xcode, que solo corre en macOS. Si tu equipo no
tiene Macs, quedás bloqueado para esa mitad del trabajo. Esta plataforma elimina ese
choque: el build de iOS corre en un runner **macOS gratuito hosteado por GitHub**, en
la nube, disparado automáticamente con cada push — vos nunca tocás una Mac.

## Cómo funciona

Es un **workflow reutilizable de GitHub Actions** (no un servicio al que subís
código). Cualquier repo de cualquier equipo lo adopta agregando una sola referencia
`uses:` a su propio `.github/workflows/build.yml`:

```yaml
jobs:
  build:
    uses: shadownrx/code/.github/workflows/build-mobile.yml@main
    with:
      project_type: auto   # detecta Flutter o React Native automáticamente
    secrets: inherit
```

Al hacer push, se disparan en paralelo:

- **`build-android`** en un runner Linux → genera `.apk` y `.aab`.
- **`build-ios`** en un runner **macOS** de GitHub → genera `.ipa` (o un `.app` sin
  firmar si todavía no configuraste una cuenta de Apple Developer).
- **`notify`** → deja un resumen en la ejecución, opcionalmente notifica a Slack y
  opcionalmente adjunta los artefactos a un GitHub Release.

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
  actions/
    detect-project/          # detecta si el repo consumidor es Flutter o React Native
docs/
  USAGE.md                   # cómo conectar tu repo, paso a paso
  SIGNING.md                 # cómo configurar firma de Android/iOS y notificaciones
  TROUBLESHOOTING.md         # errores frecuentes (reales, ya vistos) y cómo resolverlos
examples/
  flutter-demo/               # app Flutter mínima usada para probar la plataforma
  react-native-demo/          # app React Native mínima usada para probar la plataforma
```

## Empezar

1. Leé [`docs/USAGE.md`](docs/USAGE.md) para conectar tu repo Flutter o React Native.
2. (Opcional) Leé [`docs/SIGNING.md`](docs/SIGNING.md) para builds firmados y
   notificaciones por Slack.
3. Mirá los proyectos de ejemplo, ya configurados para esta plataforma (firma
   opcional de Android incluida) — cada push a su carpeta dispara su propio
   workflow y compila Android + iOS como prueba viva de que el pipeline funciona:
   - [`examples/flutter-demo`](examples/flutter-demo) — Flutter, ver
     `android/app/build.gradle.kts`, disparado por `example-flutter-ci.yml`.
   - [`examples/react-native-demo`](examples/react-native-demo) — React Native, ver
     `android/app/build.gradle`, disparado por `example-react-native-ci.yml`.
4. Si algo falla, mirá [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — reúne
   los errores que ya aparecieron armando esta plataforma (y cómo se resolvieron),
   no solo casos teóricos.

## Costo

- Repos **públicos**: minutos de GitHub Actions ilimitados, incluyendo runners macOS.
- Repos **privados**: cuota mensual gratis de GitHub Actions (los runners macOS
  consumen minutos a una tasa mayor que Linux dentro de esa cuota).
- Firma de iOS para distribución fuera de simulador requiere una cuenta de Apple
  Developer (costo impuesto por Apple, no por esta plataforma) — sin ella, igual se
  generan builds sin firmar para verificar que el proyecto compila.
