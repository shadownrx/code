---
title: Asistente de terminal (CLI)
description: npx shadownrx-code — genera .github/workflows/build.yml sin escribirlo a mano.
section: Guías
order: 2
---

[`shadownrx-code`](https://www.npmjs.com/package/shadownrx-code) es un
configurador interactivo de terminal, publicado en npm, que reemplaza el paso
manual de [Cómo conectar tu repo](/docs/usage). Detecta si el proyecto es
Flutter, React Native, una PWA (Capacitor) o Electron, formula las preguntas
de configuración necesarias, y escribe `.github/workflows/build.yml` listo
para usar. No compila nada de forma local: únicamente prepara el workflow que
se ejecuta en GitHub Actions.

## Uso

Sin instalación, parado en la raíz del proyecto:

```bash
npx shadownrx-code
```

```
▲ shadownrx/code — configurador de CI para Android, iOS y Electron

? Detecté un proyecto React Native en este directorio. ¿Es correcto? › Yes
? ¿Qué deseas compilar? › Android + iOS (ambas)
? ¿Ya tenés listos los secrets de firma (keystore / certificado de Apple)? › No
? ¿Publicar automáticamente al pushear un tag (v1.2.3)? › Google Play, TestFlight
? ¿Adjuntar los builds a un GitHub Release cuando pushees un tag (v1.2.3)? › No

✔ Escribí .github/workflows/build.yml
```

Para proyectos Electron las preguntas de plataforma de compilación y de firma
no se muestran: Electron siempre compila para Linux, macOS y Windows, y su
firma todavía no está soportada por la plataforma.

Cada pregunta mapea uno a uno con un input real de `build-mobile.yml` — nunca
promete una funcionalidad que la plataforma no implemente. Si `.github/workflows/build.yml`
ya existe, se muestra un diff contra el archivo actual y se pide confirmar los
cambios. Si vas a firmar, al final se consultan los secrets del repo con
[GitHub CLI](https://cli.github.com) y se marcan los que ya están cargados y
los que faltan (ver [Firma de apps](/docs/signing)).

Sin preguntas: `npx shadownrx-code -y` usa lo detectado y los valores por
defecto. `--play-store` y `--testflight` activan la subida a las tiendas en tags
`v*` (ver [Publicar en tiendas](/docs/publishing)); `--release` adjunta los
builds a un GitHub Release; `--dry-run` solo muestra el YAML; `--json`
devuelve el resultado en JSON para scripts y agentes.

## Antes de pushear: `doctor`

```bash
npx shadownrx-code doctor
```

Revisa en segundos lo que de otro modo falla recién en GitHub Actions: que el
`project_type` de `build.yml` coincida con el proyecto, que
`android/app/build.gradle` lea `key.properties` (si no, el release sale firmado
con la clave debug) y `-PversionCode` cuando publicás en Google Play, y qué
secrets faltan en el repo según lo que vas a firmar o publicar. Cada problema
viene con el arreglo sugerido. Sale con código 1 si hay errores, y
`doctor --json` da el mismo resultado para CI o agentes.

## Cargar la firma: `secrets`

```bash
npx shadownrx-code secrets
```

Pide el keystore de Android, el `.p12` y el perfil `.mobileprovision` de iOS,
el JSON de la service account de Google Play y la key `.p8` de App Store
Connect. Antes de subir nada **los valida en tu máquina**: abre el keystore con
`keytool` igual que el workflow, prueba el password del `.p12` con `openssl`, y
revisa vencimiento y tipo del perfil. Después los convierte a base64 y los sube
con `gh secret set`; los valores viajan por stdin, nunca como argumentos ni en
archivos temporales. `--dry-run` valida sin subir.

## Instalación global

```bash
npm install -g shadownrx-code
shadownrx-code
```

## Como tool de Cursor (o cualquier cliente MCP)

El mismo configurador está disponible como servidor
[MCP](https://modelcontextprotocol.io), de modo que el agente de Cursor (o
Claude Code, Windsurf, o cualquier editor con soporte MCP) puede invocarlo
directamente durante la conversación:

```json
{
  "mcpServers": {
    "shadownrx-code": {
      "command": "npx",
      "args": ["-y", "shadownrx-code-mcp"]
    }
  }
}
```

Expone dos tools: `detect_project_type` (solo lectura) y `setup_mobile_ci`
(escribe el workflow, con los mismos parámetros que el CLI interactivo más
`branch` y `overwrite`). El trigger `push` usa la rama por defecto de tu repo
(`main`, `master`, etc.), detectada con git. Detalle completo en
[`cli/README.md`](https://github.com/shadownrx/code/blob/main/cli/README.md).
