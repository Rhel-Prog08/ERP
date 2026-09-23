'use strict';

/**
 * Arranque de desarrollo en paralelo (sin dependencias extra):
 *   npm run dev   →  backend (--watch, :4000) + frontend (Expo, :8081)
 * Cada proceso es etiquetado [backend]/[frontend]; Ctrl+C detiene ambos.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const root = path.resolve(__dirname, '..');
const children = [];

function run(name, args) {
  const child = spawn(npm, args, {
    cwd: root,
    shell: isWin, // Windows necesita shell para resolver npm.cmd
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tag = `[${name}] `;
  const pipe = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line) out.write(tag + line + '\n');
      }
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${tag}terminado (code ${code})\n`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('backend', ['run', 'dev', '--workspace=apps/backend']);
run('frontend', ['run', 'start', '--workspace=apps/frontend']);
