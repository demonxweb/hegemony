import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyCommand, createGame, hasLegalMainAction, playerView, roles } from '../packages/engine/game.mjs';
import { BotStuckError, runBots } from '../packages/bots/index.mjs';

const allMinimal = Object.fromEntries(roles.map(role => [role, 'minimal']));
// 這些種子用最小策略、不允許跳過時，國家會走到真正無行動可做的盤面。
const deadlockSeeds = [18, 28, 116, 142];

function deadlockedGame(seed) {
  const game = createGame({ seed });
  applyCommand(game, 'working', { type: 'start' }, true);
  assert.throws(() => runBots(game, allMinimal, { allowPass: false }), BotStuckError);
  return game;
}

const classes = ['working', 'middle', 'capitalist'];
const pairs = [['working', 'middle'], ['working', 'capitalist'], ['middle', 'capitalist']];

// 與引擎的列舉無關的暴力搜尋：用更大的參數範圍找任何合法的主要行動。
function bruteForceLegalAction(game) {
  const view = playerView(game, 'state');
  const sections = ['A', 'B', 'C'];
  const policies = [0, 1, 2, 3, 4, 5, 6].flatMap(policy => sections.map(target => ({ policy, target })));
  const numbers = Array.from({ length: 51 }, (_, index) => index);
  const distributions = classes.flatMap(role => [1, 2, 3, 4].map(count => ({ [role]: count })));
  const cardId = view.hand[0]?.id;
  const candidates = [];
  for (const event of view.content.events) {
    for (const recipient of [undefined, ...classes]) {
      for (const amount of [undefined, ...numbers]) candidates.push({ type: 'event', eventId: event.id, recipient, amount });
    }
    for (const recipients of pairs) candidates.push({ type: 'event', eventId: event.id, recipients });
    for (const distribution of distributions) candidates.push({ type: 'event', eventId: event.id, distribution });
    for (const company of event.form.offers ?? []) for (const recipient of classes) candidates.push({ type: 'event', eventId: event.id, recipient, company });
  }
  for (const amount of [1, 2, 3]) candidates.push({ type: 'campaign', amount });
  for (const { policy, target } of policies) for (const immediate of [true, false]) candidates.push({ type: 'propose', policy, target, immediate });
  for (const recipient of classes) candidates.push({ type: 'meet-mps', recipient });
  for (const recipients of pairs) candidates.push({ type: 'extra-tax', recipients });
  for (const offer of view.match.exports) for (const repeat of [1, 2]) candidates.push({ type: 'export', offers: Array(repeat).fill(offer.id) });
  for (const card of view.hand) {
    const shapes = [{}, ...numbers.slice(0, 10).map(quantity => ({ quantity })), ...classes.map(recipient => ({ recipient })),
      ...pairs.flatMap(recipients => numbers.slice(0, 3).map(quantity => ({ recipients, quantity }))),
      ...policies.flatMap(({ policy, target }) => [true, false].map(immediate => ({ policy, target, immediate })))];
    for (const shape of shapes) candidates.push({ type: 'play', cardId: card.id, ...shape });
  }
  return candidates.find(command => {
    const copy = structuredClone(game);
    try {
      applyCommand(copy, 'state', { cardId, ...command }, true);
    } catch {
      return false;
    }
    if (copy.phase !== 'card-choice') return true;
    const choice = playerView(copy, 'state').content.cardChoice;
    if (choice.eventBlocks) return Object.values(choice.eventBlocks).some(reason => !reason);
    if (choice.effect === 'investment-build') return choice.cards.some(item => !item.blocked);
    return true;
  });
}

test('the exhaustive search agrees: the stuck boards really have no legal main action', { timeout: 120000 }, () => {
  for (const seed of deadlockSeeds) {
    const game = deadlockedGame(seed);
    assert.equal(roles[game.turn % 4], 'state');
    assert.equal(hasLegalMainAction(game, 'state'), false, `seed ${seed}`);
    assert.equal(bruteForceLegalAction(game), undefined, `seed ${seed}`);
  }
});

test('pass is accepted only for the State, only when nothing else is legal, and it completes the main action', () => {
  const game = deadlockedGame(18);
  const pass = { type: 'pass' };
  for (const role of roles.filter(seat => seat !== 'state')) assert.throws(() => applyCommand(structuredClone(game), role, pass, true));
  // 輪到別人時不能跳過。
  const other = structuredClone(game);
  other.turn++;
  assert.throws(() => applyCommand(other, 'state', pass, true));
  // 房主調整或其他變動讓國家有合法行動後，跳過會被拒絕；恢復後又允許。
  const richer = structuredClone(game);
  richer.players.state.influence = 2;
  assert.equal(hasLegalMainAction(richer, 'state'), true);
  assert.throws(() => applyCommand(richer, 'state', pass, true), /不能跳過/);
  richer.players.state.influence = game.players.state.influence;
  assert.equal(hasLegalMainAction(richer, 'state'), false);
  applyCommand(richer, 'state', pass, true);
  assert.equal(richer.mainUsed, true);
  assert(richer.log.at(-1).includes('跳過'));
  assert.throws(() => applyCommand(richer, 'state', pass, true), /已完成/);
  applyCommand(richer, 'state', { type: 'end' }, true);
  assert.equal(roles[richer.turn % 4], 'working');
});

test('bots skip automatically on a stuck board and every game still finishes', { timeout: 120000 }, () => {
  for (const seed of deadlockSeeds.slice(0, 2)) {
    const game = createGame({ seed });
    applyCommand(game, 'working', { type: 'start' }, true);
    runBots(game, allMinimal);
    assert.equal(game.phase, 'complete', `seed ${seed}`);
    assert(game.log.some(line => line.includes('跳過本回合的主要行動')), `seed ${seed}`);
  }
});

async function startServer(store) {
  const child = spawn(process.execPath, ['apps/server/server.mjs'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', HEGEMONY_STORE: store, HEGEMONY_TEST_TRIAL: '0', HEGEMONY_TEST_LEGACY_ROOMS: '1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const [data] = await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(([code]) => { throw new Error(`Server exited (${code})`); })]);
  return { origin: data.toString().trim().split(' ').at(-1), async stop() { const done = once(child, 'exit'); child.kill(); await done; } };
}

test('the room view flags a stuck State and the pass command goes through the API', { timeout: 60000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-pass-'));
  let server;
  try {
    const hex = () => randomUUID().replaceAll('-', '');
    const tokens = Object.fromEntries(roles.map(role => [role, hex() + hex()]));
    const seats = Object.fromEntries(roles.map(role => [role, { name: role, key: createHash('sha256').update(tokens[role]).digest('hex') }]));
    const room = (code, game) => ({ code, revision: 5, host: 'working', seats, processed: {}, game });
    const stuck = deadlockedGame(18);
    const free = structuredClone(stuck);
    free.players.state.influence = 2;
    await writeFile(join(store, 'AAAAAAAA.json'), JSON.stringify(room('AAAAAAAA', stuck)));
    await writeFile(join(store, 'BBBBBBBB.json'), JSON.stringify(room('BBBBBBBB', free)));
    server = await startServer(store);
    const call = async (path, role, body, status = 200) => {
      const response = await fetch(server.origin + path, {
        method: body ? 'POST' : 'GET',
        headers: { ...(body && { 'Content-Type': 'application/json' }), Authorization: `Bearer ${tokens[role]}` },
        body: body && JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      return data;
    };
    const view = await call('/api/rooms/AAAAAAAA', 'state');
    assert.equal(view.noLegalAction, true);
    assert.equal((await call('/api/rooms/AAAAAAAA', 'working')).noLegalAction, undefined);
    assert.equal((await call('/api/rooms/BBBBBBBB', 'state')).noLegalAction, false);
    await call('/api/rooms/BBBBBBBB/command', 'state', { type: 'pass', id: randomUUID(), revision: 5 }, 400);
    await call('/api/rooms/AAAAAAAA/command', 'working', { type: 'pass', id: randomUUID(), revision: 5 }, 400);
    const after = await call('/api/rooms/AAAAAAAA/command', 'state', { type: 'pass', id: randomUUID(), revision: 5 });
    assert.equal(after.mainUsed, true);
    assert.equal(after.noLegalAction, undefined);
    const ended = await call('/api/rooms/AAAAAAAA/command', 'state', { type: 'end', id: randomUUID(), revision: after.revision });
    // 這個盤面是國家第 5 個回合，結束後本輪進入生產階段。
    assert.equal(ended.mainUsed, false);
    assert.equal(ended.phase, 'production-confirm');
  } finally {
    await server?.stop();
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});
