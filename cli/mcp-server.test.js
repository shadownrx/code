import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, 'mcp-server.js');

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadownrx-code-mcp-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

async function withClient(fn) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

function textOf(result) {
  return result.content.map((c) => c.text).join('\n');
}

test('lists both tools', async () => {
  await withClient(async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['detect_project_type', 'setup_mobile_ci']);
  });
});

test('detect_project_type finds a React Native project over stdio', async () => {
  const dir = tmpProject({
    'package.json': JSON.stringify({ name: 'demo', dependencies: { 'react-native': '0.87.1' } }),
  });
  await withClient(async (client) => {
    const result = await client.callTool({ name: 'detect_project_type', arguments: { cwd: dir } });
    assert.match(textOf(result), /React Native/);
  });
});

test('detect_project_type reports nothing found', async () => {
  const dir = tmpProject({ 'README.md': '# empty' });
  await withClient(async (client) => {
    const result = await client.callTool({ name: 'detect_project_type', arguments: { cwd: dir } });
    assert.match(textOf(result), /No se detectó/);
  });
});

test('setup_mobile_ci writes a real build.yml for an auto-detected Electron project', async () => {
  const dir = tmpProject({
    'package.json': JSON.stringify({ name: 'demo', devDependencies: { electron: '33.2.0', 'electron-builder': '25.1.8' } }),
  });
  await withClient(async (client) => {
    const result = await client.callTool({ name: 'setup_mobile_ci', arguments: { cwd: dir } });
    assert.equal(result.isError, undefined);
    assert.match(textOf(result), /project_type: electron/);

    const written = fs.readFileSync(path.join(dir, '.github/workflows/build.yml'), 'utf8');
    assert.match(written, /project_type: electron/);
    assert.match(written, /build_electron: true/);
    assert.doesNotMatch(written, /build_android/);
  });
});

test('setup_mobile_ci refuses to overwrite without overwrite: true', async () => {
  const dir = tmpProject({ 'pubspec.yaml': 'name: demo\nflutter:\n  sdk: flutter\n' });
  await withClient(async (client) => {
    const first = await client.callTool({ name: 'setup_mobile_ci', arguments: { cwd: dir } });
    assert.equal(first.isError, undefined);

    const second = await client.callTool({ name: 'setup_mobile_ci', arguments: { cwd: dir, project_type: 'flutter' } });
    assert.equal(second.isError, true);
    assert.match(textOf(second), /Ya existe/);

    const third = await client.callTool({
      name: 'setup_mobile_ci',
      arguments: { cwd: dir, project_type: 'flutter', create_release: true, overwrite: true },
    });
    assert.equal(third.isError, undefined);
    const written = fs.readFileSync(path.join(dir, '.github/workflows/build.yml'), 'utf8');
    assert.match(written, /create_release: true/);
  });
});

test('setup_mobile_ci errors without a detectable type and no explicit project_type', async () => {
  const dir = tmpProject({ 'README.md': '# empty' });
  await withClient(async (client) => {
    const result = await client.callTool({ name: 'setup_mobile_ci', arguments: { cwd: dir } });
    assert.equal(result.isError, true);
    assert.match(textOf(result), /No pude detectar/);
  });
});
