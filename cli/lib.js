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

export function androidSecrets() {
  return ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
}

export function iosSecrets() {
  return ['IOS_CERTIFICATE_BASE64', 'IOS_CERTIFICATE_PASSWORD', 'IOS_PROVISION_PROFILE_BASE64'];
}

export function playStoreSecrets() {
  return ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'];
}

export function appStoreSecrets() {
  return ['APP_STORE_CONNECT_API_KEY_ID', 'APP_STORE_CONNECT_ISSUER_ID', 'APP_STORE_CONNECT_API_KEY_BASE64'];
}

// Store uploads only fire on version tags, never on every push to main or on PRs.
const ON_VERSION_TAG = "${{ startsWith(github.ref, 'refs/tags/v') }}";

/**
 * Builds the literal contents of .github/workflows/build.yml.
 * Kept as plain string templating (not a YAML library) so the output
 * matches exactly what docs/USAGE.md shows and stays easy to diff by eye.
 *
 * For projectType 'electron', buildAndroid/buildIos are irrelevant (that
 * job only runs for mobile project types) and buildElectron is emitted
 * instead — and vice versa. Same for publishPlayStore/publishTestflight,
 * which also only apply to the platform actually being built.
 */
export function buildWorkflowYaml({
  projectType,
  buildAndroid,
  buildIos,
  buildElectron,
  createRelease,
  publishPlayStore = false,
  publishTestflight = false,
}) {
  const isElectron = projectType === 'electron';
  const playStore = !isElectron && buildAndroid && publishPlayStore;
  const testflight = !isElectron && buildIos && publishTestflight;

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

  lines.push('    uses: shadownrx/code/.github/workflows/build-mobile.yml@main', '    with:', `      project_type: ${projectType}`);

  if (isElectron) {
    lines.push(`      build_electron: ${buildElectron}`);
  } else {
    lines.push(`      build_android: ${buildAndroid}`, `      build_ios: ${buildIos}`);
  }

  if (createRelease) {
    lines.push('      create_release: true');
  }

  if (playStore || testflight) {
    // Stores reject a repeated versionCode/CFBundleVersion.
    lines.push('      build_number: ${{ github.run_number }}');
  }
  if (playStore) {
    lines.push(`      publish_play_store: ${ON_VERSION_TAG}`, '      play_track: internal');
  }
  if (testflight) {
    // Explicit so non-tag builds also export with the App Store profile
    // (otherwise they'd fall back to ad-hoc and fail the profile check).
    lines.push('      ios_export_method: app-store', `      publish_testflight: ${ON_VERSION_TAG}`);
  }

  lines.push('    secrets: inherit', '');

  return lines.join('\n');
}
