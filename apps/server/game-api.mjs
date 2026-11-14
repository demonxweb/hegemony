import { createHash, randomBytes } from 'node:crypto';
import catalog from '../../data/hegemony-base-catalog.json' with { type: 'json' };
import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import { applyCommand, createGame, GameError, hasLegalMainAction, names, playerView, policies, roles } from '../../packages/engine/game.mjs';
import { companyDefinition, syncPublicStorage } from '../../packages/engine/companies.mjs';
import { requireRule } from '../../packages/engine/errors.mjs';
import { domesticPriceLevels } from '../../packages/engine/prices.mjs';
import { cardDefinition } from '../../packages/engine/cards.mjs';
import { summarizeAction } from '../../packages/engine/action-summary.mjs';
import { createPlayerAccounts } from './player-accounts.mjs';
import { applyRecorded } from '../../packages/engine/turns.mjs';
import { createRecord, recordCommand, replayRecord } from '../../packages/engine/replay.mjs';
import { BotStuckError, defaultStrategy, getStrategy, listStrategies, nextBotActor, runBotActor, runBots } from '../../packages/bots/index.mjs';

const turnCommands = ['play', 'assign', 'build', 'sell', 'buy', 'deal', 'export', 'strike', 'event', 'campaign',
  'propose', 'pressure', 'demonstrate', 'extra-shift', 'lobby', 'meet-mps', 'extra-tax', 'wages', 'repay', 'benefits',
  'buy-storage', 'use-education', 'use-health', 'use-luxury', 'swap-workers', 'adjust-prices', 'give-bonus'];
const checkedCommands = [...turnCommands, 'host-adjust', 'card-choice', 'event-hire', 'policy-choice', 'worker-arrival', 'demonstration-losses'];
const catalogView = {
  decks: catalog.decks, marketSizes: catalog.marketSizes, policies, names,
  storage: { ...catalog.boards.storages, tiles: catalog.components.storage_tiles, freeTradeTiles: catalog.components.free_trade_zone },
  sources: { official: catalog.officialRules, cards: catalog.source },
};

// AI 席位：記錄在席位資料上，策略 id 為字串，存檔相容；找不到的策略退回預設。
function botSeats(room) {
  return Object.fromEntries(roles.flatMap(role => room.seats[role]?.bot ? [[role, getStrategy(room.seats[role].strategy).id]] : []));
}

const recordStep = room => ({ actor, command }) => recordCommand(room.record, room.game, actor, command);

// 讓 AI 席位持續行動到輪到真人為止。無法繼續時記錄在日誌，不中斷真人操作。
function runRoomBots(room) {
  const seats = botSeats(room);
  if (!Object.keys(seats).length) return;
  try {
    runBots(room.game, seats, { host: room.host, onStep: recordStep(room) });
  } catch (error) {
    if (!(error instanceof BotStuckError)) throw error;
    room.game.log.push(`AI 無法繼續：${error.message}`);
  }
}

// AI 思考時間：房間設定最長秒數（0 = 立即，維持原本的同步行為）。大於 0 時，輪到 AI 不立刻行動，
// 而是在 0.2～1 倍最長秒數之間隨機等一段時間再行動，玩家看得到「AI 思考中」與秒數，AI 之間也有不同的節奏。
// 思考時間只是刻意的等待，不限制運算：行動一定會做到有合法行動為止（找不到時 5 秒後重試，不會放棄）。
// 介面提供的選項。0（立即行動）不再列在選項裡，但 API 仍接受，供測試與自動化使用。
export const botThinkChoices = [2, 5, 10, 20, 30];
const defaultBotThink = 5;

// 先計算、再等待：輪到某個 AI 時，立刻在遊戲複本上讓它把這一輪的步驟全部算出來（得到一串命令），
// 算了多久就從隨機的等待時間裡扣掉，剩下的時間才等；時間到再把算好的命令套用到真正的遊戲。
// 所以「思考時間」是總長度，運算時間包含在裡面，運算比等待時間還久時就不再多等。
function planThinking(room) {
  const seats = botSeats(room);
  const actor = room.botThinkMax > 0 && Object.keys(seats).length ? nextBotActor(room.game, seats, room.host) : null;
  if (!actor) {
    room.thinking = null;
    return;
  }
  if (room.thinking?.role === actor && !room.thinking.stuck) return;
  const since = Date.now();
  const totalMs = Math.round(room.botThinkMax * 1000 * (0.2 + 0.8 * Math.random()));
  const copy = structuredClone(room.game);
  const commands = [];
  try {
    runBotActor(copy, seats, { host: room.host, onStep: ({ actor: who, command }) => commands.push({ actor: who, command }) });
  } catch (error) {
    if (!(error instanceof BotStuckError)) throw error;
    if (!room.thinking?.stuck) room.game.log.push(`AI 找不到合法行動，持續重試：${error.message}`);
    room.thinking = { role: actor, since: Date.now(), delayMs: 5000, stuck: true };
    return;
  }
  const computeMs = Date.now() - since;
  room.game.botPlans = copy.botPlans ?? room.game.botPlans;
  room.thinking = { role: actor, since, delayMs: Math.max(totalMs, computeMs), computeMs, commands };
}

// 等待時間到了：套用事先算好的命令，記下這個 AI 的運算時間，再安排下一個 AI。
// 若等待期間狀態被改過（例如房主調整），算好的命令不再適用，改為重新計算。
function finishThinking(room) {
  const { role, commands = [], computeMs } = room.thinking;
  if (!room.thinking.stuck && commands.length) {
    try {
      for (const { actor, command } of commands) {
        applyRecorded(room.game, actor, command, true);
        recordCommand(room.record, room.game, actor, command);
      }
      room.botStats = { ...room.botStats, [role]: { lastMs: computeMs } };
      room.thinking = null;
      room.revision++;
      planThinking(room);
      return;
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
    }
  }
  room.thinking = null;
  planThinking(room);
  room.revision++;
}

// 還原存檔等整份等待區被換掉時，真人須重新確認；AI 永遠視為已確認。
// 一般的等待區操作（別人換階級、增減 AI、撤銷邀請）不會取消已經按下開始的人，
// 只有改了自己階級的人，自己的確認會被取消。
function unreadyHumans(waiting) {
  for (const item of waiting.players) item.ready = Boolean(item.bot);
}

function fingerprint(token) {
  return createHash('sha256').update(token).digest('hex');
}

const presenceTimeout = 30_000;
const chatLimit = 50;

export function appendChat(chat, message) {
  const previous = chat ?? [];
  return [...previous.slice(-(chatLimit - 1)), { id: (previous.at(-1)?.id ?? 0) + 1, at: Date.now(), ...message }];
}

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
  return { code, revision: 0, host, seats: {}, processed: {}, botThinkMax: defaultBotThink, game: createGame({ full }) };
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
        strategies: role === host ? listStrategies() : undefined,
        botThinkMax: room.botThinkMax ?? 0, botThinkChoices,
        players: players.map(({ id, name, role, ready, skill, bot, strategy }) => ({ id, name, role, ready, skill, ...(bot && { bot, strategy }) })) } };
  }
  return {
    code: room.code, roomName: room.name ?? room.code, role, host: room.host, revision: room.revision, restoredRevision: room.restoredRevision ?? 0,
    seats: Object.fromEntries(roles.map(seat => [seat, room.seats[seat]?.name ?? null])),
    botSeats: botSeats(room),
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
      }
    }
  } else if (input.type === 'set-bot-think') {
    if (id !== waiting.host) throw new GameError('只有房主可以設定 AI 思考時間。', 403);
    requireRule(input.seconds === 0 || botThinkChoices.includes(input.seconds), 'AI 最長思考時間只能選 2、5、10、20 或 30 秒。');
    room.botThinkMax = input.seconds;
  } else if (input.type === 'add-bot' || input.type === 'remove-bot') {
    if (id !== waiting.host) throw new GameError('只有房主可以管理 AI。', 403);
    if (input.type === 'add-bot') {
      requireRule(roles.includes(input.role), '請選擇 AI 要坐的階級。');
      requireRule(waiting.players.length < roles.length, '房間已滿。');
      requireRule(!waiting.players.some(item => item.role === input.role), '這個階級已有人選擇。');
      const strategy = getStrategy(input.strategy ?? defaultStrategy);
      waiting.players.push({ id: randomBytes(8).toString('hex'), name: `AI·${strategy.name}`, key: null, role: input.role,
        ready: true, bot: true, strategy: strategy.id, ...(input.role === 'middle' && { skill: 'food' }) });
    } else {
      const index = waiting.players.findIndex(item => item.id === input.id && item.bot);
      if (index < 0) throw new GameError('找不到這個 AI 席位。', 404);
      waiting.players.splice(index, 1);
    }
    waiting.selectionRevision++;
  } else if (input.type === 'select') {
    requireRule(input.role === null || roles.includes(input.role), '請選擇有效的階級。');
    if (player.role === input.role) return id;
    player.role = input.role;
    delete player.skill;
    player.ready = false;
    waiting.selectionRevision++;
  } else if (input.type === 'start-skill') {
    requireRule(room.game.content && player.role === 'middle' && !player.ready
      && ['food', 'luxury', 'health', 'education', 'influence'].includes(input.skill), '請由中產選擇有效的開局技術工技能。');
    if (player.skill === input.skill) return id;
    player.skill = input.skill;
    waiting.selectionRevision++;
  } else if (input.type === 'cancel') {
    player.ready = false;
  } else if (input.type === 'ready') {
    requireRule(input.selectionRevision === waiting.selectionRevision, '階級選擇已更新，請重新確認。');
    const choices = waiting.players.map(item => item.role);
    requireRule(roles.every(role => choices.includes(role)), '四位玩家須選擇不同階級。');
    requireRule(!room.game.content || player.role !== 'middle' || player.skill, '請先選擇中產的開局技術工技能。');
    player.ready = true;
    if (waiting.players.every(item => item.ready)) {
      room.seats = Object.fromEntries(waiting.players.map(({ role, name, key, accountId, bot, strategy }) =>
        [role, { name, key, accountId, ...(bot && { bot, strategy }) }]));
      room.host = waiting.players.find(item => item.id === waiting.host).role;
      if (room.game.content) room.game.content.startSkill = waiting.players.find(item => item.role === 'middle').skill;
      delete room.waiting;
      room.invitationsLocked = true;
      // 從開局起記錄種子與每筆成功的命令，供事後重播。
      room.record = createRecord(room.game);
      applyRecorded(room.game, room.host, { type: 'start' }, true);
      recordCommand(room.record, room.game, room.host, { type: 'start' });
      if (room.botThinkMax > 0) planThinking(room);
      else runRoomBots(room);
      return player.role;
    }
  } else {
    throw new GameError('不支援的等待區操作。');
  }
  return id;
}

function applySingleAction(game, role, input, record) {
  requireRule(turnCommands.includes(input.type) && game.phase === 'action' && !game.transaction, '目前無法確認此行動。');
  applyRecorded(game, role, input, true);
  record?.(role, input);
  if (game.transaction) {
    applyRecorded(game, role, { type: 'transaction-confirm' }, true);
    record?.(role, { type: 'transaction-confirm' });
  }
}

// 依命令紀錄從初始狀態重播。沒有 step 時回傳每一步的摘要；指定 step 時另附該步之後、
// 以請求者席位視角看到的畫面。重播不可靠時（引擎改版、紀錄缺漏）在 warnings 說明。
function replayResponse(room, role, stepText) {
  if (!room.record) {
    return { available: false, steps: [], warnings: ['這個房間在重播功能加入前建立，沒有命令紀錄，或尚未開局。'] };
  }
  const step = stepText === undefined ? undefined : Number(stepText);
  if (step !== undefined) requireRule(Number.isInteger(step) && step >= 0 && step <= room.record.commands.length, '沒有這一步。');
  const steps = [];
  const { game, applied, warnings } = replayRecord(room.record, {
    upTo: step,
    onStep: ({ index, entry, game: current, logs }) => steps.push({ n: index + 1, role: entry.role, type: entry.command.type, logs,
      round: current.match?.round ?? null, turn: current.turn, phase: current.phase }),
  });
  if (step === undefined && applied === room.record.commands.length && game.log.length !== room.game.log.length) {
    warnings.push('重播結果與目前對局的紀錄不一致，可能有未被記錄的變更。');
  }
  return {
    available: true, engineVersion: room.record.engineVersion, total: room.record.commands.length, applied, warnings, steps,
    ...(step !== undefined && { step, view: playerView(game, role) }),
    // 完整紀錄含種子，等於含全部牌庫順序；目前只在對局結束後給房主下載。
    ...(room.game.phase === 'complete' && role === room.host && step === undefined && { record: room.record }),
  };
}

export function createGameApi({ readRoom: loadRoom, saveRoom, deleteRoom, listRooms, addRoomSave, listRoomSaves, readRoomSave, getSetting, insertSetting, listSettings, updateSetting, getSaveKey, clientId,
  full = true, allowLegacyRooms = false }) {
  const accounts = createPlayerAccounts({ getSetting, insertSetting, listSettings, updateSetting, getSaveKey, clientId });
  // 國家是否沒有任何合法的主要行動（可跳過）。只在國家的回合計算，並依房間版本快取：
  // 房主調整、換牌、還原存檔都會讓版本改變，下次視圖就會重算。pass 命令本身不信任這個快取。
  const passCache = new Map();
  function noLegalAction(room, role) {
    const { game } = room;
    if (role !== 'state' || room.waiting || game.phase !== 'action' || !game.content || game.mainUsed || game.transaction
      || roles[game.turn % roles.length] !== 'state') return undefined;
    const key = `${room.code}:${room.revision}`;
    if (!passCache.has(key)) {
      if (passCache.size > 200) passCache.clear();
      passCache.set(key, !hasLegalMainAction(game, 'state'));
    }
    return passCache.get(key);
  }
  // AI 思考時間：每個 AI 的計時器。伺服器重啟時從房間存檔接續。
  const thinkTimers = new Map();
  function armThinking(room) {
    clearTimeout(thinkTimers.get(room.code));
    thinkTimers.delete(room.code);
    if (!room.thinking) return;
    const wait = Math.max(0, room.thinking.since + room.thinking.delayMs - Date.now());
    const timer = setTimeout(() => thinkTick(room.code), wait);
    timer.unref?.();
    thinkTimers.set(room.code, timer);
  }
  function thinkTick(code) {
    thinkTimers.delete(code);
    const room = loadRoom(code);
    if (!room?.thinking) return;
    try {
      finishThinking(room);
      saveRoom(room);
    } catch (error) {
      console.error(error);
      room.thinking = null;
    }
    armThinking(room);
  }
  for (const room of listRooms()) if (room.thinking) armThinking(room);
  const view = (room, role) => {
    const stuck = noLegalAction(room, role);
    const think = room.botThinkMax > 0 || room.thinking ? {
      max: room.botThinkMax ?? 0, stats: room.botStats ?? {},
      thinking: room.thinking && { role: room.thinking.role, elapsedMs: Date.now() - room.thinking.since, delayMs: room.thinking.delayMs, computeMs: room.thinking.computeMs, stuck: Boolean(room.thinking.stuck) },
    } : undefined;
    return { ...roomView(room, role, accounts), ...(stuck !== undefined && { noLegalAction: stuck }), ...(think && { botThink: think }), chat: (room.chat ?? []).slice(-chatLimit) };
  };
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
        actionConfirmation: true, loanPrincipal: base.loans.principal,
        playerTracks: { population: catalog.boards.population, prosperity: catalog.boards.prosperity, wealth: base.wealth } });
      if (path === '/api/catalog') return json(response, 200, catalogView);
    }
    if (request.method === 'POST' && ['/api/player/register', '/api/player/login'].includes(path)) {
      const player = await accounts.login(await readJson(request), path.endsWith('/register'), request);
      return json(response, 200, player);
    }
    if (request.method === 'POST' && path === '/api/player/password') {
      return json(response, 200, await accounts.changePassword(request, await readJson(request)));
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
    const match = /^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|waiting|command|check|action-preview|action-confirm|saves|restore|name|chat|replay(?:\/\d+)?))?$/.exec(path);
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
      next.chat = room.chat;
      next.invitations = room.invitations;
      next.invitationsLocked = room.invitationsLocked || room.game.phase !== 'lobby';
      next.game.testMode = room.game.testMode === true;
      next.name = room.name ?? room.code;
      next.botThinkMax = room.botThinkMax;
      next.thinking = null;
      if (next.waiting) {
        next.waiting.selectionRevision = revision;
        next.waiting.players = next.waiting.players.filter(player => !next.invitations?.some(invite => invite.revoked && invite.id === player.accountId));
        unreadyHumans(next.waiting);
      }
      saveRoom(next);
      return json(response, 200, view(next, next.waiting?.host ?? next.host));
    }
    if (request.method === 'GET' && action?.startsWith('replay')) {
      const room = readRoom(code);
      if (!room) throw new GameError('找不到房間。', 404);
      const role = authenticate(room, request, accounts);
      return json(response, 200, replayResponse(room, role, action.split('/')[1]));
    }
    if (request.method === 'DELETE' && !action) {
      const room = readRoom(code);
      if (!room) throw new GameError('找不到房間。', 404);
      if (authenticate(room, request, accounts) !== (room.waiting?.host ?? room.host)) throw new GameError('只有房主可以刪除房間。', 403);
      clearTimeout(thinkTimers.get(code));
      thinkTimers.delete(code);
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
      if (action === 'chat') {
        const text = typeof input.text === 'string' ? input.text.trim() : '';
        requireRule(text.length > 0 && text.length <= 500, '訊息須為 1 至 500 字。');
        const member = room.waiting?.players.find(player => player.id === role) ?? room.seats[role];
        const previous = room.chat ?? [];
        room.chat = appendChat(previous, { role: room.waiting ? member.role : role, name: member.name, text });
        saveRoom(room);
        return json(response, 201, { chat: room.chat });
      }
      if (action === 'waiting' || room.waiting) {
        if (action !== 'waiting' || !room.waiting) throw new GameError('目前無法使用此操作。', 409);
        const viewer = updateWaitingRoom(room, role, input, accounts);
        room.revision++;
        saveRoom(room);
        armThinking(room);
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
      const next = { ...room, game: structuredClone(room.game), processed: { ...room.processed },
        ...(room.record && { record: { ...room.record, commands: [...room.record.commands] } }) };
      const record = (seat, command) => recordCommand(next.record, next.game, seat, command);
      if (action === 'action-confirm') applySingleAction(next.game, role, input, record);
      else {
        applyRecorded(next.game, role, input, roles.every(seat => next.seats[seat]));
        record(role, input);
      }
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
      if (next.botThinkMax > 0) planThinking(next);
      else runRoomBots(next);
      next.revision++;
      saveRoom(next);
      armThinking(next);
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
