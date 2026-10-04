# Publicar en las tiendas (opcional)

Además de compilar y firmar, la plataforma puede **subir el build a las tiendas**
sola: el `.aab` a **Google Play** y el `.ipa` a **TestFlight** (App Store
Connect). Lo recomendado es publicar solo cuando pusheás un tag de versión
(`v1.2.3`), no en cada push a `main`.

Requisito previo: la **firma real** ya configurada ([`SIGNING.md`](./SIGNING.md)).
Las tiendas solo aceptan builds firmados, así que el workflow se niega a publicar
sin firma (y tampoco publica con `signing_self_test`).

## Workflow de ejemplo

```yaml
name: Build Mobile Apps

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
  workflow_dispatch:

jobs:
  build:
    uses: shadownrx/code/.github/workflows/build-mobile.yml@main
    with:
      project_type: auto
      build_number: ${{ github.run_number }}                          # número nuevo en cada build
      publish_play_store: ${{ startsWith(github.ref, 'refs/tags/v') }} # solo en tags v*
      play_track: internal
      ios_export_method: app-store                                    # el perfil App Store, en todos los builds
      publish_testflight: ${{ startsWith(github.ref, 'refs/tags/v') }}
    secrets: inherit
```

`npx shadownrx-code --play-store --testflight` escribe exactamente esto.

Con esta config cada push a `main` compila y firma (y verifica la firma), y
solo `git tag v1.0.0 && git push --tags` sube a las tiendas. En pull requests
nunca se publica, aunque el input esté en `true`.

## Número de build (`build_number`)

Google Play y App Store Connect **rechazan un número de build repetido**
(`versionCode` en Android, `CFBundleVersion` en iOS). `build_number` lo pisa en
cada build; `${{ github.run_number }}` sirve porque nunca se repite dentro del
mismo workflow.

| Framework | Android | iOS |
|---|---|---|
| Flutter | `--build-number` (automático) | `--build-number` (automático) |
| React Native | `-PversionCode=N`: tu `build.gradle` tiene que leerlo (abajo) | `CURRENT_PROJECT_VERSION` (automático con la plantilla estándar) |
| Capacitor | `-PversionCode=N`: tu `build.gradle` tiene que leerlo (abajo) | `CURRENT_PROJECT_VERSION` (automático con la plantilla estándar) |

En React Native y Capacitor, cambiá la línea `versionCode 1` de
`android/app/build.gradle` por:

```groovy
versionCode project.hasProperty('versionCode') ? project.property('versionCode').toInteger() : 1
```

Ya está aplicado en
[`examples/react-native-demo`](../examples/react-native-demo/android/app/build.gradle)
y [`examples/pwa-demo`](../examples/pwa-demo/android/app/build.gradle).

> Si tu app ya publicó un número más alto que el `run_number` actual, Play lo va
> a rechazar con *"Version code N has already been used"*. Subí ese build de
> forma manual con un número mayor o esperá a que `run_number` lo pase.

## Google Play

1. **La primera versión se sube a mano.** La API de Google Play no puede crear una
   app nueva: creá la app en [Play Console](https://play.google.com/console) y subí
   el primer `.aab` a mano (podés usar el que genera este workflow, en la pestaña
   **Artifacts**). A partir de ahí la plataforma sube las siguientes.
2. **Cuenta de servicio:** en Google Cloud Console creá una *service account* y
   descargá su clave JSON. Después, en Play Console → **Usuarios y permisos** →
   invitá el email de esa cuenta y dale permiso de *publicar en tracks de prueba*
   (o en producción, si vas a usar `play_track: production`).
3. **Secret:** guardá el contenido completo del JSON como
   `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.

| Input | Default | Descripción |
|---|---|---|
| `publish_play_store` | `false` | Subir el `.aab` firmado. |
| `play_track` | `internal` | `internal`, `alpha`, `beta`, `production` o el nombre de un track cerrado propio. |
| `play_release_status` | `completed` | `completed`, `draft` o `inProgress`. Usá `draft` mientras la app nunca se haya publicado (Play no deja `completed` en apps en borrador). |
| `android_package_name` | (vacío) | `applicationId`. Vacío lo lee del APK generado. |

La subida usa [`r0adkll/upload-google-play`](https://github.com/r0adkll/upload-google-play).

## TestFlight (App Store Connect)

1. **La app tiene que existir en App Store Connect** con el mismo bundle ID
   (Apps → **+** → Nueva app).
2. **Perfil App Store:** `IOS_PROVISION_PROFILE_BASE64` tiene que ser un perfil de
   distribución **App Store** (no ad-hoc). La plataforma lo comprueba antes de
   compilar y falla con un mensaje claro si no coincide.
3. **Clave de API:** en App Store Connect → **Users and Access** → **Integrations**
   → **App Store Connect API**, generá una clave con rol *App Manager* (o
   *Developer*) y descargá el `.p8` (se descarga una sola vez).
4. **Secrets:**
   - `APP_STORE_CONNECT_API_KEY_ID`: el *Key ID* de la clave.
   - `APP_STORE_CONNECT_ISSUER_ID`: el *Issuer ID* (arriba de la lista de claves).
   - `APP_STORE_CONNECT_API_KEY_BASE64`: el `.p8` en base64 (`base64 -i AuthKey_XXXX.p8 | pbcopy`).

| Input | Default | Descripción |
|---|---|---|
| `publish_testflight` | `false` | Subir el `.ipa` firmado a App Store Connect. Fuerza `ios_export_method: app-store` en ese build. |
| `ios_export_method` | `ad-hoc` | Ponelo en `app-store` si publicás, así los builds sin tag también usan tu perfil App Store. |

La subida usa `xcrun altool` (viene con Xcode, sin dependencias extra). El build
aparece en TestFlight cuando Apple termina de procesarlo, normalmente entre 5 y
30 minutos después. Pasarlo a revisión para App Store sigue siendo un paso manual
en App Store Connect.

## Resultado

El **Summary** de cada ejecución muestra una tabla de tiendas con el resultado de
cada subida (`success`, `failure` u `omitido (pull request)`).

## ¿Algo falló?

Ver la sección de publicación en [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md#errores-de-publicación-en-tiendas).
