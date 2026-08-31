# Posibles errores y cómo solucionarlos

Esta lista incluye errores reales que aparecieron mientras se armaba y probaba esta
plataforma (algunos ya corregidos en `build-mobile.yml`, documentados acá por si
volvés a tocar el workflow) y otros esperables al conectar un proyecto propio.

## Errores del workflow en sí (`build-mobile.yml`)

### "Invalid workflow file... Unrecognized named-value: 'secrets'"

**Síntoma:** la ejecución falla instantáneamente, con 0 jobs, apenas hacés push —
ni siquiera llega a arrancar el runner.

**Causa:** GitHub Actions no permite usar el contexto `secrets` dentro de una
condición `if:` (solo está permitido en `run:`, `env:` y `with:`). Por ejemplo
`if: secrets.MI_SECRET != ''` es inválido.

**Solución:** exponé el secret como variable de entorno a nivel de `job` y
consultá esa variable en el `if:`:

```yaml
jobs:
  mi-job:
    env:
      TENGO_SECRET: ${{ secrets.MI_SECRET != '' }}
    steps:
      - name: Paso condicional
        if: env.TENGO_SECRET == 'true'
```

Este error ya está corregido en `build-mobile.yml` (los checks de
`ANDROID_KEYSTORE_BASE64` y `SLACK_WEBHOOK_URL` usan este patrón), pero si agregás
un nuevo `if:` que lea un secret directamente, va a volver a pasar.

### "The nested job 'X' is requesting 'contents: write', but is only allowed 'contents: read'"

**Síntoma:** el workflow llamador (tu `build.yml`) falla con `startup_failure` al
invocar `build-mobile.yml`, incluso si vos no tocaste nada de permisos.

**Causa:** un workflow reutilizable no puede pedir más permisos de los que le
otorga quien lo llama. El job `notify` de `build-mobile.yml` necesita
`contents: write` únicamente para el paso opcional de crear un GitHub Release
(`create_release: true`), pero por defecto tu repo no le da ese permiso al
`GITHUB_TOKEN`.

**Solución:** si no usás `create_release: true`, no necesitás hacer nada — este
paso no pide el permiso a menos que haga falta. Si sí lo usás, agregá el bloque de
permisos en tu propio workflow llamador (ver [`USAGE.md`](./USAGE.md#4-notificaciones-opcional)):

```yaml
jobs:
  build:
    permissions:
      contents: write
    uses: shadownrx/code/.github/workflows/build-mobile.yml@main
    with:
      create_release: true
```

## Errores de build de Android

### `npm ci` o `flutter pub get` fallan por versión de Node

**Síntoma:** el job `build-android` (o `build-ios`) falla en el paso de instalar
dependencias con un error tipo `EBADENGINE` o "Unsupported engine".

**Causa:** tu `package.json` tiene un `engines.node` más nuevo que el
`node_version` que le pasaste al workflow (React Native 0.81+ exige Node ≥ 22.11;
el default de la plataforma ya es `22`, pero si lo overrideaste a un valor viejo,
falla).

**Solución:** revisá `engines.node` en tu `package.json` y pasá esa versión en el
input `node_version`.

### `./gradlew: Permission denied` o "gradlew: not found"

**Síntoma:** el paso de Android falla porque no encuentra `gradlew` o no tiene
permiso de ejecución.

**Causa:** algunas plantillas recientes de Flutter agregan `gradlew` y
`gradle-wrapper.jar` a `.gitignore` (para no versionar binarios), asumiendo que se
regeneran solos — pero en un `git clone` limpio como el que hace CI, si no están
committeados, no existen.

**Solución:** revisá `android/.gitignore` en tu proyecto y sacá las líneas que
ignoren `gradlew`, `gradlew.bat` y `gradle-wrapper.jar`; commiteá esos archivos.
Es exactamente lo que se corrigió en
[`examples/flutter-demo/android/.gitignore`](../examples/flutter-demo/android/.gitignore)
al armar el ejemplo de esta plataforma.

### El APK/AAB sale sin firmar aunque configuré los secrets de Android

**Síntoma:** el build compila bien, pero el artefacto sigue firmado con la clave
debug.

**Causa más común:** tu `android/app/build.gradle` (o `.kts`) no lee
`key.properties`. El workflow decodifica el keystore y escribe ese archivo, pero
si el `build.gradle` no está configurado para usarlo, Gradle sigue usando el
`signingConfig` que ya tenía.

**Solución:** aplicá el patrón de `key.properties` que documenta
[`SIGNING.md`](./SIGNING.md) — hay un ejemplo real ya aplicado en
[`examples/flutter-demo/android/app/build.gradle.kts`](../examples/flutter-demo/android/app/build.gradle.kts)
(Kotlin DSL) y en
[`examples/react-native-demo/android/app/build.gradle`](../examples/react-native-demo/android/app/build.gradle)
(Groovy).

## Errores de build de iOS

### `pod install` falla o no encuentra el `Podfile`

**Síntoma:** el job `build-ios` falla en el paso `pod install` (solo en proyectos
React Native; Flutter no usa este paso).

**Causa habitual:** el `Podfile` no está en `ios/` dentro de `working_directory`,
o el `Podfile.lock` quedó desincronizado con `package.json` después de agregar una
dependencia nativa nueva.

**Solución:** corré `pod install` localmente (si tenés Mac) o `pod update` para
regenerar `Podfile.lock`, commiteá el resultado, y confirmá que `working_directory`
apunta a la raíz correcta del proyecto (donde está la carpeta `ios/`).

### `xcodebuild: error: no schemes found` o falla al detectar el scheme

**Síntoma:** el paso de `xcodebuild archive` falla antes de compilar nada, al
intentar resolver `$SCHEME`.

**Causa:** el script asume que existe al menos un scheme compartido
(`xcshareddata/xcschemes/*.xcscheme`) en el `.xcodeproj`/`.xcworkspace`. Si
renombraste el proyecto de Xcode manualmente sin regenerar los schemes
compartidos, la detección automática falla.

**Solución:** abrí el proyecto en Xcode una vez y marcá el scheme como
"Shared" (Product → Scheme → Manage Schemes → checkbox Shared), commiteá el
archivo `.xcscheme` generado bajo `xcshareddata/`.

### El `.ipa` firmado no se genera aunque configuré los secrets de iOS

**Síntoma:** el job iOS termina bien, pero solo aparece el `.app` sin firmar en
los artefactos.

**Causa:** para que la plataforma intente el build firmado hacen falta **ambos**
secrets, `IOS_CERTIFICATE_BASE64` **y** `IOS_PROVISION_PROFILE_BASE64` — si falta
cualquiera de los dos, el workflow cae automáticamente al build sin firmar (es
intencional, para no romper el pipeline por una config incompleta).

**Solución:** confirmá que ambos secrets estén configurados, y que
`IOS_TEAM_ID` corresponda a la cuenta de Apple Developer dueña del certificado y
el perfil de aprovisionamiento — un Team ID incorrecto hace que `xcodebuild
-exportArchive` falle igual, ya con los certificados importados.

## El proyecto no se detecta (`project_type: unknown`)

**Síntoma:** los jobs `build-android`/`build-ios` aparecen como `skipped` en vez
de correr.

**Causa:** con `project_type: auto` (el default), la plataforma busca
`pubspec.yaml` con una clave `flutter:` o `package.json` con la dependencia
`"react-native"` **en la raíz de `working_directory`**. Si tu proyecto está en un
monorepo y `working_directory` no apunta exactamente a esa carpeta, no lo
encuentra.

**Solución:** ajustá `working_directory` para que apunte a la carpeta donde
realmente están `pubspec.yaml`/`package.json`, o fijá `project_type: flutter` /
`project_type: react-native` explícitamente en vez de `auto`.

## No aparecen artefactos para descargar

**Síntoma:** el job termina en verde, pero la sección **Artifacts** de la
ejecución está vacía o falta `android-build`/`ios-build`.

**Causa:** el build no generó ningún `.apk`/`.aab`/`.ipa` donde el paso "Collect
… artifacts" los busca (por ejemplo, un `flutter build apk` que en realidad falló
silenciosamente antes, o un `working_directory` mal configurado).

**Solución:** revisá los logs del paso de build justo antes de "Collect
artifacts" — el paso de subida usa `if-no-files-found: warn`, así que el job no
falla aunque no encuentre nada; el aviso queda solo como warning en el log.
