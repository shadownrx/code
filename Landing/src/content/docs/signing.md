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
   `IOS_PROVISION_PROFILE_BASE64`, `IOS_TEAM_ID`.

El workflow importa el certificado y el perfil en un keychain temporal del
runner macOS, genera un `ExportOptions.plist` (método `ad-hoc` por defecto) y
produce un `.ipa` firmado.

> Un proyecto **Capacitor** nuevo no tiene `Podfile` ni `.xcworkspace` (usa Swift
> Package Manager desde Capacitor 7), así que la plataforma compila directo
> contra `ios/App/App.xcodeproj` con `-scheme App`. El resto del proceso de firma
> es idéntico a Flutter/React Native.

## Notificaciones

`SLACK_WEBHOOK_URL` (opcional): URL de un
[Incoming Webhook de Slack](https://api.slack.com/messaging/webhooks) para
recibir un mensaje con el resultado de cada build.
