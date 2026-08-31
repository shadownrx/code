# shadownrx-code

Configurador interactivo de terminal para la plataforma de build de
`shadownrx/code`. Detecta si tu proyecto es Flutter, React Native o una PWA
(Capacitor), te hace un par de preguntas, y te escribe
`.github/workflows/build.yml` ya configurado — no compila nada localmente, solo
prepara el workflow que corre gratis en GitHub Actions.

```
▲ shadownrx/code — configurador de CI para Android + iOS

? Detecté un proyecto React Native en este directorio. ¿Es correcto? › Yes
? ¿Qué deseas compilar? › Android + iOS (ambas)
? ¿Ya tenés listos los secrets de firma (keystore / certificado de Apple)? › No
? ¿Adjuntar los builds a un GitHub Release cuando pushees un tag (v1.2.3)? › No

✔ Escribí .github/workflows/build.yml
```

## Usar

La idea es que, una vez publicado, alcance con:

```bash
npx shadownrx-code
```

parado en la raíz de tu proyecto (Flutter, React Native o PWA) — sin clonar
nada. **Todavía no está publicado en npm** (publicarlo es distribuirlo
públicamente, así que quedó pendiente de que lo pidas explícito — y hace falta
una cuenta/token de npm que este entorno no tiene). El nombre `shadownrx-code`
está libre en el registro — no se reserva hasta el primer `npm publish`.

Mientras tanto, corré la versión local:

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

## Qué pregunta y por qué

Cada pregunta mapea 1 a 1 a un input real de
[`build-mobile.yml`](../.github/workflows/build-mobile.yml) — no hay ninguna
opción que prometa algo que la plataforma no haga. Ver
[`docs/USAGE.md`](../docs/USAGE.md) para el detalle de cada input.

| Pregunta | Input generado |
|---|---|
| Tipo de proyecto (auto-detectado o elegido) | `project_type` |
| Qué compilar (Android / iOS / ambas) | `build_android`, `build_ios` |
| ¿Adjuntar a un GitHub Release en tags? | `create_release` (+ el bloque `permissions: contents: write` que necesita) |

Si respondés que ya tenés los secrets de firma listos, te lista los nombres
exactos que hay que cargar en GitHub y te manda a `docs/SIGNING.md` — no los
pide ni los toca, esos siempre se configuran a mano como secrets de GitHub.

Si `.github/workflows/build.yml` ya existe, pregunta antes de pisarlo.

## Desarrollo

`lib.js` tiene toda la lógica pura (detección de proyecto + generación del
YAML) separada de `bin.js` (la parte interactiva con
[`prompts`](https://www.npmjs.com/package/prompts)), justamente para poder
testearla sin simular una terminal:

```bash
npm test   # node --test — corre lib.test.js
```
