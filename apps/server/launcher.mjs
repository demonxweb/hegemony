import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./server.mjs', import.meta.url));
let port = process.env.PORT ?? '4173';
let child;
let stopping = false;

function start() {
  let reload = false;
  child = fork(entry, { env: { ...process.env, PORT: port } });
  child.on('message', message => {
    if (message.type === 'listening') port = String(message.port);
    if (message.type === 'reload') reload = true;
  });
  child.on('exit', code => {
    if (reload && code === 0 && !stopping) start();
    else process.exitCode = stopping ? 0 : (code ?? 1);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    child?.kill();
  });
}

start();
