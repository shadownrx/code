// Pre-flight checks (`shadownrx-code doctor`) and secret validation
// (`shadownrx-code secrets`). Everything that shells out goes through an
// injectable runner so tests can fake `gh`, `keytool` and `openssl`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PROJECT_LABELS,
  androidSecrets,
  appStoreSecrets,
  detectProjectType,
  iosSecrets,
  playStoreSecrets,
} from './lib.js';

/** Runs a command and returns trimmed stdout; throws with stderr in the message. */
export function run(cmd, args, { cwd, input, env } = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      input,
      env: env ? { ...process.env, ...env } : process.env,
      encoding: 'utf8',
      stdio: [input != null ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error(`${cmd} no está instalado`);
      e.code = 'ENOENT';
      throw e;
    }
    const stderr = String(err.stderr || '').trim();
    const e = new Error(stderr.split('\n').find(Boolean) || err.message);
    e.stderr = stderr;
    throw e;
  }
}

export const WORKFLOW_FILE = path.join('.github', 'workflows', 'build.yml');

/**
 * Reads back the options a generated build.yml calls build-mobile.yml with.
 * Line-based on purpose: we only need to understand files we generated.
 */
export function readWorkflowConfig(yaml) {
  const val = (key) => yaml.match(new RegExp(`^\\s+${key}:\\s*(.+?)\\s*$`, 'm'))?.[1];
  const bool = (key, dflt) => {
    const v = val(key);
    if (v == null) return dflt;
    // Store flags are `${{ startsWith(...) }}` expressions: on for tag pushes.
    return v !== 'false';
  };
  return {
    usesShadownrx: /uses:\s*shadownrx\/code\/\.github\/workflows\/build-mobile\.yml@/.test(yaml),
    projectType: val('project_type') ?? 'auto',
    buildAndroid: bool('build_android', true),
    buildIos: bool('build_ios', true),
    publishPlayStore: bool('publish_play_store', false),
    publishTestflight: bool('publish_testflight', false),
  };
}

/** Which secret groups a configuration needs (`required`) or can use (`optional`). */
export function secretGroups(config) {
  const isElectron = config.projectType === 'electron';
  const groups = [];
  if (isElectron) return groups;
  if (config.buildAndroid) {
    groups.push({ id: 'android', label: 'Firma Android', names: androidSecrets(), required: Boolean(config.publishPlayStore) });
  }
  if (config.buildIos) {
    groups.push({ id: 'ios', label: 'Firma iOS', names: iosSecrets(), required: Boolean(config.publishTestflight) });
  }
  if (config.buildAndroid && config.publishPlayStore) {
    groups.push({ id: 'play', label: 'Google Play', names: playStoreSecrets(), required: true });
  }
  if (config.buildIos && config.publishTestflight) {
    groups.push({ id: 'appstore', label: 'TestFlight', names: appStoreSecrets(), required: true });
  }
  return groups;
}

/**
 * Names of the repo's Actions secrets via `gh secret list`. Returns
 * `{ names: Set }` or `{ error }` (gh missing, not logged in, no GitHub remote).
 */
export function listRepoSecrets({ cwd, exec = run } = {}) {
  try {
    const out = exec('gh', ['secret', 'list', '--app', 'actions', '--json', 'name', '--jq', '.[].name'], { cwd });
    return { names: new Set(out.split('\n').map((s) => s.trim()).filter(Boolean)) };
  } catch (err) {
    if (err.code === 'ENOENT') return { error: 'gh (GitHub CLI) no está instalado' };
    if (/auth login|not logged/i.test(err.message)) return { error: 'gh no tiene sesión: corré `gh auth login`' };
    return { error: `gh no pudo leer los secrets: ${err.message}` };
  }
}

/** Checks each secret group against the names present in the repo. */
export function compareSecrets(groups, present) {
  return groups.map((g) => {
    const missing = g.names.filter((n) => !present.has(n));
    let status;
    if (missing.length === 0) status = 'ok';
    else if (g.required) status = 'fail';
    else if (missing.length < g.names.length) status = 'warn'; // half-configured
    else status = 'skip'; // optional and untouched: builds unsigned
    return { ...g, missing, status };
  });
}

function findGradle(cwd, projectType) {
  const base = projectType === 'pwa' || projectType === 'react-native' || projectType === 'flutter' ? 'android/app' : null;
  if (!base) return null;
  for (const name of ['build.gradle.kts', 'build.gradle']) {
    const p = path.join(cwd, base, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Runs every pre-flight check. Each result is
 * `{ id, title, status: ok|warn|fail|skip, detail?, fix? }`.
 * `exec` is injected so tests don't need gh.
 */
export function runDoctor({ cwd, exec = run, checkSecrets = true } = {}) {
  const results = [];
  const add = (r) => results.push(r);

  // 1. Project type
  const detected = detectProjectType(cwd);
  add(
    detected
      ? { id: 'project', title: 'Tipo de proyecto', status: 'ok', detail: PROJECT_LABELS[detected] }
      : {
          id: 'project',
          title: 'Tipo de proyecto',
          status: 'warn',
          detail: 'no detectado (pubspec.yaml, capacitor.config.*, package.json)',
          fix: 'Pasá project_type explícito en build.yml.',
        }
  );

  // 2. Workflow
  const wfPath = path.join(cwd, WORKFLOW_FILE);
  let config = null;
  if (!fs.existsSync(wfPath)) {
    add({
      id: 'workflow',
      title: 'Workflow',
      status: 'fail',
      detail: `falta ${WORKFLOW_FILE}`,
      fix: 'Corré `npx shadownrx-code` para generarlo.',
    });
  } else {
    config = readWorkflowConfig(fs.readFileSync(wfPath, 'utf8'));
    if (!config.usesShadownrx) {
      add({
        id: 'workflow',
        title: 'Workflow',
        status: 'warn',
        detail: `${WORKFLOW_FILE} no llama a shadownrx/code/.github/workflows/build-mobile.yml`,
        fix: 'Regeneralo con `npx shadownrx-code --force`.',
      });
    } else {
      add({ id: 'workflow', title: 'Workflow', status: 'ok', detail: `${WORKFLOW_FILE} (project_type: ${config.projectType})` });
    }
    if (config.projectType === 'auto' && detected) config.projectType = detected;
    if (detected && config.projectType !== 'auto' && config.projectType !== detected) {
      add({
        id: 'project-mismatch',
        title: 'Tipo en build.yml',
        status: 'fail',
        detail: `build.yml dice ${config.projectType} pero el proyecto parece ${detected}`,
        fix: `Cambiá project_type a ${detected} o regenerá el workflow.`,
      });
    }
  }

  // 3. Gradle reads the signing config and the build number
  const projectType = config?.projectType ?? detected;
  const buildAndroid = config ? config.buildAndroid : true;
  if (projectType && projectType !== 'electron' && buildAndroid) {
    const gradle = findGradle(cwd, projectType);
    if (!gradle) {
      add({
        id: 'gradle',
        title: 'android/app/build.gradle',
        status: 'skip',
        detail: projectType === 'pwa' ? 'todavía no existe (se crea con `npx cap add android`)' : 'no encontrado',
      });
    } else {
      const src = fs.readFileSync(gradle, 'utf8');
      const rel = path.relative(cwd, gradle);
      add(
        /key\.properties/.test(src)
          ? { id: 'gradle-signing', title: 'Firma en Gradle', status: 'ok', detail: `${rel} lee key.properties` }
          : {
              id: 'gradle-signing',
              title: 'Firma en Gradle',
              status: config?.publishPlayStore ? 'fail' : 'warn',
              detail: `${rel} no lee android/key.properties: el release sale firmado con la clave debug`,
              fix: 'Agregá el bloque signingConfigs de docs/SIGNING.md.',
            }
      );
      if (config?.publishPlayStore && projectType !== 'flutter') {
        const readsVersion = /(hasProperty|findProperty)\(\s*['"]versionCode['"]\s*\)/.test(src);
        add(
          readsVersion
            ? { id: 'gradle-version', title: 'versionCode', status: 'ok', detail: `${rel} lee -PversionCode` }
            : {
                id: 'gradle-version',
                title: 'versionCode',
                status: 'fail',
                detail: `${rel} ignora -PversionCode: Play rechaza el segundo upload ("Version code already used")`,
                fix: "versionCode project.hasProperty('versionCode') ? project.property('versionCode').toInteger() : 1",
              }
        );
      }
    }
  }

  // 4. Secrets in the GitHub repo
  if (checkSecrets && config && projectType !== 'electron') {
    const groups = secretGroups({ ...config, projectType });
    const listed = listRepoSecrets({ cwd, exec });
    if (listed.error) {
      add({
        id: 'secrets',
        title: 'Secrets de GitHub',
        status: groups.some((g) => g.required) ? 'warn' : 'skip',
        detail: listed.error,
      });
    } else {
      for (const g of compareSecrets(groups, listed.names)) {
        const detail =
          g.status === 'ok'
            ? `${g.names.length}/${g.names.length} cargados`
            : g.status === 'skip'
              ? 'sin cargar: el build sale sin firmar'
              : `faltan ${g.missing.join(', ')}`;
        add({
          id: `secrets-${g.id}`,
          title: `Secrets · ${g.label}`,
          status: g.status,
          detail,
          fix: g.status === 'ok' || g.status === 'skip' ? undefined : 'Cargalos con `npx shadownrx-code secrets`.',
        });
      }
    }
  }

  return results;
}

export function doctorExitCode(results) {
  return results.some((r) => r.status === 'fail') ? 1 : 0;
}

// ─── Secret validation (used by `shadownrx-code secrets`) ─────────────────────

export function readBase64(file) {
  return fs.readFileSync(file).toString('base64');
}

/**
 * Opens a keystore with keytool exactly like build-mobile.yml does, so a
 * wrong password/alias fails on the developer's machine instead of in CI.
 * Returns the certificate's SHA-256 (lowercase hex, no colons).
 */
export function validateKeystore({ file, password, alias, exec = run }) {
  if (!fs.existsSync(file)) throw new Error(`No existe ${file}`);
  let out;
  try {
    // Password via env, never argv: argv is visible to other local users (ps).
    out = exec('keytool', ['-list', '-v', '-keystore', file, '-storepass:env', 'SHADOWNRX_KS_PASS', '-alias', alias], {
      env: { SHADOWNRX_KS_PASS: password },
    });
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('keytool no está instalado (viene con el JDK)');
    throw new Error(`keytool no pudo abrir el keystore con ese password + alias: ${err.message}`);
  }
  const sha = out.match(/SHA256:\s*([0-9A-Fa-f:]+)/)?.[1];
  if (!sha) throw new Error('keytool abrió el keystore pero no mostró el certificado SHA-256');
  return sha.replace(/:/g, '').toLowerCase();
}

/** Checks the .p12 password with openssl (retrying with -legacy for OpenSSL 3). */
export function validateP12({ file, password, exec = run }) {
  if (!fs.existsSync(file)) throw new Error(`No existe ${file}`);
  const base = ['pkcs12', '-in', file, '-nokeys', '-passin', 'env:SHADOWNRX_P12_PASS'];
  const env = { SHADOWNRX_P12_PASS: password };
  try {
    exec('openssl', base, { env });
    return;
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('openssl no está instalado');
    try {
      exec('openssl', [...base, '-legacy'], { env });
      return;
    } catch {
      throw new Error(`openssl no pudo abrir el .p12 con ese password: ${err.message}`);
    }
  }
}

/** Pulls Name, UUID, TeamIdentifier and ExpirationDate out of a profile's plist XML. */
export function parseProfilePlist(xml) {
  const str = (key) => xml.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1];
  const date = xml.match(/<key>ExpirationDate<\/key>\s*<date>([^<]*)<\/date>/)?.[1];
  const team = xml.match(/<key>TeamIdentifier<\/key>\s*<array>\s*<string>([^<]*)<\/string>/)?.[1];
  const hasDevices = /<key>ProvisionedDevices<\/key>/.test(xml);
  const allDevices = /<key>ProvisionsAllDevices<\/key>\s*<true\/>/.test(xml);
  const taskAllow = /<key>get-task-allow<\/key>\s*<true\/>/.test(xml);
  return {
    name: str('Name'),
    uuid: str('UUID'),
    team,
    expires: date ? new Date(date) : null,
    // Same classification build-mobile.yml uses to check ios_export_method.
    kind: allDevices ? 'enterprise' : hasDevices ? (taskAllow ? 'development' : 'ad-hoc') : 'app-store',
  };
}

/** Decodes a .mobileprovision (CMS-signed plist) with `security` on macOS, else openssl. */
export function readProvisioningProfile({ file, exec = run, platform = os.platform() }) {
  if (!fs.existsSync(file)) throw new Error(`No existe ${file}`);
  let xml;
  try {
    xml =
      platform === 'darwin'
        ? exec('security', ['cms', '-D', '-i', file])
        : exec('openssl', ['smime', '-inform', 'der', '-verify', '-noverify', '-in', file]);
  } catch (err) {
    throw new Error(`No pude leer el perfil de aprovisionamiento: ${err.message}`);
  }
  const profile = parseProfilePlist(xml);
  if (!profile.uuid) throw new Error('El archivo no parece un .mobileprovision válido (no tiene UUID)');
  return profile;
}

export function validateServiceAccountJson(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('El archivo de la service account no es JSON válido');
  }
  if (json.type !== 'service_account' || !json.client_email || !json.private_key) {
    throw new Error('El JSON no es una key de service account de Google (falta type/client_email/private_key)');
  }
  return json.client_email;
}

export function validateP8(text) {
  if (!/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(text)) {
    throw new Error('El .p8 no tiene un bloque BEGIN/END PRIVATE KEY');
  }
}

/** Uploads one secret through `gh secret set`, value on stdin (never argv). */
export function setRepoSecret({ name, value, cwd, exec = run }) {
  exec('gh', ['secret', 'set', name, '--app', 'actions'], { cwd, input: value });
}
