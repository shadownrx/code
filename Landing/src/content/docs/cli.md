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
? ¿Adjuntar los builds a un GitHub Release cuando pushees un tag (v1.2.3)? › No

✔ Escribí .github/workflows/build.yml
```

Para proyectos Electron las preguntas de plataforma de compilación y de firma
no se muestran: Electron siempre compila para Linux, macOS y Windows, y su
firma todavía no está soportada por la plataforma.

Cada pregunta mapea uno a uno con un input real de `build-mobile.yml` — nunca
promete una funcionalidad que la plataforma no implemente. Si `.github/workflows/build.yml`
ya existe, se solicita confirmación antes de sobrescribirlo, y si se indica
que los secrets de firma ya están configurados, se listan los nombres exactos
que deben cargarse en GitHub (ver [Firma de apps](/docs/signing)) sin
solicitarlos ni manipularlos.

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
`overwrite` para confirmar la sobrescritura). Detalle completo en
[`cli/README.md`](https://github.com/shadownrx/code/blob/main/cli/README.md).
