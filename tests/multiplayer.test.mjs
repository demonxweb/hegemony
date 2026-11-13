import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const roles = ['working', 'middle', 'capitalist', 'state'];

test('waiting room starts only after four distinct roles and four current confirmations', async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-waiting-'));
  let server;
  try {
    server = await startServer(store, false, false);
    async function request(path, { body, token, presence, status = 200, method = body ? 'POST' : 'GET' } = {}) {
      const response = await fetch(server.origin + path, {
        method,
        headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }), ...(presence && { 'X-Room-Presence': '1' }) },
        body: body && JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      return data;
    }
    await request('/api/rooms', { body: {}, status: 401 });
    const accounts = [];
    for (const name of ['Host', ...roles.slice(1)]) {
      accounts.push(await request('/api/player/register', { body: { name, password: 'p' } }));
    }
    const host = await request('/api/rooms', { body: { testMode: true, roomName: '測試議事廳' }, token: accounts[0].token, status: 201 });
    const path = '/api/rooms/' + host.code;
    assert.equal((await request(path + '/name', { token: accounts[1].token })).roomName, '測試議事廳');
    const invite = name => request(path + '/waiting', { body: { type: 'invite', name }, token: host.token });
    const middle = accounts[1];
    const offered = await invite(middle.name);
    const [invitation] = offered.waiting.invitations;
    assert(!offered.waiting.invitationCandidates.includes(middle.name));
    assert(!offered.waiting.invitationCandidates.includes(accounts[0].name));
    assert(offered.waiting.invitationCandidates.includes(accounts[2].name));
    assert.equal(invitation.joined, false);
    assert.equal((await request('/api/player/rooms', { token: middle.token })).invitations[0].code, host.code);
    const invitedSeat = await request(path + '/join', { body: {}, token: middle.token });
    const revoke = { type: 'revoke-invite', id: invitation.id };
    await request(path + '/waiting', { body: revoke, token: invitedSeat.token, status: 403 });
    assert.equal((await request(path, { token: host.token })).waiting.invitations[0].joined, true);
    const revoked = await request(path + '/waiting', { body: revoke, token: host.token });
    assert.equal(revoked.waiting.players.length, 1);
    assert.deepEqual((await request('/api/player/rooms', { token: middle.token })).invitations, []);
    await request(path, { token: invitedSeat.token, status: 401 });
    await request(path + '/join', { body: {}, token: middle.token, status: 403 });
    await invite(middle.name);
    const tokens = [host.token];
    for (const account of accounts.slice(1)) tokens.push((await request(path + '/join', { body: {}, token: account.token })).token);
    const extra = await request('/api/player/register', { body: { name: 'Extra', password: 'p' } });
    await invite(extra.name);
    assert.equal((await request('/api/player/rooms', { token: extra.token })).invitations[0].full, true);
    await request(path + '/join', { body: {}, token: extra.token, status: 409 });
    assert.equal((await request(path + '/join', { body: {}, token: accounts[0].token })).token, host.token);
    const hostView = await request(path, { token: host.token, presence: true });
    await request(path + '/chat', { body: { text: '未登入' }, status: 401 });
    await request(path + '/chat', { body: { text: '   ' }, token: host.token, status: 400 });
    const lobbyChat = await request(path + '/chat', { body: { text: ' 大家好 ' }, token: host.token, status: 201 });
    assert.deepEqual(lobbyChat.chat, [{ id: 1, role: null, name: accounts[0].name, text: '大家好' }]);
    assert.equal(hostView.presence[hostView.role], true);
    assert.equal(Object.values(hostView.presence).filter(Boolean).length, 1);
    const guestView = await request(path, { token: tokens[1], presence: true });
    assert.deepEqual(guestView.chat, lobbyChat.chat);
    assert.equal(guestView.waiting.invitationCandidates, undefined);
    assert.equal(guestView.presence[hostView.role], true);
    assert.equal(guestView.presence[guestView.role], true);
    assert.equal(guestView.revision, hostView.revision);
    const rename = { roomName: '四人測試桌', revision: hostView.revision };
    await request(path + '/name', { body: rename, token: tokens[1], status: 403 });
    assert.equal((await request(path + '/name', { body: rename, token: host.token })).roomName, '四人測試桌');
    assert.equal((await request(path, { token: tokens[1] })).roomName, '四人測試桌');
    const change = (index, body, status) => request(path + '/waiting', { token: tokens[index], body, status });
    for (let index = 0; index < roles.length; index++) await change(index, { type: 'select', role: roles[index] });
    const conflict = await change(1, { type: 'select', role: 'working' });
    assert.equal(conflict.waiting.players.filter(player => player.role === 'working').length, 2);
    assert(conflict.waiting.players.every(player => !Object.hasOwn(player, 'key')));
    await change(0, { type: 'ready', selectionRevision: conflict.waiting.selectionRevision }, 400);
    const resolved = await change(1, { type: 'select', role: 'middle' });
    await change(0, { type: 'start-skill', skill: 'health' }, 400);
    await change(1, { type: 'ready', selectionRevision: resolved.waiting.selectionRevision }, 400);
    const selected = await change(1, { type: 'start-skill', skill: 'health' });
    assert.equal(selected.waiting.middleMarket.length, 3);
    assert(selected.waiting.middleMarket.every(company => company.skills.length));
    assert.equal((await request(path, { token: host.token })).waiting.middleMarket, undefined);
    const ready = { type: 'ready', selectionRevision: selected.waiting.selectionRevision };
    await change(0, { type: 'ready', selectionRevision: conflict.waiting.selectionRevision }, 400);
    await change(0, ready);
    await change(0, { type: 'cancel' });
    const others = await Promise.all([1, 2, 3].map(index => change(index, ready)));
    assert(others.every(view => view.phase === 'lobby'));
    assert.equal((await change(0, ready)).phase, 'action');
    const gameChat = await request(path + '/chat', { body: { text: '開始了' }, token: host.token, status: 201 });
    assert.deepEqual(gameChat.chat, [...lobbyChat.chat, { id: 2, role: 'working', name: accounts[0].name, text: '開始了' }]);
    await request(path + '/waiting', { body: revoke, token: host.token, status: 409 });
    assert.deepEqual((await request('/api/player/rooms', { token: extra.token })).invitations, []);
    for (const [index, token] of tokens.entries()) {
      const view = await request(path, { token, presence: true });
      assert.equal(view.role, roles[index]);
      assert.equal(view.phase, 'action');
      assert.equal(view.presence.working, true);
      assert.equal(view.presence.middle, true);
    }
    const started = storedRoom(store, host.code).game;
    assert.equal(started.economy.workers[started.economy.startingMiddleSkill].skill, 'health');
    const beforeAdjust = await request(path, { token: tokens[0], presence: true });
    await request(path + '/command', { token: tokens[1], body: {
      type: 'host-adjust', target: 'middle', cash: 1, id: randomUUID(), revision: beforeAdjust.revision,
    }, status: 403 });
    const adjusted = await request(path + '/command', { token: tokens[0], body: {
      type: 'host-adjust', target: 'middle', cash: 99, living: { influence: 4 }, inventory: { food: 5 },
      storageUnits: { food: 3 }, prices: { food: 15 }, id: randomUUID(), revision: beforeAdjust.revision,
    } });
    assert.equal(adjusted.testMode, true);
    assert(adjusted.cardPiles.draw.length > 0);
    assert.equal(adjusted.players.middle.cash, 99);
    assert.equal(adjusted.players.middle.influence, 4);
    assert.equal(adjusted.economy.inventory.middle.food, 5);
    assert.equal(adjusted.economy.storageCapacity.middle.food, 24);
    assert.equal(adjusted.match.prices.middle.food.price, 15);
    await server.stop();
    server = await startServer(store, false, false);
    const login = await request('/api/player/login', { body: { name: 'Host', password: 'p' } });
    const { rooms } = await request('/api/player/rooms', { token: login.token });
    assert.equal(rooms[0].roomName, '四人測試桌');
    assert.deepEqual(rooms.map(({ code, host }) => ({ code, host })), [{ code: host.code, host: true }]);
    assert.equal((await request(path + '/join', { body: {}, token: login.token })).token, host.token);
    const guestRooms = await request('/api/player/rooms', { token: accounts[1].token });
    assert.equal(guestRooms.rooms[0].host, false);
    await request('/api/admin/players', { token: login.token, status: 401 });
    const admin = await request('/api/admin/setup', { body: { password: 'a' } });
    const { players } = await request('/api/admin/players', { token: admin.token });
    const playerPath = '/api/admin/players/' + players.find(player => player.name === 'Host').id;
    await request(playerPath, { method: 'PATCH', token: admin.token, body: { name: 'Renamed' } });
    assert.equal((await request('/api/player/rooms', { token: login.token })).name, 'Renamed');
    await request(playerPath, { method: 'PATCH', token: admin.token, body: { name: 'Renamed', password: '短' } });
    await request('/api/player/login', { body: { name: 'Renamed', password: '短' } });
    await request(playerPath, { method: 'PATCH', token: admin.token, body: { name: 'Renamed', password: '新'.repeat(150) } });
    await request('/api/player/rooms', { token: login.token, status: 401 });
    await request(path, { token: host.token, status: 401 });
    const renamed = await request('/api/player/login', { body: { name: 'Renamed', password: '新'.repeat(150) } });
    const returned = await request(path + '/join', { body: {}, token: renamed.token });
    assert.equal((await request(path, { token: returned.token })).role, 'working');
    await request(playerPath, { method: 'DELETE', token: admin.token });
    await request(path, { token: returned.token, status: 401 });
    await request('/api/player/login', { body: { name: 'Renamed', password: '新'.repeat(150) }, status: 401 });
  } finally {
    await server?.stop();
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});

function storedRoom(store, code) {
  const db = new DatabaseSync(join(store, 'rooms.sqlite'), { readOnly: true });
  try {
    return JSON.parse(db.prepare('SELECT snapshot FROM rooms WHERE code = ?').get(code).snapshot);
  } finally {
    db.close();
  }
}

async function confirmVote(command, current) {
  const electionId = current.lastVote.id;
  for (const role of roles.filter(seat => !current.voteConfirmation.confirmed.includes(seat))) {
    current = await command(role, { type: 'confirm-vote', electionId });
  }
  return current;
}

async function confirmProduction(command, current) {
  while (current.phase === 'production-confirm') {
    const { role, stage } = current.match.productionStep;
    current = await command(role, { type: 'production-confirm', option: stage });
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
    const roomFile = join(store, `${code}.json`);
    const room = storedRoom(store, code);
    assert.deepEqual(roles.map(role => room.game.decks[role].draw.length), [40, 40, 40, 40]);
    // Arrange a known opening without replacing or adding physical cards.
    const opening = ['fake-news', 'public-opinion-polling', 'offshore-companies', 'foreign-financial-assistance'];
    for (const [index, role] of roles.entries()) {
      const { draw } = room.game.decks[role];
      const cardIndex = draw.findIndex(card => card.key.endsWith(opening[index]));
      assert(cardIndex >= 0);
      draw.push(...draw.splice(cardIndex, 1));
    }
    // The scripted turns prioritize card coverage over earning enough to buy food for five rounds.
    room.game.players.working.cash += 500;
    const events = room.game.content.eventDeck;
    events.unshift(...events.splice(events.indexOf('event-fear-of-deflation'), 1));
    await server.stop();
    await rm(join(store, 'rooms.sqlite'));
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
          if (role === 'working') {
            const { drawn, removed, returned } = current.cardResult.fakeNews;
            assert.deepEqual(removed, drawn.slice(0, 1));
            assert.deepEqual(returned, drawn.slice(1));
          } else assert(Array.isArray(current.cardResult.changes));
          assert.equal((await snapshot(opponent)).cardResult, undefined);
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
      assert.equal(current.match.productionStep.role, 'state');
      assert.equal(current.match.productionStep.stage, 'wages');
      current = await confirmProduction(command, current);
      assert.equal(current.match.needsRole, 'middle');
      assert(current.economy.production.length > 0);
      for (const player of Object.values(current.players)) assert.equal(player.handCount, 2);
      const policiesVoted = [];
      while (['needs', 'election', 'vote-confirmation', 'event-penalty', 'policy-choice', 'production-confirm'].includes(current.phase)) {
        if (current.phase !== 'policy-choice') assert.equal(current.match.roundPhase,
          { needs: 'production', 'production-confirm': 'production', election: 'elections', 'vote-confirmation': 'elections', 'event-penalty': 'scoring' }[current.phase]);
        if (current.phase === 'election' && policiesVoted.at(-1) !== current.election.bill.policy) {
          assert(current.election.bill.policy > (policiesVoted.at(-1) ?? -1));
          policiesVoted.push(current.election.bill.policy);
        }
        if (current.phase === 'production-confirm') current = await confirmProduction(command, current);
        else if (current.phase === 'policy-choice') current = await settlePolicy(command, current);
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

async function startServer(store, trial = true, legacyRooms = true) {
  const child = spawn(process.execPath, ['apps/server/server.mjs'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', HEGEMONY_STORE: store, HEGEMONY_TEST_TRIAL: trial ? '1' : '0',
      HEGEMONY_TEST_LEGACY_ROOMS: legacyRooms ? '1' : '0' },
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

test('Room saves survive a restart and only the host can save, restore or delete them', { timeout: 15000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-save-'));
  let server;
  try {
    server = await startServer(store);
    const request = (path, options) => fetch(server.origin + path, options);
    const post = (path, body, token) => request(path, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    });
    assert.equal((await request('/quick')).status, 404);
    assert.equal((await post('/api/quick-room', {})).status, 404);
    assert.equal((await post('/api/quick-reload', {})).status, 404);
    const created = await post('/api/rooms', { role: 'working', name: 'Host', testMode: true });
    assert.equal(created.status, 201);
    const { code, token } = await created.json();
    const path = `/api/rooms/${code}`;
    const seats = { working: { token } };
    for (const role of roles.slice(1)) {
      const joined = await post(path + '/join', { role, name: role });
      assert.equal(joined.status, 200);
      seats[role] = await joined.json();
    }
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
    const savePath = `${path}/saves`;
    const restorePath = `${path}/restore`;
    const hostToken = seats.working.token;
    const withSeat = role => ({ headers: { Authorization: `Bearer ${seats[role].token}` } });
    assert.equal((await request(path + '/save', withSeat('working'))).status, 404);
    assert.equal((await request(savePath, withSeat('middle'))).status, 403);
    const savedResponse = await post(savePath, { revision: before[0].revision }, hostToken);
    assert.equal(savedResponse.status, 201);
    const record = await savedResponse.json();
    assert.deepEqual(Object.keys(record), ['id', 'createdAt']);
    const other = await (await post('/api/rooms', { role: 'working', name: 'Other host', testMode: true })).json();
    const otherPath = `/api/rooms/${other.code}`;
    assert.equal((await post(otherPath + '/restore', { revision: 1, id: record.id }, other.token)).status, 404);
    assert.equal((await request(otherPath, { method: 'DELETE', headers: { Authorization: `Bearer ${other.token}` } })).status, 200);
    const regular = await (await post('/api/rooms', { role: 'working', name: 'Regular host' })).json();
    const regularPath = `/api/rooms/${regular.code}`;
    const regularAuth = { headers: { Authorization: `Bearer ${regular.token}` } };
    assert.equal((await request(`${regularPath}/saves`, regularAuth)).status, 403);
    assert.equal((await post(`${regularPath}/saves`, { revision: 1 }, regular.token)).status, 403);
    assert.equal((await post(`${regularPath}/restore`, { revision: 1, id: record.id }, regular.token)).status, 403);
    assert.equal((await request(regularPath, { ...regularAuth, method: 'DELETE' })).status, 200);
    const savedPath = join(store, `${code}.json`);
    const saved = storedRoom(store, code);
    await writeFile(savedPath, JSON.stringify({ ...saved, godKey: 'legacy-key', history: [], rewindRevision: 1 }));
    await server.stop();
    server = await startServer(store);
    assert.deepEqual(await views(), before);
    assert.deepEqual(await (await request(savePath, withSeat('working'))).json(), { saves: [{ ...record, round: 1, turn: 0, phase: 'action' }] });
    const cardId = before[0].hand[0].id;
    const played = await post(`${path}/action-confirm`, { type: 'pressure', id: randomUUID(), revision: before[0].revision, cardId }, hostToken);
    assert.equal(played.status, 200);
    const changed = await played.json();
    assert.equal(changed.mainUsed, true);
    const restore = { revision: changed.revision, id: record.id };
    assert.equal((await post(restorePath, restore, seats.middle.token)).status, 403);
    assert.equal((await post(restorePath, { ...restore, revision: before[0].revision }, hostToken)).status, 409);
    assert.equal((await post(restorePath, restore, hostToken)).status, 200);
    const after = await views();
    assert.deepEqual(after, before.map(view => ({ ...view, revision: changed.revision + 1, restoredRevision: changed.revision + 1 })));
    assert.equal((await room('middle', 'DELETE')).status, 403);
    assert.equal((await room('working', 'DELETE')).status, 200);
    assert.equal((await room('working')).status, 404);
    await server.stop();
    server = await startServer(store);
    assert.equal((await room('working')).status, 404);
    const db = new DatabaseSync(join(store, 'rooms.sqlite'), { readOnly: true });
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM room_saves WHERE code = ?').get(code).count, 0);
    } finally {
      db.close();
    }
    assert.deepEqual((await readdir(store)).sort(), [`${code}.json`, 'rooms.sqlite'].sort());
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
    const wages = await snapshot('state');
    assert.equal(wages.match.productionStep.stage, 'wages');
    assert.deepEqual(wages.economy.production, []);
    await command('middle', { type: 'production-confirm', option: 'wages' }, 400);
    const statePaid = await command('state', { type: 'production-confirm', option: 'wages' });
    assert.equal(statePaid.match.productionStep.stage, 'goods');
    assert.deepEqual(statePaid.economy.production, []);
    const produced = await confirmProduction(command, await snapshot('middle'));
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
    const pending = await confirmProduction(command, await command('working', { type: 'food', quantities: { capitalist: 3 } }));
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
      await confirmProduction(command, await snapshot('state'));
      await command('middle', { type: 'food', quantities: {} });
      let current = await confirmProduction(command, await command('working', { type: 'food', quantities: {} }));
      while (['election', 'vote-confirmation', 'policy-choice', 'production-confirm'].includes(current.phase)) {
        if (current.phase === 'production-confirm') {
          current = await confirmProduction(command, current);
          continue;
        }
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
