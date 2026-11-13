import { createHash, randomBytes } from 'node:crypto';
import catalog from '../../data/hegemony-base-catalog.json' with { type: 'json' };
import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import { applyCommand, createGame, GameError, names, playerView, policies, roles } from '../../packages/engine/game.mjs';
import { companyDefinition, syncPublicStorage } from '../../packages/engine/companies.mjs';
import { requireRule } from '../../packages/engine/errors.mjs';
import { domesticPriceLevels } from '../../packages/engine/prices.mjs';
import { cardDefinition } from '../../packages/engine/cards.mjs';
import { summarizeAction } from './action-summary.mjs';
import { createPlayerAccounts } from './player-accounts.mjs';

const turnCommands = ['play', 'assign', 'build', 'sell', 'buy', 'deal', 'export', 'strike', 'event', 'campaign',
  'propose', 'pressure', 'demonstrate', 'extra-shift', 'lobby', 'meet-mps', 'extra-tax', 'wages', 'repay', 'benefits',
  'buy-storage', 'use-education', 'use-health', 'use-luxury', 'swap-workers', 'adjust-prices', 'give-bonus'];
const checkedCommands = [...turnCommands, 'host-adjust', 'card-choice', 'event-hire', 'policy-choice', 'worker-arrival', 'demonstration-losses'];
const catalogView = {
  decks: catalog.decks, marketSizes: catalog.marketSizes, policies, names,
  storage: { ...catalog.boards.storages, tiles: catalog.components.storage_tiles, freeTradeTiles: catalog.components.free_trade_zone },
  sources: { official: catalog.officialRules, cards: catalog.source },
};

function fingerprint(token) {
  return createHash('sha256').update(token).digest('hex');
}

const presenceTimeout = 30_000;

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

function joinWaitingRoom(room, input, accountId, seatToken) {
  if (room.game.phase !== 'lobby') throw new GameError('遊戲已開始。', 409);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 24) throw new GameError('請輸入 1 至 24 字的暱稱。');
  if (!room.waiting) {
    const players = Object.entries(room.seats).map(([role, seat]) =>
      ({ ...seat, id: randomBytes(8).toString('hex'), role, ready: false }));
    room.waiting = { players, host: players.find(player => player.role === room.host)?.id, selectionRevision: 0 };
  }
  const { waiting } = room;
  if (waiting.players.length >= roles.length) throw new GameError('房間已滿。', 409);
  const token = seatToken ?? randomBytes(32).toString('hex');
  const id = randomBytes(8).toString('hex');
  waiting.players.push({ id, name, key: fingerprint(token), role: null, ready: false, accountId });
  waiting.host ??= id;
  room.revision++;
  return { code: room.code, token };
}

function roomMember(room, accountId) {
  return (room.waiting?.players ?? Object.values(room.seats)).find(player => player.accountId === accountId);
}

function authenticate(room, request, accounts) {
  const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.authorization ?? '')?.[1];
  const matches = member => member && (member.accountId
    ? accounts.seatToken(member.accountId, room.code) === token
    : member.key === fingerprint(token));
  const role = token && (room.waiting
    ? room.waiting.players.find(matches)?.id
    : roles.find(seat => matches(room.seats[seat])));
  if (!role) throw new GameError('席位憑證無效，請使用原本的瀏覽器分頁重連。', 401);
  return role;
}

function roomName(input, fallback) {
  if (input === undefined) return fallback;
  requireRule(typeof input === 'string' && input.trim().length <= 60, '房間名稱最多 60 字。');
  return input.trim() || fallback;
}

function roomView(room, role, accounts) {
  if (room.waiting) {
    const { host, players, selectionRevision } = room.waiting;
    const canInvite = role === host && !room.invitationsLocked;
    const invitations = canInvite ? (room.invitations ?? []).filter(invite => !invite.revoked) : undefined;
    return { code: room.code, roomName: room.name ?? room.code, role, host, revision: room.revision, restoredRevision: room.restoredRevision ?? 0, phase: 'lobby',
      testMode: room.game.testMode === true,
      waiting: { selectionRevision, skillSelection: Boolean(room.game.content),
        invitations: invitations?.map(invite => ({ ...invite, joined: Boolean(roomMember(room, invite.id)) })),
        invitationCandidates: invitations && accounts.invitationCandidates(new Set([
          players.find(player => player.id === host)?.accountId, ...invitations.map(invite => invite.id),
        ])),
        middleMarket: room.game.content && players.find(player => player.id === role)?.role === 'middle'
          ? room.game.economy.markets.middle.map(companyDefinition) : undefined,
        players: players.map(({ id, name, role, ready, skill }) => ({ id, name, role, ready, skill })) } };
  }
  return {
    code: room.code, roomName: room.name ?? room.code, role, host: room.host, revision: room.revision, restoredRevision: room.restoredRevision ?? 0,
    seats: Object.fromEntries(roles.map(seat => [seat, room.seats[seat]?.name ?? null])),
    ...playerView(room.game, role),
  };
}

function updateWaitingRoom(room, id, input, accounts) {
  const waiting = room.waiting;
  const player = waiting.players.find(item => item.id === id);
  if (input.type === 'invite' || input.type === 'revoke-invite') {
    if (id !== waiting.host) throw new GameError('只有房主可以管理邀請。', 403);
    if (room.invitationsLocked) throw new GameError('遊戲已開始，無法更改邀請。', 409);
    const invitations = room.invitations ??= [];
    if (input.type === 'invite') {
      const invitee = accounts.lookup(input.name);
      if (!invitee) throw new GameError('找不到這個帳號。', 404);
      requireRule(invitee.id !== player.accountId, '不能邀請自己。');
      const existing = invitations.find(invite => invite.id === invitee.id);
      if (existing && !existing.revoked) throw new GameError('已邀請這個帳號。', 409);
      if (existing) Object.assign(existing, invitee, { revoked: false });
      else invitations.push(invitee);
    } else {
      const invite = invitations.find(item => item.id === input.id && !item.revoked);
      if (!invite) throw new GameError('找不到這筆邀請。', 404);
      invite.revoked = true;
      const index = waiting.players.findIndex(item => item.accountId === invite.id);
      if (index >= 0) {
        waiting.players.splice(index, 1);
        waiting.selectionRevision++;
        for (const item of waiting.players) item.ready = false;
      }
    }
  } else if (input.type === 'select') {
    requireRule(input.role === null || roles.includes(input.role), '請選擇有效的階級。');
    if (player.role === input.role) return id;
    player.role = input.role;
    delete player.skill;
    waiting.selectionRevision++;
    for (const item of waiting.players) item.ready = false;
  } else if (input.type === 'start-skill') {
    requireRule(room.game.content && player.role === 'middle' && !player.ready
      && ['food', 'luxury', 'health', 'education', 'influence'].includes(input.skill), '請由中產選擇有效的開局技術工技能。');
    if (player.skill === input.skill) return id;
    player.skill = input.skill;
    waiting.selectionRevision++;
    for (const item of waiting.players) item.ready = false;
  } else if (input.type === 'cancel') {
    player.ready = false;
  } else if (input.type === 'ready') {
    requireRule(input.selectionRevision === waiting.selectionRevision, '階級選擇已更新，請重新確認。');
    const choices = waiting.players.map(item => item.role);
    requireRule(roles.every(role => choices.includes(role)), '四位玩家須選擇不同階級。');
    requireRule(!room.game.content || player.role !== 'middle' || player.skill, '請先選擇中產的開局技術工技能。');
    player.ready = true;
    if (waiting.players.every(item => item.ready)) {
      room.seats = Object.fromEntries(waiting.players.map(({ role, name, key, accountId }) => [role, { name, key, accountId }]));
      room.host = waiting.players.find(item => item.id === waiting.host).role;
      if (room.game.content) room.game.content.startSkill = waiting.players.find(item => item.role === 'middle').skill;
      delete room.waiting;
      room.invitationsLocked = true;
      applyCommand(room.game, room.host, { type: 'start' }, true);
      return player.role;
    }
  } else {
    throw new GameError('不支援的等待區操作。');
  }
  return id;
}

function applySingleAction(game, role, input) {
  requireRule(turnCommands.includes(input.type) && game.phase === 'action' && !game.transaction, '目前無法確認此行動。');
  applyCommand(game, role, input, true);
  if (game.transaction) applyCommand(game, role, { type: 'transaction-confirm' }, true);
}

export function createGameApi({ readRoom: loadRoom, saveRoom, deleteRoom, listRooms, addRoomSave, listRoomSaves, readRoomSave, getSetting, insertSetting, listSettings, getSaveKey, clientId,
  full = true, allowLegacyRooms = false }) {
  const accounts = createPlayerAccounts({ getSetting, insertSetting, listSettings, getSaveKey, clientId });
  const view = (room, role) => roomView(room, role, accounts);
  const activeSeats = new Map();
  function normalizePublicStorage(room) {
    if (room?.game.economy?.publicCapacityOverride) {
      delete room.game.economy.publicCapacityOverride;
      syncPublicStorage(room.game);
    }
    return room;
  }
  const readRoom = code => normalizePublicStorage(loadRoom(code));
  return async function route(request, response, path) {
    if (request.method === 'GET') {
      if (path === '/api/meta') return json(response, 200, { roles, names, policies, policyRules: base.policies, domesticPriceLevels, checkedCommands, turnCommands,
        actionConfirmation: true, loanPrincipal: base.loans.principal, loanSupply: base.components.small_cards.loans,
        playerTracks: { population: catalog.boards.population, prosperity: catalog.boards.prosperity, wealth: base.wealth } });
      if (path === '/api/catalog') return json(response, 200, catalogView);
    }
    if (request.method === 'POST' && ['/api/player/register', '/api/player/login'].includes(path)) {
      const player = await accounts.login(await readJson(request), path.endsWith('/register'), request);
      return json(response, 200, player);
    }
    if (request.method === 'GET' && path === '/api/player/rooms') {
      const player = accounts.authenticate(request);
      const allRooms = listRooms();
      const rooms = allRooms.flatMap(room => {
        const member = roomMember(room, player.id);
        if (!member) return [];
        const host = room.waiting ? room.waiting.host === member.id : room.seats[room.host] === member;
        return [{ code: room.code, roomName: room.name ?? room.code, phase: room.game.phase, round: room.game.match?.round, host }];
      });
      const invitations = allRooms.filter(room => room.waiting && !room.invitationsLocked &&
        room.invitations?.some(invite => invite.id === player.id && !invite.revoked)).map(room => ({
        code: room.code, roomName: room.name ?? room.code,
        hostName: room.waiting.players.find(member => member.id === room.waiting.host)?.name,
        full: room.waiting.players.length >= roles.length && !roomMember(room, player.id),
      }));
      return json(response, 200, { name: player.name, rooms, invitations });
    }
    if (request.method === 'POST' && path === '/api/rooms') {
      const input = await readJson(request);
      const legacy = allowLegacyRooms && !request.headers.authorization;
      const player = legacy ? null : accounts.authenticate(request);
      const room = newRoom(legacy ? input.role : undefined, readRoom, full);
      room.game.testMode = input.testMode === true;
      room.name = roomName(input.roomName, room.code);
      const seat = legacy
        ? (input.role === undefined ? joinWaitingRoom(room, input) : claimSeat(room, input))
        : joinWaitingRoom(room, player, player.id, accounts.seatToken(player.id, room.code));
      saveRoom(room);
      return json(response, 201, seat);
    }
    const match = /^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|waiting|command|check|action-preview|action-confirm|saves|restore|name))?$/.exec(path);
    if (!match) throw new GameError('找不到頁面。', 404);
    const [, code, action] = match;
    if (action === 'name' && request.method === 'GET') {
      accounts.authenticate(request);
      const room = readRoom(code);
      if (!room) throw new GameError('找不到房間。', 404);
      return json(response, 200, { roomName: room.name ?? room.code });
    }
    if (action === 'name' && request.method === 'POST') {
      const input = await readJson(request);
      const room = readRoom(code);
      if (!room) throw new GameError('找不到房間。', 404);
      const role = authenticate(room, request, accounts);
      if (role !== (room.waiting?.host ?? room.host)) throw new GameError('只有房長可以修改房間名稱。', 403);
      if (input.revision !== room.revision) throw new GameError('房間進度已更新，請重新操作。', 409);
      room.name = roomName(input.roomName, room.code);
      room.revision++;
      saveRoom(room);
      return json(response, 200, view(room, role));
    }
    if ((action === 'saves' && request.method === 'GET') || (['saves', 'restore'].includes(action) && request.method === 'POST')) {
      const input = request.method === 'POST' ? await readJson(request) : null;
      const room = readRoom(code);
      if (!room) throw new GameError('找不到房間。', 404);
      if (authenticate(room, request, accounts) !== (room.waiting?.host ?? room.host)) throw new GameError('只有房長可以儲存或讀取遊戲。', 403);
      if (room.game.testMode !== true) throw new GameError('只有測試房間可以儲存或讀取遊戲。', 403);
      if (!input) return json(response, 200, { saves: listRoomSaves(code) });
      if (input.revision !== room.revision) throw new GameError('房間進度已更新，請重新操作。', 409);
      if (action === 'saves') {
        const record = { id: randomBytes(16).toString('hex'), createdAt: new Date().toISOString() };
        addRoomSave(room, record);
        return json(response, 201, record);
      }
      const saved = typeof input.id === 'string' && normalizePublicStorage(readRoomSave(code, input.id));
      if (!saved) throw new GameError('找不到這個房間的存檔。', 404);
      const revision = room.revision + 1;
      const next = { ...saved, revision, restoredRevision: revision, processed: room.processed };
      next.invitations = room.invitations;
      next.invitationsLocked = room.invitationsLocked || room.game.phase !== 'lobby';
      next.game.testMode = room.game.testMode === true;
      next.name = room.name ?? room.code;
      if (next.waiting) {
        next.waiting.selectionRevision = revision;
        next.waiting.players = next.waiting.players.filter(player => !next.invitations?.some(invite => invite.revoked && invite.id === player.accountId));
        for (const player of next.waiting.players) player.ready = false;
      }
      saveRoom(next);
      return json(response, 200, view(next, next.waiting?.host ?? next.host));
    }
    if (request.method === 'DELETE' && !action) {
      const room = readRoom(code);
      if (!room) throw new GameError('找不到房間。', 404);
      if (authenticate(room, request, accounts) !== (room.waiting?.host ?? room.host)) throw new GameError('只有房主可以刪除房間。', 403);
      deleteRoom(code);
      return json(response, 200, { deleted: code });
    }
    if (request.method === 'POST' && action && !['saves', 'restore'].includes(action)) {
      const input = await readJson(request, ['check', 'action-preview', 'action-confirm'].includes(action) ? 16384 : 4096);
      const room = readRoom(code);
      if (!room) throw new GameError('找不到房間。', 404);
      if (action === 'join') {
        const legacy = allowLegacyRooms && !request.headers.authorization;
        if (legacy) {
          const seat = room.waiting || input.role === undefined ? joinWaitingRoom(room, input) : claimSeat(room, input);
          saveRoom(room);
          return json(response, 200, seat);
        }
        const player = accounts.authenticate(request);
        const token = accounts.seatToken(player.id, room.code);
        if (roomMember(room, player.id)) return json(response, 200, { code, token });
        if (room.invitations?.some(invite => invite.id === player.id && invite.revoked)) throw new GameError('房主已撤銷你的邀請。', 403);
        const seat = joinWaitingRoom(room, player, player.id, token);
        saveRoom(room);
        return json(response, 200, seat);
      }
      const role = authenticate(room, request, accounts);
      if (action === 'waiting' || room.waiting) {
        if (action !== 'waiting' || !room.waiting) throw new GameError('目前無法使用此操作。', 409);
        const viewer = updateWaitingRoom(room, role, input, accounts);
        room.revision++;
        saveRoom(room);
        return json(response, 200, view(room, viewer));
      }
      const { id, revision } = input;
      if (input.type === 'host-adjust' && role !== room.host) throw new GameError('只有房長可以調整遊戲狀態。', 403);
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
      if (Object.hasOwn(room.processed, key)) {
        const previous = room.processed[key];
        return json(response, 200, { ...view(room, role), ...(previous?.cardResult && { cardResult: previous.cardResult }) });
      }
      const sameBallot = input.type === 'bid' && room.game.election && input.electionId === room.game.election.id;
      const sameResult = input.type === 'confirm-vote' && room.game.voteConfirmation && input.electionId === room.game.lastVote.id;
      if (revision !== room.revision && (!(revision >= (room.restoredRevision ?? room.rewindRevision ?? 0)) || (!sameBallot && !sameResult))) {
        throw new GameError('畫面已更新，請確認後重試。', 409);
      }
      if (['start', 'next-round'].includes(input.type) && room.host !== role) throw new GameError('由房主開始新一輪。', 403);
      const next = { ...room, game: structuredClone(room.game), processed: { ...room.processed } };
      if (action === 'action-confirm') applySingleAction(next.game, role, input);
      else applyCommand(next.game, role, input, roles.every(seat => next.seats[seat]));
      const cardStep = ['card-choice', 'event-hire', 'civil-bill', 'civil-confirm'].includes(input.type)
        || (input.type === 'policy-choice' && ['action', 'immediate'].includes(room.game.policyChoice?.resume));
      const playedCard = input.type === 'play' && room.game.players[role].hand.find(card => card.id === input.cardId);
      const interestGroups = playedCard && cardDefinition(role, playedCard).effect === 'interest-groups';
      const choice = room.game.content?.cardChoice;
      const fakeNews = input.type === 'card-choice' && choice?.effect === 'fake-news';
      const cardResult = fakeNews ? {
        fakeNews: {
          drawn: choice.drawn,
          removed: choice.drawn.filter((_, index) => input.indices.includes(index)),
          returned: choice.drawn.filter((_, index) => !input.indices.includes(index)),
        },
      } : interestGroups ? {
        interestGroups: {
          ...next.game.interestGroupsResult,
          role,
          before: room.game.bag,
          after: next.game.bag,
        },
      } : cardStep ? {
        changes: summarizeAction(room.game, next.game, role, input, { committed: true }).changes,
      } : null;
      next.processed[key] = cardResult ? { cardResult } : true;
      next.revision++;
      saveRoom(next);
      return json(response, 200, { ...view(next, role), ...(cardResult && { cardResult }) });
    }
    if (request.method === 'GET' && !action) {
      const room = readRoom(code);
      if (!room) throw new GameError('找不到房間。', 404);
      const role = authenticate(room, request, accounts);
      if (request.headers['x-room-presence'] !== '1') return json(response, 200, view(room, role));
      const members = room.waiting?.players ?? Object.entries(room.seats).map(([id, seat]) => ({ ...seat, id }));
      const now = Date.now();
      for (const [key, expires] of activeSeats) if (expires <= now) activeSeats.delete(key);
      const presenceKey = member => room.code + ":" + member.key;
      activeSeats.set(presenceKey(members.find(member => member.id === role)), now + presenceTimeout);
      const presence = Object.fromEntries(members.map(member => [member.id, activeSeats.has(presenceKey(member))]));
      return json(response, 200, { ...view(room, role), presence });
    }
    throw new GameError('不支援的請求。', 405);
  };
}
