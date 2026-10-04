// Runs the real bash from .github/workflows/build-mobile.yml, so the
// reusable workflow and the CLI can't silently drift apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectProjectType } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'build-mobile.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

const hasJq = (() => {
  try {
    execFileSync('jq', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Returns the `run: |` script of the first step whose header line matches
 * `stepPattern`. Plain indentation slicing instead of a YAML library: the
 * block ends at the first non-blank line indented no deeper than `run:`.
 */
function stepScript(stepPattern) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((l) => stepPattern.test(l));
  assert.notEqual(start, -1, `step ${stepPattern} not found in build-mobile.yml`);
  const runIdx = lines.findIndex((l, i) => i > start && /^\s+run: \|\s*$/.test(l));
  const runIndent = lines[runIdx].search(/\S/);
  const body = [];
  for (const line of lines.slice(runIdx + 1)) {
    if (line.trim() !== '' && line.search(/\S/) <= runIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(indent)).join('\n');
}

function runStep(script, cwd, env = {}) {
  const outputFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gh-output-')), 'out');
  fs.writeFileSync(outputFile, '');
  execFileSync('bash', ['-e', '-c', script], {
    cwd,
    env: { ...process.env, GITHUB_OUTPUT: outputFile, ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return Object.fromEntries(
    fs
      .readFileSync(outputFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2))
  );
}

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadownrx-code-wf-'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const pkg = (obj) => JSON.stringify(obj);

const DETECTION_CASES = {
  'flutter pubspec': { 'pubspec.yaml': 'name: demo\nflutter:\n  sdk: flutter\n' },
  'pubspec without flutter key': { 'pubspec.yaml': 'name: demo\ndependencies:\n  x: 1.0\n' },
  'capacitor.config.ts': { 'capacitor.config.ts': 'export default {}', 'package.json': pkg({ dependencies: { electron: '1' } }) },
  'capacitor.config.json': { 'capacitor.config.json': '{}' },
  'electron devDependency': { 'package.json': pkg({ devDependencies: { electron: '33' } }) },
  'electron-builder only': { 'package.json': pkg({ devDependencies: { 'electron-builder': '25' } }) },
  'react-native dependency': { 'package.json': pkg({ dependencies: { 'react-native': '0.87.1' } }) },
  'electron wins over react-native': {
    'package.json': pkg({ dependencies: { 'react-native': '0.87.1' }, devDependencies: { electron: '33' } }),
  },
  // These used to be misdetected by grepping package.json for the string.
  'react-native app with an "electron" keyword': {
    'package.json': pkg({ keywords: ['electron'], dependencies: { 'react-native': '0.87.1' } }),
  },
  'react-native app with an "electron" script': {
    'package.json': pkg({ scripts: { electron: 'echo' }, dependencies: { 'react-native': '0.87.1' } }),
  },
  'react-native only as a peerDependency': { 'package.json': pkg({ peerDependencies: { 'react-native': '*' } }) },
  'malformed package.json': { 'package.json': '{ "dependencies": { "electron": ' },
  'package.json is null': { 'package.json': 'null' },
  'empty directory': {},
};

for (const [name, files] of Object.entries(DETECTION_CASES)) {
  test(`workflow auto-detection matches the CLI: ${name}`, { skip: !hasJq && 'jq not installed' }, () => {
    const dir = tmpProject(files);
    const { project_type } = runStep(stepScript(/^\s+- id: auto$/), dir);
    assert.equal(project_type, detectProjectType(dir) ?? 'unknown');
  });
}

/** Minimal java.util.Properties reader: key=value lines with \-escapes. */
function readProperties(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([^=]+)=[ \t\f]*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/\\(.)/g, (_, c) => ({ t: '\t', n: '\n', r: '\r', f: '\f' })[c] ?? c);
  }
  return out;
}

test('Android signing step writes the keystore and an exact, absolute key.properties', () => {
  const dir = tmpProject({});
  const keystore = Buffer.from([0xfe, 0xed, 0xfe, 0xed, 0x00, 0x01, 0x02, 0xff]);
  const env = {
    ANDROID_KEYSTORE_BASE64: keystore.toString('base64'),
    // Each of these broke when secrets were pasted straight into a heredoc.
    ANDROID_KEYSTORE_PASSWORD: 'Te$t`whoami`$(id)\\n#!',
    ANDROID_KEY_ALIAS: 'my alias',
    ANDROID_KEY_PASSWORD: ' lead\\ing "quote\' \\t',
  };
  runStep(stepScript(/name: Decode Android signing keystore/), dir, env);

  assert.deepEqual(fs.readFileSync(path.join(dir, 'android/keystore/release.jks')), keystore);

  const props = readProperties(fs.readFileSync(path.join(dir, 'android/key.properties'), 'utf8'));
  assert.equal(props.storeFile, path.join(fs.realpathSync(dir), 'android/keystore/release.jks'));
  assert.ok(path.isAbsolute(props.storeFile));
  assert.equal(props.storePassword, env.ANDROID_KEYSTORE_PASSWORD);
  assert.equal(props.keyAlias, env.ANDROID_KEY_ALIAS);
  assert.equal(props.keyPassword, env.ANDROID_KEY_PASSWORD);
});

test('no step interpolates secrets directly into a script', () => {
  // `${{ secrets.X }}` inside `run:` is expanded by bash; secrets must go
  // through `env:` (the only allowed places are env:/with:/if: values).
  const offenders = workflow
    .split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\$\{\{\s*secrets\./.test(l))
    .filter(([, l]) => !/^\s+[A-Z0-9_]+: \$\{\{\s*secrets\.[A-Z0-9_]+\s*(!= '')?\s*\}\}\s*$/.test(l))
    .filter(([, l]) => !/^\s+(if|run): [^']*\$\{\{ (secrets\.[A-Z0-9_]+ != '' *(&& *)?)+\}\}/.test(l));
  assert.deepEqual(offenders, []);
});

test('reusable workflow references no local actions (they resolve in the caller repo)', () => {
  assert.doesNotMatch(workflow, /^\s*(-\s+)?uses:\s+\.\//m);
});
