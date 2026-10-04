import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWorkflowYaml, detectDefaultBranch, detectProjectType } from './lib.js';

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadownrx-code-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

test('detects Flutter via pubspec.yaml', () => {
  const dir = tmpProject({ 'pubspec.yaml': 'name: demo\nflutter:\n  sdk: flutter\n' });
  assert.equal(detectProjectType(dir), 'flutter');
});

test('detects React Native via package.json dependency', () => {
  const dir = tmpProject({
    'package.json': JSON.stringify({ name: 'demo', dependencies: { 'react-native': '0.87.1' } }),
  });
  assert.equal(detectProjectType(dir), 'react-native');
});

test('detects PWA via capacitor.config.json', () => {
  const dir = tmpProject({ 'capacitor.config.json': '{}' });
  assert.equal(detectProjectType(dir), 'pwa');
});

test('detects Electron via package.json devDependency', () => {
  const dir = tmpProject({
    'package.json': JSON.stringify({ name: 'demo', devDependencies: { electron: '33.2.0', 'electron-builder': '25.1.8' } }),
  });
  assert.equal(detectProjectType(dir), 'electron');
});

test('Electron is detected before React Native when both happen to be present', () => {
  const dir = tmpProject({
    'package.json': JSON.stringify({
      name: 'demo',
      dependencies: { 'react-native': '0.87.1' },
      devDependencies: { electron: '33.2.0' },
    }),
  });
  assert.equal(detectProjectType(dir), 'electron');
});

test('returns null when nothing matches', () => {
  const dir = tmpProject({ 'README.md': '# nothing here' });
  assert.equal(detectProjectType(dir), null);
});

test('pubspec.yaml without a flutter: key is not treated as Flutter', () => {
  const dir = tmpProject({ 'pubspec.yaml': 'name: demo\ndependencies:\n  something: 1.0\n' });
  assert.equal(detectProjectType(dir), null);
});

test('generates a minimal both-platforms workflow', () => {
  const yaml = buildWorkflowYaml({ projectType: 'flutter', buildAndroid: true, buildIos: true, createRelease: false });
  assert.match(yaml, /project_type: flutter/);
  assert.match(yaml, /build_android: true/);
  assert.match(yaml, /build_ios: true/);
  assert.doesNotMatch(yaml, /permissions:/);
  assert.doesNotMatch(yaml, /create_release/);
  assert.match(yaml, /uses: shadownrx\/code\/\.github\/workflows\/build-mobile\.yml@main/);
});

test('android-only selection sets build_ios: false', () => {
  const yaml = buildWorkflowYaml({ projectType: 'react-native', buildAndroid: true, buildIos: false, createRelease: false });
  assert.match(yaml, /build_android: true/);
  assert.match(yaml, /build_ios: false/);
});

test('create_release adds the permissions block and input', () => {
  const yaml = buildWorkflowYaml({ projectType: 'pwa', buildAndroid: true, buildIos: true, createRelease: true });
  assert.match(yaml, /permissions:\n\s+contents: write/);
  assert.match(yaml, /create_release: true/);
});

test('electron project type emits build_electron instead of build_android/build_ios', () => {
  const yaml = buildWorkflowYaml({ projectType: 'electron', buildElectron: true, createRelease: false });
  assert.match(yaml, /project_type: electron/);
  assert.match(yaml, /build_electron: true/);
  assert.doesNotMatch(yaml, /build_android/);
  assert.doesNotMatch(yaml, /build_ios/);
});

test('push trigger defaults to main', () => {
  const yaml = buildWorkflowYaml({ projectType: 'pwa', buildAndroid: true, buildIos: false, createRelease: false });
  assert.match(yaml, /push:\n\s+branches: \[main\]/);
});

test('push trigger uses the given branch, quoting names YAML could misread', () => {
  const master = buildWorkflowYaml({ projectType: 'pwa', buildAndroid: true, buildIos: true, createRelease: false, branch: 'master' });
  assert.match(master, /branches: \[master\]/);

  const odd = buildWorkflowYaml({ projectType: 'pwa', buildAndroid: true, buildIos: true, createRelease: false, branch: 'dev: #1' });
  assert.match(odd, /branches: \["dev: #1"\]/);
});

function git(cwd, ...args) {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

test('detectDefaultBranch falls back to main outside a git repo', () => {
  const dir = tmpProject({});
  assert.equal(detectDefaultBranch(dir), 'main');
});

test('detectDefaultBranch uses the current branch when there is no origin', () => {
  const dir = tmpProject({});
  git(dir, 'init', '-q', '-b', 'master');
  assert.equal(detectDefaultBranch(dir), 'master');
});

test("detectDefaultBranch prefers origin's default branch over the current one", () => {
  const origin = tmpProject({});
  git(origin, 'init', '-q', '-b', 'trunk');
  git(origin, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');

  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'shadownrx-code-clone-'));
  git(clone, 'clone', '-q', origin, '.');
  git(clone, 'switch', '-q', '-c', 'feature/x');
  assert.equal(detectDefaultBranch(clone), 'trunk');
});
