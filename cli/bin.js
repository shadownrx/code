#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import prompts from 'prompts';
import {
  PROJECT_LABELS,
  androidSecrets,
  appStoreSecrets,
  buildWorkflowYaml,
  detectProjectType,
  iosSecrets,
  playStoreSecrets,
} from './lib.js';
import {
  banner,
  box,
  c,
  gradient,
  highlightYaml,
  pipeline,
  rule,
  setColor,
  spin,
  stepHeader,
  sym,
  table,
} from './ui.js';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const TAGLINE = 'CI gratis para Android, iOS y Electron';
const PROJECT_TYPES = ['flutter', 'react-native', 'pwa', 'electron', 'auto'];
const TARGETS = ['both', 'android', 'ios'];
// Inner width shared by every panel so their right edges line up.
const PANEL = 72;

const HELP_ROWS = [
  ['-y, --yes', 'Sin preguntas: usa lo detectado y los defaults'],
  ['-t, --type <tipo>', `Tipo: ${PROJECT_TYPES.join('|')}`],
  ['    --target <t>', `Qué compilar: ${TARGETS.join('|')}`],
  ['    --release', 'Adjuntar builds a un GitHub Release en tags v*'],
  ['    --play-store', 'Subir el .aab a Google Play (internal) en tags v*'],
  ['    --testflight', 'Subir el .ipa a TestFlight en tags v*'],
  ['    --dry-run', 'Muestra el workflow sin escribir nada'],
  ['-f, --force', 'Sobrescribe build.yml sin preguntar'],
  ['    --cwd <dir>', 'Proyecto a configurar (default: directorio actual)'],
  ['    --no-color', 'Desactiva colores (también respeta NO_COLOR)'],
  ['-v, --version', 'Muestra la versión'],
  ['-h, --help', 'Muestra esta ayuda'],
];

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      yes: { type: 'boolean', short: 'y' },
      type: { type: 'string', short: 't' },
      target: { type: 'string' },
      release: { type: 'boolean' },
      'play-store': { type: 'boolean' },
      testflight: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean', short: 'f' },
      cwd: { type: 'string' },
      'no-color': { type: 'boolean' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.type && !PROJECT_TYPES.includes(values.type)) {
    throw new Error(`--type inválido: "${values.type}". Opciones: ${PROJECT_TYPES.join(', ')}`);
  }
  if (values.target && !TARGETS.includes(values.target)) {
    throw new Error(`--target inválido: "${values.target}". Opciones: ${TARGETS.join(', ')}`);
  }
  return values;
}

function printHelp() {
  console.log(banner({ version: pkg.version, tagline: TAGLINE }));
  console.log(
    box(
      [
        `${c.bold('Uso:')} ${c.cyan('npx shadownrx-code')} ${c.gray('[opciones]')}`,
        '',
        ...table(HELP_ROWS, { keyColor: c.cyan }),
        '',
        c.gray('Ejemplos:'),
        `  ${c.cyan('npx shadownrx-code')}                       ${c.gray('# modo interactivo')}`,
        `  ${c.cyan('npx shadownrx-code -y --release')}          ${c.gray('# defaults + releases')}`,
        `  ${c.cyan('npx shadownrx-code -t flutter --dry-run')}  ${c.gray('# solo previsualizar')}`,
        `  ${c.cyan('npx shadownrx-code -y --play-store --testflight')} ${c.gray('# publicar en tags v*')}`,
      ],
      { title: 'Ayuda', minWidth: PANEL }
    )
  );
  console.log();
}

function displayPath(p) {
  const home = os.homedir();
  const short = p.startsWith(home) ? '~' + p.slice(home.length) : p;
  return short.length > PANEL - 12 ? '…' + short.slice(-(PANEL - 13)) : short;
}

function onCancel() {
  console.log(`\n  ${sym.fail()} ${c.bold('Cancelado')} ${c.gray('— no se modificó nada.')}\n`);
  process.exit(1);
}

async function ask(question) {
  return prompts({ name: 'value', ...question }, { onCancel }).then((r) => r.value);
}

async function main() {
  let opts;
  try {
    opts = parseCli(process.argv.slice(2));
  } catch (err) {
    console.error(`\n  ${sym.fail()} ${err.message}\n  ${c.gray('Probá')} ${c.cyan('--help')}\n`);
    process.exit(2);
  }
  if (opts['no-color']) setColor(false);
  if (opts.version) return console.log(pkg.version);
  if (opts.help) return printHelp();

  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const auto = Boolean(opts.yes);

  console.log(banner({ version: pkg.version, tagline: TAGLINE }));
  console.log(
    box(
      [
        `Genera ${c.cyan('.github/workflows/build.yml')} para este proyecto.`,
        `No compila nada acá: el build corre ${c.green('gratis')} en GitHub Actions`,
        `con cada push — sin Mac ni Windows en tu máquina.`,
        '',
        `${c.gray('Proyecto:')} ${c.bold(displayPath(cwd))}`,
      ],
      { title: gradient('Configurador de CI'), minWidth: PANEL }
    )
  );

  // ── Detección ────────────────────────────────────────────────────────────
  console.log();
  const detected = await spin('Analizando el proyecto…', () => detectProjectType(cwd));
  if (detected) {
    console.log(`  ${sym.ok()} Proyecto detectado: ${c.bold(PROJECT_LABELS[detected])}`);
  } else {
    console.log(`  ${sym.warn()} ${c.yellow('No pude detectar el tipo de proyecto')} ${c.gray('(Flutter / RN / PWA / Electron)')}`);
  }

  let projectType = opts.type ?? null;
  const willBeElectron = (projectType ?? detected) === 'electron';
  const totalSteps = willBeElectron ? 2 : 5;
  let step = 0;

  if (!projectType) {
    if (auto) {
      projectType = detected ?? 'auto';
    } else {
      console.log(stepHeader(++step, totalSteps, 'Tipo de proyecto'));
      if (detected) {
        const ok = await ask({
          type: 'confirm',
          message: `¿Es un proyecto ${PROJECT_LABELS[detected]}?`,
          initial: true,
        });
        if (ok) projectType = detected;
      }
      if (!projectType) {
        projectType = await ask({
          type: 'select',
          message: '¿Qué tipo de proyecto es?',
          choices: [
            { title: 'Flutter', value: 'flutter', description: 'pubspec.yaml' },
            { title: 'React Native', value: 'react-native', description: 'react-native en package.json' },
            { title: 'PWA (Capacitor)', value: 'pwa', description: 'capacitor.config.*' },
            { title: 'Electron', value: 'electron', description: 'escritorio: Linux, macOS, Windows' },
            { title: 'Detectar en cada build', value: 'auto', description: 'project_type: auto' },
          ],
        });
      }
    }
  } else {
    step++;
  }

  const isElectron = projectType === 'electron';
  const steps = isElectron ? 2 : 5;

  let buildAndroid = true;
  let buildIos = true;
  let wantsSigning = false;
  let publishPlayStore = false;
  let publishTestflight = false;

  if (isElectron) {
    console.log(`\n  ${sym.info()} Electron compila ${c.bold('Linux, macOS y Windows')} en paralelo ${c.gray('— no hace falta elegir.')}`);
  } else {
    let target = opts.target;
    if (!target && !auto) {
      console.log(stepHeader(++step, steps, 'Plataformas'));
      target = await ask({
        type: 'select',
        message: '¿Qué deseas compilar?',
        choices: [
          { title: 'Android + iOS', value: 'both', description: '.apk/.aab + .ipa' },
          { title: 'Solo Android', value: 'android', description: '.apk/.aab en runner Linux' },
          { title: 'Solo iOS', value: 'ios', description: '.ipa en runner macOS' },
        ],
      });
    } else step++;
    target ??= 'both';
    buildAndroid = target !== 'ios';
    buildIos = target !== 'android';

    if (!auto) {
      console.log(stepHeader(++step, steps, 'Firma'));
      wantsSigning = await ask({
        type: 'confirm',
        message: '¿Ya tenés listos los secrets de firma (keystore / certificado de Apple)?',
        initial: false,
      });
    } else step++;

    publishPlayStore = buildAndroid && Boolean(opts['play-store']);
    publishTestflight = buildIos && Boolean(opts.testflight);
    if (!opts['play-store'] && !opts.testflight && !auto) {
      console.log(stepHeader(++step, steps, 'Tiendas'));
      const choices = [];
      if (buildAndroid) choices.push({ title: 'Google Play', value: 'play', description: 'sube el .aab al track internal' });
      if (buildIos) choices.push({ title: 'TestFlight', value: 'testflight', description: 'sube el .ipa a App Store Connect' });
      const stores = await ask({
        type: 'multiselect',
        message: '¿Publicar automáticamente al pushear un tag (v1.2.3)? (espacio para elegir)',
        choices,
        instructions: false,
        hint: 'enter sin elegir = no publicar',
      });
      publishPlayStore = stores.includes('play');
      publishTestflight = stores.includes('testflight');
    } else step++;
    // Publishing needs signed builds, so it implies the signing secrets.
    if (publishPlayStore || publishTestflight) wantsSigning = true;
  }

  let createRelease = Boolean(opts.release);
  if (!opts.release && !auto) {
    console.log(stepHeader(++step, steps, 'Releases'));
    createRelease = await ask({
      type: 'confirm',
      message: '¿Adjuntar los builds a un GitHub Release al pushear un tag (v1.2.3)?',
      initial: false,
    });
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  const config = {
    projectType,
    buildAndroid,
    buildIos,
    buildElectron: true,
    createRelease,
    publishPlayStore,
    publishTestflight,
  };
  const yaml = buildWorkflowYaml(config);
  const yes = c.green('sí');
  const no = c.gray('no');

  const platforms = isElectron
    ? 'Linux · macOS · Windows'
    : [buildAndroid && 'Android', buildIos && 'iOS'].filter(Boolean).join(' · ');

  console.log(`\n  ${gradient('━'.repeat(PANEL + 2))}\n`);
  console.log(
    box(
      table([
        ['Proyecto', c.bold(PROJECT_LABELS[projectType] ?? 'Auto-detectar en cada build')],
        ['Plataformas', c.bold(platforms)],
        ['Firma', isElectron ? c.gray('no soportada aún') : wantsSigning ? yes : c.gray('sin firmar (por ahora)')],
        ['Tiendas', isElectron ? c.gray('no aplica') : [publishPlayStore && 'Google Play', publishTestflight && 'TestFlight'].filter(Boolean).join(' · ') || no],
        ['GitHub Release', createRelease ? yes : no],
      ]),
      { title: 'Resumen', color: c.cyan, minWidth: PANEL }
    )
  );
  console.log();
  console.log(box(pipeline(config), { title: 'Pipeline en GitHub Actions', color: c.magenta, minWidth: PANEL }));
  console.log();
  console.log(box(highlightYaml(yaml), { title: '.github/workflows/build.yml', color: c.blue, minWidth: PANEL }));
  console.log();

  if (opts['dry-run']) {
    console.log(`  ${sym.info()} ${c.bold('--dry-run')}: no se escribió nada.\n`);
    return;
  }

  // ── Escritura ────────────────────────────────────────────────────────────
  const workflowPath = path.join(cwd, '.github', 'workflows', 'build.yml');
  const rel = path.relative(cwd, workflowPath);

  if (!auto) {
    const go = await ask({ type: 'confirm', message: `¿Escribir ${rel}?`, initial: true });
    if (!go) onCancel();
  }

  if (fs.existsSync(workflowPath) && !opts.force) {
    if (fs.readFileSync(workflowPath, 'utf8') === yaml) {
      console.log(`  ${sym.ok()} ${rel} ya está al día ${c.gray('— nada que cambiar.')}\n`);
      return;
    }
    if (auto) {
      console.log(`  ${sym.warn()} ${c.yellow(`Ya existe ${rel}.`)} Usá ${c.cyan('--force')} para sobrescribirlo.\n`);
      process.exit(1);
    }
    const overwrite = await ask({ type: 'confirm', message: `Ya existe ${rel}. ¿Sobrescribir?`, initial: false });
    if (!overwrite) onCancel();
  }

  await spin(`Escribiendo ${rel}…`, () => {
    fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
    fs.writeFileSync(workflowPath, yaml);
  }, { minMs: 300 });

  // ── Próximos pasos ───────────────────────────────────────────────────────
  const next = [`${sym.ok()} ${c.bold(`Escribí ${rel}`)}`, ''];

  if (isElectron) {
    next.push(`${sym.warn()} Los builds de Electron salen ${c.yellow('sin firmar')} por ahora.`, '');
  } else if (wantsSigning) {
    next.push(c.bold('Cargá estos secrets en GitHub:'));
    next.push(c.gray('Settings → Secrets and variables → Actions'), '');
    if (buildAndroid) next.push(c.green('Android'), ...androidSecrets().map((s) => `  ${c.gray('☐')} ${s}`));
    if (buildIos) next.push(c.green('iOS'), ...iosSecrets().map((s) => `  ${c.gray('☐')} ${s}`));
    if (publishPlayStore) next.push(c.green('Google Play'), ...playStoreSecrets().map((s) => `  ${c.gray('☐')} ${s}`));
    if (publishTestflight) next.push(c.green('TestFlight'), ...appStoreSecrets().map((s) => `  ${c.gray('☐')} ${s}`));
    next.push('', `${c.gray('Guía:')} ${c.underline('https://github.com/shadownrx/code/blob/main/docs/SIGNING.md')}`);
    if (publishPlayStore || publishTestflight) {
      next.push(`${c.gray('Tiendas:')} ${c.underline('https://github.com/shadownrx/code/blob/main/docs/PUBLISHING.md')}`);
    }
    next.push('');
  } else {
    next.push(`${sym.info()} Va a compilar ${c.yellow('sin firmar')}: sirve para emulador/simulador.`);
    next.push(`  ${c.gray('Para builds firmados mirá')} ${c.cyan('docs/SIGNING.md')}`, '');
  }

  next.push(rule(c.bold('Siguiente paso'), PANEL - 2).trimStart(), '');
  next.push(`  ${c.cyan('git add')} ${rel}`);
  next.push(`  ${c.cyan('git commit')} -m ${c.yellow('"ci: build con shadownrx/code"')}`);
  next.push(`  ${c.cyan('git push')}`);
  if (createRelease || publishPlayStore || publishTestflight) {
    next.push('', `${c.gray('Para un release:')} ${c.cyan('git tag v1.0.0 && git push --tags')}`);
  }

  console.log(box(next, { title: gradient('Listo'), color: c.green, style: 'round', minWidth: PANEL }));
  console.log();
}

main();
