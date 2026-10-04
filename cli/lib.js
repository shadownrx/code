import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const PROJECT_LABELS = {
  flutter: 'Flutter',
  'react-native': 'React Native',
  pwa: 'PWA (Capacitor)',
  electron: 'Electron',
};

/**
 * Same detection rules as the `detect` job in .github/workflows/build-mobile.yml,
 * ported to Node so the CLI can guess before asking.
 */
export function detectProjectType(cwd) {
  const pubspecPath = path.join(cwd, 'pubspec.yaml');
  if (fs.existsSync(pubspecPath)) {
    const content = fs.readFileSync(pubspecPath, 'utf8');
    if (/^\s*flutter:/m.test(content)) return 'flutter';
  }

  if (
    fs.existsSync(path.join(cwd, 'capacitor.config.ts')) ||
    fs.existsSync(path.join(cwd, 'capacitor.config.json'))
  ) {
    return 'pwa';
  }

  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps && (deps['electron'] || deps['electron-builder'])) return 'electron';
      if (deps && deps['react-native']) return 'react-native';
    } catch {
      // malformed package.json — fall through to "not detected"
    }
  }

  return null;
}

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * The branch the generated workflow should build on push: the remote's
 * default branch if known (origin/HEAD), else the current branch, else
 * 'main'. Hardcoding 'main' meant repos on 'master' (or 'Main') never
 * built on push.
 */
export function detectDefaultBranch(cwd) {
  const remoteHead = git(cwd, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (remoteHead.startsWith('origin/')) return remoteHead.slice('origin/'.length);

  const current = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (current) return current;

  return 'main';
}

export function androidSecrets() {
  return ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
}

export function iosSecrets() {
  return ['IOS_CERTIFICATE_BASE64', 'IOS_CERTIFICATE_PASSWORD', 'IOS_PROVISION_PROFILE_BASE64', 'IOS_TEAM_ID'];
}

/**
 * Builds the literal contents of .github/workflows/build.yml.
 * Kept as plain string templating (not a YAML library) so the output
 * matches exactly what docs/USAGE.md shows and stays easy to diff by eye.
 *
 * For projectType 'electron', buildAndroid/buildIos are irrelevant (that
 * job only runs for mobile project types) and buildElectron is emitted
 * instead — and vice versa.
 */
export function buildWorkflowYaml({ projectType, buildAndroid, buildIos, buildElectron, createRelease, branch = 'main' }) {
  // Plain branch names go in unquoted, like the docs show; anything YAML
  // could misread is emitted as a JSON (= YAML) string.
  const branchYaml = /^[A-Za-z0-9._/-]+$/.test(branch) ? branch : JSON.stringify(branch);
  const lines = [
    'name: Build Mobile Apps',
    '',
    'on:',
    '  push:',
    `    branches: [${branchYaml}]`,
    '    tags: ["v*"]',
    '  pull_request:',
    '  workflow_dispatch:',
    '',
    'jobs:',
    '  build:',
  ];

  if (createRelease) {
    lines.push('    permissions:', '      contents: write');
  }

  lines.push('    uses: shadownrx/code/.github/workflows/build-mobile.yml@main', '    with:', `      project_type: ${projectType}`);

  if (projectType === 'electron') {
    lines.push(`      build_electron: ${buildElectron}`);
  } else {
    lines.push(`      build_android: ${buildAndroid}`, `      build_ios: ${buildIos}`);
  }

  if (createRelease) {
    lines.push('      create_release: true');
  }

  lines.push('    secrets: inherit', '');

  return lines.join('\n');
}
