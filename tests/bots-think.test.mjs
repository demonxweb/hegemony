import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('with a thinking time the AIs act one at a time after a visible delay, and zero keeps them instant', { timeout: 60000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-think-'));
  let server;
  try {
    server = await startServer(store);
    const request = async (path, { body, token, status = 200 } = {}) => {
      const response = await fetch(server.origin + path, {
        method: body ? 'POST' : 'GET',
        headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
        body: body && JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      return data;
    };
    const account = await request('/api/player/register', { body: { name: 'Host', password: 'p' } });
    const host = await request('/api/rooms', { body: {}, token: account.token, status: 201 });
    const path = `/api/rooms/${host.code}`;
    const waiting = (body, status) => request(`${path}/waiting`, { body, token: host.token, status });
    await waiting({ type: 'select', role: 'middle' });
    await waiting({ type: 'start-skill', skill: 'food' });
    for (const role of ['working', 'capitalist', 'state']) await waiting({ type: 'add-bot', role, strategy: 'minimal' });

    await waiting({ type: 'set-bot-think', seconds: 3 }, 400);
    // 新房間預設 5 秒；0 不在選項裡但 API 仍接受。
    assert.equal((await request(path, { token: host.token })).waiting.botThinkMax, 5);
    const lobby = await waiting({ type: 'set-bot-think', seconds: 2 });
    assert.equal(lobby.waiting.botThinkMax, 2);
    assert.deepEqual(lobby.waiting.botThinkChoices, [2, 5, 10, 20, 30]);
    assert.equal((await request(path, { token: host.token })).waiting.botThinkMax, 2);

    const view = await request(path, { token: host.token });
    const started = await waiting({ type: 'ready', selectionRevision: view.waiting.selectionRevision });
    // 勞工 AI 先手：還沒行動，畫面上顯示它正在思考。
    assert.equal(started.turn, 0);
    assert.equal(started.botThink.thinking.role, 'working');
    assert(started.botThink.thinking.delayMs >= 400 && started.botThink.thinking.delayMs <= 2000);
    // 先計算再等待：運算在開始等待之前就做完，時間算在思考時間裡，不會另外加在後面。
    assert.equal(typeof started.botThink.thinking.computeMs, 'number');
    assert(started.botThink.thinking.computeMs <= started.botThink.thinking.delayMs);
    assert(started.botThink.thinking.elapsedMs >= 0 && started.botThink.thinking.elapsedMs < 1000);

    const until = async (condition, limit = 6000) => {
      const begun = Date.now();
      for (;;) {
        const current = await request(path, { token: host.token });
        if (condition(current)) return { current, waited: Date.now() - begun };
        assert(Date.now() - begun < limit, '等太久');
        await sleep(150);
      }
    };
    const first = await until(current => current.turn === 1 && !current.botThink.thinking);
    assert.equal(first.current.currentRole, 'middle');
    assert(first.waited >= 200, 'AI 應該先思考一段時間，而不是立刻行動');
    assert.equal(typeof first.current.botThink.stats.working.lastMs, 'number');

    // 真人行動並結束回合後，資本家、國家、勞工 AI 依序各自思考。
    const acted = await request(`${path}/command`, { body: { type: 'pressure', cardId: first.current.hand[0].id, id: randomUUID(), revision: first.current.revision }, token: host.token });
    const ended = await request(`${path}/command`, { body: { type: 'end', id: randomUUID(), revision: acted.revision }, token: host.token });
    assert.equal(ended.botThink.thinking.role, 'capitalist');
    assert.equal(ended.turn, 2);
    const seen = new Set();
    const second = await until(current => {
      if (current.botThink.thinking) seen.add(current.botThink.thinking.role);
      return current.turn === 5 && !current.botThink.thinking;
    }, 9000);
    assert.equal(second.current.currentRole, 'middle');
    assert(seen.has('state') || seen.has('working'), '應該看得到後面的 AI 也各自思考');
    assert(['capitalist', 'state', 'working'].every(role => typeof second.current.botThink.stats[role].lastMs === 'number'));
  } finally {
    await server?.stop();
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});
