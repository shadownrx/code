#!/usr/bin/env node
// MCP server exposing shadownrx/code's build-mobile.yml setup as tools for
// any MCP client (Cursor, Claude Code, Windsurf, etc.) — not Cursor-specific,
// MCP is an open standard. See cli/README.md for how to point Cursor at this.
import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  PROJECT_LABELS,
  androidSecrets,
  buildWorkflowYaml,
  detectProjectType,
  iosSecrets,
} from './lib.js';

const server = new McpServer({ name: 'shadownrx-code', version: '1.0.0' });

const PROJECT_TYPES = ['auto', 'flutter', 'react-native', 'pwa', 'electron'];

function text(str) {
  return { content: [{ type: 'text', text: str }] };
}

server.registerTool(
  'detect_project_type',
  {
    title: 'Detect mobile/desktop project type',
    description:
      'Looks at a directory and reports whether it is a Flutter, React Native, PWA (Capacitor), or Electron ' +
      'project, using the same rules as build-mobile.yml\'s auto-detection. Read-only — writes nothing.',
    inputSchema: {
      cwd: z.string().optional().describe('Directory to inspect. Defaults to the server process cwd.'),
    },
  },
  async ({ cwd }) => {
    const dir = cwd ? path.resolve(cwd) : process.cwd();
    if (!fs.existsSync(dir)) {
      return { ...text(`No existe el directorio: ${dir}`), isError: true };
    }
    const detected = detectProjectType(dir);
    if (!detected) {
      return text(
        `No se detectó ningún tipo de proyecto conocido en ${dir}.\n` +
          'Buscado: pubspec.yaml con flutter:, capacitor.config.ts/json, o package.json ' +
          'con electron/electron-builder/react-native.'
      );
    }
    return text(`Detectado: ${PROJECT_LABELS[detected]} (project_type: ${detected}) en ${dir}`);
  }
);

server.registerTool(
  'setup_mobile_ci',
  {
    title: 'Set up free Android/iOS/Electron CI',
    description:
      'Writes .github/workflows/build.yml wired to shadownrx/code\'s free reusable GitHub Actions workflow ' +
      '(build-mobile.yml), which builds Android/iOS (no Mac needed) or Electron for Linux/macOS/Windows ' +
      '(no Mac or Windows machine needed), depending on project_type. Detects the project type automatically ' +
      'if not given. Refuses to overwrite an existing build.yml unless overwrite is true.',
    inputSchema: {
      cwd: z.string().optional().describe('Project root to write .github/workflows/build.yml into. Defaults to the server process cwd.'),
      project_type: z.enum(PROJECT_TYPES).optional().describe('Defaults to auto-detecting from the project files.'),
      build_android: z.boolean().optional().describe('Only relevant for flutter/react-native/pwa. Default true.'),
      build_ios: z.boolean().optional().describe('Only relevant for flutter/react-native/pwa. Default true.'),
      build_electron: z.boolean().optional().describe('Only relevant for project_type electron. Default true.'),
      create_release: z.boolean().optional().describe('Attach build artifacts to a GitHub Release on tag pushes. Default false.'),
      overwrite: z.boolean().optional().describe('Overwrite an existing .github/workflows/build.yml. Default false.'),
    },
  },
  async ({ cwd, project_type, build_android, build_ios, build_electron, create_release, overwrite }) => {
    const dir = cwd ? path.resolve(cwd) : process.cwd();
    if (!fs.existsSync(dir)) {
      return { ...text(`No existe el directorio: ${dir}`), isError: true };
    }

    let projectType = project_type;
    if (!projectType || projectType === 'auto') {
      const detected = detectProjectType(dir);
      if (!detected) {
        return {
          ...text(
            `No pude detectar el tipo de proyecto en ${dir}. Pasá project_type explícitamente ` +
              `(${PROJECT_TYPES.filter((t) => t !== 'auto').join(', ')}).`
          ),
          isError: true,
        };
      }
      projectType = detected;
    }

    const isElectron = projectType === 'electron';
    const yaml = buildWorkflowYaml({
      projectType,
      buildAndroid: build_android ?? true,
      buildIos: build_ios ?? true,
      buildElectron: build_electron ?? true,
      createRelease: create_release ?? false,
    });

    const workflowPath = path.join(dir, '.github', 'workflows', 'build.yml');
    const relPath = path.relative(dir, workflowPath);
    if (fs.existsSync(workflowPath) && !overwrite) {
      return {
        ...text(
          `Ya existe ${relPath}. Llamá de nuevo con overwrite: true si querés reemplazarlo.\n\n` +
            'Contenido propuesto:\n\n```yaml\n' + yaml + '\n```'
        ),
        isError: true,
      };
    }

    fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
    fs.writeFileSync(workflowPath, yaml);

    const notes = [`Escribí ${relPath} (project_type: ${projectType}).`];
    if (isElectron) {
      notes.push('Los builds de Electron salen sin firmar por ahora (firma de macOS/Windows no soportada todavía).');
    } else {
      notes.push(
        'Sin firma por defecto. Para builds firmados agregá los secrets de GitHub descritos en docs/SIGNING.md:\n' +
          `  Android: ${androidSecrets().join(', ')}\n` +
          `  iOS:     ${iosSecrets().join(', ')}`
      );
    }
    notes.push('Siguiente paso: commit + push. El build corre gratis en GitHub Actions.');

    return text(notes.join('\n\n') + '\n\n```yaml\n' + yaml + '\n```');
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
