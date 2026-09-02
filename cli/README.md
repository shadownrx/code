# shadownrx-code

Configurador interactivo de terminal para la plataforma de build de
`shadownrx/code`. Detecta si tu proyecto es Flutter, React Native, una PWA
(Capacitor) o Electron, te hace un par de preguntas, y te escribe
`.github/workflows/build.yml` ya configurado — no compila nada localmente, solo
prepara el workflow que corre gratis en GitHub Actions.

```
▲ shadownrx/code — configurador de CI para Android, iOS y Electron

? Detecté un proyecto React Native en este directorio. ¿Es correcto? › Yes
? ¿Qué deseas compilar? › Android + iOS (ambas)
? ¿Ya tenés listos los secrets de firma (keystore / certificado de Apple)? › No
? ¿Adjuntar los builds a un GitHub Release cuando pushees un tag (v1.2.3)? › No

✔ Escribí .github/workflows/build.yml
```

Para Electron, la pregunta "¿Qué deseas compilar?" y la de firma no aparecen
(Electron siempre compila Linux + macOS + Windows, y la firma todavía no está
soportada) — solo pregunta el tipo de proyecto y si querés adjuntar a un
GitHub Release.

## Usar

Publicado en npm como
[`shadownrx-code`](https://www.npmjs.com/package/shadownrx-code) (v2.0.0).
Alcanza con:

```bash
npx shadownrx-code
```

parado en la raíz de tu proyecto (Flutter, React Native, PWA o Electron) — sin
clonar nada ni instalar nada de forma permanente: `npx` baja la última
versión publicada, la corre, y listo.

También podés instalarlo global si preferís no repetir la descarga cada vez:

```bash
npm install -g shadownrx-code
shadownrx-code
```

O correr la versión local del repo clonado:

```bash
git clone https://github.com/shadownrx/code
cd code/cli
npm install
node bin.js   # parado en la raíz de TU proyecto, o pasale el cwd que corresponda
```

o, apuntando directo a la carpeta de tu proyecto:

```bash
cd /ruta/a/tu/proyecto
node /ruta/a/code/cli/bin.js
```

## Como tool de Cursor (o cualquier cliente MCP)

Además del CLI interactivo, `mcp-server.js` expone lo mismo como un servidor
[MCP](https://modelcontextprotocol.io) — así el agente de Cursor (o Claude
Code, Windsurf, o cualquier editor con soporte MCP; no es algo específico de
Cursor) puede llamarlo directamente en la conversación, sin que abras una
terminal vos.

Agregá esto a `.cursor/mcp.json` en tu proyecto (o al `mcp.json` global de
Cursor):

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

También podés usar `"command": "npx", "args": ["-y", "shadownrx-code-mcp"]`
en vez de la ruta absoluta, sin necesidad de clonar el repo.

Este mismo repo ya trae [`.cursor/mcp.json`](../.cursor/mcp.json) apuntando a
`cli/mcp-server.js` con `${workspaceFolder}` — si abrís `shadownrx/code` en
Cursor, la tool queda disponible sola. Eso sí, corré `npm install` en `cli/`
primero (`node_modules` no se commitea): el server necesita
`@modelcontextprotocol/sdk` y `zod` instalados para arrancar.

Expone dos tools:

| Tool | Qué hace |
|---|---|
| `detect_project_type` | Solo lee: reporta si un directorio es Flutter/React Native/PWA/Electron. No escribe nada. |
| `setup_mobile_ci` | Detecta (o recibe `project_type` explícito) y escribe `.github/workflows/build.yml` — mismos parámetros que el CLI interactivo (`build_android`, `build_ios`, `build_electron`, `create_release`), más `overwrite` para confirmar si el archivo ya existe. |

Ambas tools están probadas de punta a punta contra el server real (no un
mock): `mcp-server.test.js` levanta `mcp-server.js` como subproceso vía stdio
con el `Client` del SDK de MCP y llama las tools de verdad.

## Qué pregunta y por qué

Cada pregunta mapea 1 a 1 a un input real de
[`build-mobile.yml`](../.github/workflows/build-mobile.yml) — no hay ninguna
opción que prometa algo que la plataforma no haga. Ver
[`docs/USAGE.md`](../docs/USAGE.md) para el detalle de cada input.

| Pregunta | Input generado |
|---|---|
| Tipo de proyecto (auto-detectado o elegido) | `project_type` |
| Qué compilar (Android / iOS / ambas) — no aplica a Electron | `build_android`, `build_ios` |
| ¿Adjuntar a un GitHub Release en tags? | `create_release` (+ el bloque `permissions: contents: write` que necesita) |

Para Electron, en vez de `build_android`/`build_ios` se emite
`build_electron: true` (siempre compila los tres sistemas operativos).

Si respondés que ya tenés los secrets de firma listos, te lista los nombres
exactos que hay que cargar en GitHub y te manda a `docs/SIGNING.md` — no los
pide ni los toca, esos siempre se configuran a mano como secrets de GitHub.

Si `.github/workflows/build.yml` ya existe, pregunta antes de pisarlo.

## Desarrollo

`lib.js` tiene toda la lógica pura (detección de proyecto + generación del
YAML) separada de `bin.js` (la parte interactiva con
[`prompts`](https://www.npmjs.com/package/prompts)) y de `mcp-server.js` (el
server MCP) — justamente para no duplicar la lógica y poder testearla sin
simular una terminal ni un cliente MCP real:

```bash
npm test   # node --test — corre lib.test.js y mcp-server.test.js
```
