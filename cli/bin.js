#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import {
  PROJECT_LABELS,
  androidSecrets,
  buildWorkflowYaml,
  detectProjectType,
  iosSecrets,
} from './lib.js';

const cwd = process.cwd();

function onCancel() {
  console.log('\nCancelado — no se modificó nada.\n');
  process.exit(1);
}

async function main() {
  console.log('\n▲ shadownrx/code — configurador de CI para Android, iOS y Electron\n');
  console.log('Esto escribe .github/workflows/build.yml en este proyecto. No compila nada');
  console.log('acá: el build corre gratis en GitHub Actions con cada push.\n');

  const detected = detectProjectType(cwd);
  let projectType = detected;

  if (detected) {
    const { confirmDetected } = await prompts(
      {
        type: 'confirm',
        name: 'confirmDetected',
        message: `Detecté un proyecto ${PROJECT_LABELS[detected]} en este directorio. ¿Es correcto?`,
        initial: true,
      },
      { onCancel }
    );
    if (!confirmDetected) projectType = null;
  }

  if (!projectType) {
    const { picked } = await prompts(
      {
        type: 'select',
        name: 'picked',
        message: '¿Qué tipo de proyecto es?',
        choices: [
          { title: 'Flutter', value: 'flutter' },
          { title: 'React Native', value: 'react-native' },
          { title: 'PWA (Capacitor)', value: 'pwa' },
          { title: 'Electron', value: 'electron' },
          { title: 'Detectar automáticamente en cada build', value: 'auto' },
        ],
      },
      { onCancel }
    );
    projectType = picked;
  }

  const isElectron = projectType === 'electron';

  let buildAndroid = true;
  let buildIos = true;
  let buildElectron = true;
  let wantsSigning = false;

  if (isElectron) {
    console.log('\nElectron compila Linux, macOS y Windows en paralelo — no hace falta elegir.\n');
  } else {
    const { target } = await prompts(
      {
        type: 'select',
        name: 'target',
        message: '¿Qué deseas compilar?',
        choices: [
          { title: 'Android + iOS (ambas)', value: 'both' },
          { title: 'Solo Android', value: 'android' },
          { title: 'Solo iOS', value: 'ios' },
        ],
      },
      { onCancel }
    );
    buildAndroid = target !== 'ios';
    buildIos = target !== 'android';

    const signingAnswer = await prompts(
      {
        type: 'confirm',
        name: 'wantsSigning',
        message: '¿Ya tenés listos los secrets de firma (keystore / certificado de Apple)?',
        initial: false,
      },
      { onCancel }
    );
    wantsSigning = signingAnswer.wantsSigning;
  }

  const { wantsRelease } = await prompts(
    {
      type: 'confirm',
      name: 'wantsRelease',
      message: '¿Adjuntar los builds a un GitHub Release cuando pushees un tag (v1.2.3)?',
      initial: false,
    },
    { onCancel }
  );

  const workflowPath = path.join(cwd, '.github', 'workflows', 'build.yml');
  if (fs.existsSync(workflowPath)) {
    const { overwrite } = await prompts(
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Ya existe ${path.relative(cwd, workflowPath)}. ¿Sobrescribir?`,
        initial: false,
      },
      { onCancel }
    );
    if (!overwrite) {
      console.log('\nCancelado — no se modificó nada.\n');
      return;
    }
  }

  const yaml = buildWorkflowYaml({
    projectType,
    buildAndroid,
    buildIos,
    buildElectron,
    createRelease: wantsRelease,
  });

  fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
  fs.writeFileSync(workflowPath, yaml);

  console.log(`\n✔ Escribí ${path.relative(cwd, workflowPath)}\n`);

  if (isElectron) {
    console.log(
      'Los builds de Electron salen sin firmar por ahora (la firma de macOS/Windows\n' +
        'todavía no está soportada por la plataforma).\n'
    );
  } else if (wantsSigning) {
    console.log('Agregá estos secrets en GitHub (Settings → Secrets and variables → Actions):\n');
    if (buildAndroid) console.log(`  Android: ${androidSecrets().join(', ')}`);
    if (buildIos) console.log(`  iOS:     ${iosSecrets().join(', ')}`);
    console.log('\nDetalle paso a paso: https://github.com/shadownrx/code/blob/main/docs/SIGNING.md\n');
  } else {
    console.log(
      'Por ahora va a compilar sin firmar (sirve para probar que compila y correr en\n' +
        'simulador/emulador). Cuando quieras builds firmados, mirá docs/SIGNING.md.\n'
    );
  }

  console.log('Siguiente paso: hacé commit y push — el primer build corre solo, gratis,');
  console.log('sin necesitar Mac (ni Windows, si es Electron) en tu máquina.\n');
}

main();
