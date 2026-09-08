import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const root = process.cwd();
const nodeModules = resolve(root, 'node_modules');
const tsxCli = resolve(nodeModules, 'tsx/dist/cli.mjs');
const viteCli = resolve(nodeModules, 'vite/bin/vite.js');
const children = [];

function start(command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: {...process.env, ...env},
    stdio: 'inherit',
  });
  children.push(child);
  child.on('exit', (code) => {
    if (code && !children.some((process) => process.exitCode === null)) {
      process.exitCode = code;
    }
  });
}

start(process.execPath, [tsxCli, 'server.ts'], {
  DISABLE_VITE: 'true',
});
start(process.execPath, [viteCli, '--host', '0.0.0.0'], {
  VITE_API_BASE_URL: 'http://localhost:3000',
  DISABLE_HMR: 'true',
});

function stop() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
