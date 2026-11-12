# Changelog

## 7.5.2

Salto de versión: esta release junta todo lo que había en `main` sin
publicar (2.2.0) más el hardening del workflow y tres comandos nuevos.

### Nuevo

- **`shadownrx-code doctor`**: chequeo previo antes de gastar minutos de CI.
  Detecta `project_type` que no coincide con el proyecto, `build.gradle` que no
  lee `key.properties` (release firmado con la clave debug) o `-PversionCode`
  (Play rechaza el segundo upload), y secrets faltantes en el repo según lo que
  vas a firmar o publicar. Código de salida 1 si hay errores; `--json` para CI
  y agentes.
- **`shadownrx-code secrets`**: valida localmente el keystore (keytool), el
  `.p12` (openssl), el perfil `.mobileprovision` (vencimiento y tipo), el JSON
  de Google Play y la key `.p8`, y los sube con `gh secret set` por stdin.
  `--dry-run` solo valida.
- **Interfaz**: si `build.yml` ya existe se muestra un diff y se piden
  confirmar los cambios; el resumen final marca qué secrets ya están cargados
  (☑) y cuáles faltan (☐); la rama del trigger aparece en el resumen.
- **`--json`** en `init` y `doctor`.
- Publicación en **Google Play** y **TestFlight** en tags `v*`
  (`--play-store`, `--testflight`) con verificación real de la firma.
- El `build.yml` generado dispara en la rama por defecto del repo (no siempre
  `main`); `setup_mobile_ci` acepta `branch`.

### Arreglado

- Firma Android: los secrets pasan por `env` y `key.properties` se escribe con
  escapado de Java `.properties`. Un password con `$`, `` ` `` o `\` ya no rompe
  la firma.
- Auto-detección del workflow alineada con el CLI (`jq` sobre dependencias
  reales en vez de `grep`).
- El servidor MCP reporta la versión del `package.json`.
- Actions fuera del runtime Node 20 deprecado.

### Interno

- Tests del CLI: de 17 a 71, incluyendo el bash real de `build-mobile.yml`.
- `cli-ci.yml`: tests en Node 18 y 24 + actionlint con shellcheck.
