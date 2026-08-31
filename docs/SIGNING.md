# Configurar firma de apps (opcional)

Sin firma, los builds sirven para verificar que compilan y para correr en
simulador/emulador. Para instalar en un dispositivo real o publicar en las tiendas,
necesitás configurar la firma. Todo se hace con **GitHub Secrets** en el repo que
usa la plataforma (`Settings → Secrets and variables → Actions`).

## Android

1. Generá un keystore de release (si no tenés uno):
   ```bash
   keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. Codificalo en base64 y guardalo como secret:
   ```bash
   base64 -i release.jks | pbcopy   # o base64 -w0 release.jks en Linux
   ```
3. Agregá estos secrets en tu repo:
   - `ANDROID_KEYSTORE_BASE64` — el contenido en base64 del `.jks`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

4. El workflow decodifica el keystore en `android/keystore/release.jks` y escribe
   `android/key.properties`. Para que Gradle lo use, tu `android/app/build.gradle.kts`
   (Kotlin DSL, la plantilla actual de Flutter) debe leer ese archivo — ver
   [`examples/flutter-demo/android/app/build.gradle.kts`](../examples/flutter-demo/android/app/build.gradle.kts)
   para el patrón completo ya aplicado:

   ```kotlin
   import java.io.FileInputStream
   import java.util.Properties

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

   Si tu proyecto todavía usa Groovy (`build.gradle` en vez de `build.gradle.kts`), el
   mismo patrón aplica con sintaxis Groovy clásica (`keyAlias keystoreProperties['keyAlias']`,
   etc.) — es el patrón oficial que documenta Flutter.

Si estos secrets no están configurados, el build de Android simplemente se genera
sin firma de release (firma debug por defecto de las plantillas de Flutter/RN).

## iOS

La firma de iOS **requiere una cuenta de Apple Developer** (de pago, ~99 USD/año) —
eso lo exige Apple, no esta plataforma. Sin esa cuenta, el workflow igual compila un
`.app` sin firmar válido para simulador, útil para verificar que el proyecto compila.

Con cuenta de Apple Developer:

1. Exportá tu certificado de distribución (`.p12`) desde Keychain Access (Mac) o
   generalo con `fastlane match`/`fastlane cert`.
2. Descargá el perfil de aprovisionamiento (`.mobileprovision`) correspondiente desde
   [developer.apple.com](https://developer.apple.com).
3. Codificá ambos en base64:
   ```bash
   base64 -i Certificates.p12 | pbcopy
   base64 -i Profile.mobileprovision | pbcopy
   ```
4. Agregá estos secrets en tu repo:
   - `IOS_CERTIFICATE_BASE64`
   - `IOS_CERTIFICATE_PASSWORD` (contraseña con la que exportaste el `.p12`)
   - `IOS_PROVISION_PROFILE_BASE64`
   - `IOS_TEAM_ID` (Team ID de Apple Developer, visible en developer.apple.com/account)

El workflow importa el certificado y el perfil en un keychain temporal del runner
macOS, genera un `ExportOptions.plist` (método `ad-hoc` por defecto) y produce un
`.ipa` firmado. Si necesitás método `app-store` o `enterprise`, ajustá el `method` en
`.github/workflows/build-mobile.yml` (o pedí que se agregue como input configurable).

## Notificaciones

- `SLACK_WEBHOOK_URL` (opcional): URL de un [Incoming Webhook de Slack](https://api.slack.com/messaging/webhooks)
  para recibir un mensaje con el resultado de cada build.
