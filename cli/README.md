# shadownrx-code

[![npm version](https://img.shields.io/npm/v/shadownrx-code.svg)](https://www.npmjs.com/package/shadownrx-code)
[![node](https://img.shields.io/node/v/shadownrx-code.svg)](https://www.npmjs.com/package/shadownrx-code)

Configurador interactivo de terminal para la plataforma de build de
`shadownrx/code`. Detecta si el proyecto es Flutter, React Native, una PWA
(Capacitor) o Electron, formula las preguntas de configuración necesarias, y
genera `.github/workflows/build.yml` listo para usar. No compila nada de
forma local: únicamente prepara el workflow que se ejecuta en GitHub
Actions.

```
▲ shadownrx/code — configurador de CI para Android, iOS y Electron

? Detecté un proyecto React Native en este directorio. ¿Es correcto? › Yes
? ¿Qué deseas compilar? › Android + iOS (ambas)
? ¿Ya tenés listos los secrets de firma (keystore / certificado de Apple)? › No
? ¿Adjuntar los builds a un GitHub Release cuando pushees un tag (v1.2.3)? › No

✔ Escribí .github/workflows/build.yml
```

Para proyectos Electron las preguntas de plataforma de compilación y de
firma no se muestran: Electron siempre compila para Linux, macOS y Windows,
y la firma de sus artefactos aún no está soportada por la plataforma. En ese
caso solo se pregunta el tipo de proyecto y si se desea adjuntar los
artefactos a un GitHub Release.

## Instalación

El paquete está publicado en npm como
[`shadownrx-code`](https://www.npmjs.com/package/shadownrx-code).

**Sin instalación** (recomendado): `npx` descarga la última versión
publicada, la ejecuta una única vez, y no deja nada instalado de forma
permanente.

```bash
npx shadownrx-code
```

**Instalación global**, si se prefiere evitar la descarga en cada
ejecución:

```bash
npm install -g shadownrx-code
shadownrx-code
```

**Desde el código fuente del repositorio**, sin depender del registro de
npm:

```bash
git clone https://github.com/shadownrx/code
cd code/cli
npm install
node bin.js
```

También puede apuntarse directamente a un proyecto en otra ruta:

```bash
cd /ruta/a/tu/proyecto
node /ruta/a/code/cli/bin.js
```

En todos los casos, el comando debe ejecutarse parado en la raíz del
proyecto a configurar (Flutter, React Native, PWA o Electron).

## Como tool de Cursor (o cualquier cliente MCP)

Además del CLI interactivo, `mcp-server.js` expone la misma funcionalidad
como un servidor [MCP](https://modelcontextprotocol.io), de modo que el
agente de Cursor (o Claude Code, Windsurf, o cualquier editor con soporte
MCP — no es específico de Cursor) puede invocarla directamente durante la
conversación, sin necesidad de abrir una terminal.

Configuración en `.cursor/mcp.json` del proyecto (o en el `mcp.json`
global de Cursor):

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

Alternativamente, apuntando a una copia local del repositorio en lugar del
paquete publicado:

```json
{
  "mcpServers": {
    "shadownrx-code": {
      "command": "node",
      "args": ["/ruta/absoluta/a/code/cli/mcp-server.js"]
    }
  }
}
```

Este repositorio incluye [`.cursor/mcp.json`](../.cursor/mcp.json)
configurado con la segunda variante y `${workspaceFolder}` — al abrir
`shadownrx/code` en Cursor, la tool queda disponible automáticamente. Es
necesario ejecutar `npm install` en `cli/` una vez (`node_modules` no se
versiona): el servidor requiere `@modelcontextprotocol/sdk` y `zod`
instalados para iniciar.

Expone dos tools:

| Tool | Qué hace |
|---|---|
| `detect_project_type` | Solo lectura: reporta si un directorio es Flutter, React Native, PWA o Electron. No escribe nada. |
| `setup_mobile_ci` | Detecta el tipo de proyecto (o recibe `project_type` explícito) y escribe `.github/workflows/build.yml` — mismos parámetros que el CLI interactivo (`build_android`, `build_ios`, `build_electron`, `create_release`), más `overwrite` para confirmar la sobrescritura si el archivo ya existe. |

Ambas tools están cubiertas por tests de punta a punta contra el servidor
real (no un mock): `mcp-server.test.js` levanta `mcp-server.js` como
subproceso vía stdio, usando el `Client` del SDK de MCP para invocar las
tools reales.

## Qué pregunta y por qué

Cada pregunta mapea uno a uno con un input real de
[`build-mobile.yml`](../.github/workflows/build-mobile.yml): no hay ninguna
opción que prometa una funcionalidad que la plataforma no implemente. El
detalle de cada input está documentado en
[`docs/USAGE.md`](../docs/USAGE.md).

| Pregunta | Input generado |
|---|---|
| Tipo de proyecto (auto-detectado o elegido) | `project_type` |
| Qué compilar (Android / iOS / ambas) — no aplica a Electron | `build_android`, `build_ios` |
| ¿Adjuntar a un GitHub Release en tags? | `create_release` (incluye el bloque `permissions: contents: write` requerido) |

Para proyectos Electron, en lugar de `build_android`/`build_ios` se emite
`build_electron: true` (siempre compila para los tres sistemas operativos).

Si se indica que los secrets de firma ya están configurados, se listan los
nombres exactos que deben cargarse en GitHub y se referencia
`docs/SIGNING.md`. El CLI no solicita ni manipula esos secrets: siempre se
configuran manualmente como GitHub Secrets.

Si `.github/workflows/build.yml` ya existe, se solicita confirmación antes
de sobrescribirlo.

## Desarrollo

La lógica pura (detección de proyecto y generación del YAML) vive en
`lib.js`, separada de `bin.js` (la interfaz interactiva, con
[`prompts`](https://www.npmjs.com/package/prompts)) y de `mcp-server.js`
(el servidor MCP). Esta separación evita duplicar lógica y permite testear
sin simular una terminal ni un cliente MCP real:

```bash
npm test   # node --test — corre lib.test.js y mcp-server.test.js
```
