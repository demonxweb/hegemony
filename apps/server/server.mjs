import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameError, names, roles } from '../../packages/engine/game.mjs';
import { claimSeat, createGameApi, json, newRoom, readJson } from './game-api.mjs';
import { openRoomStore } from './room-store.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const web = join(root, 'apps', 'web');
const assets = join(root, 'assets', 'prototype');
const store = process.env.HEGEMONY_STORE ?? join(root, '.runtime');
const { readRoom, saveRoom, deleteRoom } = openRoomStore(store);
const instance = randomBytes(8).toString('hex');
let reloading = false;
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

function localQuickRequest(request) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
    && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(request.headers.host ?? '')
    && !['cross-site', 'same-site'].includes(request.headers['sec-fetch-site']);
}

const full = process.env.HEGEMONY_TEST_TRIAL !== '1';
const gameApi = createGameApi({ readRoom, saveRoom, deleteRoom, getSaveKey, instance,
  quickReload: Boolean(process.connected), quickRooms: true, allowDelete: localQuickRequest, full });

async function route(request, response) {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET') {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const pages = { '/': 'index.html', '/quick': 'index.html', '/catalog': 'catalog.html', '/style.css': 'style.css',
      '/catalog.css': 'catalog.css', '/catalog.js': 'catalog.js', '/catalog-action-details.js': 'catalog-action-details.js',
      '/app.js': 'app.js', '/boards.js': 'boards.js', '/pieces.js': 'pieces.js' };
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
  if (request.method === 'POST' && path === '/api/quick-room') {
    if (!localQuickRequest(request)
      || request.headers['content-type'] !== 'application/json') throw new GameError('請從本機快速開桌頁建立席位。', 403);
    await readJson(request);
    const room = newRoom('working', readRoom, full);
    const seats = Object.fromEntries(roles.map(role => [role, claimSeat(room, { role, name: names[role] })]));

    saveRoom(room);
    return json(response, 201, { code: room.code, seats });
  }
  if (request.method === 'POST' && path === '/api/quick-reload') {
    if (!localQuickRequest(request) || request.headers['content-type'] !== 'application/json') {
      throw new GameError('請從本機快速開桌頁重載伺服器。', 403);
    }
    if (!process.connected) throw new GameError('請用 npm start 啟動伺服器，以啟用重載功能。', 409);
    await readJson(request);
    if (reloading) throw new GameError('伺服器正在重載。', 409);
    reloading = true;
    response.once('finish', () => {
      server.close(error => {
        if (error) {
          reloading = false;
          return;
        }
        process.send({ type: 'reload' }, () => process.disconnect());
      });
    });
    return json(response, 202, { instance });
  }
  return gameApi(request, response, path);
}

const server = createServer((request, response) => {
  route(request, response).catch(error => {
    if (error instanceof GameError) return json(response, error.status, { error: error.message });
    console.error(error);
    json(response, 500, { error: '伺服器暫時無法處理此請求。' });
  });
});
if (process.connected) process.once('disconnect', () => {
  if (!reloading) server.close();
});
server.listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? '127.0.0.1', () => {
  const { address, port } = server.address();
  console.log(`Hegemony http://${address}:${port}`);
  if (process.connected) process.send({ type: 'listening', port });
});
