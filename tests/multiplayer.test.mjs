import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const roles = ['working', 'middle', 'capitalist', 'state'];

async function confirmVote(command, current) {
  const electionId = current.lastVote.id;
  for (const role of roles.filter(seat => !current.voteConfirmation.confirmed.includes(seat))) {
    current = await command(role, { type: 'confirm-vote', electionId });
  }
  return current;
}

async function settlePolicy(command, current) {
  while (current.phase === 'policy-choice') {
    const choice = current.policyChoice;
    const input = { type: 'policy-choice' };
    if (choice.kind === 'public') input.companies = choice.companies.slice(0, choice.count).map(company => company.id);
    if (choice.kind === 'hire') [input.company, input.hire] = choice.options[0];
    current = await command(choice.role, input);
  }
  return current;
}

test('four connected seats complete five rounds using the full catalog', { timeout: 30000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-catalog-'));
  let server = await startServer(store, false);
  try {
    const tokens = {};
    async function send(path, body, role, status = 200) {
      const response = await fetch(server.origin + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', ...(role && { Authorization: `Bearer ${tokens[role]}` }) },
        body: body && JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify({ role, body, data: data.error }));
      return data;
    }
    const { code, token } = await send('/api/rooms', { name: 'working', role: 'working' }, null, 201);
    const path = `/api/rooms/${code}`;
    tokens.working = token;
    for (const role of roles.slice(1)) tokens[role] = (await send(`${path}/join`, { name: role, role })).token;
    const snapshot = role => send(path, null, role);
    const command = async (role, input, status) => {
      const view = await snapshot(role);
      return send(`${path}/command`, { id: randomUUID(), revision: view.revision, cardId: view.hand[0]?.id, ...input }, role, status);
    };
    const roomFile = join(store, (await readdir(store))[0]);
    const room = JSON.parse(await readFile(roomFile, 'utf8'));
    assert.deepEqual(roles.map(role => room.game.decks[role].draw.length), [40, 40, 40, 40]);
    // Arrange a known opening without replacing or adding physical cards.
    const opening = ['fake-news', 'public-opinion-polling', 'offshore-companies', 'foreign-financial-assistance'];
    for (const [index, role] of roles.entries()) {
      const { draw } = room.game.decks[role];
      const cardIndex = draw.findIndex(card => card.key.endsWith(opening[index]));
      assert(cardIndex >= 0);
      draw.push(...draw.splice(cardIndex, 1));
    }
    const events = room.game.content.eventDeck;
    events.unshift(...events.splice(events.indexOf('event-fear-of-deflation'), 1));
    await server.stop();
    await writeFile(roomFile, JSON.stringify(room));
    server = await startServer(store, false);
    const start = await command('working', { type: 'start' });
    assert.equal(start.match.roundPhase, 'action');
    assert.equal(start.content.events.length, 2);
    assert.equal(start.content.eventDeck, undefined);
    assert.deepEqual(Object.values(start.economy.markets).map(cards => cards.length), [4, 3]);
    const check = { type: 'play', cardId: start.hand[0].id, revision: start.revision };
    assert.deepEqual(await send(`${path}/check`, check, 'working'), { valid: true });
    const summary = await send(`${path}/action-preview`, check, 'working');
    assert.deepEqual(Object.keys(summary), ['kind', 'changes']);
    assert.equal(summary.kind, 'main');
    assert(summary.changes.some(line => line.includes('確認後揭示')));
    assert(summary.changes.every(line => !line.includes('袋內投票方塊')));
    await send(`${path}/check`, { ...check, cardId: 'invalid' }, 'working', 400);
    await send(`${path}/check`, check, 'middle', 400);
    await send(`${path}/check`, check, null, 401);
    await send(`${path}/check`, { ...check, revision: start.revision - 1 }, 'working', 409);
    assert.deepEqual(await snapshot('working'), start);
    const seenEvents = new Set();
    let actions = 0;
    let effects = 0;
    for (let round = 1; round <= 5; round++) {
      const prepared = await snapshot('working');
      assert.equal(prepared.match.round, round);
      assert.equal(prepared.match.roundPhase, 'action');
      for (const event of prepared.content.events) {
        assert(!seenEvents.has(event.id));
        seenEvents.add(event.id);
      }
      for (const role of roles) {
        const view = await snapshot(role);
        assert.equal(view.hand.length, 7);
        assert(view.hand.every(card => card.key.startsWith(`action-${role}-`) && card.effect));
        assert.equal(view.decks, undefined);
      }
      for (let turn = 0; turn < 20; turn++) {
        const role = roles[turn % 4];
        const view = await snapshot(role);
        assert.equal(view.currentRole, role);
        assert.equal(view.turn, turn);
        let action = { type: 'pressure' };
        if (role === 'state') {
          action = view.publicServices.influence ? { type: 'campaign', amount: 1 }
            : view.availablePolicies.length ? { type: 'propose', ...view.availablePolicies.at(-1), immediate: false } : null;
          if (!action && view.players.state.influence >= 2) action = { type: 'meet-mps', recipient: 'working' };
          if (!action) {
            const recipients = roles.slice(0, 3).sort((a, b) => view.legitimacy[a] - view.legitimacy[b]).slice(0, 2);
            if (recipients.every(seat => view.legitimacy[seat] > 1)) action = { type: 'extra-tax', recipients };
          }
          if (!action) {
            for (const card of view.hand) {
              const response = await fetch(server.origin + `${path}/check`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.state}` },
                body: JSON.stringify({ type: 'play', cardId: card.id, revision: view.revision }),
              });
              if (response.ok) { action = { type: 'play', cardId: card.id }; break; }
            }
          }
          assert(action, 'State fixture needs a legal main action');
        }
        if (round === 1 && turn < 4) {
          action = { type: 'play', ...view.availablePolicies[0] };
          effects++;
        }
        if (round === 1 && turn === 7) action = { type: 'event', eventId: 'event-fear-of-deflation', amount: 15 };
        if (round === 2 && turn === 1) {
          const broadcaster = view.economy.companies.find(item => item.id.includes('national-public-broadcasting'));
          const workers = view.economy.workers.filter(worker => worker.role === 'middle' && !worker.committed);
          const staff = [workers.find(worker => worker.skill === 'influence'),
            ...workers.filter(worker => worker.skill === 'any').slice(0, 2)];
          action = { type: 'assign', moves: staff.map((worker, slot) => ({ worker: worker.id, company: broadcaster.id, slot })) };
        }
        if (round === 1 && turn === 6) action = { type: 'deal', dealId: view.content.deals[0].id, destination: 'free-zone' };
        if (round === 1 && turn === 10) {
          action = { type: 'build', company: view.economy.markets.capitalist[0].id, wage: 2 };
          assert.deepEqual(await send(`${path}/check`, { ...action, revision: view.revision, cardId: view.hand[0].id }, role), { valid: true });
          assert.deepEqual(await snapshot(role), view);
        }
        let current = round === 1 && turn === 0
          ? await send(`${path}/action-confirm`, { id: randomUUID(), revision: view.revision, ...action, cardId: view.hand[0].id }, role)
          : await command(role, action);
        if (current.phase === 'card-choice') {
          const opponent = role === 'state' ? 'working' : 'state';
          assert.equal((await snapshot(opponent)).content.cardChoice, undefined);
          await command(opponent, { type: 'card-choice' }, 400);
          current = await command(role, { type: 'card-choice', indices: [0], immediate: false });
        }
        assert(current.mainUsed);
        if (action.type === 'build') {
          assert(current.economy.companies.some(company => company.id === action.company && company.owner === 'capitalist'));
          assert.equal(current.economy.markets.capitalist.length, 3);
        }
        await command(role, { type: 'end' });
        actions++;
      }
      let current = await snapshot('state');
      assert.equal(current.match.roundPhase, 'production');
      assert.equal(current.match.needsRole, 'middle');
      assert(current.economy.production.length > 0);
      for (const player of Object.values(current.players)) assert.equal(player.handCount, 2);
      const policiesVoted = [];
      while (['needs', 'election', 'vote-confirmation', 'event-penalty', 'policy-choice'].includes(current.phase)) {
        if (current.phase !== 'policy-choice') assert.equal(current.match.roundPhase,
          { needs: 'production', election: 'elections', 'vote-confirmation': 'elections', 'event-penalty': 'scoring' }[current.phase]);
        if (current.phase === 'election' && policiesVoted.at(-1) !== current.election.bill.policy) {
          assert(current.election.bill.policy > (policiesVoted.at(-1) ?? -1));
          policiesVoted.push(current.election.bill.policy);
        }
        if (current.phase === 'policy-choice') current = await settlePolicy(command, current);
        else if (current.phase === 'vote-confirmation') current = await confirmVote(command, current);
        else if (current.transaction) current = await command(current.transaction.role, { type: 'transaction-confirm' });
        else if (current.phase === 'needs') current = await command(current.match.needsRole, { type: 'food', quantities: {} });
        else if (current.phase === 'event-penalty') current = await command('state', {
          type: 'event-penalty', eventId: current.content.events[0].id, recipients: ['working', 'middle'],
        });
        else if (current.election.nextVoter) current = await command(current.election.nextVoter, { type: 'side', side: 'against' });
        else {
          const role = roles.find(seat => current.election.sides[seat] !== 'absent' && !current.election.submitted.includes(seat));
          current = await command(role, { type: 'bid', electionId: current.election.id, amount: 0 });
        }
      }
      assert.equal(current.match.history.length, round);
      assert.equal(current.match.electionsHeld, policiesVoted.length > 0);
      assert.equal(current.match.roundPhase, round === 5 ? 'endgame' : 'scoring');
      assert.equal(current.phase, round === 5 ? 'complete' : 'scoring');
      if (round < 5) {
        const preparation = await command('working', { type: 'next-round' });
        assert.equal(preparation.match.round, round + 1);
        assert.equal(preparation.match.roundPhase, 'preparation');
        assert.equal(preparation.match.settlement, null);
        assert.equal(preparation.hand.length, 7);
        const capitalist = await snapshot('capitalist');
        const removed = capitalist.economy.markets.capitalist[0].id;
        const refreshed = await command('capitalist', { type: 'market', companies: [removed] });
        assert(!refreshed.economy.markets.capitalist.some(card => card.id === removed));
        await command('middle', { type: 'market-skill', skill: 'food' }, 400);
        const middleMarket = await command('middle', { type: 'market', companies: [] });
        assert.equal(middleMarket.match.roundPhase, 'preparation');
        assert.equal(middleMarket.content.marketSkillPending, true);
        const next = await command('middle', { type: 'market-skill', skill: round === 1 ? 'influence' : 'food' });
        assert.equal(next.match.roundPhase, 'action');
      } else assert.equal(current.match.final.results.length, 4);
    }
    assert.equal(actions, 100);
    assert.equal(effects, 4);
    assert.equal(seenEvents.size, 10);
  } finally {
    await server.stop();
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});

test('single-action previews are read-only and a confirmed purchase can fund a free action before ending the turn', async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-turn-'));
  const server = await startServer(store, false);
  const tokens = {};
  const send = async (path, body, role, status = 200) => {
    const response = await fetch(server.origin + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(role && { Authorization: `Bearer ${tokens[role]}` }) },
      body: body && JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, status, result.error);
    return result;
  };
  try {
    const { code, token } = await send('/api/rooms', { name: 'working', role: 'working' }, null, 201);
    const path = `/api/rooms/${code}`;
    tokens.working = token;
    for (const role of roles.slice(1)) tokens[role] = (await send(`${path}/join`, { name: role, role })).token;
    const open = await send(path, null, 'working');
    const start = await send(`${path}/command`, { id: randomUUID(), revision: open.revision, type: 'start' }, 'working');
    const other = await send(path, null, 'middle');
    const buy = { type: 'buy', cardId: start.hand[0].id, resource: 'education', distribution: { state: 3 } };
    const preview = (action, revision) => send(`${path}/action-preview`, { ...action, revision }, 'working');
    const pending = await preview(buy, start.revision);
    assert.equal(pending.kind, 'main');
    assert(pending.changes.includes('購買教育 · 國家 3 份 · 支付 $30'));
    assert(pending.changes.some(line => line.includes('勞工 · 教育') && line.includes('0 → 3')));
    assert.deepEqual(await send(path, null, 'working'), start);
    assert.deepEqual(await send(path, null, 'middle'), other);
    const purchase = { id: randomUUID(), revision: start.revision, ...buy };
    const purchased = await send(`${path}/action-confirm`, purchase, 'working');
    assert.equal(purchased.players.working.education, 3);
    assert.equal(purchased.currentRole, 'working');
    assert.equal(purchased.mainUsed, true);
    assert.equal(purchased.transaction, null);
    assert.deepEqual(await send(`${path}/action-confirm`, purchase, 'working'), purchased);
    const { id: worker, skills } = purchased.educationOptions.workers[0];
    const educate = { type: 'use-education', worker, skill: skills[0] };
    assert.deepEqual(await send(`${path}/check`, { revision: purchased.revision, ...educate }, 'working'), { valid: true });
    const free = await preview(educate, purchased.revision);
    assert.equal(free.kind, 'free');
    assert(free.changes.some(line => line.includes('技能') && line.includes(worker.split('-').at(-1))));
    assert.deepEqual(await send(path, null, 'working'), purchased);
    await send(`${path}/action-confirm`, { id: randomUUID(), revision: start.revision, ...educate }, 'working', 409);
    const committed = await send(`${path}/action-confirm`, { id: randomUUID(), revision: purchased.revision, ...educate }, 'working');
    assert.equal(committed.revision, purchased.revision + 1);
    assert.equal(committed.currentRole, 'working');
    assert.equal(committed.freeUsed, true);
    assert.equal(committed.economy.workers.find(item => item.id === worker).skill, skills[0]);
    assert.equal(committed.players.working.cash, 0);
    assert.equal(committed.players.working.education, 0);
    assert.equal(committed.players.working.vp, 1);
    const ended = await send(`${path}/command`, { id: randomUUID(), revision: committed.revision, type: 'end' }, 'working');
    assert.equal(ended.currentRole, 'middle');
  } finally {
    await server.stop();
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});

async function startServer(store, trial = true, entry = 'server') {
  const child = spawn(process.execPath, [`apps/server/${entry}.mjs`], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', HEGEMONY_STORE: store, HEGEMONY_TEST_TRIAL: trial ? '1' : '0' },
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

test('Quick creates four seats and reload preserves room state and seat credentials, and only the host can delete the save', { timeout: 15000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-quick-'));
  let server;
  try {
    server = await startServer(store, true, 'launcher');
    const request = (path, options) => fetch(server.origin + path, options);
    const post = (path, body, token) => request(path, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    });
    const created = await post('/api/quick-room', {});
    assert.equal(created.status, 201);
    const { code, seats, ...extra } = await created.json();
    assert.deepEqual(extra, {});
    const path = `/api/rooms/${code}`;
    const room = (role, method = 'GET') => request(path, { method, headers: { Authorization: `Bearer ${seats[role].token}` } });
    const lobby = await (await room('working')).json();
    assert.equal((await post(`${path}/command`, { type: 'start', id: randomUUID(), revision: lobby.revision }, seats.working.token)).status, 200);
    assert.deepEqual(Object.keys(seats), roles);
    assert.equal((await request('/god')).status, 404);
    assert.equal((await request('/god.js')).status, 404);
    for (const endpoint of ['god-seat', 'god', 'god-history']) {
      assert.equal((await request(path + '/' + endpoint)).status, 404);
      assert.equal((await post(path + '/' + endpoint, {}, seats.working.token)).status, 404);
    }
    const views = () => Promise.all(roles.map(async role => {
      const response = await room(role);
      assert.equal(response.status, 200);
      return response.json();
    }));
    const before = await views();
    assert(before.every(view => view.phase === 'action'));
    const savePath = `${path}/save`;
    const withSeat = role => ({ headers: { Authorization: `Bearer ${seats[role].token}` } });
    assert.equal((await request(savePath, withSeat('middle'))).status, 403);
    const exported = await request(savePath, withSeat('working'));
    assert.equal(exported.status, 200);
    const save = await exported.json();
    assert.deepEqual(Object.keys(save), ['version', 'game', 'signature']);
    assert(roles.every(role => save.game.players[role].hand.length > 0));
    const savedPath = join(store, `${code}.json`);
    const saved = JSON.parse(await readFile(savedPath, 'utf8'));
    await writeFile(savedPath, JSON.stringify({ ...saved, godKey: 'legacy-key', history: [], rewindRevision: 1 }));
    const reload = await post('/api/quick-reload', {});
    assert.equal(reload.status, 202);
    const { instance } = await reload.json();
    let restarted = false;
    for (let attempt = 0; attempt < 40 && !restarted; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const current = await request('/api/meta').then(response => response.json()).catch(() => null);
      restarted = Boolean(current?.instance && current.instance !== instance);
    }
    assert(restarted);
    assert.deepEqual(await views(), before);
    const hostToken = seats.working.token;
    const cardId = before[0].hand[0].id;
    const played = await post(`${path}/action-confirm`, { type: 'pressure', id: randomUUID(), revision: before[0].revision, cardId }, hostToken);
    assert.equal(played.status, 200);
    const changed = await played.json();
    assert.equal(changed.mainUsed, true);
    const restore = { revision: changed.revision, save };
    assert.equal((await post(savePath, restore, seats.middle.token)).status, 403);
    const tampered = { ...save, game: { ...save.game, treasury: 123456 } };
    assert.equal((await post(savePath, { ...restore, save: tampered }, hostToken)).status, 400);
    assert.equal((await post(savePath, { ...restore, revision: before[0].revision }, hostToken)).status, 409);
    assert.equal((await post(savePath, restore, hostToken)).status, 200);
    const after = await views();
    assert.deepEqual(after, before.map(view => ({ ...view, revision: changed.revision + 1, restoredRevision: changed.revision + 1 })));
    assert.equal((await room('middle', 'DELETE')).status, 403);
    assert.equal((await room('working', 'DELETE')).status, 200);
    assert.equal((await room('working')).status, 404);
    assert.deepEqual(await readdir(store), ['.save-key']);
  } finally {
    await server?.stop();
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});

test('four seats can finish five rounds and recover a private ballot after server restart', { timeout: 20000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-'));
  let server;
  try {
    server = await startServer(store);
    const sessions = {};
    async function request(path, body, role, status = 200) {
      const response = await fetch(`${server.origin}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', ...(role && { Authorization: `Bearer ${sessions[role]}` }) },
        body: body && JSON.stringify(body),
      });
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify(result));
      return result;
    }
    const room = await request('/api/rooms', { name: '勞工玩家', role: 'working' }, null, 201);
    const path = `/api/rooms/${room.code}`;
    sessions.working = room.token;
    for (const role of roles.slice(1)) {
      const joined = await request(`${path}/join`, { name: role, role });
      sessions[role] = joined.token;
    }
    await request(`${path}/join`, { name: '重複席位', role: 'state' }, null, 409);
    await request(path, null, null, 401);
    const snapshot = role => request(path, null, role);
    const post = (role, body, status) => request(`${path}/command`, body, role, status);
    async function command(role, input, status = 200) {
      const state = await snapshot(role);
      return post(role, { id: randomUUID(), revision: state.revision, cardId: state.hand[0]?.id, ...input }, status);
    }
    await command('middle', { type: 'start' }, 403);
    const opened = await command('working', { type: 'start' });
    const middle = await snapshot('middle');
    assert.equal(opened.hand.length, 7);
    for (const role of roles) {
      const hand = await snapshot(role);
      assert(new Set(hand.hand.map(card => card.key)).size >= 4);
      assert.equal(hand.decks, undefined);
    }
    assert.equal(opened.players.middle.handCount, 7);
    assert.equal(opened.players.middle.hand, undefined);
    assert(!JSON.stringify(opened).includes(middle.hand[0].id));
    await command('working', { type: 'pressure', cardId: middle.hand[0].id }, 400);
    await command('middle', { type: 'pressure' }, 400);
    const proposal = { id: randomUUID(), revision: opened.revision, cardId: opened.hand[0].id,
      type: 'propose', policy: 4, target: 'B', immediate: true };
    const proposed = await post('working', proposal);
    assert.equal(proposed.phase, 'election');
    assert.equal((await post('working', proposal)).revision, proposed.revision);
    await post('working', { id: randomUUID(), revision: opened.revision, type: 'end' }, 409);
    for (const role of roles.slice(1)) await command(role, { type: 'side', side: 'for' });
    const firstBallot = await snapshot('working');
    await command('middle', { type: 'bid', electionId: firstBallot.election.id, amount: 1 });
    const beforeRestart = await snapshot('capitalist');
    assert.deepEqual(beforeRestart.election.submitted, ['middle']);
    assert.equal(beforeRestart.election.bids, undefined);
    assert.equal(beforeRestart.players.middle.influence, 1);

    await server.stop();
    server = await startServer(store);
    const recovered = await snapshot('working');
    assert.equal(recovered.election.id, firstBallot.election.id);
    assert.equal(recovered.hand.length, 6);
    assert.deepEqual(recovered.election.submitted, ['middle']);
    await post('working', { id: randomUUID(), revision: firstBallot.revision, type: 'bid', electionId: firstBallot.election.id, amount: 0 });
    await command('capitalist', { type: 'bid', electionId: firstBallot.election.id, amount: 0 });
    const result = await command('state', { type: 'bid', electionId: firstBallot.election.id, amount: 0 });
    assert.equal(result.phase, 'vote-confirmation');
    for (const role of roles.slice(0, 2)) {
      await post(role, { id: randomUUID(), revision: result.revision, type: 'confirm-vote', electionId: result.lastVote.id });
    }
    const resolved = await settlePolicy(command, await confirmVote(command, await snapshot('state')));
    assert.equal(resolved.phase, 'action');
    assert.equal(resolved.currentRole, 'working');
    assert.equal(resolved.policies[4], 'B');
    assert.equal(resolved.players.working.vp, 3);
    assert.equal(resolved.players.middle.vp, 1);
    assert.equal(resolved.lastVote.bids.middle, 1);
    await command('working', { type: 'end' });

    for (let turn = 1; turn < 20; turn++) {
      const role = roles[turn % 4];
      let action = role === 'state' ? { type: 'campaign', amount: 1 } : { type: 'pressure' };
      if (turn === 1) action = { type: 'propose', policy: 5, target: 'C', immediate: false };
      if (turn === 2) action = { type: 'build', company: 'radio', wage: 2, hire: '' };
      if (turn === 4) {
        const { economy } = await snapshot(role);
        const idle = economy.workers.filter(worker => worker.role === role && !worker.company);
        const health = idle.find(worker => worker.skill === 'health').id;
        const general = idle.find(worker => worker.skill === 'any').id;
        const first = { worker: health, company: 'clinic', slot: 0 };
        const invalid = await snapshot(role);
        await command(role, { type: 'assign', moves: [first] }, 400);
        assert.deepEqual(await snapshot(role), invalid);
        action = { type: 'assign', moves: [first, { worker: general, company: 'clinic', slot: 1 }] };
      }
      if (turn === 5) {
        const { economy } = await snapshot(role);
        const operator = economy.workers.find(worker => worker.role === role && !worker.company && worker.skill === 'luxury').id;
        action = { type: 'build', company: 'games', wage: 2, operator, hire: 'working' };
      }
      if (turn === 6) {
        await command(role, { type: 'sell', company: 'clinic' }, 400);
        await command(role, { type: 'wages', changes: [{ company: 'clinic', wage: 3 }] });
        await command(role, { type: 'wages', changes: [{ company: 'college', wage: 3 }] }, 400);
      }
      if (turn === 19) action = { type: 'propose', policy: 6, target: 'C', immediate: false };
      await command(role, action);
      await command(role, { type: 'end' });
    }
    const produced = await snapshot('middle');
    assert.equal(produced.phase, 'needs');
    assert.equal(produced.treasury, 60);
    assert.equal(produced.players.capitalist.revenue, 22);
    assert.equal(produced.players.working.cash, 138);
    assert.equal(produced.economy.production.find(row => row.company === '診所').wage, 30);
    assert.equal(produced.economy.production.find(row => row.company === '遊戲商店').produced, 4);
    assert.equal(produced.economy.production.some(row => row.company === '電台'), false);
    assert(produced.economy.workers.every(worker => !worker.committed));
    await command('working', { type: 'food', quantities: {} }, 400);
    await command('middle', { type: 'food', quantities: {} });
    await command('working', { type: 'food', quantities: { capitalist: 4 } }, 400);
    const pending = await command('working', { type: 'food', quantities: { capitalist: 3 } });
    assert.equal(pending.phase, 'election');
    assert.equal(pending.election.bill.policy, 5);
    for (const role of ['working', 'capitalist', 'state']) await command(role, { type: 'side', side: 'for' });
    for (const role of roles) await command(role, { type: 'bid', electionId: pending.election.id, amount: 0 });
    const secondBill = await settlePolicy(command, await confirmVote(command, await snapshot('state')));
    assert.equal(secondBill.election.bill.policy, 6);
    for (const role of roles.slice(0, 3)) await command(role, { type: 'side', side: 'for' });
    for (const role of roles) await command(role, { type: 'bid', electionId: secondBill.election.id, amount: 0 });
    const first = await settlePolicy(command, await confirmVote(command, await snapshot('state')));
    assert.equal(first.phase, 'scoring');
    assert.equal(first.policies[5], 'C');
    assert.equal(first.match.history[0].taxes.corporate, 12);
    assert.equal(first.match.history[0].taxes.total, 81);
    assert.deepEqual(first.match.history[0].meals, []);
    const workingMeal = (await snapshot('working')).match.history[0].meals[0];
    assert.equal(workingMeal.cost, 36);
    assert.deepEqual(first.match.history[0].foodSettlement.working, {
      own: workingMeal.own, purchased: 3, imported: workingMeal.imported, cost: 36,
    });
    assert(roles.every(role => first.players[role].handCount === 2));
    await command('middle', { type: 'next-round' }, 403);

    for (let round = 2; round <= 5; round++) {
      const retained = (await snapshot('working')).hand;
      const prepared = await command('working', { type: 'next-round' });
      assert.equal(prepared.match.round, round);
      assert.equal(prepared.match.populations.working, Math.floor((10 + 4 * (round - 1)) / 3));
      assert.equal(prepared.hand.length, 7);
      assert.deepEqual(prepared.hand.slice(0, 2), retained);
      for (let turn = 0; turn < 20; turn++) {
        const role = roles[turn % 4];
        const state = await snapshot(role);
        const offer = state.match.exports.find(item => item.available);
        const proposal = state.availablePolicies.find(item => item.policy === 4);
        let action = { type: 'pressure' };
        if (offer) action = { type: 'export', offers: [offer.id] };
        if (role === 'state') {
          if (state.publicServices.influence) action = { type: 'campaign', amount: 1 };
          else if (proposal) action = { type: 'propose', ...proposal, immediate: false };
          else if (state.availablePolicies.length) action = { type: 'propose', ...state.availablePolicies.at(-1), immediate: false };
          else if (state.players.state.influence >= 2) action = { type: 'meet-mps', recipient: 'working' };
          else action = { type: 'trial-pass' }; // This server intentionally uses the legacy trial fixture.
        }
        await command(role, action);
        await command(role, { type: 'end' });
      }
      await command('middle', { type: 'food', quantities: {} });
      let current = await command('working', { type: 'food', quantities: {} });
      while (['election', 'vote-confirmation', 'policy-choice'].includes(current.phase)) {
        if (current.phase === 'vote-confirmation') {
          current = await confirmVote(command, current);
          continue;
        }
        if (current.phase === 'policy-choice') {
          current = await settlePolicy(command, current);
          continue;
        }
        const id = current.election.id;
        while (current.election?.id === id && current.election.nextVoter) {
          current = await command(current.election.nextVoter, { type: 'side', side: 'against' });
        }
        for (const role of roles) {
          if (current.election?.id !== id || current.election.sides[role] === 'absent') continue;
          current = await command(role, { type: 'bid', electionId: id, amount: 0 });
        }
      }
      assert.equal(current.phase, round === 5 ? 'complete' : 'scoring');
      assert.equal(current.match.history.length, round);
    }
    const completed = await snapshot('state');
    assert.equal(completed.match.round, 5);
    assert.equal(completed.match.final.results.length, 4);
    assert(completed.match.final.winners.length > 0);
    for (const row of completed.match.final.results) {
      assert.equal(row.total, row.before + row.policy + row.money + row.inventory - row.penalty);
      assert.equal(row.total, completed.players[row.role].vp);
    }
    await command('working', { type: 'next-round' }, 400);
  } finally {
    await server?.stop();
    // Remove only this test's freshly allocated files and directory.
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});
