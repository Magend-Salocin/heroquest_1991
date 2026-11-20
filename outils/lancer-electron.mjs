// Lance la version PC (Electron) en retirant ELECTRON_RUN_AS_NODE, que VS Code transmet à ses
// terminaux : avec elle, Electron se comporte comme Node et la fenêtre ne s'ouvre pas.
//   node outils/lancer-electron.mjs [--dev] [--options=sans-intro]   (npm start, npm run dev)

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const environnement = { ...process.env };
delete environnement.ELECTRON_RUN_AS_NODE;

const processus = spawn(electron, [racine, ...process.argv.slice(2)], { stdio: 'inherit', env: environnement });
processus.on('exit', (code) => process.exit(code ?? 0));
