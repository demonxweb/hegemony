import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../../data/hegemony-base-catalog.json' with { type: 'json' };
import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import { applyCommand, createGame, GameError, names, playerView, policies, roles } from '../../packages/engine/game.mjs';
import { requireRule } from '../../packages/engine/errors.mjs';
import { domesticPriceLevels } from '../../packages/engine/prices.mjs';
import { summarizeAction } from './action-summary.mjs';
import { openRoomStore } from './room-store.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const web = join(root, 'apps', 'web');
const assets = join(root, 'assets', 'prototype');
const store = process.env.HEGEMONY_STORE ?? join(root, '.runtime');
const { readRoom, saveRoom, deleteRoom } = openRoomStore(store);
const instance = randomBytes(8).toString('hex');
let reloading = false;
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', svg: 'image/svg+xml' };
const turnCommands = ['play', 'assign', 'build', 'sell', 'buy', 'deal', 'export', 'strike', 'event', 'campaign',
  'propose', 'pressure', 'demonstrate', 'extra-shift', 'lobby', 'meet-mps', 'extra-tax', 'wages', 'repay', 'benefits',
  'buy-storage', 'use-education', 'use-health', 'use-luxury', 'swap-workers', 'adjust-prices', 'give-bonus'];
const checkedCommands = [...turnCommands, 'card-choice', 'event-hire', 'policy-choice', 'worker-arrival', 'demonstration-losses'];
const catalogView = {
  decks: catalog.decks, marketSizes: catalog.marketSizes, policies, names,
  storage: { ...catalog.boards.storages, tiles: catalog.components.storage_tiles, freeTradeTiles: catalog.components.free_trade_zone },
  sources: { official: catalog.officialRules, cards: catalog.source },
};

function fingerprint(token) {
  return createHash('sha256').update(token).digest('hex');
}

const saveVersion = 1;

function saveSignature(game) {
  const path = join(store, '.save-key');
  let key;
  try {
    key = readFileSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    key = randomBytes(32);
    writeFileSync(path, key, { mode: 0o600, flag: 'wx' });
  }
  return createHmac('sha256', key).update(JSON.stringify([saveVersion, game])).digest();
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function readJson(request, limit = 4096) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw new GameError('請求太大。', 413);
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Report malformed requests consistently.
  }
  throw new GameError('請求格式錯誤。');
}

function claimSeat(room, input) {
  const { role } = input;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!roles.includes(role) || !name || name.length > 24) throw new GameError('請輸入 1 至 24 字的暱稱並選擇角色。');
  if (room.game.phase !== 'lobby' || room.seats[role]) throw new GameError('此席位已有人或遊戲已開始。', 409);
  const token = randomBytes(32).toString('hex');
  room.seats[role] = { name, key: fingerprint(token) };
  room.revision++;
  return { code: room.code, token };
}

function newRoom(host) {
  let code;
  do code = randomBytes(4).toString('hex').toUpperCase();
  while (readRoom(code));
  return { code, revision: 0, host, seats: {}, processed: {}, game: createGame({ full: process.env.HEGEMONY_TEST_TRIAL !== '1' }) };
}

function authenticate(room, request) {
  const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization ?? '')?.[1];
  const role = token && roles.find(seat => room.seats[seat]?.key === fingerprint(token));
  if (!role) throw new GameError('席位憑證無效，請使用原本的瀏覽器分頁重連。', 401);
  return role;
}

function view(room, role) {
  return {
    code: room.code, role, host: room.host, revision: room.revision, restoredRevision: room.restoredRevision ?? 0,
    seats: Object.fromEntries(roles.map(seat => [seat, room.seats[seat]?.name ?? null])),
    ...playerView(room.game, role),
  };
}

function applySingleAction(game, role, input) {
  requireRule(turnCommands.includes(input.type) && game.phase === 'action' && !game.transaction, '目前無法確認此行動。');
  applyCommand(game, role, input, true);
  if (game.transaction) applyCommand(game, role, { type: 'transaction-confirm' }, true);
}

function localQuickRequest(request) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
    && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(request.headers.host ?? '')
    && !['cross-site', 'same-site'].includes(request.headers['sec-fetch-site']);
}

async function route(request, response) {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET') {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (path === '/api/meta') return json(response, 200, { roles, names, policies, policyRules: base.policies, domesticPriceLevels, checkedCommands, turnCommands,
      actionConfirmation: true, quickReload: Boolean(process.connected), instance,
      playerTracks: { population: catalog.boards.population, prosperity: catalog.boards.prosperity, wealth: base.wealth } });
    if (path === '/api/catalog') return json(response, 200, catalogView);
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
    const room = newRoom('working');
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
  if (request.method === 'POST' && path === '/api/rooms') {
    const input = await readJson(request);
    const room = newRoom(input.role);
    const seat = claimSeat(room, input);
    saveRoom(room);
    return json(response, 201, seat);
  }
  const match = /^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|command|check|action-preview|action-confirm|save))?$/.exec(path);
  if (!match) throw new GameError('找不到頁面。', 404);
  const [, code, action] = match;
  if (action === 'save' && ['GET', 'POST'].includes(request.method)) {
    const input = request.method === 'POST' ? await readJson(request, 8 * 1024 * 1024) : null;
    const room = readRoom(code);
    if (!room) throw new GameError('找不到房間。', 404);
    if (authenticate(room, request) !== room.host) throw new GameError('只有房主可以匯出或匯入遊戲。', 403);
    if (!input) return json(response, 200, { version: saveVersion, game: room.game, signature: saveSignature(room.game).toString('hex') });
    if (input.revision !== room.revision) throw new GameError('房間進度已更新，請重新確認匯入。', 409);
    const { version, game, signature } = input.save ?? {};
    requireRule(version === saveVersion && game && typeof game === 'object' && !Array.isArray(game)
      && typeof signature === 'string' && /^[0-9a-f]{64}$/.test(signature), '存檔格式或版本不符。');
    requireRule(timingSafeEqual(saveSignature(game), Buffer.from(signature, 'hex')), '存檔驗證失敗。請使用由這台伺服器匯出的原始檔案。');
    requireRule(game.phase === 'lobby' || roles.every(role => room.seats[role]), '請先讓目前房間的四個席位入座，再匯入已開始的對局。');
    const revision = room.revision + 1;
    const next = { ...room, revision, restoredRevision: revision, game };
    saveRoom(next);
    return json(response, 200, view(next, room.host));
  }
  if (request.method === 'DELETE' && !action) {
    if (!localQuickRequest(request)) throw new GameError('請從本機快速開桌頁刪除房間。', 403);
    const room = readRoom(code);
    if (!room) throw new GameError('找不到房間。', 404);
    if (authenticate(room, request) !== room.host) throw new GameError('只有房主可以刪除房間。', 403);
    deleteRoom(code);
    return json(response, 200, { deleted: code });
  }
  if (request.method === 'POST' && action) {
    const input = await readJson(request, ['check', 'action-preview', 'action-confirm'].includes(action) ? 16384 : 4096);
    const room = readRoom(code);
    if (!room) throw new GameError('找不到房間。', 404);
    if (action === 'join') {
      const next = { ...room, seats: { ...room.seats } };
      const seat = claimSeat(next, input);
      saveRoom(next);
      return json(response, 200, seat);
    }
    const role = authenticate(room, request);
    const { id, revision } = input;
    if (action === 'check') {
      if (!checkedCommands.includes(input.type)) throw new GameError('此操作不提供事前檢查。');
      if (revision !== room.revision) throw new GameError('畫面已更新，請依最新狀態確認。', 409);
      // Return only validity. Any draws, choices and state changes stay in the copy.
      const projected = structuredClone(room.game);
      if (turnCommands.includes(input.type)) applySingleAction(projected, role, input);
      else applyCommand(projected, role, input, roles.every(seat => room.seats[seat]));
      return json(response, 200, { valid: true });
    }
    if (action === 'action-preview') {
      if (revision !== room.revision) throw new GameError('畫面已更新，請依最新狀態確認。', 409);
      const projected = structuredClone(room.game);
      applySingleAction(projected, role, input);
      return json(response, 200, summarizeAction(room.game, projected, role, input));
    }
    if (typeof id !== 'string' || !/^[a-z0-9-]{12,64}$/i.test(id)) throw new GameError('命令識別碼無效。');
    const key = `${role}:${id}`;
    if (Object.hasOwn(room.processed, key)) return json(response, 200, view(room, role));
    const sameBallot = input.type === 'bid' && room.game.election && input.electionId === room.game.election.id;
    const sameResult = input.type === 'confirm-vote' && room.game.voteConfirmation && input.electionId === room.game.lastVote.id;
    if (revision !== room.revision && (!(revision >= (room.restoredRevision ?? room.rewindRevision ?? 0)) || (!sameBallot && !sameResult))) {
      throw new GameError('畫面已更新，請確認後重試。', 409);
    }
    if (['start', 'next-round'].includes(input.type) && room.host !== role) throw new GameError('由房主開始新一輪。', 403);
    const next = { ...room, game: structuredClone(room.game), processed: { ...room.processed } };
    if (action === 'action-confirm') applySingleAction(next.game, role, input);
    else applyCommand(next.game, role, input, roles.every(seat => next.seats[seat]));
    next.processed[key] = true;
    next.revision++;
    saveRoom(next);
    return json(response, 200, view(next, role));
  }
  if (request.method === 'GET' && !action) {
    const room = readRoom(code);
    if (!room) throw new GameError('找不到房間。', 404);
    return json(response, 200, view(room, authenticate(room, request)));
  }
  throw new GameError('不支援的請求。', 405);
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
