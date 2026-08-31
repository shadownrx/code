import fs from 'node:fs';
import path from 'node:path';

export const PROJECT_LABELS = {
  flutter: 'Flutter',
  'react-native': 'React Native',
  pwa: 'PWA (Capacitor)',
};

/**
 * Same detection rules as .github/actions/detect-project/action.yml,
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
      if (deps && deps['react-native']) return 'react-native';
    } catch {
      // malformed package.json — fall through to "not detected"
    }
  }

  return null;
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
 */
export function buildWorkflowYaml({ projectType, buildAndroid, buildIos, createRelease }) {
  const lines = [
    'name: Build Mobile Apps',
    '',
    'on:',
    '  push:',
    '    branches: [main]',
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

  lines.push(
    '    uses: shadownrx/code/.github/workflows/build-mobile.yml@main',
    '    with:',
    `      project_type: ${projectType}`,
    `      build_android: ${buildAndroid}`,
    `      build_ios: ${buildIos}`
  );

  if (createRelease) {
    lines.push('      create_release: true');
  }

  lines.push('    secrets: inherit', '');

  return lines.join('\n');
}
