import assert from 'node:assert/strict';
import test from 'node:test';
import { cardDefinition } from '../packages/engine/cards.mjs';
import { addWorker, company } from '../packages/engine/companies.mjs';
import { catalogDecks } from '../packages/engine/content.mjs';
import { eventSpec } from '../packages/engine/events.mjs';
import { applyCommand, createGame, playerView } from '../packages/engine/game.mjs';
import { businessDeal, buyGoods } from '../packages/engine/trade.mjs';

test('Pressing Matters offers free immediate voting or a scheduled bill', () => {
  const game = createGame();
  const card = { id: 'pressing-matters', key: 'action-state-pressing-matters' };
  game.phase = 'action';
  game.turn = 3;
  game.players.state.hand = [card];
  game.players.state.influence = 0;
  const { policy, target } = playerView(game, 'state').availablePolicies.find(choice => choice.policy === 2);
  const command = { type: 'play', cardId: card.id, policy, target };
  const scheduled = structuredClone(game);
  applyCommand(scheduled, 'state', { ...command, immediate: false }, true);
  assert.equal(scheduled.phase, 'action');
  assert.equal(scheduled.election, null);
  assert.deepEqual(scheduled.bills, [{ role: 'state', policy, target }]);

  applyCommand(game, 'state', { ...command, immediate: true }, true);
  assert.equal(game.players.state.influence, 0);
  assert.equal(playerView(game, 'working').election.nextVoter, 'working');
  assert.deepEqual(playerView(game, 'working').voteResults, []);
  for (const role of ['working', 'middle', 'capitalist']) applyCommand(game, role, { type: 'side', side: 'for' }, true);
  const electionId = game.election.id;
  for (const role of ['working', 'middle', 'capitalist', 'state']) {
    applyCommand(game, role, { type: 'bid', amount: 0, electionId }, true);
  }
  const confirm = { type: 'confirm-vote', electionId };
  assert.equal(game.phase, 'vote-confirmation');
  assert.notEqual(game.policies[policy], target);
  assert.throws(() => applyCommand(game, 'state', { type: 'end' }, true), /等待四席確認/);
  for (const role of ['working', 'middle', 'capitalist']) applyCommand(game, role, confirm, true);
  applyCommand(game, 'working', confirm, true);
  assert.deepEqual(playerView(game, 'state').voteConfirmation.confirmed, ['working', 'middle', 'capitalist']);
  assert.equal(game.phase, 'vote-confirmation');
  applyCommand(game, 'state', confirm, true);
  assert.equal(game.policies[policy], target);
  assert.equal(game.phase, 'action');
  assert.equal(game.turn, 3);
  assert.equal(game.mainUsed, true);
  for (const role of ['working', 'middle', 'capitalist', 'state']) {
    const { lastVote, voteResults } = playerView(game, role);
    assert.equal(lastVote.id, electionId);
    assert.deepEqual(voteResults, [lastVote]);
  }
});

test('Current deals, export offers and saved import overrides affect trade', () => {
  const game = createGame();
  game.policies[5] = 'A';
  applyCommand(game, 'working', { type: 'start' }, true);
  const deal = catalogDecks.businessDeals[0];
  game.content.deals = [deal.id];
  const previousCash = game.players.capitalist.revenue;
  businessDeal(game, { dealId: deal.id, destination: 'free-zone' });
  assert.equal(game.players.capitalist.revenue, previousCash - deal.cost);

  const exportCard = catalogDecks.exports.find(card => card.id !== game.content.export);
  game.content.export = exportCard.id;
  assert.equal(playerView(game, 'capitalist').content.export.id, exportCard.id);
  assert.equal(playerView(game, 'capitalist').match.exports[0].price, exportCard.offers[0].money);
  game.content.export = null;
  assert.deepEqual(playerView(game, 'capitalist').match.exports, []);

  const before = playerView(game, 'working').match.prices.foreign.food;
  const cash = game.players.working.cash;
  const treasury = game.treasury;
  game.testImports = { food: { base: 12, tariff: 4 } };
  buyGoods(game, 'working', 'food', { foreign: 1 });
  assert.equal(game.players.working.cash, cash - 16);
  assert.equal(game.treasury, treasury + 4);
  delete game.testImports;
  assert.deepEqual(playerView(game, 'working').match.prices.foreign.food, before);
});

test('labor market deregulation restricts employed workers to 2C and preserves commitment on a full replacement', () => {
  const game = createGame({ full: false });
  const card = { id: 'deregulation', key: 'action-working-labor-market-deregulation' };
  game.phase = 'action';
  game.policies[1] = 'B';
  game.players.working.hand = [card];
  const { companies, workers } = game.economy;
  companies.fish = company('fish');
  const replacements = ['food', 'any', 'any'].map(skill => addWorker(game.economy, 'working', skill));
  const original = companies.supermarket.slots.map(slot => slot.worker);
  const moves = [...original, replacements[2]].map((worker, slot) => ({ worker, company: 'fish', slot }))
    .concat(replacements.slice(0, 2).map((worker, slot) => ({ worker, company: 'supermarket', slot })));
  const play = { type: 'play', cardId: card.id, moves };
  assert.throws(() => applyCommand(structuredClone(game), 'working', play, true), /工人來源或目的地不符/);
  game.policies[1] = 'C';
  const committed = structuredClone(game);
  committed.economy.workers[original[0]].committed = true;
  assert.throws(() => applyCommand(committed, 'working', play, true), /尚未承諾/);
  applyCommand(game, 'working', play, true);
  assert.deepEqual(companies.supermarket.slots.map(slot => slot.worker), replacements.slice(0, 2));
  assert(companies.supermarket.slots.every(slot => !workers[slot.worker].committed));
  assert(companies.fish.slots.every(slot => workers[slot.worker].committed));
});

test('specialization can assign the newly added worker in the same action', () => {
  const game = createGame({ full: false });
  const card = { id: 'specialization', key: 'action-working-specialization' };
  game.phase = 'action';
  game.policies[6] = 'B';
  game.players.working.hand = [card];
  const idle = Object.values(game.economy.workers).find(worker => worker.role === 'working' && worker.skill === 'any'
    && !Object.values(game.economy.companies).some(company => company.slots.some(slot => slot.worker === worker.id)));
  applyCommand(game, 'working', { type: 'play', cardId: card.id, skill: 'health', moves: [
    { worker: 'specialization-new-worker', company: 'clinic', slot: 0 },
    { worker: idle.id, company: 'clinic', slot: 1 },
  ] }, true);
  const newcomer = game.economy.workers[game.economy.companies.clinic.slots[0].worker];
  assert.equal(newcomer.skill, 'health');
  assert.equal(newcomer.committed, true);
});

test('middle specialization accepts zero placements and restricts placements to its employee slots', () => {
  const game = createGame({ full: false });
  const card = { id: 'specialization', key: 'action-middle-specialization' };
  game.phase = 'action';
  game.turn = 1;
  game.policies[6] = 'C';
  game.players.middle.hand = [card];
  const play = { type: 'play', cardId: card.id, skill: 'influence' };
  const move = { worker: 'specialization-new-worker', company: 'convenience', slot: 1 };
  assert.throws(() => applyCommand(structuredClone(game), 'middle', {
    ...play, moves: [{ ...move, company: 'broadcaster', slot: 0 }],
  }, true), /工人來源或目的地不符/);
  assert.throws(() => applyCommand(structuredClone(game), 'middle', {
    ...play, moves: [{ ...move, worker: game.economy.companies.supermarket.slots[1].worker }],
  }, true), /工人來源或目的地不符/);
  const assigned = structuredClone(game);
  applyCommand(assigned, 'middle', { ...play, moves: [move] }, true);
  const worker = assigned.economy.workers[assigned.economy.companies.convenience.slots[1].worker];
  assert.equal(worker.role, 'working');
  assert.equal(worker.skill, 'influence');

  applyCommand(game, 'middle', { ...play, moves: [] }, true);
  const added = playerView(game, 'middle').economy.workers.find(item => item.id === worker.id);
  assert.equal(added.company, null);
});

test('all 107 action faces and all 25 events have engine definitions', () => {
  const game = createGame();
  let actionFaces = 0;
  for (const [role, deck] of Object.entries(game.decks)) {
    const expected = catalogDecks[`${role}Actions`];
    assert.equal(deck.draw.length, 40);
    assert.equal(new Set(deck.draw.map(card => card.id)).size, 40);
    for (const card of expected) {
      assert.equal(deck.draw.filter(copy => copy.key === card.id).length, card.copies);
      assert(cardDefinition(role, { key: card.id }).effect, card.id);
    }
    actionFaces += expected.length;
  }
  assert.equal(actionFaces, 107);
  assert.equal(game.content.eventDeck.length, 25);
  for (const id of game.content.eventDeck) assert(eventSpec(id)?.kind, id);
});

test('the industry event waits for the company owner to confirm staffing', () => {
  const game = createGame();
  const eventId = 'event-infant-industry-requires-help';
  const { eventDeck } = game.content;
  eventDeck.unshift(...eventDeck.splice(eventDeck.indexOf(eventId), 1));
  const { markets, companyDecks } = game.economy;
  const id = 'company-capitalist-fish-farm';
  const target = [...markets.capitalist, ...companyDecks.capitalist]
    .find(key => catalogDecks.capitalistCompanies.find(company => company.id === key)?.cost >= 15);
  assert(target, id);
  if (!markets.capitalist.includes(target)) {
    const index = companyDecks.capitalist.indexOf(target);
    [markets.capitalist[0], companyDecks.capitalist[index]] = [target, markets.capitalist[0]];
  }
  applyCommand(game, 'working', { type: 'start' }, true);
  game.turn = 3;
  const cardId = game.players.state.hand[0].id;
  applyCommand(game, 'state', { type: 'event', cardId, eventId, recipient: 'capitalist', company: target }, true);
  assert.equal(game.phase, 'event-hire');
  assert.equal(game.economy.companies[target], undefined);
  assert.throws(() => applyCommand(game, 'state', { type: 'event-hire', wage: 2 }, true));
  applyCommand(game, 'capitalist', { type: 'event-hire', wage: 2 }, true);
  assert.equal(game.phase, 'action');
  assert.equal(game.economy.companies[target].id, target);
  assert.equal(game.content.legitimacyTokens.capitalist, 1);
  assert.equal(game.mainUsed, true);
});

test('the selected card runs its own effect and moves to the discard pile', () => {
  const game = createGame({ full: false });
  const deck = game.decks.working;
  for (const key of ['housing', 'healthcare']) {
    const index = deck.draw.findIndex(card => card.key === key);
    deck.draw.push(...deck.draw.splice(index, 1));
  }
  applyCommand(game, 'working', { type: 'start' }, true);
  const hand = playerView(game, 'working').hand;
  const housing = hand.find(card => card.key === 'housing');
  assert.equal(hand[0].key, 'healthcare');
  assert.throws(() => applyCommand(game, 'working', { type: 'play', cardId: housing.id, recipient: 'state' }, true));
  assert.equal(game.players.working.hand.length, 7);
  applyCommand(game, 'working', { type: 'play', cardId: housing.id, recipient: 'middle' }, true);
  assert.equal(game.players.working.cash, 20);
  assert.equal(game.players.working.vp, 3);
  assert.equal(game.players.middle.cash, 50);
  assert.equal(game.publicServices.health, 6);
  assert.equal(deck.discard[0].id, housing.id);
  assert.equal(game.players.working.hand.some(card => card.id === housing.id), false);
});
