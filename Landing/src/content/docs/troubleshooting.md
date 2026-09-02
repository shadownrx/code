---
title: Errores y soluciones
description: Errores reales encontrados armando esta plataforma, con causa y fix.
section: Guías
order: 4
---

Esta lista incluye errores **reales** que aparecieron mientras se armaba y probaba
esta plataforma — no casos teóricos.

## "Unrecognized named-value: 'secrets'"

**Síntoma:** la ejecución falla instantáneamente, con 0 jobs, apenas hacés push.

**Causa:** GitHub Actions no permite el contexto `secrets` dentro de un `if:` —
solo en `run:`, `env:` o `with:`.

**Solución:** exponé el secret como variable de entorno a nivel de job y
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

## "The nested job 'X' is requesting 'contents: write'..."

**Síntoma:** el workflow llamador falla con `startup_failure` al invocar
`build-mobile.yml`.

**Causa:** un workflow reutilizable no puede pedir más permisos de los que le
otorga quien lo llama.

**Solución:** si no usás `create_release: true`, no hace falta nada. Si sí lo
usás, agregá `permissions: contents: write` en tu propio workflow llamador (ver
[Cómo conectar tu repo](/docs/usage)).

## `./gradlew: Permission denied` / "gradlew: not found"

**Causa:** algunas plantillas de Flutter agregan `gradlew` y
`gradle-wrapper.jar` a `.gitignore`, asumiendo que se regeneran solos — pero en
un `git clone` limpio como el que hace CI, si no están committeados, no existen.

**Solución:** sacá esas líneas de `android/.gitignore` y commiteá los archivos
del wrapper.

## El APK/AAB sale sin firmar aunque configuré los secrets

**Causa:** tu `build.gradle(.kts)` no lee `key.properties`.

**Solución:** aplicá el patrón documentado en [Firma de apps](/docs/signing).

## `error: invalid source release: 21` compilando `capacitor-android`

**Síntoma:** el build de Android de un proyecto Capacitor falla en
`compileReleaseJavaWithJavac`.

**Causa:** el módulo nativo `capacitor-android` (Capacitor 8) compila contra
Java 21; la plataforma usaba JDK 17, heredado de cuando solo existían Flutter y
React Native.

**Solución:** ya está corregido — la plataforma usa JDK 21 para el job de
Android, compatible hacia atrás con Flutter y React Native.

## `pod install` falla o no encuentra el `Podfile`

**Síntoma:** el job `build-ios` falla en `pod install` (solo aplica a React
Native; ni Flutter ni un proyecto Capacitor sin plugins nativos extra usan este
paso).

**Causa habitual:** el `Podfile` no está en `ios/` dentro de `working_directory`,
o `Podfile.lock` quedó desincronizado.

**Solución:** corré `pod install`/`pod update` localmente, commiteá el
resultado, y confirmá `working_directory`.

## `xcodebuild: error: no schemes found`

**Causa:** no existe un scheme compartido (`xcshareddata/xcschemes/*.xcscheme`)
en el proyecto de Xcode.

**Solución:** abrí el proyecto en Xcode una vez y marcá el scheme como
"Shared", commiteá el `.xcscheme` generado. En un proyecto **Capacitor** esto no
aplica — el scheme es siempre `App` (nombre fijo del template).

## El `.ipa` firmado no se genera aunque configuré los secrets

**Causa:** hacen falta **ambos** secrets, `IOS_CERTIFICATE_BASE64` **y**
`IOS_PROVISION_PROFILE_BASE64` — si falta cualquiera, cae al build sin firmar.

## El proyecto no se detecta (`project_type: unknown`)

**Causa:** con `project_type: auto`, la plataforma busca `pubspec.yaml` con
`flutter:`, un `capacitor.config.ts`/`.json`, `package.json` con
`"react-native"`, o `package.json` con `"electron"`/`"electron-builder"` —
**en la raíz de `working_directory`**.

**Solución:** ajustá `working_directory`, o fijá `project_type` explícitamente.

## No aparecen artifacts para descargar

**Causa:** el build no generó ningún `.apk`/`.aab`/`.ipa` donde el paso de
recolección los busca. El paso de subida usa `if-no-files-found: warn`, así que
el job no falla — el aviso queda como warning en el log.
