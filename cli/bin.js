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
  detectDefaultBranch,
  detectProjectType,
  iosSecrets,
  playStoreSecrets,
} from './lib.js';
import {
  WORKFLOW_FILE,
  compareSecrets,
  doctorExitCode,
  listRepoSecrets,
  readBase64,
  readProvisioningProfile,
  runDoctor,
  secretGroups,
  setRepoSecret,
  validateKeystore,
  validateP12,
  validateP8,
  validateServiceAccountJson,
} from './checks.js';
import {
  banner,
  box,
  c,
  diffLines,
  gradient,
  highlightYaml,
  pipeline,
  renderDiff,
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
const COMMANDS = ['init', 'doctor', 'secrets'];
// Inner width shared by every panel so their right edges line up.
const PANEL = 72;
const DOCS = 'https://github.com/shadownrx/code/blob/main/docs';

const COMMAND_ROWS = [
  ['(sin comando)', 'Genera .github/workflows/build.yml (igual que init)'],
  ['doctor', 'Revisa proyecto, Gradle y secrets antes de gastar CI'],
  ['secrets', 'Valida keystore/certificados y los sube a GitHub con gh'],
];

const HELP_ROWS = [
  ['-y, --yes', 'Sin preguntas: usa lo detectado y los defaults'],
  ['-t, --type <tipo>', `Tipo: ${PROJECT_TYPES.join('|')}`],
  ['    --target <t>', `Qué compilar: ${TARGETS.join('|')}`],
  ['    --release', 'Adjuntar builds a un GitHub Release en tags v*'],
  ['    --play-store', 'Subir el .aab a Google Play (internal) en tags v*'],
  ['    --testflight', 'Subir el .ipa a TestFlight en tags v*'],
  ['    --dry-run', 'Muestra el workflow (o los secrets) sin escribir nada'],
  ['-f, --force', 'Sobrescribe build.yml sin preguntar'],
  ['    --json', 'Salida JSON para scripts y agentes (implica -y)'],
  ['    --cwd <dir>', 'Proyecto a configurar (default: directorio actual)'],
  ['    --no-color', 'Desactiva colores (también respeta NO_COLOR)'],
  ['-v, --version', 'Muestra la versión'],
  ['-h, --help', 'Muestra esta ayuda'],
];

function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      yes: { type: 'boolean', short: 'y' },
      type: { type: 'string', short: 't' },
      target: { type: 'string' },
      release: { type: 'boolean' },
      'play-store': { type: 'boolean' },
      testflight: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean', short: 'f' },
      json: { type: 'boolean' },
      cwd: { type: 'string' },
      'no-color': { type: 'boolean' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (positionals.length > 1) {
    throw new Error(`Sobran argumentos: ${positionals.slice(1).join(' ')}`);
  }
  const command = positionals[0] ?? 'init';
  if (!COMMANDS.includes(command)) {
    throw new Error(`Comando desconocido: "${command}". Opciones: ${COMMANDS.join(', ')}`);
  }
  if (values.type && !PROJECT_TYPES.includes(values.type)) {
    throw new Error(`--type inválido: "${values.type}". Opciones: ${PROJECT_TYPES.join(', ')}`);
  }
  if (values.target && !TARGETS.includes(values.target)) {
    throw new Error(`--target inválido: "${values.target}". Opciones: ${TARGETS.join(', ')}`);
  }
  if (values.json && command === 'secrets') {
    throw new Error('secrets es interactivo: no acepta --json');
  }
  return { ...values, command };
}

function printHelp() {
  console.log(banner({ version: pkg.version, tagline: TAGLINE }));
  console.log(
    box(
      [
        `${c.bold('Uso:')} ${c.cyan('npx shadownrx-code')} ${c.gray('[comando] [opciones]')}`,
        '',
        c.bold('Comandos'),
        ...table(COMMAND_ROWS, { keyColor: c.magenta }),
        '',
        c.bold('Opciones'),
        ...table(HELP_ROWS, { keyColor: c.cyan }),
        '',
        c.gray('Ejemplos:'),
        `  ${c.cyan('npx shadownrx-code')}                       ${c.gray('# modo interactivo')}`,
        `  ${c.cyan('npx shadownrx-code -y --release')}          ${c.gray('# defaults + releases')}`,
        `  ${c.cyan('npx shadownrx-code -t flutter --dry-run')}  ${c.gray('# solo previsualizar')}`,
        `  ${c.cyan('npx shadownrx-code -y --play-store --testflight')} ${c.gray('# publicar en tags v*')}`,
        `  ${c.cyan('npx shadownrx-code doctor')}                ${c.gray('# chequeo antes de pushear')}`,
        `  ${c.cyan('npx shadownrx-code secrets')}               ${c.gray('# cargar la firma en GitHub')}`,
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

function printDiff(before, after, rel) {
  const lines = renderDiff(diffLines(before, after));
  console.log(box(lines, { title: `Cambios en ${rel}`, color: c.yellow, minWidth: PANEL }));
  console.log();
}

// ─── init: generate build.yml ─────────────────────────────────────────────────

async function init(opts, cwd) {
  const json = Boolean(opts.json);
  const auto = json || Boolean(opts.yes);
  const log = json ? () => {} : console.log;
  const busy = json ? (_text, task) => task() : spin;

  log(banner({ version: pkg.version, tagline: TAGLINE }));
  log(
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
  log();
  const detected = await busy('Analizando el proyecto…', () => detectProjectType(cwd));
  if (detected) {
    log(`  ${sym.ok()} Proyecto detectado: ${c.bold(PROJECT_LABELS[detected])}`);
  } else {
    log(`  ${sym.warn()} ${c.yellow('No pude detectar el tipo de proyecto')} ${c.gray('(Flutter / RN / PWA / Electron)')}`);
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
    log(`\n  ${sym.info()} Electron compila ${c.bold('Linux, macOS y Windows')} en paralelo ${c.gray('— no hace falta elegir.')}`);
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
    branch: detectDefaultBranch(cwd),
  };
  const yaml = buildWorkflowYaml(config);
  const yes = c.green('sí');
  const no = c.gray('no');
  const workflowPath = path.join(cwd, WORKFLOW_FILE);
  const rel = path.relative(cwd, workflowPath);
  const existing = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : null;

  if (json) {
    let written = false;
    let reason = null;
    if (opts['dry-run']) reason = 'dry-run';
    else if (existing === yaml) reason = 'up-to-date';
    else if (existing !== null && !opts.force) reason = 'exists';
    else {
      fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
      fs.writeFileSync(workflowPath, yaml);
      written = true;
    }
    const groups = secretGroups(config).map(({ id, names, required }) => ({ id, names, required }));
    console.log(JSON.stringify({ path: rel, written, reason, config, secrets: groups, yaml }, null, 2));
    if (reason === 'exists') process.exitCode = 1;
    return;
  }

  const platforms = isElectron
    ? 'Linux · macOS · Windows'
    : [buildAndroid && 'Android', buildIos && 'iOS'].filter(Boolean).join(' · ');

  console.log(`\n  ${gradient('━'.repeat(PANEL + 2))}\n`);
  console.log(
    box(
      table([
        ['Proyecto', c.bold(PROJECT_LABELS[projectType] ?? 'Auto-detectar en cada build')],
        ['Plataformas', c.bold(platforms)],
        ['Rama', c.bold(config.branch)],
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
  if (existing !== null && existing !== yaml) {
    // An existing file gets a diff instead of the full listing, so a
    // hand-edited build.yml is never overwritten blind.
    printDiff(existing, yaml, rel);
  } else {
    console.log(box(highlightYaml(yaml), { title: rel, color: c.blue, minWidth: PANEL }));
    console.log();
  }

  if (opts['dry-run']) {
    console.log(`  ${sym.info()} ${c.bold('--dry-run')}: no se escribió nada.\n`);
    return;
  }

  // ── Escritura ────────────────────────────────────────────────────────────
  if (existing === yaml) {
    console.log(`  ${sym.ok()} ${rel} ya está al día ${c.gray('— nada que cambiar.')}\n`);
    return;
  }

  if (existing !== null && !opts.force) {
    if (auto) {
      console.log(`  ${sym.warn()} ${c.yellow(`Ya existe ${rel}.`)} Usá ${c.cyan('--force')} para sobrescribirlo.\n`);
      process.exit(1);
    }
    const overwrite = await ask({ type: 'confirm', message: `¿Aplicar estos cambios a ${rel}?`, initial: false });
    if (!overwrite) onCancel();
  } else if (!auto) {
    const go = await ask({ type: 'confirm', message: `¿Escribir ${rel}?`, initial: true });
    if (!go) onCancel();
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
    // Ask GitHub which secrets already exist, so the checklist is real.
    const listed = await spin('Consultando los secrets del repo…', () => listRepoSecrets({ cwd }));
    const present = listed.names ?? new Set();
    const mark = (s) => (present.has(s) ? `  ${c.green('☑')} ${c.gray(s)}` : `  ${c.gray('☐')} ${s}`);
    const missing = (names) => names.filter((s) => !present.has(s)).length;

    next.push(c.bold('Secrets en GitHub:'));
    next.push(
      listed.error
        ? c.gray(`(no pude consultarlos: ${listed.error})`)
        : c.gray('Settings → Secrets and variables → Actions'),
      ''
    );
    const groups = [];
    if (buildAndroid) groups.push(['Android', androidSecrets()]);
    if (buildIos) groups.push(['iOS', iosSecrets()]);
    if (publishPlayStore) groups.push(['Google Play', playStoreSecrets()]);
    if (publishTestflight) groups.push(['TestFlight', appStoreSecrets()]);
    for (const [label, names] of groups) next.push(c.green(label), ...names.map(mark));
    const totalMissing = groups.reduce((n, [, names]) => n + missing(names), 0);
    next.push('');
    if (totalMissing > 0) {
      next.push(`${sym.arrow()} Cargalos validados con ${c.cyan('npx shadownrx-code secrets')}`);
    }
    next.push(`${c.gray('Guía:')} ${c.underline(`${DOCS}/SIGNING.md`)}`);
    if (publishPlayStore || publishTestflight) {
      next.push(`${c.gray('Tiendas:')} ${c.underline(`${DOCS}/PUBLISHING.md`)}`);
    }
    next.push('');
  } else {
    next.push(`${sym.info()} Va a compilar ${c.yellow('sin firmar')}: sirve para emulador/simulador.`);
    next.push(`  ${c.gray('Para firmar:')} ${c.cyan('npx shadownrx-code secrets')}`, '');
  }

  next.push(rule(c.bold('Siguiente paso'), PANEL - 2).trimStart(), '');
  next.push(`  ${c.cyan('npx shadownrx-code doctor')}   ${c.gray('# chequeo previo (opcional)')}`);
  next.push(`  ${c.cyan('git add')} ${rel}`);
  next.push(`  ${c.cyan('git commit')} -m ${c.yellow('"ci: build con shadownrx/code"')}`);
  next.push(`  ${c.cyan('git push')}`);
  if (createRelease || publishPlayStore || publishTestflight) {
    next.push('', `${c.gray('Para un release:')} ${c.cyan('git tag v1.0.0 && git push --tags')}`);
  }

  console.log(box(next, { title: gradient('Listo'), color: c.green, style: 'round', minWidth: PANEL }));
  console.log();
}

// ─── doctor ───────────────────────────────────────────────────────────────────

const STATUS_SYM = { ok: sym.ok, warn: sym.warn, fail: sym.fail, skip: () => c.gray('○') };

async function doctor(opts, cwd) {
  if (opts.json) {
    const results = runDoctor({ cwd });
    console.log(JSON.stringify({ ok: doctorExitCode(results) === 0, results }, null, 2));
    process.exitCode = doctorExitCode(results);
    return;
  }

  console.log(banner({ version: pkg.version, tagline: TAGLINE }));
  const results = await spin('Revisando proyecto, Gradle y secrets…', () => runDoctor({ cwd }));

  const titleWidth = Math.max(...results.map((r) => r.title.length));
  const lines = [];
  for (const r of results) {
    lines.push(`${STATUS_SYM[r.status]()} ${c.bold(r.title.padEnd(titleWidth))}  ${r.status === 'skip' ? c.gray(r.detail ?? '') : r.detail ?? ''}`);
    if (r.fix) lines.push(`  ${' '.repeat(titleWidth)}  ${sym.arrow()} ${c.cyan(r.fix)}`);
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  lines.push(
    '',
    `${c.green(`${count('ok')} ok`)} ${sym.dot()} ${c.yellow(`${count('warn')} avisos`)} ${sym.dot()} ${c.red(`${count('fail')} errores`)}`
  );

  const failed = doctorExitCode(results) !== 0;
  console.log(
    box(lines, {
      title: failed ? 'Doctor · hay que arreglar algo' : gradient('Doctor · listo para pushear'),
      color: failed ? c.red : c.green,
      minWidth: PANEL,
    })
  );
  console.log(`\n  ${c.gray('Proyecto:')} ${displayPath(cwd)}\n`);
  process.exitCode = doctorExitCode(results);
}

// ─── secrets ──────────────────────────────────────────────────────────────────

/** Asks for a file path until it exists (or the user cancels). */
async function askFile(message, initial) {
  return ask({
    type: 'text',
    message,
    initial,
    validate: (v) => (v && fs.existsSync(path.resolve(v.replace(/^~(?=\/)/, os.homedir()))) ? true : 'No existe ese archivo'),
    format: (v) => path.resolve(v.replace(/^~(?=\/)/, os.homedir())),
  });
}

async function secretsCommand(opts, cwd) {
  console.log(banner({ version: pkg.version, tagline: TAGLINE }));
  console.log(
    box(
      [
        'Valida tus archivos de firma acá, antes de gastar minutos de CI,',
        `y los sube como ${c.cyan('Actions secrets')} con ${c.cyan('gh secret set')}.`,
        '',
        `${c.gray('Los valores viajan por stdin a gh: nunca quedan en argv ni en disco.')}`,
        opts['dry-run'] ? c.yellow('--dry-run: solo valida, no sube nada.') : '',
        `${c.gray('Repo:')} ${c.bold(displayPath(cwd))}`,
      ].filter((l) => l !== ''),
      { title: gradient('Secrets de firma'), minWidth: PANEL }
    )
  );

  const listed = listRepoSecrets({ cwd });
  if (listed.error && !opts['dry-run']) {
    console.log(`\n  ${sym.fail()} ${listed.error}`);
    console.log(`  ${c.gray('Instalá gh (https://cli.github.com), corré')} ${c.cyan('gh auth login')} ${c.gray('o probá con')} ${c.cyan('--dry-run')}\n`);
    process.exitCode = 1;
    return;
  }
  const present = listed.names ?? new Set();

  const wf = path.join(cwd, WORKFLOW_FILE);
  const wfText = fs.existsSync(wf) ? fs.readFileSync(wf, 'utf8') : '';
  const choices = [
    { title: 'Firma Android', value: 'android', description: 'keystore .jks/.keystore', selected: /build_android: true/.test(wfText) },
    { title: 'Firma iOS', value: 'ios', description: 'certificado .p12 + perfil .mobileprovision', selected: /build_ios: true/.test(wfText) },
    { title: 'Google Play', value: 'play', description: 'JSON de service account', selected: /publish_play_store:/.test(wfText) },
    { title: 'TestFlight', value: 'appstore', description: 'API key .p8 de App Store Connect', selected: /publish_testflight:/.test(wfText) },
  ];
  console.log();
  const picked = await ask({
    type: 'multiselect',
    message: '¿Qué querés cargar? (espacio para elegir)',
    choices: choices.map((ch) => {
      const names = { android: androidSecrets(), ios: iosSecrets(), play: playStoreSecrets(), appstore: appStoreSecrets() }[ch.value];
      const done = names.every((n) => present.has(n));
      return { ...ch, title: done ? `${ch.title} ${c.green('(ya cargado)')}` : ch.title, selected: ch.selected && !done };
    }),
    instructions: false,
    min: 1,
  });

  /** name → value, filled as each group validates. */
  const toUpload = [];
  const ok = (msg) => console.log(`  ${sym.ok()} ${msg}`);

  for (const group of picked) {
    if (group === 'android') {
      console.log(rule(c.bold('Firma Android'), PANEL));
      const file = await askFile('Ruta del keystore (.jks / .keystore)');
      const alias = await ask({ type: 'text', message: 'Alias de la clave', validate: (v) => (v ? true : 'Requerido') });
      const storePass = await ask({ type: 'password', message: 'Password del keystore' });
      const keyPass =
        (await ask({ type: 'password', message: 'Password de la clave (enter = el mismo del keystore)' })) || storePass;
      let sha;
      try {
        sha = await spin('Abriendo el keystore con keytool…', () => validateKeystore({ file, password: storePass, alias }));
      } catch (err) {
        console.log(`  ${sym.fail()} ${err.message}\n`);
        process.exitCode = 1;
        return;
      }
      ok(`Keystore OK ${c.gray(`(SHA-256 ${sha.slice(0, 16)}…)`)}`);
      toUpload.push(
        ['ANDROID_KEYSTORE_BASE64', readBase64(file)],
        ['ANDROID_KEYSTORE_PASSWORD', storePass],
        ['ANDROID_KEY_ALIAS', alias],
        ['ANDROID_KEY_PASSWORD', keyPass]
      );
    }

    if (group === 'ios') {
      console.log(rule(c.bold('Firma iOS'), PANEL));
      const p12 = await askFile('Ruta del certificado de distribución (.p12)');
      const p12Pass = await ask({ type: 'password', message: 'Password del .p12' });
      const profileFile = await askFile('Ruta del perfil (.mobileprovision)');
      let profile;
      try {
        await spin('Abriendo el .p12 con openssl…', () => validateP12({ file: p12, password: p12Pass }));
        profile = readProvisioningProfile({ file: profileFile });
      } catch (err) {
        console.log(`  ${sym.fail()} ${err.message}\n`);
        process.exitCode = 1;
        return;
      }
      ok('Certificado .p12 OK');
      const days = profile.expires ? Math.floor((profile.expires - Date.now()) / 86400000) : null;
      if (days !== null && days < 0) {
        console.log(`  ${sym.fail()} El perfil "${profile.name}" venció el ${profile.expires.toISOString().slice(0, 10)}. Regeneralo en developer.apple.com.\n`);
        process.exitCode = 1;
        return;
      }
      ok(`Perfil "${profile.name}" ${c.gray(`(${profile.kind}, team ${profile.team}, vence en ${days} días)`)}`);
      if (days !== null && days < 14) console.log(`  ${sym.warn()} ${c.yellow('Vence en menos de 14 días.')}`);
      if (picked.includes('appstore') && profile.kind !== 'app-store') {
        console.log(`  ${sym.warn()} ${c.yellow(`TestFlight exige un perfil App Store; este es ${profile.kind}.`)}`);
      }
      toUpload.push(
        ['IOS_CERTIFICATE_BASE64', readBase64(p12)],
        ['IOS_CERTIFICATE_PASSWORD', p12Pass],
        ['IOS_PROVISION_PROFILE_BASE64', readBase64(profileFile)]
      );
    }

    if (group === 'play') {
      console.log(rule(c.bold('Google Play'), PANEL));
      const file = await askFile('Ruta del JSON de la service account');
      const text = fs.readFileSync(file, 'utf8');
      try {
        ok(`Service account ${c.gray(validateServiceAccountJson(text))}`);
      } catch (err) {
        console.log(`  ${sym.fail()} ${err.message}\n`);
        process.exitCode = 1;
        return;
      }
      toUpload.push(['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', text]);
    }

    if (group === 'appstore') {
      console.log(rule(c.bold('TestFlight (App Store Connect API)'), PANEL));
      const keyId = await ask({ type: 'text', message: 'Key ID', validate: (v) => (/^[A-Z0-9]{10}$/.test(v) ? true : '10 caracteres, p. ej. ABC123DEF4') });
      const issuer = await ask({
        type: 'text',
        message: 'Issuer ID',
        validate: (v) => (/^[0-9a-f-]{36}$/i.test(v) ? true : 'Es un UUID (Users and Access → Integrations)'),
      });
      const p8 = await askFile(`Ruta de la key (.p8, suele llamarse AuthKey_${keyId}.p8)`);
      try {
        validateP8(fs.readFileSync(p8, 'utf8'));
      } catch (err) {
        console.log(`  ${sym.fail()} ${err.message}\n`);
        process.exitCode = 1;
        return;
      }
      ok('API key .p8 OK');
      toUpload.push(
        ['APP_STORE_CONNECT_API_KEY_ID', keyId],
        ['APP_STORE_CONNECT_ISSUER_ID', issuer],
        ['APP_STORE_CONNECT_API_KEY_BASE64', readBase64(p8)]
      );
    }
  }

  console.log();
  const rows = toUpload.map(([name]) => [name, present.has(name) ? c.yellow('reemplaza') : c.green('nuevo')]);
  console.log(box(table(rows), { title: opts['dry-run'] ? 'Se subirían (dry-run)' : 'A subir', color: c.cyan, minWidth: PANEL }));
  console.log();

  if (opts['dry-run']) {
    console.log(`  ${sym.info()} ${c.bold('--dry-run')}: todo validado, no se subió nada.\n`);
    return;
  }
  const go = await ask({ type: 'confirm', message: `¿Subir ${toUpload.length} secrets al repo?`, initial: true });
  if (!go) onCancel();

  for (const [name, value] of toUpload) {
    try {
      await spin(`gh secret set ${name}…`, () => setRepoSecret({ name, value, cwd }), { minMs: 0 });
      ok(name);
    } catch (err) {
      console.log(`  ${sym.fail()} ${name}: ${err.message}\n`);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`\n  ${sym.ok()} ${c.bold('Listo.')} Verificá con ${c.cyan('npx shadownrx-code doctor')}\n`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  let opts;
  try {
    opts = parseCli(process.argv.slice(2));
  } catch (err) {
    console.error(`\n  ${sym.fail()} ${err.message}\n  ${c.gray('Probá')} ${c.cyan('--help')}\n`);
    process.exit(2);
  }
  if (opts['no-color'] || opts.json) setColor(false);
  if (opts.version) return console.log(pkg.version);
  if (opts.help) return printHelp();

  const cwd = path.resolve(opts.cwd ?? process.cwd());
  if (opts.command === 'doctor') return doctor(opts, cwd);
  if (opts.command === 'secrets') return secretsCommand(opts, cwd);
  return init(opts, cwd);
}

main();
