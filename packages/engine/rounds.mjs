import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import { activeCompany, addWorker, availableInfluence, credit, funds, operational, operationalCount, outsideEmployers, pay, publicCapacity, resizePublicSector, finishCompanyProduction, productionOrder, productionPlans, runProductionStep, setWagePolicy, storageCapacity, workerSupply } from './companies.mjs';
import { catalogCard, drawImmigrant } from './content.mjs';
import { marketPrices, marketQuote } from './prices.mjs';
import { requireRule } from './errors.mjs';
import { resolveProposal } from './proposals.mjs';

const roles = base.turn_order;
const classes = roles.slice(0, 3);
const skills = ['health', 'education', 'luxury', 'food', 'influence'];
const agendas = ['CBABC', 'ACBCA', 'BCABA', 'CAACB', 'ABCBC'];
const exportCards = [
  [[2, 20, 6, 55], [4, 30, 8, 55], [3, 25, 5, 40], [3, 15, 7, 35]],
  [[3, 30, 7, 70], [4, 30, 6, 40], [3, 20, 5, 35], [2, 15, 6, 35]],
  [[4, 50, 8, 95], [3, 20, 5, 30], [3, 15, 7, 35], [2, 15, 6, 40]],
  [[3, 35, 7, 80], [3, 15, 5, 25], [4, 20, 8, 40], [2, 15, 6, 45]],
  [[4, 45, 7, 80], [3, 20, 5, 30], [2, 15, 6, 40], [3, 20, 7, 50]],
];
const products = ['food', 'luxury', 'health', 'education'];
const middleProsperity = [0, 1, 2, 3, 4, 5, 5, 6, 6, 7, 7];
const preferences = { working: 'A', middle: 'B', capitalist: 'C' };

export function createMatch() {
  return { round: 1, needs: null, history: [], resourceSales: {}, welfare: { given: {}, taken: {} }, wealth: 0, middleProsperity: 0, immigrationIndex: 0, final: null };
}

export function population(game, role) {
  if (!game.match) return 3;
  const count = Object.values(game.economy.workers).filter(worker => worker.role === role).length;
  return Math.min(10, Math.max(3, Math.floor(count / 3)));
}

export function taxMultiplier(game) {
  if (game.testTaxMultiplier != null) return game.testTaxMultiplier;
  const tax = game.policies[2];
  const { tax_multiplier_base: rate, tax_multiplier_welfare_factor: factor, welfare_modifier: welfare } = base.policies;
  return rate[tax] + factor[tax] * (welfare[game.policies[3]] + welfare[game.policies[4]]);
}

export function supplyInfluence(game, role, quantity) {
  game.players[role].influence += Math.min(quantity, availableInfluence(game));
}

export function stateElectionInfluence(game) {
  if (!game.match) return;
  const lowest = Math.min(...Object.values(game.legitimacy));
  supplyInfluence(game, 'state', Math.floor(lowest / 2));
}

export function openNeeds(game) {
  game.phase = 'needs';
  game.match.needs = { role: 'middle', labor: game.policies[1], meals: [], taxes: null, imf: null };
  game.log.push(`第 ${game.match.round} 輪進入食物需求結算。`);
}

export function beginProduction(game) {
  game.economy.production = [];
  if (!game.match) return;
  const capacity = Object.fromEntries(roles.map(role => [role, productionCapacity(game.economy, role)]));
  const personal = Object.fromEntries(classes.map(role => [role, Object.fromEntries(
    [...products, 'influence'].map(resource => [resource, game.players[role][resource] ?? 0]))]));
  const warehouse = {
    middle: { ...game.economy.inventory.middle },
    capitalist: { ...game.economy.inventory.capitalist },
    state: { ...game.publicServices },
  };
  game.match.productionOpening = { personal, warehouse, capacity };
  game.match.pendingWorkingWages = 0;
  game.match.wagePayments = [];
  game.match.wageLoans = Object.fromEntries(roles.map(role => [role, 0]));
}

export function settleProductionStep(game, role, stage) {
  const before = game.economy.loans[role];
  runProductionStep(game, role, stage);
  if (role === 'working' && stage === 'wages' && game.match?.pendingWorkingWages !== undefined) {
    credit(game, role, game.match.pendingWorkingWages);
    delete game.match.pendingWorkingWages;
  }
  if (game.match && stage === 'wages') game.match.wageLoans[role] += game.economy.loans[role] - before;
}

export function completeProduction(game) {
  const strikes = Object.values(game.economy.companies).filter(item => item.strike && item.wage !== 3 && operational(item)).length;
  finishCompanyProduction(game);
  supplyInfluence(game, 'working', strikes + (game.economy.unions?.length ?? 0));
}

export function produceRound(game, pending) {
  if (!pending) beginProduction(game);
  const start = pending ? productionOrder.indexOf(pending.role) : 0;
  for (const [index, role] of productionOrder.slice(start).entries()) {
    if (index > 0 || pending?.stage !== 'goods') settleProductionStep(game, role, 'wages');
    settleProductionStep(game, role, 'goods');
  }
  completeProduction(game);
}

export function foodOptions(game, role = game.match?.needs?.role) {
  if (!role) return null;
  const own = game.players[role].food + (role === 'middle' ? game.economy.inventory.middle.food : 0);
  const required = population(game, role);
  const importQuote = marketQuote(game, 'foreign', 'food');
  const sources = ['middle', 'capitalist', ...(game.publicServices.food > 0 ? ['state'] : [])]
    .filter(seller => seller !== role).map(seller => [seller, marketQuote(game, seller, 'food')]);
  return {
    role, required, own: Math.min(own, required), shortage: Math.max(0, required - own),
    sellers: Object.fromEntries(sources),
    importPrice: importQuote.price, tariff: importQuote.tariff,
  };
}

export function quoteFood(game, role, quantities, personalFood) {
  const options = foodOptions(game);
  requireRule(options?.role === role, '目前由另一個階級結算食物。');
  requireRule(quantities && typeof quantities === 'object' && !Array.isArray(quantities), '請提供各供應者的購買量。');
  const personalStock = game.players[role].food;
  const warehouseStock = role === 'middle' ? game.economy.inventory.middle.food : 0;
  const fromPersonal = personalFood === undefined ? Math.min(personalStock, options.own) : personalFood;
  const fromWarehouse = options.own - fromPersonal;
  requireRule(Number.isInteger(fromPersonal) && fromPersonal >= 0 && fromPersonal <= personalStock
    && fromWarehouse >= 0 && fromWarehouse <= warehouseStock, '請依庫存分配自有食物，並先用足自有食物。');
  let purchased = 0;
  let localCost = 0;
  for (const [seller, amount] of Object.entries(quantities)) {
    requireRule(Object.hasOwn(options.sellers, seller) && Number.isInteger(amount) && amount >= 0 && amount <= options.sellers[seller].stock, '購買量超出可用庫存。');
    purchased += amount;
    localCost += amount * options.sellers[seller].price;
  }
  requireRule(purchased <= options.shortage, '只能購買本輪需要的食物。');
  const imported = options.shortage - purchased;
  const cost = localCost + imported * options.importPrice;
  const loans = Math.max(0, Math.ceil((cost - funds(game, role)) / base.loans.principal));
  return { own: options.own, fromPersonal, fromWarehouse, purchased, imported, tariffs: imported * options.tariff, cost, loans };
}

export function coverNeeds(game, role, quantities, personalFood) {
  const quote = quoteFood(game, role, quantities, personalFood);
  const { fromPersonal, fromWarehouse, cost, tariffs } = quote;
  const loansBefore = game.economy.loans[role];
  pay(game, role, cost, true);
  game.players[role].food -= fromPersonal;
  if (role === 'middle') game.economy.inventory.middle.food -= fromWarehouse;
  const sales = {};
  for (const [seller, amount] of Object.entries(quantities)) {
    const stock = seller === 'state' ? game.publicServices : game.economy.inventory[seller];
    stock.food -= amount;
    sales[seller] = amount * marketQuote(game, seller, 'food').price;
    credit(game, seller, sales[seller]);
    recordResourceSale(game, seller, 'food', amount);
  }
  credit(game, 'state', tariffs);
  game.match.needs.meals.push({ role, ...quote, sales, loans: game.economy.loans[role] - loansBefore });
  game.match.needs.role = role === 'middle' ? 'working' : null;
}

// 福利：given 是國家發放到各階級福利區的量，taken 是各階級實際領走的量。每輪重新累計。
export function recordWelfare(game, kind, role, resource, amount) {
  if (!game.match?.welfare || !amount) return;
  const side = game.match.welfare[kind][role] ??= {};
  side[resource] = (side[resource] ?? 0) + amount;
}

export function recordResourceSale(game, seller, resource, amount) {
  if (!game.match?.resourceSales || !amount) return;
  const sales = game.match.resourceSales[seller] ??= {};
  sales[resource] = (sales[resource] ?? 0) + amount;
}

export function checkIMF(game, defer = false) {
  const { loans } = game.economy;
  const threshold = base.policies.fiscal[game.policies[0]].imf_loan_threshold_inclusive;
  if (loans.state < threshold) return null;
  const price = base.loans.endgame_repay_non_capitalist;
  const required = loans.state - threshold + 1;
  if (funds(game, 'state') >= required * price) {
    pay(game, 'state', required * price);
    loans.state -= required;
    game.log.push(`國庫償還 ${required} 筆貸款，避免 IMF 介入。`);
    return { intervened: false, repaid: required };
  }
  for (const bill of game.bills) supplyInfluence(game, bill.role, 1);
  const canceledBills = game.bills.length;
  for (const bill of game.bills) resolveProposal(game, bill, 'canceled');
  game.bills = [];
  for (const [policy, section] of Object.entries(base.imf.forced_policies)) game.policies[Number(policy) - 1] = section;
  setWagePolicy(game, base.imf.forced_wage_level);
  if (defer) return { intervened: true, canceledBills, closed: [] };
  const closed = resizePublicSector(game);
  return finishIMF(game, { canceledBills, closed });
}

export function finishIMF(game, { canceledBills, closed }) {
  const loans = game.economy.loans;
  const price = base.loans.endgame_repay_non_capitalist;
  const cleared = loans.state;
  const paid = Math.min(funds(game, 'state'), cleared * price);
  pay(game, 'state', paid);
  loans.state = 0;
  for (const role of classes) game.legitimacy[role] = Math.ceil(game.legitimacy[role] / 2);
  game.log.push(`IMF 介入，取消 ${canceledBills} 項待決法案，國庫支付 $${paid}。`);
  return { intervened: true, canceledBills, closed, paid, cleared };
}

export function createTaxSettlement(game, labor) {
  return { labor, taxation: game.policies[2], multiplier: taxMultiplier(game), employment: 0, corporate: 0,
    middleIncome: 0, middleEmployment: 0, workingIncome: 0, total: 0,
    loans: Object.fromEntries(roles.map(role => [role, 0])) };
}

export function payTaxStep(game, role, taxes) {
  const { economy } = game;
  const { labor, taxation, multiplier } = taxes;
  const unit = base.income_tax.rows_labor_columns_taxation[labor][taxation];
  const before = economy.loans[role];
  let amount;
  let calculation;
  if (role === 'capitalist') {
    const companies = operationalCount(economy, role);
    taxes.employment = companies * multiplier;
    pay(game, role, taxes.employment, true);
    const revenue = game.players[role].revenue;
    const bracket = base.corporate_tax.brackets.find(row => revenue >= row.min && (row.max === null || revenue <= row.max));
    taxes.corporate = bracket[taxation] ?? 0;
    amount = taxes.corporate;
    calculation = { companies, revenue, bracket: { min: bracket.min, max: bracket.max } };
    taxes.total += taxes.employment;
    credit(game, 'state', taxes.employment);
  } else if (role === 'middle') {
    const employers = outsideEmployers(economy, role);
    const companies = operationalCount(economy, role);
    taxes.middleIncome = employers * unit;
    taxes.middleEmployment = companies * multiplier;
    calculation = { employers, companies };
    amount = taxes.middleIncome + taxes.middleEmployment;
  } else {
    const people = population(game, role);
    taxes.workingIncome = people * unit;
    calculation = { people };
    amount = taxes.workingIncome;
  }
  pay(game, role, amount, true);
  credit(game, 'state', amount);
  taxes.total += amount;
  taxes.loans[role] = economy.loans[role] - before;
  return { ...calculation, unit };
}

export function payTaxes(game, labor) {
  const taxes = createTaxSettlement(game, labor);
  for (const role of productionOrder.slice(1)) payTaxStep(game, role, taxes);
  return taxes;
}

export function repayLoan(game, role) {
  requireRule(game.match && game.economy.loans[role] > 0, '沒有可以償還的貸款。');
  const amount = base.loans.free_action_repay;
  requireRule(funds(game, role) >= amount, '資金不足以償還貸款。');
  pay(game, role, amount, false, role === 'capitalist');
  game.economy.loans[role]--;
}

export function exportOffers(game, role) {
  if (!game.match || !['middle', 'capitalist', 'state'].includes(role)) return [];
  if (game.content?.export === null) return [];
  if (game.content?.export) return catalogCard(game.content.export).offers.map(({ resource, quantity, money }, id) => ({
    id, resource, quantity, price: money, available: ((role === 'state' ? game.publicServices : game.economy.inventory[role])[resource] ?? 0)
      + (role === 'capitalist' ? (game.economy.tradeZone[resource] ?? 0) : 0) >= quantity,
  })).filter(offer => role !== 'state' || ['food', 'luxury'].includes(offer.resource));
  if (role === 'state') return [];
  return exportCards[game.match.round - 1].flatMap(([small, smallPrice, large, largePrice], index) => {
    const resource = products[index];
    const count = game.economy.inventory[role][resource] + (role === 'capitalist' ? (game.economy.tradeZone[resource] ?? 0) : 0);
    return [[small, smallPrice], [large, largePrice]].map(([quantity, price], row) => ({
      id: index * 2 + row, resource, quantity, price, available: count >= quantity,
    }));
  });
}

export function exportGoods(game, role, ids, allowed, repeats = 1) {
  const offers = exportOffers(game, role);
  requireRule(Array.isArray(ids) && ids.length > 0 && ids.length <= offers.length * repeats
    && ids.every(id => ids.filter(item => item === id).length <= repeats), '出口交易次數無效。');
  const inventory = role === 'state' ? game.publicServices : game.economy.inventory[role];
  const zone = game.economy.tradeZone;
  let proceeds = 0;
  for (const id of ids) {
    const offer = offers.find(item => item.id === id);
    requireRule(offer && (!allowed || allowed.includes(offer.resource)), '出口交易無效。');
    const { resource, quantity, price } = offer;
    const fromZone = role === 'capitalist' ? Math.min(zone[resource] ?? 0, quantity) : 0;
    requireRule(inventory[resource] >= quantity - fromZone, '選取的交易合計超過庫存。');
    if (fromZone) zone[resource] -= fromZone;
    inventory[resource] -= quantity - fromZone;
    proceeds += price;
  }
  credit(game, role, proceeds);
  if (role === 'middle') game.players.middle.vp += ids.length;
  game.log.push(`${{ middle: '中產', capitalist: '資本家', state: '國家' }[role]}完成 ${ids.length} 筆出口，取得 ${proceeds}。`);
}

function agenda(game) {
  if (game.content?.agenda) return Object.values(catalogCard(game.content.agenda).targets);
  return [...agendas[game.match.round - 1]];
}

export function matches(game, role) {
  const target = role === 'state' ? agenda(game) : Array(5).fill(preferences[role]);
  return target.filter((section, index) => game.policies[index] === section).length;
}

export function gainMiddleProsperity(game) {
  const { match } = game;
  match.middleProsperity = Math.min(match.middleProsperity + 1, middleProsperity.length - 1);
  const points = middleProsperity[match.middleProsperity];
  game.players.middle.vp += points;
  return points;
}

function productionCapacity(economy, role) {
  return Object.fromEntries([...products, 'influence'].map(resource => {
    if (role === 'state') return [resource, publicCapacity(economy, resource)];
    if (role === 'working' || resource === 'influence') return [resource, null];
    const trade = role === 'capitalist' ? base.limits.free_trade_zone_capacity[resource] ?? 0 : 0;
    return [resource, storageCapacity(economy, role, resource) + trade];
  }));
}

function remainingResources({ economy, players, publicServices }) {
  return Object.fromEntries(roles.map(role => {
    const stock = role === 'state' ? publicServices : economy.inventory[role];
    const personal = role === 'state' ? {} : players[role];
    const trade = role === 'capitalist' ? economy.tradeZone : {};
    return [role, Object.fromEntries([...products, 'influence'].map(resource =>
      [resource, (stock?.[resource] ?? 0) + (personal[resource] ?? 0) + (trade[resource] ?? 0)]))];
  }));
}

export function scoreRound(game) {
  const { economy, match, players } = game;
  const fullyStaffed = Object.values(economy.companies).filter(item => activeCompany(economy, item.id).owner === 'middle'
    && item.slots.every(slot => slot.worker)).length;
  let middle = 0;
  if (middleProsperity[match.middleProsperity] < fullyStaffed) {
    middle = gainMiddleProsperity(game);
  }
  const owner = players.capitalist;
  owner.capital += owner.revenue;
  owner.revenue = 0;
  const band = base.wealth.thresholds.findLastIndex(amount => owner.capital >= amount);
  const wealthBonus = Math.max(0, band - match.wealth) * base.wealth.bonus_per_new_high_space;
  const capitalist = base.wealth.vp[band] + wealthBonus;
  match.wealth = Math.max(match.wealth, band);
  const legitimacy = Object.values(game.legitimacy).sort((a, b) => a - b).slice(0, 2).reduce((sum, value) => sum + value, 0);
  for (const role of classes) game.legitimacy[role] = Math.min(10, Math.ceil(game.legitimacy[role] / 2) + (game.content?.legitimacyTokens[role] ?? 0));
  const agendaPoints = matches(game, 'state');
  const points = { working: 2 * (economy.unions?.length ?? 0), middle, capitalist, state: legitimacy + agendaPoints };
  players.working.vp += points.working;
  players.capitalist.vp += points.capitalist;
  players.state.vp += points.state;
  const loans = Object.fromEntries(roles.map(role => [role, {
    wages: match.wageLoans?.[role],
    taxes: match.needs.taxes?.loans?.[role],
    outstanding: economy.loans[role],
    nextInterest: match.round < base.rounds ? economy.loans[role] * base.loans.preparation_interest : null,
  }]));
  const imf = match.needs.imf?.repaid
    ? { ...match.needs.imf, paid: match.needs.imf.repaid * base.loans.endgame_repay_non_capitalist }
    : match.needs.imf;
  match.history.push({ round: match.round, ...match.needs, imf, production: economy.production,
    productionOpening: match.productionOpening, remainingResources: remainingResources(game), resourceSales: match.resourceSales, welfare: match.welfare,
    loans, points, wealthBonus, legitimacy, agendaPoints });
  game.log.push(`第 ${match.round} 輪計分完成。`);
  game.phase = 'scoring';
}

export function beginPreparation(game) {
  const { match, economy } = game;
  match.round++;
  game.phase = 'market';
  match.needs = null;
  delete match.wageLoans;
  delete match.productionOpening;
  match.resourceSales = {};
  match.welfare = { given: {}, taken: {} };
  economy.production = null;
  game.turn = 0;
  game.mainUsed = false;
  game.freeUsed = false;
  for (const role of roles) {
    const interest = economy.loans[role] * base.loans.preparation_interest;
    if (interest) pay(game, role, interest, true, role === 'capitalist');
  }
  match.workingProsperity = Math.max(0, (match.workingProsperity ?? 0) - 1);
  match.middleProsperity = Math.max(0, match.middleProsperity - 2);
  game.log.push(`第 ${match.round} 輪進入準備階段，貸款利息與繁榮調整已結算。`);
}

export function prepareWorkers(game, middleSkill = skills[(game.match.round - 2) % skills.length]) {
  const { match, economy } = game;
  const immigration = base.policies.immigration_extra_each_class[game.policies[6]];
  economy.workerArrivals = [];
  for (const role of ['working', 'middle']) {
    economy.workerArrivals.push([role, 'any'], [role, role === 'working' ? 'any' : middleSkill]);
    for (let draw = 0; draw < immigration; draw++) {
      if (game.content) {
        economy.workerArrivals.push([role, drawImmigrant(game, role)]);
        continue;
      }
      const index = match.immigrationIndex++ % 25;
      const skill = index < 10 ? (role === 'working' ? skills[Math.floor(index / 2)] : 'any')
        : (role === 'middle' ? skills[Math.floor((index - 10) / 3)] : 'any');
      economy.workerArrivals.push([role, skill]);
    }
  }
}

export function advanceWorkerArrivals(game, replacement) {
  const { economy } = game;
  while (economy.workerArrivals.length) {
    const [role, requested] = economy.workerArrivals[0];
    if (workerSupply(economy, role, requested) <= 0 && workerSupply(economy, role, 'any') <= 0) {
      const options = skills.filter(skill => workerSupply(economy, role, skill) > 0);
      if (options.length && replacement === undefined) return { role, options };
      requireRule(!options.length || options.includes(replacement), '請選擇仍有供應的替代技術工。');
    }
    addWorker(economy, role, requested, replacement);
    replacement = undefined;
    economy.workerArrivals.shift();
  }
  delete economy.workerArrivals;
  return null;
}

function inventoryScore(stock, extra = {}) {
  return products.reduce((sum, resource) => sum + Math.floor(((stock[resource] ?? 0) + (extra[resource] ?? 0)) / (resource === 'food' ? 2 : 3)), 0);
}

export function finalScore(game) {
  const { economy, players, match } = game;
  const results = roles.map(role => {
    const loanCount = economy.loans[role];
    let repaid = 0;
    let penalty = loanCount * base.loans.capitalist_endgame_penalty_per_loan;
    if (role !== 'capitalist') {
      const outstanding = loanCount * base.loans.endgame_repay_non_capitalist;
      repaid = Math.min(outstanding, Math.floor(funds(game, role) / 5) * 5);
      pay(game, role, repaid);
      penalty = (outstanding - repaid) / 5;
      economy.loans[role] = 0;
    }
    const policyMatches = matches(game, role);
    const policy = base.end_policy_vp_by_match_count[role]?.[policyMatches] ?? 0;
    const money = role === 'working' ? Math.min(15, Math.floor(players[role].cash / 10))
      : role === 'middle' ? Math.floor(players[role].cash / 15) : role === 'state' ? Math.floor(game.treasury / 30) : 0;
    const inventory = role === 'state' ? inventoryScore(game.publicServices) + Math.floor(game.publicServices.influence / 3)
      : role === 'working' ? 0 : inventoryScore(economy.inventory[role], role === 'capitalist' ? economy.tradeZone : {});
    const before = players[role].vp;
    players[role].vp += policy + money + inventory - penalty;
    return { role, before, policy, money, inventory, penalty, repaid, total: players[role].vp, policyMatches, votingCubes: game.bag[role] ?? 0 };
  });
  results.sort((a, b) => b.total - a.total || b.policyMatches - a.policyMatches || Number(b.role === 'state') - Number(a.role === 'state') || b.votingCubes - a.votingCubes);
  const first = results[0];
  const winners = results.filter(result => result.total === first.total && result.policyMatches === first.policyMatches
    && (result.role === first.role || (first.role !== 'state' && result.role !== 'state' && result.votingCubes === first.votingCubes)));
  match.final = { results, winners: winners.map(result => result.role) };
  game.phase = 'complete';
  game.log.push('第五輪與終局計分完成。');
}

function recoverOpeningPersonal(game, row) {
  return Object.fromEntries(['working', 'middle'].map(seat => {
    const player = game.players[seat];
    const meal = row.meals.find(item => item.role === seat);
    const personal = Object.fromEntries(['luxury', 'health', 'education'].map(resource => [resource, player[resource] ?? 0]));
    if (meal && seat === 'working' && Array.isArray(row.production)) {
      const produced = row.production.filter(item => item.owner === seat && item.resource === 'food')
        .reduce((sum, item) => sum + item.stored, 0);
      const openingFood = player.food + meal.own - produced;
      if (openingFood >= 0) personal.food = openingFood;
    } else if (meal && seat === 'middle' && (player.food > 0 || meal.own === 0)) {
      personal.food = player.food + meal.own;
    }
    return [seat, personal];
  }));
}

function recoverFoodSales(meals) {
  const sales = {};
  for (const meal of meals) {
    const sellers = Object.keys(meal.sales ?? {}).filter(seller => meal.sales[seller] > 0);
    if (sellers.length === 1 && meal.purchased > 0) {
      const [seller] = sellers;
      sales[seller] = (sales[seller] ?? 0) + meal.purchased;
    }
  }
  return sales;
}

function recoverOpeningWarehouse(game, row) {
  if (!Array.isArray(row.production)) return {};
  return Object.fromEntries(['middle', 'capitalist'].map(seat => [seat, Object.fromEntries(
    ['luxury', 'health', 'education'].flatMap(resource => {
      if (seat === 'capitalist' && game.economy.tradeZone[resource] > 0) return [];
      const stored = row.production.filter(item => item.owner === seat && item.resource === resource)
        .reduce((sum, item) => sum + item.stored, 0);
      const opening = game.economy.inventory[seat][resource] - stored;
      return opening >= 0 ? [[resource, opening]] : [];
    }))]));
}

export function matchView(game, role) {
  const match = game.match;
  if (!match) return null;
  const { history, final, wealth, middleProsperity: prosperity } = match;
  const round = match.round + Number(legacyPreparation(game));
  const prices = marketPrices(game);
  const atRoundEnd = ['scoring', 'complete'].includes(game.phase);
  return { round, history: history.map(row => ({
    ...row,
    productionOpening: row.round === match.round && atRoundEnd ? {
      capacity: Object.fromEntries(['working', 'middle', 'capitalist'].map(seat => [seat, productionCapacity(game.economy, seat)])),
      personal: row.productionOpening?.personal ?? recoverOpeningPersonal(game, row),
      warehouse: row.productionOpening?.warehouse ?? recoverOpeningWarehouse(game, row),
      ...row.productionOpening,
    } : row.productionOpening,
    remainingResources: row.remainingResources ?? (row.round === match.round && atRoundEnd
      ? remainingResources(game) : undefined),
    meals: row.meals.filter(meal => meal.role === role),
    recordedFoodSales: row.resourceSales ? undefined : recoverFoodSales(row.meals),
    foodSettlement: Object.fromEntries(row.meals.map(({ role, own, purchased, imported, cost }) =>
      [role, { own, purchased, imported, cost }])),
  })),
    final, wealth, workingProsperity: match.workingProsperity ?? 0,
    middleProsperity: middleProsperity[prosperity], middleProsperityIndex: prosperity, agenda: agenda(game),
    prices, importPrices: { food: prices.foreign.food.price, luxury: prices.foreign.luxury.price },
    populations: { working: population(game, 'working'), middle: population(game, 'middle') },
    needs: game.phase === 'needs' && match.needs?.role === role ? foodOptions(game) : null,
    productionStep: productionStepView(game, role),
    // 本輪已發出、付給自己的薪資；勞工的薪資要到自己確認發薪才入帳，這裡另附累計的待入帳金額。
    wagePayments: (match.wagePayments ?? []).filter(item => item.recipient === role),
    pendingWorkingWages: role === 'working' ? match.pendingWorkingWages : undefined,
    needsRole: game.phase === 'needs' ? match.needs?.role : null,
    roundPhase: roundPhase(game), electionsHeld: match.needs?.electionsHeld ?? null,
    settlement: settlementOverview(game, role), exports: exportOffers(game, role) };
}

export function legacyPreparation(game) {
  return game.phase === 'market' && game.match.history.at(-1)?.round === game.match.round;
}

function productionStepView(game, role) {
  const step = game.match.productionStep;
  if (game.phase !== 'production-confirm' || !step) return null;
  if (step.role !== role) return step;
  if (step.stage === 'wages' && role === 'working') {
    const companies = game.economy.production.filter(row => row.recipient === role && row.wage > 0)
      .map(({ company, owner, resource, wage }) => ({ company, owner, resource, wage }));
    return { ...step, companies, income: companies.reduce((sum, item) => sum + item.wage, 0),
      pendingIncome: game.match.pendingWorkingWages ?? 0 };
  }
  if (step.stage === 'wages' || step.stage === 'goods') {
    const companies = productionPlans(game, role).map(({ definition, wage, recipient, produced }) =>
      ({ company: definition.name, resource: definition.resource, wage, recipient, produced }));
    if (step.stage === 'goods') return { ...step, companies };
    const due = companies.reduce((sum, item) => sum + item.wage, 0);
    const loans = Math.max(0, Math.ceil((due - funds(game, role)) / base.loans.principal));
    return { ...step, companies, due, loans };
  }
  if (step.stage === 'taxes' && role !== 'state') {
    const projected = structuredClone(game);
    projected.settlementEstimate = true;
    const taxes = projected.match.needs.taxes;
    const before = taxes.total;
    const calculation = payTaxStep(projected, role, taxes);
    const { labor, taxation, multiplier, employment, corporate, middleIncome, middleEmployment, workingIncome } = taxes;
    return { ...step, due: taxes.total - before, loans: taxes.loans[role],
      taxDetails: { ...calculation, labor, taxation, multiplier, employment, corporate, middleIncome, middleEmployment, workingIncome } };
  }
  return step;
}

function roundPhase(game) {
  switch (game.phase) {
    case 'lobby': return null;
    case 'market': case 'worker-arrival': return 'preparation';
    case 'production-confirm': case 'needs': case 'demonstration': return 'production';
    case 'policy-choice': return { imf: 'production', election: 'elections' }[game.policyChoice.resume] ?? 'action';
    case 'election': return game.election.immediate ? 'action' : 'elections';
    case 'vote-confirmation': return game.voteConfirmation.immediate ? 'action' : 'elections';
    case 'event-penalty': case 'scoring': return 'scoring';
    case 'complete': return 'endgame';
    default: return 'action';
  }
}

function wageOverview(production, role, startingCash) {
  let available = startingCash;
  let gap = 0;
  let outgoing = 0;
  let incoming = 0;
  for (const row of production ?? []) {
    if (row.owner === role) {
      outgoing += row.wage;
      if (available !== undefined) {
        available -= row.wage;
        gap = Math.max(gap, -available);
      }
    }
    if (row.recipient === role) {
      incoming += row.wage;
      if (available !== undefined) available += row.wage;
    }
  }
  return { outgoing, incoming, gap: startingCash === undefined ? null : gap };
}

function settlementOverview(game, role) {
  if (['lobby', 'market'].includes(game.phase) || !game.economy) return null;
  const required = ['working', 'middle'].includes(role) ? population(game, role) : 0;
  const usage = required ? ['health', 'education', 'luxury'].map(resource => {
    const stock = game.players[role][resource] ?? 0;
    const warehouse = role === 'middle' ? game.economy.inventory.middle[resource] : 0;
    return { resource, required, stock, warehouse, shortage: Math.max(0, required - stock) };
  }) : [];
  const cash = funds(game, role);
  const interest = game.economy.loans[role] * base.loans.preparation_interest;
  const step = game.match.productionStep;
  const producing = step?.stage === 'wages' || step?.stage === 'goods';
  const beforeProduction = !game.match.needs && (!game.economy.production || producing);
  const awaitingTax = step?.stage === 'taxes';
  const awaitingIMF = game.policyChoice?.resume === 'imf';
  const pendingFood = game.match.needs?.role;
  const estimate = !game.match.needs || Boolean(pendingFood) || awaitingIMF || step?.stage === 'imf' || awaitingTax;
  const projected = estimate ? structuredClone(game) : game;
  if (estimate) projected.settlementEstimate = true;
  if (!game.match.needs) {
    if (beforeProduction) produceRound(projected, producing ? step : undefined);
    openNeeds(projected);
  }
  let food;
  const existing = game.match.needs?.meals.find(meal => meal.role === role);
  if (existing) food = { required, ...existing, shortage: 0, settled: true };
  while (estimate && projected.match.needs.role) {
    const eater = projected.match.needs.role;
    const transaction = eater === role && game.transaction?.kind === 'food-loan' && game.transaction.role === eater ? game.transaction : null;
    const quantities = transaction?.quantities ?? {};
    if (eater === role) {
      const { own, shortage } = foodOptions(projected);
      const quote = quoteFood(projected, role, quantities, transaction?.fromPersonal);
      food = { required, own, shortage, cost: quote.cost, gap: Math.max(0, quote.cost - funds(projected, role)),
        settled: false, currentShortage: beforeProduction ? foodOptions(game, role).shortage : null };
    }
    coverNeeds(projected, eater, quantities, transaction?.fromPersonal);
  }
  if (awaitingIMF) {
    const imf = projected.match.needs.imf;
    finishIMF(projected, { ...imf, closed: imf.closed.length ? imf.closed : resizePublicSector(projected) });
  } else if (estimate && !awaitingTax) checkIMF(projected);
  const beforeTax = funds(projected, role);
  let taxes = game.match.needs?.taxes;
  if (awaitingTax) {
    taxes = projected.match.needs.taxes;
    const start = Math.max(1, productionOrder.indexOf(step.role));
    for (const seat of productionOrder.slice(start)) payTaxStep(projected, seat, taxes);
  } else if (estimate) taxes = payTaxes(projected, projected.match.needs.labor);
  const taxByRole = {
    working: taxes?.workingIncome,
    middle: (taxes?.middleIncome ?? 0) + (taxes?.middleEmployment ?? 0),
    capitalist: (taxes?.employment ?? 0) + (taxes?.corporate ?? 0),
    state: 0,
  };
  const taxDue = taxByRole[role] ?? 0;
  const wages = wageOverview(projected.economy.production, role, beforeProduction && !producing ? cash : undefined);
  const meals = projected.match.needs.meals;
  const foodSales = meals.reduce((sum, meal) => sum + (meal.sales?.[role] ?? 0), 0);
  const tariffs = role === 'state' ? meals.reduce((sum, meal) => sum + meal.tariffs, 0) : 0;
  const taxIncome = role === 'state' ? taxes?.total ?? 0 : 0;
  const salesIncomplete = role !== 'working' && meals.some(meal => meal.role !== role && meal.purchased > 0 && !meal.sales);
  return {
    stage: beforeProduction ? 'forecast' : estimate ? 'food' : 'settled', usage, food,
    production: projected.economy.production?.filter(row => row.owner === role),
    wages, income: { wages: wages.incoming, foodSales, tariffs, taxes: taxIncome,
      taxByRole: role === 'state' ? taxByRole : undefined,
      wageDetails: ['working', 'middle'].includes(role) ? (projected.economy.production ?? [])
        .filter(row => row.recipient === role && row.wage > 0)
        .map(({ company, resource, wage }) => ({ company, resource, wage })) : undefined,
      total: wages.incoming + foodSales + tariffs + taxIncome, salesIncomplete },
    tax: { due: taxDue, income: taxIncome,
      gap: estimate && (!awaitingTax || productionOrder.indexOf(role) >= productionOrder.indexOf(step.role))
        ? Math.max(0, taxDue - beforeTax) : null },
    interest: game.match.round < base.rounds ? { due: interest, gap: Math.max(0, interest - cash) } : null,
  };
}
