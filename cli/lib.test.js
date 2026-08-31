import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWorkflowYaml, detectProjectType } from './lib.js';

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
