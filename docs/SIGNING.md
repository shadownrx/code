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
   `android/key.properties` con `storeFile` como **ruta absoluta** a ese `.jks`, así
   funciona tanto si tu `build.gradle` usa `file(...)` (relativo a `android/app/`)
   como `rootProject.file(...)` (relativo a `android/`). En los ejemplos usamos
   `rootProject.file(...)` para que un `key.properties` local con una ruta relativa
   (p. ej. `storeFile=keystore/release.jks`) se resuelva desde `android/`, igual que el
   propio `key.properties`. Para que Gradle lo use, tu `android/app/build.gradle.kts`
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
                   storeFile = (keystoreProperties["storeFile"] as String?)?.let { rootProject.file(it) }
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

   Si tu proyecto usa Groovy (`build.gradle` en vez de `build.gradle.kts`) — el caso de
   la plantilla estándar de **React Native** — el mismo patrón se ve así. Ejemplo real
   ya aplicado en
   [`examples/react-native-demo/android/app/build.gradle`](../examples/react-native-demo/android/app/build.gradle):

   ```groovy
   def keystoreProperties = new Properties()
   def keystorePropertiesFile = rootProject.file('key.properties')
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }

   android {
       signingConfigs {
           debug { /* ... */ }
           if (keystorePropertiesFile.exists()) {
               release {
                   keyAlias keystoreProperties['keyAlias']
                   keyPassword keystoreProperties['keyPassword']
                   storeFile keystoreProperties['storeFile'] ? rootProject.file(keystoreProperties['storeFile']) : null
                   storePassword keystoreProperties['storePassword']
               }
           }
       }
       buildTypes {
           release {
               signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug
           }
       }
   }
   ```

   El mismo patrón (Groovy) aplica a un proyecto **Capacitor (PWA)** — ver el
   ejemplo real en
   [`examples/pwa-demo/android/app/build.gradle`](../examples/pwa-demo/android/app/build.gradle).
   Única diferencia: la plantilla de Capacitor no define un `signingConfig` de
   `debug` explícito, así que sin `key.properties` el `buildType release` queda
   directamente sin firmar (no cae a la firma debug como en Flutter/RN) — es el
   comportamiento normal del Android Gradle Plugin cuando no hay ningún
   `signingConfig` asignado.

Si estos secrets no están configurados, el build de Android simplemente se genera
sin firma de release (firma debug por defecto de las plantillas de Flutter/RN; sin
firma en absoluto en la plantilla de Capacitor).

### Verificación automática de la firma

Con los secrets cargados, el workflow ya no se queda con que Gradle terminó bien:
**comprueba la firma real** de lo que generó.

1. Antes de compilar abre el keystore con `ANDROID_KEYSTORE_PASSWORD` y
   `ANDROID_KEY_ALIAS`. Si alguno está mal, falla ahí mismo con un mensaje claro
   (no 5 minutos después, dentro de Gradle).
2. Después del build revisa cada `.apk` (`apksigner verify`) y cada `.aab`
   (`jarsigner`) y compara su certificado con el SHA-256 de tu keystore. Si algún
   archivo sale **sin firmar o firmado con la clave debug**, el build falla.

El caso que esto atrapa es el más traicionero: secrets bien cargados, pero un
`build.gradle` que nunca lee `key.properties`. Sin esta verificación el build sale
verde con firma debug y te enterás cuando Play Console rechaza la subida.

Para apagarlo (no recomendado): `verify_signing: false`.

### Probar la firma sin un keystore real (`signing_self_test`)

`signing_self_test: true` genera un keystore descartable en cada run cuando no hay
`ANDROID_KEYSTORE_BASE64`, así se ejercita todo el camino (`key.properties` →
Gradle → verificación) sin exponer tu clave real. Es lo que usan los ejemplos de
este repo en su CI. Esos builds **no sirven para publicar**: la plataforma se
niega a subirlos a Google Play.

## iOS

La firma de iOS **requiere una cuenta de Apple Developer** (de pago, ~99 USD/año) —
eso lo exige Apple, no esta plataforma. Sin esa cuenta, el workflow igual compila un
`.app` sin firmar válido para simulador, útil para verificar que el proyecto compila.

> **Nota sobre Capacitor**: un proyecto Capacitor nuevo no tiene `Podfile` ni
> `.xcworkspace` (usa Swift Package Manager por defecto desde Capacitor 7), así que
> la plataforma compila directo contra `ios/App/App.xcodeproj` con `-scheme App`.
> El resto del proceso de firma (certificado, perfil de aprovisionamiento,
> `ExportOptions.plist`) es idéntico a Flutter/React Native.

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
   - `IOS_TEAM_ID` (**opcional**: el Team ID se lee del perfil; si lo cargás, se
     usa para confirmar que el perfil es de la cuenta correcta)
5. Elegí el método de export con el input `ios_export_method`, que tiene que
   coincidir con el tipo de perfil: `ad-hoc` (default), `app-store`,
   `development` o `enterprise`. Para subir a TestFlight usá `app-store` (ver
   [`PUBLISHING.md`](./PUBLISHING.md)).

### Qué hace el workflow con eso

1. **Importa** el certificado en un keychain temporal del runner macOS e
   **instala** el perfil.
2. **Chequea antes de compilar** (así no gastás 10+ minutos de macOS en un build
   que iba a fallar al exportar) y corta con un error específico si:
   - la contraseña del `.p12` es incorrecta,
   - el perfil está vencido (y avisa si vence en menos de 14 días),
   - el certificado no está incluido en el perfil (o está vencido/revocado),
   - el tipo de perfil no coincide con `ios_export_method` (p. ej. perfil App
     Store con export `ad-hoc`),
   - `IOS_TEAM_ID` no coincide con el team del perfil.
3. **Configura firma manual** en el target de la app del `.xcodeproj` (team,
   identidad y perfil). Solo en ese target, no en los de Pods/SPM, que no
   aceptan perfiles. Así no dependés de cómo dejaste la firma en Xcode
   ("Automatically manage signing" no funciona en CI).
4. Genera `ExportOptions.plist` con firma manual y el mapeo bundle ID → perfil, y
   produce el `.ipa`.
5. **Verifica el `.ipa`**: lo abre, corre `codesign --verify` y confirma que el
   team y el perfil embebido son los que cargaste. Si no coinciden, el build falla
   (`verify_signing: false` lo apaga).

> **Limitación:** se firma un solo target de app con un solo perfil. Si tu app
> tiene extensiones (widgets, notification service, etc.), cada una necesita su
> propio perfil y por ahora no está soportado.

## Notificaciones

- `SLACK_WEBHOOK_URL` (opcional): URL de un [Incoming Webhook de Slack](https://api.slack.com/messaging/webhooks)
  para recibir un mensaje con el resultado de cada build.

## ¿Algo falló?

Ver [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — incluye los errores de firma más
comunes (keystore mal configurado, Team ID incorrecto, etc.) con su solución.
