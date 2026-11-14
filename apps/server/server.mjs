import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameError } from '../../packages/engine/game.mjs';
import { createGameApi, json } from './game-api.mjs';
import { openRoomStore } from './room-store.mjs';
import { createAdminApi } from './admin-api.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const web = join(root, 'apps', 'web');
const assets = join(root, 'assets', 'prototype');
const store = process.env.HEGEMONY_STORE ?? join(root, '.runtime');
const roomStore = openRoomStore(store);
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', svg: 'image/svg+xml' };
function getSaveKey() {
  const path = join(store, '.save-key');
  let key;
  try {
    key = readFileSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    key = randomBytes(32);
    writeFileSync(path, key, { mode: 0o600, flag: 'wx' });
  }
  return key;
}

function localAdminSetup(request) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
    && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(request.headers.host ?? '')
    && !['cross-site', 'same-site'].includes(request.headers['sec-fetch-site']);
}

const full = process.env.HEGEMONY_TEST_TRIAL !== '1';
const gameApi = createGameApi({ ...roomStore, getSaveKey, clientId: request => request.socket.remoteAddress,
  full,
  allowLegacyRooms: process.env.HEGEMONY_TEST_LEGACY_ROOMS === '1' });
const adminApi = createAdminApi({ ...roomStore, getSaveKey,
  canSetUp: localAdminSetup,
  clientId: request => request.socket.remoteAddress });

async function route(request, response) {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET') {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const pages = { '/': 'index.html', '/help': 'help.html', '/help.js': 'help.js', '/help.css': 'help.css', '/help-content.js': 'help-content.js', '/mobile.css': 'mobile.css', '/mobile.js': 'mobile.js', '/style.css': 'style.css',
      '/admin': 'admin.html', '/admin.js': 'admin.js',
      '/catalog.css': 'catalog.css', '/catalog.js': 'catalog.js', '/catalog-action-details.js': 'catalog-action-details.js',
      '/app.js': 'app.js', '/boards.js': 'boards.js', '/pieces.js': 'pieces.js' };
    if (path === '/catalog') {
      response.writeHead(302, { Location: '/help#cards' });
      return response.end();
    }
    const page = Object.hasOwn(pages, path) && pages[path];
    const asset = /^\/assets\/(cards|icons)\/[a-z-]+\.svg$/.test(path);
    if (page || asset) {
      const file = page ? join(web, page) : join(assets, path.slice('/assets/'.length));
      try {
        const body = readFileSync(file);
        response.writeHead(200, { 'Content-Type': types[file.split('.').at(-1)] });
        return response.end(body);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  return (path.startsWith('/api/admin/') ? adminApi : gameApi)(request, response, path);
}

const server = createServer((request, response) => {
  route(request, response).catch(error => {
    if (error instanceof GameError) return json(response, error.status, { error: error.message });
    console.error(error);
    json(response, 500, { error: '伺服器暫時無法處理此請求。' });
  });
});
server.listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? '127.0.0.1', () => {
  const { address, port } = server.address();
  console.log(`Hegemony http://${address}:${port}`);
});
