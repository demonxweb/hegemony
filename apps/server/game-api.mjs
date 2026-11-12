import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import catalog from '../../data/hegemony-base-catalog.json' with { type: 'json' };
import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import { applyCommand, createGame, GameError, names, playerView, policies, roles } from '../../packages/engine/game.mjs';
import { requireRule } from '../../packages/engine/errors.mjs';
import { domesticPriceLevels } from '../../packages/engine/prices.mjs';
import { summarizeAction } from './action-summary.mjs';

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

export function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

export async function readJson(request, limit = 4096) {
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

export function claimSeat(room, input) {
  const { role } = input;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!roles.includes(role) || !name || name.length > 24) throw new GameError('請輸入 1 至 24 字的暱稱並選擇角色。');
  if (room.game.phase !== 'lobby' || room.seats[role]) throw new GameError('此席位已有人或遊戲已開始。', 409);
  const token = randomBytes(32).toString('hex');
  room.seats[role] = { name, key: fingerprint(token) };
  room.revision++;
  return { code: room.code, token };
}

export function newRoom(host, readRoom, full) {
  let code;
  do code = randomBytes(4).toString('hex').toUpperCase();
  while (readRoom(code));
  return { code, revision: 0, host, seats: {}, processed: {}, game: createGame({ full }) };
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

export function createGameApi({ readRoom, saveRoom, deleteRoom, getSaveKey, instance, quickReload = false, quickRooms = false, allowDelete, full = true }) {
  const saveSignature = game => createHmac('sha256', getSaveKey()).update(JSON.stringify([saveVersion, game])).digest();
  return async function route(request, response, path) {
    if (request.method === 'GET') {
      if (path === '/api/meta') return json(response, 200, { roles, names, policies, policyRules: base.policies, domesticPriceLevels, checkedCommands, turnCommands,
        actionConfirmation: true, quickReload, quickRooms, instance,
        playerTracks: { population: catalog.boards.population, prosperity: catalog.boards.prosperity, wealth: base.wealth } });
      if (path === '/api/catalog') return json(response, 200, catalogView);
    }
    if (request.method === 'POST' && path === '/api/rooms') {
      const input = await readJson(request);
      const room = newRoom(input.role, readRoom, full);
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
      if (!allowDelete(request)) throw new GameError('請從本機快速開桌頁刪除房間。', 403);
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
  };
}
