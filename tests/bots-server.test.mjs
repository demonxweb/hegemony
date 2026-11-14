import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { defaultCandidates } from '../packages/bots/phases.mjs';

async function startServer(store) {
  const child = spawn(process.execPath, ['apps/server/server.mjs'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', HEGEMONY_STORE: store, HEGEMONY_TEST_TRIAL: '0', HEGEMONY_TEST_LEGACY_ROOMS: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const [data] = await Promise.race([
    once(child.stdout, 'data'),
    once(child, 'exit').then(([code]) => { throw new Error(`Server exited (${code})`); }),
  ]);
  return {
    origin: data.toString().trim().split(' ').at(-1),
    async stop() {
      const done = once(child, 'exit');
      child.kill();
      await done;
    },
  };
}

async function setup(server, strategies) {
  async function request(path, { body, token, status = 200 } = {}) {
    const response = await fetch(server.origin + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
    const data = await response.json();
    if (status !== null) assert.equal(response.status, status, JSON.stringify(data));
    return { data, status: response.status };
  }
  return request;
}

test('one human and three AI seats play all five rounds through the HTTP API', { timeout: 180000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-bots-full-'));
  let server;
  try {
    server = await startServer(store);
    const request = await setup(server);
    const call = async (path, options) => (await request(path, options)).data;
    const account = await call('/api/player/register', { body: { name: 'Host', password: 'p' } });
    const host = await call('/api/rooms', { body: {}, token: account.token, status: 201 });
    const path = `/api/rooms/${host.code}`;
    const waiting = body => call(`${path}/waiting`, { body, token: host.token });
    await waiting({ type: 'select', role: 'middle' });
    await waiting({ type: 'start-skill', skill: 'food' });
    for (const [role, strategy] of [['working', 'basic'], ['capitalist', 'minimal'], ['state', 'minimal']]) {
      await waiting({ type: 'add-bot', role, strategy });
    }
    let view = await call(path, { token: host.token });
    view = await waiting({ type: 'ready', selectionRevision: view.waiting.selectionRevision });
    const send = async body => {
      const { data, status } = await request(`${path}/command`, { body: { ...body, id: randomUUID(), revision: view.revision }, token: host.token, status: null });
      if (status === 200) view = data;
      return status === 200;
    };
    for (let step = 0; step < 400 && view.phase !== 'complete'; step++) {
      let acted;
      if (view.phase === 'action') {
        assert.equal(view.currentRole, 'middle', `AI 沒有把回合交還：${view.phase} ${view.turn}`);
        acted = view.mainUsed ? await send({ type: 'end' }) : await send({ type: 'pressure', cardId: view.hand[0].id });
      } else {
        for (const candidate of defaultCandidates({ role: 'middle', view, phase: view.phase })) {
          if (await send(candidate)) { acted = true; break; }
        }
      }
      assert(acted, `真人無法前進：${view.phase} ${JSON.stringify(view.log.slice(-3))}`);
    }
    assert.equal(view.phase, 'complete');
    assert.equal(view.match.final.results.length, 4);
    assert(view.log.every(line => !line.startsWith('AI 無法繼續')));

    // 事後可由命令紀錄重播整局：真人與 AI 的每一筆命令都在裡面。
    const replay = await call(`${path}/replay`, { token: host.token });
    assert.equal(replay.available, true);
    assert.deepEqual(replay.warnings, []);
    assert.equal(replay.applied, replay.total);
    assert.equal(replay.steps.length, replay.total);
    assert(replay.total > 200);
    assert(new Set(replay.steps.map(item => item.role)).size === 4);
    assert.equal(replay.record.commands.length, replay.total);
    assert.equal(replay.steps.at(-1).phase, 'complete');
    const middle = await call(`${path}/replay/60`, { token: host.token });
    assert.equal(middle.steps.length, 60);
    assert.equal(middle.view.turn, middle.steps[59].turn);
    assert.equal(middle.record, undefined);
    assert.notEqual(middle.view.phase, 'complete');
    await call(`${path}/replay/99999`, { token: host.token, status: 400 });
    await call(`${path}/replay`, { status: 401 });
  } finally {
    await server?.stop();
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});

test('a host can fill the other seats with AI of different strengths and play on', { timeout: 60000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-bots-'));
  let server;
  try {
    server = await startServer(store);
    async function request(path, { body, token, status = 200 } = {}) {
      const response = await fetch(server.origin + path, {
        method: body ? 'POST' : 'GET',
        headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
        body: body && JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      return data;
    }
    const account = await request('/api/player/register', { body: { name: 'Host', password: 'p' } });
    const host = await request('/api/rooms', { body: { roomName: 'AI 測試' }, token: account.token, status: 201 });
    const path = `/api/rooms/${host.code}`;
    const waiting = body => request(`${path}/waiting`, { body, token: host.token });
    const lobby = await request(path, { token: host.token });
    const ids = lobby.waiting.strategies.map(item => item.id);
    for (const id of ['minimal', 'basic', 'goal-balanced', 'goal-growth', 'goal-frugal', 'goal-political']) assert(ids.includes(id), id);

    await waiting({ type: 'select', role: 'middle' });
    await waiting({ type: 'start-skill', skill: 'food' });
    await request(`${path}/waiting`, { body: { type: 'add-bot', role: 'middle' }, token: host.token, status: 400 });
    await request(`${path}/waiting`, { body: { type: 'add-bot', role: 'nobody' }, token: host.token, status: 400 });
    await waiting({ type: 'add-bot', role: 'working', strategy: 'basic' });
    await waiting({ type: 'add-bot', role: 'capitalist', strategy: 'does-not-exist' });
    const full = await waiting({ type: 'add-bot', role: 'state', strategy: 'minimal' });
    await request(`${path}/waiting`, { body: { type: 'add-bot', role: 'state' }, token: host.token, status: 400 });
    const bots = full.waiting.players.filter(player => player.bot);
    assert.deepEqual(bots.map(player => [player.role, player.strategy]),
      [['working', 'basic'], ['capitalist', 'minimal'], ['state', 'minimal']]);
    assert(bots.every(player => player.ready && !Object.hasOwn(player, 'key')));

    // 移除再加回，確認 AI 席位可調整。
    const removed = await waiting({ type: 'remove-bot', id: bots[2].id });
    assert.equal(removed.waiting.players.length, 3);
    const again = await waiting({ type: 'add-bot', role: 'state', strategy: 'minimal' });

    const started = await waiting({ type: 'ready', selectionRevision: again.waiting.selectionRevision });
    assert.equal(started.phase, 'action');
    assert.deepEqual(started.botSeats, { working: 'basic', capitalist: 'minimal', state: 'minimal' });
    // 第一個回合屬於勞工 AI，已自動走完；現在輪到真人中產。
    assert.equal(started.currentRole, 'middle');
    assert.equal(started.turn, 1);

    const turn = async view => {
      const acted = await request(`${path}/command`, { body: { type: 'pressure', cardId: view.hand[0].id, id: randomUUID(), revision: view.revision }, token: host.token });
      return request(`${path}/command`, { body: { type: 'end', id: randomUUID(), revision: acted.revision }, token: host.token });
    };
    let view = await turn(started);
    // AI 繼續走完資本家、國家與下一輪勞工，回到真人。
    assert.equal(view.currentRole, 'middle');
    assert.equal(view.turn, 5);
    for (let index = 0; index < 4; index++) view = await turn(view);
    // 第 20 回合後 AI 會代為完成生產與食物結算，並停在需要真人的步驟。
    assert(view.revision > started.revision);
  } finally {
    await server?.stop();
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});
