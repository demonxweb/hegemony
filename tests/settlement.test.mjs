import { catalogCard } from '../packages/engine/content.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, playerView } from '../packages/engine/game.mjs';
import { addWorker, economyView, pay, publicCapacity, resizePublicSector, storageCapacity, workerSupply, workplace } from '../packages/engine/companies.mjs';
import { catalogDecks, eventDraw } from '../packages/engine/content.mjs';
import { checkIMF, coverNeeds, finalScore, openNeeds, payTaxes } from '../packages/engine/rounds.mjs';
import { marketQuote } from '../packages/engine/prices.mjs';

test('healthcare, luxury and swapping follow the shared free-action limit and worker commitment', () => {
  const game = createGame({ full: false });
  const command = (role, input) => applyCommand(game, role, { cardId: game.players[role].hand[0]?.id, ...input }, true);
  command('working', { type: 'start' });
  game.players.working.health = 3;
  const originalCount = Object.keys(game.economy.workers).length;
  command('working', { type: 'use-health' });
  assert.equal(game.players.working.health, 0);
  assert.equal(game.players.working.vp, 3);
  assert.equal(Object.keys(game.economy.workers).length, originalCount + 1);
  assert.throws(() => command('working', { type: 'use-luxury' }), /已執行免費行動/);
  command('working', { type: 'pressure' });
  command('working', { type: 'end' });
  game.players.middle.luxury = 3;
  command('middle', { type: 'use-luxury' });
  assert.equal(game.players.middle.luxury, 0);
  assert.equal(game.players.middle.vp, 1);

  game.turn = 4;
  game.freeUsed = false;
  const slot = game.economy.companies.hospital.slots[1];
  const employed = game.economy.workers[slot.worker];
  employed.skill = 'food';
  employed.committed = true;
  const idle = Object.values(game.economy.workers).find(worker => worker.role === 'working' && worker.skill === 'any' && !workplace(game.economy, worker.id));
  command('working', { type: 'swap-workers', swaps: [{ employed: employed.id, idle: idle.id }] });
  assert.equal(slot.worker, idle.id);
  assert.equal(idle.committed, true);
  assert.equal(employed.committed, false);
  assert.equal(workplace(game.economy, employed.id), undefined);
});

test('extra shift leaves a committed employee out and State extra tax validates lowest legitimacy', () => {
  const game = createGame({ full: false });
  const command = (role, input) => applyCommand(game, role, { cardId: game.players[role].hand[0]?.id, ...input }, true);
  command('working', { type: 'start' });
  game.turn = 1;
  const business = game.economy.companies.convenience;
  const employee = Object.values(game.economy.workers).find(worker => worker.role === 'working' && worker.skill === 'any' && !workplace(game.economy, worker.id));
  business.slots[1].worker = employee.id;
  employee.committed = true;
  command('middle', { type: 'extra-shift', company: business.id });
  assert.equal(game.economy.inventory.middle.food, 3);
  assert.equal(game.players.middle.cash, 40);
  assert.equal(game.economy.workers[business.slots[0].worker].committed, true);
  command('middle', { type: 'end' });
  game.players.capitalist.capital = 35;
  command('capitalist', { type: 'lobby' });
  assert.equal(game.players.capitalist.capital, 5);
  assert.equal(game.players.capitalist.influence, 4);
  command('capitalist', { type: 'end' });
  game.legitimacy = { working: 2, middle: 3, capitalist: 3 };
  assert.throws(() => command('state', { type: 'extra-tax', recipients: ['middle', 'capitalist'] }), /合法性最低/);
  game.players.working.cash = 0;
  command('state', { type: 'extra-tax', recipients: ['working', 'capitalist'] });
  assert.equal(game.economy.loans.working, 1);
  assert.equal(game.treasury, 150);
  assert.deepEqual(game.legitimacy, { working: 1, middle: 3, capitalist: 2 });
  command('state', { type: 'end' });
  game.turn = 7;
  game.players.state.influence = 2;
  command('state', { type: 'meet-mps', recipient: 'working' });
  assert.equal(game.players.working.influence, 3);
  assert.equal(game.legitimacy.working, 2);
});

test('demonstration pauses before food and enforces the exact VP distribution', () => {
  const game = createGame({ full: false });
  const command = (role, input) => applyCommand(game, role, { cardId: game.players[role].hand[0]?.id, ...input }, true);
  command('working', { type: 'start' });
  for (let i = 0; i < 12; i++) addWorker(game.economy, 'working', 'any');
  command('working', { type: 'demonstrate' });
  game.turn = 19;
  command('state', { type: 'end' });
  for (const role of ['state', 'capitalist', 'middle', 'working']) {
    assert.deepEqual(game.match.productionStep, { role, stage: 'wages' });
    if (role === 'working') {
      const { companies, income, pendingIncome } = playerView(game, role).match.productionStep;
      assert.equal(pendingIncome, income);
      assert(income > 0);
      assert(companies.length > 0);
      assert.equal(income, companies.reduce((sum, item) => sum + item.wage, 0));
    }
    const cash = game.players.working.cash;
    command(role, { type: 'production-confirm', option: 'wages' });
    if (role === 'working') {
      const income = game.economy.production.filter(row => row.recipient === role).reduce((sum, row) => sum + row.wage, 0);
      assert.equal(game.players.working.cash, cash + income);
      assert.equal(game.match.pendingWorkingWages, undefined);
    }
    else if (game.match.productionStep.stage === 'goods') command(role, { type: 'production-confirm', option: 'goods' });
  }
  const { demonstration } = playerView(game, 'working');
  assert.equal(game.phase, 'demonstration');
  assert.throws(() => command('state', { type: 'demonstration-losses' }), /等待勞工/);
  assert.throws(() => command('working', { type: 'demonstration-losses', losses: { middle: 0, capitalist: 0, state: 0 } }), /合計/);
  let left = demonstration.losses;
  const losses = Object.fromEntries(Object.entries(demonstration.limits).map(([role, limit]) => {
    const amount = Math.min(left, limit);
    left -= amount;
    return [role, amount];
  }));
  command('working', { type: 'demonstration-losses', losses });
  assert.equal(game.phase, 'needs');
  assert.equal(game.players.working.influence, 2);
  for (const [role, amount] of Object.entries(losses)) assert.equal(game.players[role].vp + amount, 0);
});

test('a split business deal pays tariffs and keeps both stocks separate', () => {
  const game = createGame();
  const deal = catalogDecks.businessDeals.find(item => item.goods.food > 1);
  applyCommand(game, 'working', { type: 'start' }, true);
  game.content.deals = [deal.id];
  game.turn = 2;
  const domestic = game.economy.inventory.capitalist.food;
  const before = game.treasury;
  applyCommand(game, 'capitalist', { type: 'deal', cardId: game.players.capitalist.hand[0].id, dealId: deal.id, allocation: { food: 1 } }, true);
  assert.equal(game.economy.inventory.capitalist.food, domestic + 1);
  assert.equal(game.economy.tradeZone.food, deal.goods.food - 1);
  assert.equal(game.treasury, before + deal.tariffByForeignTrade.B);
});

test('worker supply is finite, loans are unlimited, and first-round event redraw preserves the restricted card', () => {
  const game = createGame();
  while (workerSupply(game.economy, 'working', 'any')) addWorker(game.economy, 'working', 'any');
  assert.throws(() => addWorker(game.economy, 'working', 'any'), /替代|技術工/);
  const worker = addWorker(game.economy, 'working', 'any', 'luxury');
  assert.equal(game.economy.workers[worker].skill, 'luxury');
  game.economy.loans.state = 10;
  pay(game, 'working', 31, true);
  assert.equal(game.economy.loans.working, 1);
  assert.equal(game.players.working.cash, 49);
  const [restricted, one, two] = catalogDecks.events;
  const previous = restricted.minimumRound;
  restricted.minimumRound = 2;
  try {
    game.content.eventDeck = [restricted.id, one.id, two.id];
    const options = eventDraw(game, 2, true);
    assert.deepEqual(new Set(options), new Set([one.id, two.id]));
    assert.deepEqual(game.content.eventDeck, [...options, restricted.id]);
    game.match.round = 2;
    assert.equal(eventDraw(game, 3).at(-1), restricted.id);
  } finally {
    restricted.minimumRound = previous;
  }
});

test('IMF waits for State closures and both price decisions before collecting taxes', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  command('working', { type: 'start' });
  game.policies[0] = 'B';
  resizePublicSector(game, playerView(game, 'state').economy.publicSector
    .map((entry, index) => entry.face === 'closed' ? game.economy.publicSlots[index] : null).filter(Boolean).slice(0, 3));
  game.treasury = 0;
  game.economy.loans.state = 2;
  openNeeds(game);
  game.players.middle.food = 10;
  game.players.working.food = 10;
  command('middle', { type: 'food', quantities: {} });
  command('working', { type: 'food', quantities: {} });
  assert.deepEqual(game.match.productionStep, { role: 'state', stage: 'imf' });
  command('state', { type: 'production-confirm', option: 'imf' });
  assert.equal(game.phase, 'policy-choice');
  assert.equal(game.match.needs.taxes, null);
  const { policyChoice } = playerView(game, 'state');
  const closed = policyChoice.companies.slice(0, 3).map(company => company.id);
  assert.throws(() => command('middle', { type: 'policy-choice', companies: closed }), /指定席位/);
  command('state', { type: 'policy-choice', companies: closed });
  assert(closed.every(id => !game.economy.companies[id]));
  assert.equal(game.match.needs.taxes, null);
  command('middle', { type: 'policy-choice', prices: { food: 9 } });
  command('capitalist', { type: 'policy-choice' });
  assert.deepEqual(game.match.productionStep, { role: 'state', stage: 'taxes' });
  assert.equal(game.match.needs.taxes.total, 0);
  assert.equal(game.economy.loans.state, 0);
  assert.equal(playerView(game, 'middle').match.prices.middle.food.price, 9);
});

test('middle-class food can come from either stock and own food must be used first', () => {
  const game = createGame();
  game.players.middle.food = 2;
  game.economy.inventory.middle.food = 4;
  openNeeds(game);
  coverNeeds(game, 'middle', {}, 0);
  assert.equal(game.players.middle.food, 2);
  assert.equal(game.economy.inventory.middle.food, 1);
  assert.equal(game.match.needs.meals[0].cost, 0);

  game.economy.inventory.middle.food = 0;
  openNeeds(game);
  assert.throws(() => coverNeeds(game, 'middle', {}, 1), /先用足自有食物/);
  coverNeeds(game, 'middle', {});
  assert.equal(game.players.middle.food, 0);
  assert.equal(game.match.needs.meals[0].imported, 1);
});

test('a four-player room exposes the official opening cash and resource allocations', () => {
  const game = createGame();
  applyCommand(game, 'working', { type: 'start' }, true);
  const { players, treasury, economy, publicServices, bag, match } = playerView(game, 'working');
  assert.equal(players.working.cash, 30);
  assert.equal(players.middle.cash, 40);
  assert.equal(players.capitalist.revenue, 120);
  assert.equal(players.capitalist.capital, 0);
  assert.equal(treasury, 120);
  for (const player of Object.values(players)) {
    assert.equal(player.influence, 1);
    assert.equal(player.handCount, 7);
  }
  for (const role of ['working', 'middle']) {
    for (const resource of ['food', 'luxury', 'health', 'education']) assert.equal(players[role][resource] ?? 0, 0);
    assert.equal(economy.workers.filter(worker => worker.role === role).length, 10);
    assert.equal(economy.workers.filter(worker => worker.role === role && !worker.company).length, 3);
  }
  assert.deepEqual(match.populations, { working: 3, middle: 3 });
  assert.deepEqual(economy.inventory, {
    middle: { food: 1, luxury: 0, health: 1, education: 0 },
    capitalist: { food: 1, luxury: 2, health: 0, education: 2 },
  });
  assert.deepEqual(publicServices, { health: 6, education: 6, influence: 4 });
  assert.deepEqual(economy.publicStorageCapacity, { food: 6, luxury: 6, health: 12, education: 12, influence: 10 });
  assert.deepEqual(economy.tradeZone, { food: 0, luxury: 0 });
  assert.deepEqual(bag, { working: 8, middle: 8, capitalist: 8 });
});

test('shown market prices follow policy and match basic purchases and food settlement', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  command('working', { type: 'start' });
  const currentPrices = () => playerView(game, 'working').match.prices;
  const opening = currentPrices();
  assert.deepEqual(opening.foreign.food, { price: 15, stock: null, base: 10, tariff: 5 });
  assert.deepEqual(opening.capitalist.food, { price: 12, stock: 1 });
  assert.equal(opening.state.health.price, 5);
  assert.equal(opening.state.influence.price, 10);
  assert.equal(opening.foreign.health, undefined);
  game.policies[3] = 'A';
  game.policies[5] = 'C';
  const changed = currentPrices();
  assert.equal(changed.state.health.price, 0);
  assert.equal(changed.foreign.food.price, 10);
  const cardId = game.players.working.hand[0].id;
  command('working', { type: 'buy', cardId, resource: 'food', distribution: { capitalist: 1, foreign: 1 } });
  assert.equal(game.transaction.cost, changed.capitalist.food.price + changed.foreign.food.price);
  command('working', { type: 'transaction-confirm' });
  assert.equal(currentPrices().capitalist.food.stock, 0);
  openNeeds(game);
  const needs = playerView(game, 'middle').match.needs;
  assert.equal(needs.importPrice, changed.foreign.food.price);
  assert.equal(needs.sellers.capitalist.price, changed.capitalist.food.price);
});

test('warehouse capacity reflects capitalist purchases and middle-class card expansion', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  const draw = game.decks.middle.draw;
  draw.push(...draw.splice(draw.findIndex(card => card.key === 'action-middle-growing-business'), 1));
  command('working', { type: 'start' });
  assert.deepEqual(playerView(game, 'working').economy.storageCapacity, {
    capitalist: { food: 8, luxury: 12, health: 12, education: 12 },
    middle: { food: 8, luxury: 8, health: 8, education: 8 },
  });
  game.turn = 1;
  assert.throws(() => command('middle', { type: 'buy-storage', resource: 'food' }), /資本家/);
  const cardId = game.players.middle.hand[0].id;
  command('middle', { type: 'play', cardId, resource: 'health' });
  assert.equal(playerView(game, 'middle').economy.storageCapacity.middle.health, 16);
  assert.equal(game.players.middle.cash, 40);
  command('middle', { type: 'end' });
  assert(playerView(game, 'capitalist').storageOptions.includes('food'));
  command('capitalist', { type: 'buy-storage', resource: 'food' });
  const view = playerView(game, 'capitalist');
  assert.equal(view.economy.storageCapacity.capitalist.food, 16);
  assert.equal(view.economy.freeTradeCapacity.food, 8);
  assert.equal(view.players.capitalist.revenue, 100);
  assert.equal(view.mainUsed, false);
  assert.equal(view.freeUsed, true);
  assert.throws(() => command('capitalist', { type: 'buy-storage', resource: 'luxury' }), /免費行動/);
});

test('fiscal changes flip the same public cards and recalculate capacity and overflow', () => {
  const game = createGame();
  applyCommand(game, 'working', { type: 'start' }, true);
  const view = () => playerView(game, 'working').economy;
  const start = view().publicSector;
  assert.equal(start.length, 9);
  assert.deepEqual(start.map(card => card.face), ['open', 'open', 'open', ...Array(6).fill('closed')]);
  assert(start.slice(3).every(card => !Object.hasOwn(card, 'id')));

  game.policies[0] = 'B';
  resizePublicSector(game);
  const expanded = view();
  assert.deepEqual(expanded.publicSector.slice(0, 3), start.slice(0, 3));
  assert.deepEqual(expanded.publicSector.map(card => card.face), [...Array(6).fill('open'), ...Array(3).fill('closed')]);
  assert.deepEqual(expanded.publicStorageCapacity, { food: 6, luxury: 6, health: 16, education: 16, influence: 13 });
  assert.equal(game.publicServices.health, 6);

  game.policies[0] = 'A';
  resizePublicSector(game);
  assert(view().publicSector.every(card => card.face === 'open'));
  assert.equal(view().publicStorageCapacity.health, 20);
  game.publicServices.health = 20;
  game.policies[0] = 'C';
  resizePublicSector(game);
  assert.deepEqual(view().publicSector, start);
  assert.equal(view().publicStorageCapacity.health, 12);
  assert.equal(game.publicServices.health, 12);
});

test('food consumes own stock, transfers purchase price and forces a loan for the shortfall', () => {
  const game = createGame({ full: false });
  game.players.middle.cash = 1;
  game.players.middle.food = 1;
  openNeeds(game);
  coverNeeds(game, 'middle', { capitalist: 1 });
  assert.equal(game.economy.inventory.middle.food, 0);
  assert.equal(game.players.middle.food, 0);
  assert.equal(game.players.middle.cash, 39);
  assert.equal(game.players.capitalist.revenue, 132);
  assert.equal(game.economy.loans.middle, 1);
  coverNeeds(game, 'working', {});
  assert.equal(game.treasury, 135);
  assert.equal(game.players.working.cash, 35);
  assert.equal(game.economy.loans.working, 1);
});

test('settlement forecasts use the production sequence and disclose only the viewing seat’s gaps', () => {
  const game = createGame();
  applyCommand(game, 'working', { type: 'start' }, true);
  const before = structuredClone(game);
  const working = playerView(game, 'working').match.settlement;
  const middle = playerView(game, 'middle').match.settlement;
  const capitalist = playerView(game, 'capitalist').match.settlement;
  assert.deepEqual(game, before);
  assert.equal(working.stage, 'forecast');
  assert.equal(working.food.shortage, 3);
  assert.equal(working.food.cost, 45);
  assert(working.wages.incoming > 0);
  assert.equal(working.income.total, working.wages.incoming);
  assert(working.tax.due > 0);
  assert.equal(middle.food.shortage, 0);
  assert.equal(middle.income.total, middle.wages.incoming);
  assert.equal(middle.usage.find(item => item.resource === 'health').warehouse, 1);
  assert.equal(middle.usage.find(item => item.resource === 'health').shortage, 3);
  assert.equal(capitalist.food, undefined);
  assert.equal(capitalist.income.total, 0);
  assert.deepEqual(capitalist.usage, []);
  openNeeds(game);
  assert.equal(playerView(game, 'working').match.needs, null);
  assert.equal(playerView(game, 'working').match.needsRole, 'middle');
  assert.equal(playerView(game, 'middle').match.needs.shortage, 2);
});

test('settlement income updates on confirmed food sales and keeps borrowing separate', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  const settlement = role => playerView(game, role).match.settlement;
  command('working', { type: 'start' });
  game.players.middle.cash = 1;
  game.publicServices.food = 1;
  openNeeds(game);

  const initialStateIncome = settlement('state').income;
  assert.equal(initialStateIncome.tariffs, 25);
  assert.equal(initialStateIncome.foodSales, 0);
  command('middle', { type: 'food', quantities: { capitalist: 1, state: 1 } });
  assert.equal(settlement('capitalist').income.foodSales, 0);
  assert.deepEqual(settlement('state').income, initialStateIncome);
  command('middle', { type: 'transaction-confirm' });
  assert.equal(settlement('middle').food.loans, 1);
  assert.equal(settlement('middle').income.total, 0);
  assert.equal(settlement('capitalist').income.total, 12);
  assert.equal(settlement('state').income.foodSales, 12);
  assert.equal(settlement('state').income.tariffs, 15);

  command('working', { type: 'food', quantities: {} });
  command('working', { type: 'transaction-confirm' });
  command('state', { type: 'production-confirm', option: 'imf' });
  for (const role of ['state', 'capitalist', 'middle', 'working']) {
    command(role, { type: 'production-confirm', option: 'taxes' });
  }
  const state = settlement('state');
  assert.equal(state.stage, 'settled');
  assert.equal(playerView(game, 'state').match.electionsHeld, false);
  assert.equal(state.income.taxes, game.match.needs.taxes.total);
  assert.equal(state.income.total, 27 + state.income.taxes);
  assert.equal(settlement('capitalist').income.total, 12);

  delete game.match.needs.meals[0].sales;
  assert.equal(settlement('capitalist').income.salesIncomplete, true);
  assert.equal(settlement('working').income.salesIncomplete, false);
});

test('an immediate vote remains part of the action phase and returns to the same turn', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  command('working', { type: 'start' });
  const opening = playerView(game, 'working');
  command('working', { type: 'propose', ...opening.availablePolicies[0], cardId: opening.hand[0].id, immediate: true });
  const voting = playerView(game, 'working');
  assert.equal(voting.phase, 'election');
  assert.equal(voting.match.roundPhase, 'action');
  assert.equal(voting.match.electionsHeld, null);
  for (const role of ['middle', 'capitalist', 'state']) command(role, { type: 'side', side: 'for' });
  for (const role of ['working', 'middle', 'capitalist', 'state']) command(role, { type: 'bid', amount: 0, electionId: voting.election.id });
  for (const role of ['working', 'middle', 'capitalist', 'state']) command(role, { type: 'confirm-vote', electionId: voting.election.id });
  while (game.phase === 'policy-choice') {
    const { policyChoice } = playerView(game, 'state');
    const input = { type: 'policy-choice' };
    if (policyChoice.kind === 'public') input.companies = policyChoice.companies.slice(-policyChoice.count).map(item => item.id);
    if (policyChoice.kind === 'hire') [input.company, input.hire] = policyChoice.options[0];
    command(policyChoice.role, input);
  }
  const resumed = playerView(game, 'working');
  assert.equal(resumed.currentRole, 'working');
  assert.equal(resumed.turn, 0);
  assert.equal(resumed.mainUsed, true);
});

test('round preparation collects interest and lowers prosperity once, including legacy market saves', () => {
  for (const legacy of [false, true]) {
    const game = createGame();
    const command = (role, input) => applyCommand(game, role, input, true);
    command('working', { type: 'start' });
    game.match.history.push({ round: 1, meals: [] });
    game.match.workingProsperity = 3;
    game.match.middleProsperity = 4;
    game.economy.loans.capitalist = 1;
    game.players.capitalist.capital = 10;
    game.phase = legacy ? 'market' : 'scoring';
    if (legacy) {
      game.content.marketRole = 'middle';
      assert.equal(playerView(game, 'middle').match.round, 2);
      command('middle', { type: 'market', companies: [] });
    } else {
      command('working', { type: 'next-round' });
      assert.equal(game.players.capitalist.capital, 5);
      command('capitalist', { type: 'market', companies: [] });
      command('middle', { type: 'market', companies: [] });
    }
    assert.equal(game.match.round, 2);
    assert.equal(game.players.capitalist.capital, 5);
    assert.equal(game.match.workingProsperity, 2);
    assert.equal(game.match.middleProsperity, 2);
    command('middle', { type: 'market-skill', skill: 'food' });
    assert.equal(game.match.round, 2);
    assert.equal(game.players.capitalist.capital, 5);
    assert.equal(game.phase, 'action');
  }
});

test('new rooms block turn changes until a purchase or repayment is confirmed or cancelled', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  command('working', { type: 'start' });
  const cardId = game.players.working.hand[0].id;
  const buy = { type: 'buy', cardId, resource: 'food', distribution: { foreign: 1 } };
  command('working', buy);
  assert.equal(game.players.working.cash, 30);
  assert.equal(game.players.working.hand.length, 7);
  assert.equal(game.mainUsed, false);
  assert.deepEqual(playerView(game, 'middle').transaction, { role: 'working', kind: 'buy' });
  assert.throws(() => command('working', { type: 'end' }), /待處理/);
  assert.throws(() => command('working', { type: 'pressure', cardId }), /待處理/);
  assert.throws(() => command('middle', { type: 'transaction-confirm' }), /待處理/);
  command('working', { type: 'transaction-cancel' });
  assert.throws(() => command('working', { type: 'end' }), /主要行動/);
  command('working', buy);
  command('working', { type: 'transaction-confirm' });
  assert.equal(game.players.working.cash, 15);
  assert.equal(game.players.working.food, 1);
  assert.equal(game.players.working.hand.length, 6);
  assert.equal(playerView(game, 'working').purchaseReceipt.cost, 15);
  assert.equal(playerView(game, 'middle').purchaseReceipt, undefined);
  assert.throws(() => command('working', { type: 'pressure', cardId: game.players.working.hand[0].id }), /主要行動已完成/);
  game.players.working.cash = 55;
  game.economy.loans.working = 1;
  command('working', { type: 'repay' });
  assert.equal(game.economy.loans.working, 1);
  assert.throws(() => command('working', { type: 'end' }), /待處理/);
  command('working', { type: 'transaction-confirm' });
  assert.equal(game.economy.loans.working, 0);
  assert.equal(game.players.working.cash, 5);
  command('working', { type: 'end' });
  assert.equal(game.turn, 1);
  assert.equal(playerView(game, 'working').purchaseReceipt, undefined);
});

test('a mandatory food loan waits for confirmation before applying purchases or advancing', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  command('working', { type: 'start' });
  game.players.middle.cash = 1;
  openNeeds(game);
  command('middle', { type: 'food', quantities: {} });
  assert.equal(game.transaction.kind, 'food-loan');
  assert.equal(game.transaction.loans, 1);
  assert.equal(game.players.middle.cash, 1);
  assert.equal(game.economy.loans.middle, 0);
  assert.deepEqual(game.match.needs.meals, []);
  assert.throws(() => command('middle', { type: 'end' }), /待處理/);
  assert.throws(() => command('working', { type: 'food', quantities: {} }), /待處理/);
  command('middle', { type: 'transaction-confirm' });
  assert.equal(game.match.needs.role, 'working');
  assert.equal(game.economy.loans.middle, 1);
  assert.equal(game.match.needs.meals[0].loans, 1);
});

test('basic assignment rejects withdrawal and closes an unstaffed source after a legal reassignment', () => {
  const game = createGame();
  applyCommand(game, 'working', { type: 'start' }, true);
  const firm = game.economy.companies['company-state-university-hospital-start-34p'];
  const workers = firm.slots.map(slot => slot.worker);
  const cardId = game.players.working.hand[0].id;
  const idle = Object.values(game.economy.workers).find(worker => worker.role === 'working' && !workplace(game.economy, worker.id));
  assert.throws(() => applyCommand(game, 'working', {
    type: 'assign', cardId, moves: [{ worker: idle.id, company: firm.id, slot: 1 }],
  }, true), /工位已有人/);
  assert.equal(firm.slots[1].worker, workers[1]);
  const command = { type: 'assign', cardId, moves: [{ worker: workers[0], company: null }] };
  game.economy.workers[workers[0]].committed = true;
  assert.throws(() => applyCommand(game, 'working', command, true), /尚未承諾/);
  game.economy.workers[workers[0]].committed = false;
  assert.throws(() => applyCommand(game, 'working', command, true), /企業工位/);
  const clinic = Object.values(game.economy.companies).find(item => item.id.includes('clinic') && item.slots.every(slot => !slot.worker));
  const general = Object.values(game.economy.workers).find(worker => worker.role === 'working' && worker.skill === 'any' && !workplace(game.economy, worker.id));
  applyCommand(game, 'working', { ...command, moves: [{ worker: workers[0], company: clinic.id, slot: 0 },
    { worker: general.id, company: clinic.id, slot: 1 }] }, true);
  assert.equal(game.mainUsed, true);
  assert.equal(workplace(game.economy, workers[0]), clinic);
  assert(workers.slice(1).every(worker => !workplace(game.economy, worker) && !game.economy.workers[worker].committed));
});

test('private price changes are free actions and feed purchases and food settlement', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  command('working', { type: 'start' });
  game.turn = 1;
  command('middle', { type: 'adjust-prices', prices: { food: 9 } });
  assert.equal(playerView(game, 'middle').match.prices.middle.food.price, 9);
  assert.equal(playerView(game, 'middle').match.prices.capitalist.food.price, 12);
  game.turn = 2;
  game.freeUsed = false;
  assert.throws(() => command('capitalist', { type: 'adjust-prices', prices: { food: 15, luxury: 99 } }), /圖板上的不同售價/);
  assert.equal(playerView(game, 'capitalist').match.prices.capitalist.food.price, 12);
  command('capitalist', { type: 'adjust-prices', prices: { food: 15, luxury: 5 } });
  assert.equal(game.freeUsed, true);
  assert.throws(() => command('capitalist', { type: 'give-bonus' }), /已執行免費行動/);
  game.turn = 4;
  game.freeUsed = false;
  command('working', { type: 'buy', cardId: game.players.working.hand[0].id, resource: 'luxury', distribution: { capitalist: 1 } });
  assert.equal(game.transaction.cost, 5);
  command('working', { type: 'transaction-cancel' });
  openNeeds(game);
  coverNeeds(game, 'middle', { capitalist: 1 });
  assert.equal(game.match.needs.meals[0].sales.capitalist, 15);
});

test('capitalist bonuses commit workers and pay their class while State retains its own free actions', () => {
  const game = createGame();
  const command = (role, input) => applyCommand(game, role, input, true);
  command('working', { type: 'start' });
  game.turn = 2;
  const firm = game.economy.companies['company-capitalist-supermarket-start'];
  assert.throws(() => command('capitalist', { type: 'give-bonus', company: 'company-state-university-hospital-start-34p' }), /符合條件/);
  command('capitalist', { type: 'give-bonus', company: firm.id });
  assert.equal(game.players.capitalist.revenue, 115);
  assert.equal(game.players.working.cash, 35);
  assert(firm.slots.every(slot => game.economy.workers[slot.worker].committed));
  game.turn = 3;
  game.freeUsed = false;
  assert.throws(() => command('state', { type: 'adjust-prices', prices: { health: 10 } }), /只有中產與資本家/);
  assert.throws(() => command('state', { type: 'give-bonus', company: firm.id }), /只有資本家/);
  command('state', { type: 'wages', changes: [{ company: 'company-state-university-hospital-start-34p', wage: 3 }] });
  assert.equal(game.freeUsed, true);
});

test('working-class education preserves employment and commitment and uses the free action before the main action', () => {
  const game = createGame();
  const command = input => applyCommand(game, 'working', input, true);
  command({ type: 'start' });
  const firm = game.economy.companies['company-state-university-hospital-start-34p'];
  const [specialist, general] = firm.slots.map(slot => slot.worker);
  game.economy.workers[general].committed = true;
  game.players.working.education = 4;
  for (let count = 0; count < 5; count++) addWorker(game.economy, 'working', 'influence');
  const options = playerView(game, 'working').educationOptions;
  assert.equal(options.cost, 5);
  assert(!options.workers.some(worker => worker.id === specialist));
  assert(!options.workers.find(worker => worker.id === general).skills.includes('influence'));
  assert.throws(() => command({ type: 'use-education', worker: general, skill: 'food' }), /需要 5 份/);
  game.players.working.education = 6;
  assert.throws(() => command({ type: 'use-education', worker: general, skill: 'influence' }), /仍有供應/);
  command({ type: 'use-education', worker: general, skill: 'food' });
  assert.equal(game.players.working.education, 1);
  assert.equal(game.economy.workers[general].skill, 'food');
  assert.equal(firm.slots[1].worker, general);
  assert.equal(game.economy.workers[general].committed, true);
  assert.equal(game.players.working.vp, 1);
  assert.equal(game.match.workingProsperity, 1);
  assert.equal(game.mainUsed, false);
  assert.equal(game.freeUsed, true);
  assert.throws(() => command({ type: 'use-education', worker: general, skill: 'luxury' }), /已執行免費行動/);
  command({ type: 'pressure', cardId: game.players.working.hand[0].id });
});

test('middle-class education uses personal goods, scores its track, and only retrains unemployed specialists', () => {
  const game = createGame();
  applyCommand(game, 'working', { type: 'start' }, true);
  game.turn = 1;
  const command = input => applyCommand(game, 'middle', input, true);
  const specialist = game.economy.companies['company-middle-convenience-store-start'].slots[0].worker;
  const idle = Object.values(game.economy.workers).find(worker => worker.role === 'middle' && worker.skill === 'food' && !workplace(game.economy, worker.id));
  game.economy.inventory.middle.education = 8;
  game.match.middleProsperity = 5;
  command({ type: 'pressure', cardId: game.players.middle.hand[0].id });
  assert.throws(() => command({ type: 'use-education', worker: idle.id, skill: 'luxury' }), /生活資源區/);
  game.players.middle.education = 3;
  assert.throws(() => command({ type: 'use-education', worker: specialist, skill: 'luxury' }), /可受訓/);
  command({ type: 'use-education', worker: idle.id, skill: 'luxury' });
  assert.equal(game.economy.inventory.middle.education, 8);
  assert.equal(game.players.middle.education, 0);
  assert.equal(idle.skill, 'luxury');
  assert.equal(game.match.middleProsperity, 6);
  assert.equal(game.players.middle.vp, 5);
  assert.equal(game.mainUsed, true);
  assert.equal(game.freeUsed, true);
});

test('building commits exactly the workers selected for the new company', () => {
  const game = createGame();
  applyCommand(game, 'working', { type: 'start' }, true);
  game.turn = 2;
  const company = 'company-capitalist-radio-station';
  game.economy.markets.capitalist = [company];
  const working = [addWorker(game.economy, 'working', 'any'), addWorker(game.economy, 'working', 'any')];
  const middle = addWorker(game.economy, 'middle', 'any');
  const skilled = addWorker(game.economy, 'working', 'education');
  const command = { type: 'build', company, wage: 2, cardId: game.players.capitalist.hand[0].id };
  const confirm = staff => applyCommand(game, 'capitalist', { ...command, staff }, true);
  assert.throws(() => confirm([working[0], null]), /填滿全部工位/);
  assert.throws(() => confirm([working[0], middle]), /同一階級/);
  assert.throws(() => confirm([working[0], working[0]]), /不可重複/);
  assert.throws(() => confirm([working[0], skilled]), /優先使用/);
  assert.equal(game.economy.companies[company], undefined);
  assert.equal(game.players.capitalist.revenue, 120);
  const chosen = [...working].reverse();
  confirm(chosen);
  assert.deepEqual(game.economy.companies[company].slots.map(slot => slot.worker), chosen);
  assert(chosen.every(id => game.economy.workers[id].committed));
});

test('a middle-class company can staff its operator and a selected unemployed employee', () => {
  const game = createGame();
  applyCommand(game, 'working', { type: 'start' }, true);
  game.turn = 1;
  const company = 'company-middle-convenience-store';
  game.economy.markets.middle = [company];
  const workers = Object.values(game.economy.workers);
  const operator = workers.find(worker => worker.role === 'middle' && worker.skill === 'food' && !workplace(game.economy, worker.id));
  const employee = workers.find(worker => worker.role === 'working' && worker.skill === 'any' && !workplace(game.economy, worker.id));
  const employed = workers.find(worker => worker.role === 'working' && workplace(game.economy, worker.id));
  const command = { type: 'build', company, wage: 2, cardId: game.players.middle.hand[0].id };
  assert.throws(() => applyCommand(game, 'middle', { ...command, staff: [null, employee.id] }, true), /必要工位/);
  assert.throws(() => applyCommand(game, 'middle', { ...command, staff: [operator.id, employed.id] }, true), /待業區/);
  applyCommand(game, 'middle', { ...command, staff: [operator.id, employee.id] }, true);
  assert.deepEqual(game.economy.companies[company].slots.map(slot => slot.worker), [operator.id, employee.id]);
});

test('IMF closes the expanded sector and taxes retain the wage-time labor section', () => {
  const game = createGame({ full: false });
  game.policies = ['B', 'A', 'C', 'C', 'B', 'C', 'C'];
  resizePublicSector(game);
  assert(playerView(game, 'state').economy.publicStorageCapacity.health > 12);
  game.economy.loans.state = 2;
  game.treasury = 0;
  game.bills = [{ role: 'working', policy: 4, target: 'A' }];
  game.legitimacy = { working: 7, middle: 4, capitalist: 3 };
  game.publicServices.education = 16;
  const imf = checkIMF(game);
  assert.equal(imf.intervened, true);
  assert.equal(imf.closed.length, 3);
  assert.equal(imf.paid, 60);
  assert.equal(game.economy.loans.state, 0);
  assert.equal(game.publicServices.education, 12);
  assert.equal(game.bills.length, 0);
  assert.equal(game.players.working.influence, 2);
  assert.deepEqual(game.legitimacy, { working: 4, middle: 2, capitalist: 2 });
  assert.deepEqual(game.policies, ['C', 'C', 'A', 'B', 'C', 'B', 'B']);
  assert(Object.values(game.economy.companies).every(item => item.wage === 1));
  const taxes = payTaxes(game, 'A');
  assert.equal(taxes.workingIncome, 21);
  assert.equal(taxes.middleIncome, 14);
  assert.equal(taxes.multiplier, 5);
  assert.equal(game.treasury, taxes.total);
});

test('treasury can repay enough debt to avoid IMF', () => {
  const game = createGame();
  game.economy.loans.state = 1;
  assert.deepEqual(checkIMF(game), { intervened: false, repaid: 1 });
  assert.equal(game.treasury, 65);
  assert.equal(game.economy.loans.state, 0);
  assert.equal(game.policies[1], 'B');
});

test('final scores repay non-capitalist loans in units of five and retain fixed capitalist penalties', () => {
  const game = createGame();
  game.match.round = 5;
  game.players.middle.cash = 38;
  game.economy.loans.middle = 1;
  game.economy.loans.capitalist = 2;
  finalScore(game);
  const middle = game.match.final.results.find(row => row.role === 'middle');
  const capitalist = game.match.final.results.find(row => row.role === 'capitalist');
  assert.equal(middle.repaid, 35);
  assert.equal(middle.penalty, 4);
  assert.equal(game.players.middle.cash, 3);
  assert.equal(capitalist.penalty, 10);
  assert.equal(capitalist.repaid, 0);
});

test('host adjustment updates cash, living resources, warehouses and public storage', () => {
  const game = createGame({ full: false });
  game.phase = 'action';
  game.testMode = true;
  const adjust = (target, command) => applyCommand(game, 'capitalist', { type: 'host-adjust', target, ...command }, true);
  adjust('capitalist', {
    cash: 123, revenue: 45, capital: 6, living: { food: 2, influence: 4 },
    inventory: { food: 5, luxury: 7 }, storageUnits: { food: 3, luxury: 2 },
  });
  assert.equal(game.players.capitalist.cash, 123);
  assert.equal(game.players.capitalist.revenue, 45);
  assert.equal(game.players.capitalist.capital, 6);
  assert.equal(game.players.capitalist.food, 2);
  assert.equal(game.players.capitalist.influence, 4);
  assert.equal(game.economy.inventory.capitalist.food, 5);
  assert.equal(game.economy.inventory.capitalist.luxury, 7);
  assert.equal(storageCapacity(game.economy, 'capitalist', 'food'), 24);
  assert.equal(storageCapacity(game.economy, 'capitalist', 'luxury'), 24);
  assert.equal(economyView(game.economy).storageUnits.capitalist.food, 3);

  adjust('capitalist', { prices: { food: 15, luxury: 5 } });
  assert.equal(game.economy.domesticPrices.capitalist.food, 15);
  assert.equal(marketQuote(game, 'capitalist', 'food').price, 15);
  assert.equal(marketQuote(game, 'capitalist', 'luxury').price, 5);

  adjust('state', { treasury: 77, living: { influence: 3 }, public: { food: 6, influence: 2 } });
  assert.equal(game.treasury, 77);
  assert.equal(game.players.state.influence, 3);
  assert.equal(game.publicServices.food, 6);
  assert.equal(game.publicServices.influence, 2);
  assert.equal(publicCapacity(game.economy, 'food'), 6);
  assert.throws(() => adjust('state', { treasury: 1, public: { food: 7 } }), /超過容量上限 6/);
  assert.equal(game.treasury, 77);
  assert.equal(game.publicServices.food, 6);
  assert.throws(() => adjust('state', { publicCapacity: { food: 9 } }), /自動計算/);

  adjust('working', { cash: 8, living: { health: 2 } });
  assert.equal(game.players.working.cash, 8);
  assert.equal(game.players.working.health, 2);

  assert.throws(() => adjust('working', { inventory: { food: 1 } }), /商業倉庫/);
  assert.throws(() => adjust('middle', { storageUnits: { food: 0 } }), /1 以上/);
  assert.throws(() => adjust('middle', { cash: -1 }), /0 以上/);
  assert.throws(() => adjust('capitalist', { prices: { food: 1 } }), /圖板上的售價/);
  assert.throws(() => adjust('working', { prices: { food: 15 } }), /只有中產與資本家/);
  assert.throws(() => adjust('nobody', { cash: 1 }), /請選擇要調整的階級/);
});

test('test-room policy edits update public companies, capacity, wages, and market quotes', () => {
  const game = createGame({ full: false });
  game.phase = 'action';
  game.testMode = true;
  const countPublic = () => playerView(game, 'state').economy.companies.filter(item => item.owner === 'state').length;
  const changePolicy = (fiscal, labor, trade) => {
    const policies = [...game.policies];
    policies[0] = fiscal;
    policies[1] = labor;
    policies[5] = trade;
    applyCommand(game, 'working', { type: 'host-adjust', target: 'policy', policies }, true);
  };
  const originalTreasury = game.treasury;
  const originalCapacity = publicCapacity(game.economy, 'health');
  changePolicy('A', 'A', 'C');
  assert.equal(countPublic(), 9);
  assert(publicCapacity(game.economy, 'health') > originalCapacity);
  assert.equal(marketQuote(game, 'foreign', 'food').tariff, 0);
  assert(playerView(game, 'state').economy.companies.filter(item => item.wages).every(item => item.wage === 3));
  game.publicServices.health = publicCapacity(game.economy, 'health');
  game.economy.publicCapacityOverride = { health: 99 };
  assert.equal(publicCapacity(game.economy, 'health'), game.publicServices.health);
  changePolicy('C', 'C', 'A');
  assert.equal(countPublic(), 3);
  assert.equal(game.publicServices.health, originalCapacity);
  assert.equal(game.treasury, originalTreasury);
});

test('host adjustment overwrites the voting bag atomically within limits', () => {
  const game = createGame({ full: false });
  game.phase = 'action';
  game.testMode = true;
  const adjust = command => applyCommand(game, 'working', { type: 'host-adjust', target: 'policy', ...command }, true);
  adjust({ bag: { working: 3, middle: 4, capitalist: 5 } });
  assert.deepEqual(game.bag, { working: 3, middle: 4, capitalist: 5 });
  assert.throws(() => adjust({ bag: { working: 6, middle: 26 } }), /不可超過 25/);
  assert.deepEqual(game.bag, { working: 3, middle: 4, capitalist: 5 });
  assert.throws(() => adjust({ bag: { foreign: 1 } }), /未知階級/);
});

test('host adjustment sets state benefits without touching treasury or public stock', () => {
  const game = createGame({ full: false });
  game.phase = 'action';
  game.testMode = true;
  game.content = { benefits: { working: {}, middle: {}, capitalist: {} } };
  const treasury = game.treasury;
  const publicFood = game.publicServices.food;
  const adjust = command => applyCommand(game, 'state', { type: 'host-adjust', target: 'state', ...command }, true);
  adjust({ benefits: { working: { cash: 5, votes: 2 }, capitalist: { food: 3, influence: 1 } } });
  assert.deepEqual(game.content.benefits.working, { cash: 5, votes: 2 });
  assert.deepEqual(game.content.benefits.capitalist, { food: 3, influence: 1 });
  assert.equal(game.treasury, treasury);
  assert.equal(game.publicServices.food, publicFood);
  assert.throws(() => adjust({ benefits: { working: { unknown: 1 } } }), /未知項目/);
  assert.throws(() => adjust({ benefits: { arbeiter: { cash: 1 } } }), /未知階級/);
  assert.throws(() => applyCommand(game, 'working', { type: 'host-adjust', target: 'working', benefits: { working: { cash: 1 } } }, true), /公共政策/);
});

test('test-room policy and trade edits update the public cards without duplicating deck copies', () => {
  const game = createGame();
  applyCommand(game, 'working', { type: 'start' }, true);
  game.testMode = true;
  const adjust = (target, fields) => applyCommand(game, 'working', { type: 'host-adjust', target, ...fields }, true);
  const event = game.content.eventDeck[0];
  const nextEvent = game.content.eventDeck.find(id => !(catalogCard(id).minimumRound > 1));
  const oldEvent = game.content.events[0];
  adjust('policy', { bag: { middle: 12 }, events: [nextEvent], benefits: { middle: { food: 3 } } });
  assert.equal(game.bag.middle, 12);
  assert.equal(game.content.benefits.middle.food, 3);
  assert.equal(playerView(game, 'middle').content.events[0].id, nextEvent);
  assert(!game.content.eventDeck.includes(nextEvent));
  assert(game.content.eventDeck.includes(oldEvent));
  if (event !== nextEvent) assert(game.content.eventDeck.includes(event));
  assert.throws(() => adjust('policy', { events: [nextEvent, nextEvent] }), /超過牌組張數/);

  const [deal] = game.content.dealDeck;
  const exported = game.content.exportDeck[0];
  adjust('trade', { deals: [deal, deal], export: exported });
  assert.deepEqual(playerView(game, 'working').content.deals.map(card => card.id), [deal, deal]);
  assert.equal(playerView(game, 'working').content.export.id, exported);
  assert(!game.content.dealDeck.includes(deal));
  assert(!game.content.exportDeck.includes(exported));
  adjust('trade', { deals: [], export: null });
  assert.equal(game.content.dealDeck.filter(id => id === deal).length, 2);
  assert(game.content.exportDeck.includes(exported));
  assert.equal(game.content.export, null);
});
