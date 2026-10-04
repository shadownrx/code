---
title: Firma de apps
description: Configurar firma de release para Android e iOS, y notificaciones.
section: Guías
order: 3
---

Sin firma, los builds sirven para verificar que compilan y para correr en
simulador/emulador. Para instalar en un dispositivo real o publicar en las
tiendas, configurá la firma con **GitHub Secrets** en el repo que usa la
plataforma (`Settings → Secrets and variables → Actions`).

## Android

1. Generá un keystore de release, si no tenés uno:

```bash
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

2. Codificalo en base64:

```bash
base64 -i release.jks | pbcopy   # o base64 -w0 release.jks en Linux
```

3. Agregá estos secrets:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

4. El workflow decodifica el keystore en `android/keystore/release.jks` y escribe
   `android/key.properties`. Tu `android/app/build.gradle(.kts)` tiene que leer
   ese archivo:

```kotlin
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String?
                keyPassword = keystoreProperties["keyPassword"] as String?
                storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
                storePassword = keystoreProperties["storePassword"] as String?
            }
        }
    }
    buildTypes {
        release {
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}
```

Sin estos secrets, Android simplemente se genera sin firma de release (firma
debug en Flutter/RN; sin firma en absoluto en la plantilla de Capacitor, que no
define un `signingConfig` de debug explícito).

### Verificación automática

Con los secrets cargados, el workflow comprueba la firma real de lo que generó:

1. Antes de compilar abre el keystore con la contraseña y el alias. Si alguno
   está mal, falla ahí con un mensaje claro.
2. Después del build revisa cada `.apk` (`apksigner`) y `.aab` (`jarsigner`) y
   compara el certificado con el SHA-256 de tu keystore. Si algo sale sin firmar
   o con la clave debug (el caso típico: un `build.gradle` que no lee
   `key.properties`), el build falla en vez de salir verde.

`signing_self_test: true` firma con un keystore descartable cuando no hay
`ANDROID_KEYSTORE_BASE64`, para probar todo el camino sin tu clave real. Esos
builds nunca se publican.

## iOS

La firma de iOS **requiere una cuenta de Apple Developer** (de pago, ~99 USD/año)
— eso lo exige Apple, no esta plataforma. Sin esa cuenta, el workflow igual
compila un `.app` sin firmar válido para simulador.

Con cuenta de Apple Developer:

1. Exportá tu certificado de distribución (`.p12`) desde Keychain Access, o
   generalo con `fastlane match`/`fastlane cert`.
2. Descargá el perfil de aprovisionamiento (`.mobileprovision`) desde
   [developer.apple.com](https://developer.apple.com).
3. Codificá ambos en base64.
4. Agregá los secrets: `IOS_CERTIFICATE_BASE64`, `IOS_CERTIFICATE_PASSWORD`,
   `IOS_PROVISION_PROFILE_BASE64` y, opcional, `IOS_TEAM_ID` (se lee del perfil;
   si lo cargás, se usa para confirmar que el perfil es de esa cuenta).
5. Elegí `ios_export_method` según el tipo de perfil: `ad-hoc` (default),
   `app-store`, `development` o `enterprise`.

El workflow importa el certificado y el perfil en un keychain temporal del
runner macOS y, **antes de compilar**, valida que encajen: contraseña del
`.p12`, perfil no vencido, certificado incluido en el perfil, tipo de perfil
igual a `ios_export_method` y team correcto. Cada problema corta el build con su
propio mensaje. Después configura firma manual solo en el target de la app (no
en Pods/SPM), exporta el `.ipa` y lo **verifica** con `codesign`, confirmando
team y perfil embebido.

> Se firma un solo target de app con un solo perfil: las extensiones (widgets,
> notification service) todavía no están soportadas.

> Un proyecto **Capacitor** nuevo no tiene `Podfile` ni `.xcworkspace` (usa Swift
> Package Manager desde Capacitor 7), así que la plataforma compila directo
> contra `ios/App/App.xcodeproj` con `-scheme App`. El resto del proceso de firma
> es idéntico a Flutter/React Native.

## Notificaciones

`SLACK_WEBHOOK_URL` (opcional): URL de un
[Incoming Webhook de Slack](https://api.slack.com/messaging/webhooks) para
recibir un mensaje con el resultado de cada build.
