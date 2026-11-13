import { randomInt, randomUUID } from 'node:crypto';
import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import { activeCompany, addWorker, adjustWages, assign, build, canStaffInvestment, companyAction, companyDefinition, createEconomy, credit, demonstrationStatus, economyView, fillRequiredHires, funds, hirePublicCompany, makeFarm, operational,
  operationalCount, outsideEmployers, ownedCompanies, pay, produceCompany, refreshMarket, replacePublicCompany, sellCompany,
  productionOrder, productionPlans, publicHiringChoices, publicSectorChoices, resizePublicSector, setWagePolicy, syncPublicStorage, unionMember, updateUnions, workerSupply, workplace } from './companies.mjs';
import { cardDefinition, cardView, createDecks, fillHand } from './cards.mjs';
import { catalogCard, createRoundContent, eventDraw, revealStateContent, revealTradeContent } from './content.mjs';
import { adjustLegitimacy, choosePenalty, completeIndustry, eventPenalties, eventView, legitimacyToken, provide, resolveEvent, takeBenefits, transferPersonalBenefit } from './events.mjs';
import { businessDeal, buyGoods, sellToState, specialExport } from './trade.mjs';
import { GameError, requireRule } from './errors.mjs';
import { adjustPrices, domesticPriceLevels, marketQuote } from './prices.mjs';
import { advanceWorkerArrivals, beginPreparation, beginProduction, checkIMF, completeProduction, coverNeeds, createMatch, createTaxSettlement, exportGoods, exportOffers, finalScore, finishIMF, gainMiddleProsperity,
  legacyPreparation, matches, matchView, openNeeds, payTaxStep, population, prepareWorkers, produceRound, quoteFood, recordResourceSale, repayLoan, scoreRound, settleProductionStep,
  stateElectionInfluence, supplyInfluence, taxMultiplier } from './rounds.mjs';

export { GameError } from './errors.mjs';

export const roles = base.turn_order;
const classes = roles.slice(0, 3);
export const names = { working: '勞工', middle: '中產', capitalist: '資本家', state: '國家' };
export const policies = ['財政', '勞動市場', '稅制', '醫療福利', '教育福利', '對外貿易', '移民'];
const sections = ['A', 'B', 'C'];
const workerSkills = ['food', 'luxury', 'health', 'education', 'influence'];

export function createGame({ full = true } = {}) {
  const content = full ? createRoundContent() : null;
  return {
    phase: 'lobby', turn: 0, mainUsed: false, freeUsed: false,
    economy: createEconomy(content),
    match: createMatch(),
    decks: createDecks(full), content,
    policies: [...base.setup.policies], bills: [], election: null, lastVote: null,
    treasury: base.setup.treasury,
    publicServices: { ...base.setup.public_resources },
    legitimacy: Object.fromEntries(classes.map(role => [role, 2])),
    bag: { ...base.setup.voting_bag },
    players: Object.fromEntries(roles.map(role => [role, {
      hand: [], vp: 0, influence: base.setup.personal_influence_each_role,
      cash: base.setup.cash[role] ?? 0, revenue: role === 'capitalist' ? base.setup.cash.capitalist_revenue : 0,
      capital: 0, food: 0, education: 0, luxury: 0,
    }])),
    log: [],
  };
}

function log(game, message) {
  game.log.push(message);
}

function currentRole(game) {
  return game.phase === 'action' ? roles[game.turn % roles.length] : null;
}

function addCubes(game, role, count) {
  // The reference tutorial shows 17 in supply and 8 in the opening bag.
  const held = game.election?.drawn?.filter(cube => cube === role).length ?? 0;
  const revealed = game.content?.cardChoice?.drawn?.filter(cube => cube === role).length ?? 0;
  game.bag[role] += Math.max(0, Math.min(count, 25 - game.bag[role] - held - revealed - (game.content?.benefits[role]?.votes ?? 0)));
}

function refill(game) {
  const economy = game.economy;
  const capitalist = economy ? Math.ceil(operationalCount(economy, 'capitalist') / 2) : 2;
  const middlePopulation = Math.ceil(population(game, 'middle') / 2);
  const middle = economy ? Math.max(middlePopulation, Math.ceil(operationalCount(economy, 'middle') / 2)) : 2;
  addCubes(game, 'working', Math.ceil(population(game, 'working') / 2));
  addCubes(game, 'middle', middle);
  addCubes(game, 'capitalist', capitalist);
}

function bagTotal(game) {
  return classes.reduce((sum, role) => sum + game.bag[role], 0);
}

function drawCubes(game, drawn, count = 5, replenish = true) {
  while (drawn.length < count) {
    if (replenish && !classes.some(role => game.bag[role])) {
      refill(game);
      refill(game);
    }
    const total = bagTotal(game);
    if (!total) break;
    let index = randomInt(total);
    for (const role of classes) {
      if (index < game.bag[role]) {
        game.bag[role]--;
        drawn.push(role);
        break;
      }
      index -= game.bag[role];
    }
  }
  return drawn;
}

function drawElectionCubes(game, drawn = [], previousDraw) {
  const before = bagTotal(game);
  const alreadyDrawn = drawn.length;
  drawCubes(game, drawn);
  const added = bagTotal(game) + drawn.length - alreadyDrawn - before;
  const bagDraw = previousDraw ? { before: previousDraw.before, added: previousDraw.added + added }
    : alreadyDrawn === 0 ? { before, added } : undefined;
  return { drawn, bagDraw };
}

export function openElection(game, bill, immediate) {
  game.phase = 'election';
  if (!immediate && game.match?.needs) game.match.needs.electionsHeld = true;
  game.election = { id: randomUUID(), bill, immediate, sides: { [bill.role]: 'for' }, drawn: [], bids: {} };
  if (bill.role !== 'state' && game.players.state.influence === 0) {
    game.election.sides.state = 'absent';
  }
  log(game, `開始表決 ${policies[bill.policy]} ${bill.target}。`);
}

function nextScheduledElection(game) {
  const [bill] = [...game.bills].sort((a, b) => a.policy - b.policy);
  if (bill) openElection(game, bill, false);
  else if (game.match) {
    if (eventPenalties(game)) {
      game.phase = 'event-penalty';
      return;
    }
    scoreRound(game);
    if (game.match.round === base.rounds) finalScore(game);
  }
  else {
    game.phase = 'complete';
    log(game, '政治試玩結束。');
  }
}

export function settleElection(game) {
  const { bill, immediate, sides, drawn, bids } = game.election;
  const contribution = Object.fromEntries(roles.map(role => [role, bids[role] ?? 0]));
  for (const role of drawn) contribution[role]++;
  const total = side => roles.filter(role => sides[role] === side)
    .reduce((sum, role) => sum + contribution[role], 0);
  const favor = total('for');
  const against = total('against');
  const passed = favor >= against;
  const loser = passed ? 'against' : 'for';
  const returned = drawn.filter(role => sides[role] === loser);
  for (const role of returned) game.bag[role]++;
  for (const role of roles) game.players[role].influence -= bids[role] ?? 0;
  game.lastVote = { id: game.election.id, bill, sides, drawn, bids, favor, against, passed,
    bag: { ...game.election.bagDraw, returned: returned.length, removed: drawn.length - returned.length, remaining: bagTotal(game) } };
  (game.voteResults ??= []).push(game.lastVote);
  game.bills = game.bills.filter(item => item.policy !== bill.policy);
  game.election = null;
  game.voteConfirmation = { immediate, confirmed: [] };
  game.phase = 'vote-confirmation';
  log(game, `${policies[bill.policy]} ${bill.target} ${passed ? '通過' : '未通過'}（${favor} 比 ${against}）。`);
}

function confirmVoteResult(game, role, command) {
  const { id, bill, passed, sides, drawn, bids } = game.lastVote;
  const { immediate, confirmed } = game.voteConfirmation;
  requireRule(command.type === 'confirm-vote' && command.electionId === id && roles.includes(role), '等待四席確認表決結果。');
  if (!confirmed.includes(role)) confirmed.push(role);
  if (confirmed.length < roles.length) return;

  game.voteConfirmation = null;
  if (passed) {
    game.policies[bill.policy] = bill.target;
    game.players[bill.role].vp += 3;
    for (const seat of roles) {
      if (seat !== bill.role && sides[seat] === 'for' && (drawn.includes(seat) || bids[seat] > 0)) game.players[seat].vp++;
    }
  }
  const resume = immediate ? 'immediate' : 'election';
  if (passed && startPolicyChoices(game, [bill.policy], resume)) return;
  resumePolicy(game, resume);
}

function resumePolicy(game, resume) {
  updateUnions(game.economy);
  if (resume === 'imf') {
    game.match.needs.imf = finishIMF(game, game.match.needs.imf);
    startTaxSettlement(game);
    return;
  }
  if (resume === 'action') {
    game.phase = 'action';
    return;
  }
  const immediate = resume === 'immediate';
  const queued = immediate && game.content?.immediateBills?.shift();
  if (queued) openElection(game, queued, true);
  else if (immediate) game.phase = 'action';
  else nextScheduledElection(game);
}

function startPolicyChoices(game, changed, resume) {
  const steps = [];
  if (changed.includes(0) && publicSectorChoices(game).count) steps.push({ kind: 'public', role: 'state' });
  if (changed.includes(1) && resume !== 'imf') {
    setWagePolicy(game);
    for (const role of ['middle', 'capitalist', 'state']) {
      if (ownedCompanies(game.economy, role).some(item => item.wages)) steps.push({ kind: 'wages', role });
    }
  }
  const resources = [...(changed.includes(3) ? ['health'] : []), ...(changed.includes(4) ? ['education'] : []),
    ...(changed.includes(5) ? ['food', 'luxury'] : [])];
  if (resources.length) for (const role of ['middle', 'capitalist']) steps.push({ kind: 'prices', role, resources });
  if (!steps.length) return false;
  game.policyChoice = { steps, resume };
  game.phase = 'policy-choice';
  return true;
}

function policyChoiceView(game) {
  const step = game.policyChoice?.steps[0];
  if (!step) return null;
  if (step.kind === 'public') return { ...step, ...publicSectorChoices(game) };
  if (step.kind === 'hire') return { ...step, options: step.companies.flatMap(id => {
    const company = game.economy.companies[id];
    return publicHiringChoices(game.economy, company).map(choice => [id, choice.role, activeCompany(game.economy, id).name, choice.slots]);
  }) };
  return step;
}

function finishPolicyChoice(game, role, command) {
  const choice = policyChoiceView(game);
  requireRule(command.type === 'policy-choice' && choice?.role === role, '等待指定席位確認政策調整。');
  const { steps, resume } = game.policyChoice;
  if (choice.kind === 'public') {
    const closed = resizePublicSector(game, command.companies);
    if (resume === 'imf') game.match.needs.imf.closed = closed;
    steps.shift();
    if (choice.opening) steps.unshift({ kind: 'hire', role, companies: command.companies });
  } else if (choice.kind === 'hire') {
    requireRule(choice.options.some(([id, seat]) => id === command.company && seat === command.hire), '請選擇可滿員的企業及工人階級。');
    hirePublicCompany(game.economy, game.economy.companies[command.company], command.hire, command.staff);
    choice.companies.splice(choice.companies.indexOf(command.company), 1);
  } else {
    if (choice.kind === 'wages' && command.changes?.length) adjustWages(game, role, command.changes, true);
    if (choice.kind === 'prices' && Object.keys(command.prices ?? {}).length) {
      requireRule(Object.keys(command.prices).every(resource => choice.resources.includes(resource)), '只能調整受本次政策影響的售價。');
      adjustPrices(game, role, command.prices);
    }
    steps.shift();
  }
  if (steps[0]?.kind === 'hire' && !policyChoiceView(game).options.length) steps.shift();
  if (!steps.length) {
    game.policyChoice = null;
    resumePolicy(game, resume);
  }
}

function availablePolicies(game, role, nonAdjacent = false, ignoreMarkers = false) {
  if (!ignoreMarkers && game.bills.filter(bill => bill.role === role).length >= 3) return [];
  return game.policies.flatMap((active, policy) => {
    if ((!game.match && policy < 2) || game.bills.some(bill => bill.policy === policy)) return [];
    return sections.filter(target => target !== active && (nonAdjacent || Math.abs(sections.indexOf(active) - sections.indexOf(target)) === 1))
      .map(target => ({ policy, target }));
  });
}

function propose(game, role, command, waiveCost, nonAdjacent = false) {
  const { policy, target, immediate } = command;
  requireRule(availablePolicies(game, role, nonAdjacent).some(choice => choice.policy === policy && choice.target === target), '此政策目前不可提案。');
  requireRule(typeof immediate === 'boolean', '請選擇投票時機。');
  const bill = { role, policy, target };
  if (immediate && !waiveCost) {
    requireRule(game.players[role].influence > 0, '即時投票需要 1 影響力。');
    game.players[role].influence--;
  }
  game.bills.push(bill);
  log(game, `${names[role]}提出${policies[policy]} ${target}。`);
  if (immediate) openElection(game, bill, true);
  return bill;
}

function spend(game, role, cost, capitalFirst = false) {
  requireRule(funds(game, role) >= cost, '資金不足。');
  pay(game, role, cost, false, capitalFirst);
}

function collectCompany(game, id, owner, isOperational) {
  const economy = game.economy;
  const item = typeof id === 'string' && Object.hasOwn(economy.companies, id) && economy.companies[id];
  requireRule(item && activeCompany(economy, id).owner === owner && (isOperational === undefined || operational(item) === isOperational), '請選擇符合條件的企業。');
  return item;
}

function strike(game, ids, limit = 2) {
  requireRule(Array.isArray(ids) && new Set(ids).size === ids.length && ids.length >= 1 && ids.length <= limit, '罷工企業數量不符。');
  requireRule(ids.length + Object.values(game.economy.companies).filter(item => item.strike).length <= 7, '罷工標記不足。');
  for (const id of ids) {
    const item = game.economy.companies[id];
    requireRule(item?.slots?.some(slot => game.economy.workers[slot.worker]?.role === 'working') && item.wage !== 3
      && activeCompany(game.economy, id).owner !== 'working' && !item.strike
      && !item.slots.some(slot => game.economy.workers[slot.worker]?.committed), '此企業不能罷工。');
    item.strike = true;
  }
}

function storageChoices(economy, role) {
  const storage = economy?.storage;
  const allocated = (storage?.middle?.length ?? 0) + (storage?.capitalist?.length ?? 0);
  if (allocated >= base.components.storage_tiles) return [];
  return Object.keys(base.limits[`${role}_storage`] ?? {}).filter(resource => !storage?.[role]?.includes(resource));
}

function purchasableStorage(economy, role) {
  if (role !== 'capitalist' || !economy) return [];
  const owned = ownedCompanies(economy, role);
  return storageChoices(economy, role).filter(resource => owned.some(company => company.resource === resource));
}

function addStorage(game, role, resource, paid = true) {
  requireRule(storageChoices(game.economy, role).includes(resource), '此資源已擴充或沒有可用的倉庫板塊。');
  if (paid) {
    requireRule(purchasableStorage(game.economy, role).includes(resource), '只能為資本家旗下企業可生產的資源購買倉庫。');
    spend(game, role, 20);
  }
  const storage = game.economy.storage ??= { middle: [], capitalist: [] };
  storage[role].push(resource);
}

function availableWorkerSkill(skill) {
  return workerSkills.includes(skill);
}

function educationOptions(game, role) {
  if (!classes.slice(0, 2).includes(role) || !game.match) return null;
  const { economy, players } = game;
  const own = Object.values(economy.workers).filter(worker => worker.role === role);
  const skills = workerSkills.filter(skill => workerSupply(economy, role, skill) > 0);
  const workers = own.flatMap(worker => {
    if (unionMember(economy, worker.id)) return [];
    const company = workplace(economy, worker.id);
    const slot = company?.slots.find(slot => slot.worker === worker.id);
    if ((slot && slot.skill !== 'any') || (role === 'middle' && company && worker.skill !== 'any')) return [];
    const choices = skills.filter(skill => worker.skill !== skill);
    return choices.length ? [{ id: worker.id, skills: choices }] : [];
  });
  return { cost: population(game, role), stock: players[role].education ?? 0, workers };
}

function useEducation(game, role, command) {
  const options = educationOptions(game, role);
  requireRule(options, '只有勞工與中產可使用教育。');
  requireRule(options.stock >= options.cost, `生活資源區需要 ${options.cost} 份教育。`);
  requireRule(options.workers.find(worker => worker.id === command.worker)?.skills.includes(command.skill),
    '請選擇可受訓的己方工人和仍有供應的不同技能。');
  game.players[role].education -= options.cost;
  game.economy.workers[command.worker].skill = command.skill;
  const points = increaseProsperity(game, role);
  log(game, `${names[role]}使用 ${options.cost} 份教育，訓練一名工人並獲得 ${points} VP。`);
}

function increaseProsperity(game, role) {
  if (role === 'middle') return gainMiddleProsperity(game);
  const points = Math.min(10, (game.match.workingProsperity ?? 0) + 1);
  game.match.workingProsperity = points;
  game.players.working.vp += points;
  return points;
}

function useLivingResource(game, role, resource, skill) {
  requireRule(['working', 'middle'].includes(role), '只有勞工與中產可以使用生活資源。');
  const cost = population(game, role);
  const player = game.players[role];
  requireRule((player[resource] ?? 0) >= cost, `生活資源區至少需要 ${cost} 份資源。`);
  if (resource === 'health') {
    addWorker(game.economy, role, 'any', skill);
    player.vp += 2;
  }
  player[resource] -= cost;
  increaseProsperity(game, role);
  log(game, `${names[role]}${resource === 'health' ? '使用醫療' : '使用奢侈品'}。`);
}

function swapWorkers(game, role, swaps) {
  requireRule(['working', 'middle'].includes(role) && Array.isArray(swaps) && swaps.length, '請選擇要交換的己方工人。');
  const { economy } = game;
  for (const swap of swaps) {
    const { employed, idle } = swap ?? {};
    const worker = economy.workers[employed];
    const replacement = economy.workers[idle];
    const slot = workplace(economy, employed)?.slots.find(item => item.worker === employed);
    requireRule(worker?.role === role && worker.skill !== 'any' && slot?.skill === 'any'
      && replacement?.role === role && !replacement.committed && !workplace(economy, idle), '只能用待業工人交換在非技術工位的己方技術工。');
    replacement.committed = worker.committed;
    worker.committed = false;
    slot.worker = idle;
  }
}

function extraShiftCompany(game, role, company) {
  const item = collectCompany(game, company, role, true);
  const operators = item.slots.filter(slot => !slot.optional).map(slot => game.economy.workers[slot.worker]);
  requireRule(operators.every(worker => !worker.committed), '加班企業的中產工人必須尚未承諾。');
  const employee = game.economy.workers[item.slots.find(slot => slot.optional)?.worker];
  const operatorOnly = employee?.committed || Boolean(item.strike && item.wage !== 3);
  produceCompany(game, company, false, operatorOnly);
  for (const worker of operators) worker.committed = true;
  if (employee && !operatorOnly) employee.committed = true;
  return item;
}

function extraShift(game, role, company) {
  requireRule(role === 'middle', '只有中產可執行加班基本行動。');
  extraShiftCompany(game, role, company);
  log(game, `中產在${activeCompany(game.economy, company).name}加班生產。`);
}

function extraTax(game, recipients) {
  const lowest = classes.map(role => game.legitimacy[role]).sort((a, b) => a - b).slice(0, 2);
  requireRule(Array.isArray(recipients) && recipients.length === 2 && new Set(recipients).size === 2
    && recipients.every(role => classes.includes(role))
    && recipients.map(role => game.legitimacy[role]).sort((a, b) => a - b).every((value, index) => value > 1 && value === lowest[index]),
  '請選擇合法性最低且可下降的兩個階級。');
  for (const role of classes) pay(game, role, 10, true);
  credit(game, 'state', 30);
  for (const role of recipients) adjustLegitimacy(game, role, -1);
}

function workMoves(game, role, moves, { unemployed = false, employeeOnly = false, owner, limit = 3, preserveUncommitted = false } = {}) {
  if (!moves?.length) return;
  requireRule(Array.isArray(moves) && moves.every(move => (!unemployed || !workplace(game.economy, move.worker))
    && (!employeeOnly || game.economy.companies[move.company]?.slots?.[move.slot]?.optional)
    && (!owner || activeCompany(game.economy, move.company).owner === owner)), '工人來源或目的地不符。');
  assign(game.economy, role, moves, limit, { preserveUncommitted });
}

const investmentAdjustment = role => role === 'middle' ? 8 : 10;

function investmentDeckQuotes(game, role, ids = game.economy.companyDecks?.[role] ?? []) {
  const limit = role === 'capitalist' ? base.limits.capitalist_companies : base.limits.middle_companies;
  const atLimit = ownedCompanies(game.economy, role).length >= limit;
  const money = funds(game, role);
  return ids.map(id => {
    const item = companyDefinition(id);
    const actualCost = item.cost + investmentAdjustment(role);
    const blocked = actualCost > money ? '資金不足' : atLimit ? '已達企業上限'
      : canStaffInvestment(game.economy, role, id) ? '' : '無法填滿必要工位';
    return { ...item, actualCost, blocked };
  });
}

function openCardChoice(game, role, effect, details) {
  game.content.cardChoice = { role, effect, ...details };
  game.phase = 'card-choice';
}

function finishCardChoice(game, role, command) {
  const { content } = game;
  const choice = content.cardChoice;
  requireRule(command.type === 'card-choice' && role === choice.role, '等待出牌者完成選擇。');
  content.cardChoice = null;
  game.phase = 'action';
  switch (choice.effect) {
    case 'fake-news': {
      const removed = command.indices;
      requireRule(Array.isArray(removed) && removed.length <= 4 && new Set(removed).size === removed.length
        && removed.every(index => Number.isInteger(index) && index >= 0 && index < choice.drawn.length), '最多移除四個不同方塊。');
      choice.drawn.forEach((cube, index) => { if (!removed.includes(index)) game.bag[cube]++; });
      break;
    }
    case 'poll':
      requireRule(typeof command.immediate === 'boolean', '請選擇投票時機。');
      if (command.immediate) {
        openElection(game, choice.bill, true);
        game.election.drawn = choice.drawn;
        game.election.bagDraw = choice.bagDraw;
      } else for (const cube of choice.drawn) game.bag[cube]++;
      break;
    case 'export-insight':
      requireRule(choice.options.includes(command.option), '請選擇其中一張出口牌。');
      content.export = command.option;
      const mustExport = role === 'middle' && exportOffers(game, role).some(offer => offer.available);
      requireRule(!mustExport || command.offers?.length, '請至少選擇一筆可出口的交易。');
      if (command.offers?.length) exportGoods(game, role, command.offers, undefined, role === 'middle' ? 2 : 1);
      break;
    case 'investment-build':
      if (command.option === 'cancel-investment') {
        requireRule(investmentDeckQuotes(game, role, choice.options).every(item => item.blocked), '仍有可建造的企業。');
        const discard = game.decks[role].discard;
        const usedCard = discard.at(-1);
        requireRule(usedCard && cardDefinition(role, usedCard).effect === choice.effect, '找不到可退回的投資機會卡。');
        game.players[role].hand.push(discard.pop());
        game.mainUsed = false;
        log(game, `${names[role]}無法從牌庫建造，收回「投資機會」。`);
        break;
      }
      requireRule(choice.options.includes(command.company), '請選擇企業牌庫內的企業。');
      build(game, role, command, { fromDeck: true, discount: -investmentAdjustment(role) });
      break;
    case 'shift-event': case 'priority-event':
      if (choice.effect === 'shift-event' && command.option === 'cancel-shift-focus') {
        requireRule(!content.events.length, '場上仍有可替換的事件。');
        const discard = game.decks[role].discard;
        const usedCard = discard.at(-1);
        requireRule(usedCard && cardDefinition(role, usedCard).effect === choice.effect, '找不到可退回的轉移重點卡。');
        game.players[role].hand.push(discard.pop());
        game.mainUsed = false;
        log(game, '國家因場上沒有事件，收回「轉移重點」。');
        break;
      }
      if (command.option) {
        requireRule(choice.options.includes(command.option), '請選擇剛看到的事件。');
        if (choice.effect === 'shift-event') {
          requireRule(content.events.includes(command.replaced), '請選擇要替換的事件。');
          content.events = content.events.filter(id => id !== command.replaced);
        }
        requireRule(content.events.length < 2, '場上沒有事件空位。');
        content.eventDeck = content.eventDeck.filter(id => id !== command.option);
        content.events.push(command.option);
      }
      requireRule(command.eventId !== 'event-civil-unrest' || availablePolicies(game, 'state').length, '國家目前無法提出法案。');
      resolveEvent(game, command);
      break;
  }
}

function extendedCard(game, role, command, definition) {
  const { economy, players } = game;
  const { effect } = definition;
  const { quantity, recipient, company, skill } = command;
  const toState = resource => sellToState(game, role, resource, quantity, role === 'middle' || resource === 'luxury' ? 6 : 9);
  const transfer = (from, to, amount, mandatory = false) => { pay(game, from, amount, mandatory); credit(game, to, amount); };
  const employer = id => activeCompany(economy, id).owner;
  switch (effect) {
    case 'fake-news':
      requireRule(Object.values(game.bag).some(Boolean), '投票袋目前沒有方塊。');
      openCardChoice(game, role, effect, { drawn: drawCubes(game, [], 6, false) });
      return;
    case 'interest-groups': {
      requireRule(classes.reduce((sum, seat) => sum + (seat === role ? 0 : game.bag[seat]), 0) >= 3, '袋內沒有足夠的其他階級方塊。');
      const drawn = [];
      let replaced = 0;
      while (replaced < 3) {
        drawCubes(game, drawn, drawn.length + 1, false);
        if (drawn.at(-1) !== role) replaced++;
      }
      for (const cube of drawn) if (cube === role) game.bag[role]++;
      addCubes(game, role, replaced);
      return;
    }
    case 'poll': {
      const bill = propose(game, role, { ...command, immediate: false }, false);
      openCardChoice(game, role, effect, { bill, ...drawElectionCubes(game) });
      return;
    }
    case 'export-insight': {
      const next = game.content.exportDeck.splice(0, role === 'middle' ? 1 : 2);
      requireRule(next.length, '出口牌庫已空。');
      openCardChoice(game, role, effect, { options: [game.content.export, ...next].filter(Boolean) });
      return;
    }
    case 'shift-event': case 'priority-event':
      requireRule(effect !== 'shift-event' || game.content.events.length, '場上沒有事件，無法使用「轉移重點」。');
      requireRule(game.content.events.length || game.content.eventDeck.length, '沒有可處理的事件。');
      openCardChoice(game, role, effect, { options: eventDraw(game, 2, true) });
      return;
    case 'nationalize': {
      const removed = collectCompany(game, command.replaced, 'state', false);
      const acquired = collectCompany(game, company, 'capitalist', false);
      const item = companyDefinition(company);
      requireRule(!item.machineryBonus && !item.automated, '不可國有化印有機械符號的企業。');
      if (game.policies[0] === 'B') transfer('state', 'capitalist', item.cost, true);
      replacePublicCompany(economy, removed.id, company);
      delete economy.companies[removed.id];
      acquired.owner = 'state';
      const staff = Array.isArray(command.staff) ? command.staff : [];
      const moves = staff.map((worker, slot) => worker ? { worker, company, slot } : null).filter(Boolean);
      if (moves.length) {
        requireRule(['working', 'middle'].includes(command.hire), '請選擇要指派的工人階級。');
        requireRule(moves.every(move => move.company === company), '只能指派工人到剛國有化的企業。');
        assign(economy, command.hire, moves, 3, {
          allowSource: source => !source || activeCompany(economy, source.id).owner === 'state',
        });
      }
      syncPublicStorage(game);
      return;
    }
    case 'privatize': {
      const item = collectCompany(game, company, 'state', true);
      requireRule(ownedCompanies(economy, 'capitalist').length < base.limits.capitalist_companies, '資本家已達企業上限。');
      transfer('capitalist', 'state', companyDefinition(company).cost, true);
      item.owner = 'capitalist';
      adjustLegitimacy(game, 'capitalist', 1);
      syncPublicStorage(game);
      return;
    }
    case 'health-bill': case 'immigration-bill': {
      const policy = effect === 'health-bill' ? 3 : 6;
      requireRule(command.policy === policy, '此卡只能提出指定政策。');
      propose(game, role, command, false);
      addCubes(game, role, 2);
      return;
    }
    case 'radical':
      requireRule(command.immediate !== true, '激進改革不能立即表決，只能留到輪末選舉。');
      propose(game, role, { ...command, immediate: false }, false, true);
      return;
    case 'two-bills': {
      requireRule(Array.isArray(command.proposals) && command.proposals.length === 2, '請選擇兩項不同政策。');
      if (role === 'capitalist') spend(game, role, 25);
      const immediate = [];
      for (const proposal of command.proposals) {
        requireRule(proposal && typeof proposal.immediate === 'boolean', '請選擇兩案的表決時機。');
        const bill = propose(game, role, { ...proposal, immediate: false }, false);
        if (proposal.immediate) immediate.push(bill);
      }
      requireRule(players[role].influence >= immediate.length, '個人影響力不足以立即表決。');
      players[role].influence -= immediate.length;
      if (immediate.length) {
        openElection(game, immediate.shift(), true);
        game.content.immediateBills = immediate;
      }
      return;
    }
    case 'migration': {
      const idle = Object.values(economy.workers).filter(worker => worker.role === role && !worker.committed && !workplace(economy, worker.id));
      const ids = command.workers;
      requireRule(idle.length >= 4 && Array.isArray(ids) && ids.length >= 1 && ids.length <= 2 && new Set(ids).size === ids.length && ids.every(id => idle.some(worker => worker.id === id)), '至少四名待業者，須選一至兩名移出。');
      for (const id of ids) {
        credit(game, role, economy.workers[id].skill === 'any' ? 5 : 10);
        delete economy.workers[id];
      }
      return;
    }
    case 'accident': {
      requireRule(['middle', 'capitalist', 'state'].includes(recipient) && availableWorkerSkill(command.resource), '請選階級與產業。');
      const count = ownedCompanies(economy, recipient).filter(item => item.resource === command.resource
        && economy.companies[item.id].slots.some(slot => economy.workers[slot.worker]?.role === role)).length;
      transfer(recipient, role, count * 8, true);
      return;
    }
    case 'specialize': {
      requireRule(availableWorkerSkill(skill), '請選技術工的技能。');
      const newWorker = addWorker(economy, 'working', skill, command.replacement);
      const requested = command.moves ?? [];
      requireRule(Array.isArray(requested) && requested.every(move => move?.worker), '請選擇要指派的工人。');
      const moves = requested.map(move => {
        if (move.worker !== 'specialization-new-worker') return move;
        requireRule(newWorker, '供應區無法新增工人，請移除新工人的指派。');
        return { ...move, worker: newWorker };
      });
      workMoves(game, 'working', moves, role === 'middle'
        ? { unemployed: true, employeeOnly: true, owner: 'middle' } : {});
      return;
    }
    case 'farm': makeFarm(game, command.workers); return;
    case 'deregulate': workMoves(game, role, command.moves, { unemployed: game.policies[1] === 'B', limit: 48, preserveUncommitted: true }); return;
    case 'signing':
      workMoves(game, role, command.moves, { unemployed: true, limit: 4 });
      for (const move of command.moves ?? []) if (employer(move.company) !== 'working') transfer(employer(move.company), role, 4, true);
      return;
    case 'general-strike': strike(game, command.companies, Math.min(7, 2 + (economy.unions?.length ?? 0))); return;
    case 'income': case 'unemployment': {
      const target = role === 'state' ? recipient : role;
      requireRule(['middle', 'working'].includes(target), '請選擇勞工或中產。');
      const count = Object.values(economy.workers).filter(worker => {
        if (worker.role !== target) return false;
        const firm = workplace(economy, worker.id);
        if (effect === 'unemployment') return !firm && !unionMember(economy, worker.id);
        if (!firm) return unionMember(economy, worker.id);
        return role !== 'middle' || ['capitalist', 'state'].includes(employer(firm.id));
      }).length;
      const amount = count * (effect === 'unemployment' ? 5 : role === 'middle' ? 2 : 1);
      if (role === 'state') provide(game, target, 'cash', amount);
      else transfer('state', role, amount, true);
      adjustLegitimacy(game, target, Math.floor(count / (effect === 'unemployment' ? 3 : role === 'middle' ? 5 : 10)));
      if (command.resource) buyGoods(game, role, command.resource, command.distribution, { only: effect === 'unemployment' ? 'state' : undefined });
      return;
    }
    case 'public-overtime': case 'private-overtime': {
      const owner = effect === 'public-overtime' ? 'state' : role;
      const item = collectCompany(game, company, owner, true);
      requireRule(!companyDefinition(item.id).automated && !item.strike, '此企業不能額外生產。');
      produceCompany(game, item.id, role !== owner);
      if (effect === 'public-overtime' && quantity > 0) buyGoods(game, role, companyDefinition(item.id).resource, { state: quantity });
      return;
    }
    case 'tourism-purchase':
      requireRule(['middle', 'capitalist'].includes(recipient), '請選擇私營賣方。');
      buyGoods(game, role, 'luxury', { [recipient]: quantity }, { tourism: true });
      adjustLegitimacy(game, role, 1);
      return;
    case 'sell-health': toState('health'); return;
    case 'sell-education': toState('education'); return;
    case 'bid-rigging': toState('luxury'); supplyInfluence(game, role, 1); return;
    case 'personal-buy': buyGoods(game, role, command.resource, command.distribution, { flexible: true }); return;
    case 'grant-build': build(game, role, command, { payer: 'state', mandatoryPay: true }); adjustLegitimacy(game, role, 1); return;
    case 'land-build': {
      const offer = economy.markets.middle.includes(company) && companyDefinition(company);
      requireRule(offer, '請選中產市場企業。');
      const requested = offer.skills[0];
      requireRule(workerSupply(economy, role, requested) > 0, '沒有可填入新企業必要工位的工人。');
      const slot = Number.isInteger(command.slot) ? command.slot : 0;
      requireRule(slot >= 0 && slot < offer.skills.length, '請選擇新工人要放入的必要工位。');
      const staffingFor = worker => command.staff
        ? { staff: command.staff.map((id, index) => index === slot ? worker : id) }
        : { operators: [...(command.operators ?? [])].toSpliced(slot, 0, worker) };
      // 先完整驗證建造與指派，成功後才正式加入工人，避免失敗時留下未回滾的待業工人。
      const preview = structuredClone(game);
      const previewWorker = addWorker(preview.economy, role, requested);
      requireRule(previewWorker, '沒有可加入的工人。');
      build(preview, role, { ...command, ...staffingFor(previewWorker) });
      const newWorker = addWorker(economy, role, requested);
      build(game, role, { ...command, ...staffingFor(newWorker) });
      return;
    }
    case 'investment-build':
      if (command.fromDeck === true) {
        const options = [...(economy.companyDecks?.[role] ?? [])];
        requireRule(options.length, '企業牌庫已空。');
        requireRule(investmentDeckQuotes(game, role, options).some(item => !item.blocked), '牌庫沒有付得起且能建造的企業。');
        openCardChoice(game, role, effect, { options });
      } else build(game, role, command, { discount: investmentAdjustment(role) });
      return;
    case 'industry-build': {
      const offer = economy.markets.capitalist.includes(company) && companyDefinition(company);
      requireRule(offer && ['food', 'luxury'].includes(offer.resource), '須選農業或奢侈品企業。');
      const subsidy = Math.floor(offer.cost / 2);
      build(game, role, command, { discount: subsidy, subsidy });
      adjustLegitimacy(game, role, 1);
      return;
    }
    case 'expand-build': {
      requireRule(Array.isArray(command.builds) && command.builds.length === 2, '必須選兩項建造。');
      for (const choice of command.builds) build(game, role, choice);
      refreshMarket(economy, role);
      return;
    }
    case 'grow-storage':
      addStorage(game, role, command.resource, false);
      if (company) build(game, role, command, { discount: companyDefinition(company).resource === command.resource ? 4 : 0 });
      return;
    case 'middle-hiring':
      workMoves(game, 'working', command.moves, { unemployed: true, employeeOnly: true });
      transfer('state', role, 5 * (command.moves?.length ?? 0), true);
      adjustLegitimacy(game, role, 1);
      return;
    case 'employment-subsidy': {
      const firms = ownedCompanies(economy, role).filter(item => economy.companies[item.id].slots.some(slot => slot.optional && slot.worker));
      transfer('state', role, 5 * firms.length, true);
      adjustLegitimacy(game, role, Math.floor(firms.length / 3));
      if (company) {
        requireRule(firms.some(item => item.id === company), '須選僱有勞工的企業。');
        extraShiftCompany(game, role, company);
      }
      return;
    }
    case 'fill-unemployed': case 'recruit': {
      const item = collectCompany(game, company, role, false);
      requireRule(['working', 'middle'].includes(recipient), '請選僱用的階級。');
      if (effect === 'recruit') {
        spend(game, role, 10);
        const hireRole = companyDefinition(item.id).owner === 'capitalist' ? 'working' : recipient;
        const vacancies = item.slots.filter(slot => !slot.optional && !slot.worker);
        requireRule(vacancies.length, '這家企業沒有需要補人的必要工位。');
        for (const slot of vacancies) {
          requireRule(workerSupply(economy, hireRole, slot.skill) > 0 || (slot.skill === 'any'
            && availableWorkerSkill(command.replacement) && workerSupply(economy, hireRole, command.replacement) > 0),
          '工人供應不足，無法招募符合必要工位的工人。');
          slot.worker = addWorker(economy, hireRole, slot.skill, command.replacement);
          economy.workers[slot.worker].committed = true;
        }
      } else {
        fillRequiredHires(economy, item, recipient);
        if (role === 'capitalist') {
          transfer('state', role, 5 * item.slots.length, true);
          adjustLegitimacy(game, role, 1);
        }
      }
      return;
    }
    case 'competitive-wages': {
      const target = collectCompany(game, company, role, false);
      const source = collectCompany(game, command.sourceCompany, 'state', true);
      requireRule(target.slots.every(slot => !slot.worker), '目標企業的工位必須全空，才能移入整組工人。');
      requireRule(companyDefinition(target.id).resource === companyDefinition(source.id).resource && target.slots.length === source.slots.length
        && source.slots.every(slot => !economy.workers[slot.worker].committed), '公營來源的產業、工位或承諾狀態不符。');
      for (const [index, slot] of source.slots.entries()) {
        target.slots[index].worker = slot.worker;
        economy.workers[slot.worker].committed = true;
        slot.worker = null;
      }
      target.wage = 3;
      return;
    }
    case 'brand-export': case 'food-export':
      requireRule(command.offers?.length || quantity >= 1, '至少要完成一筆出口交易或出售 1 份資源。');
      if (command.offers?.length) exportGoods(game, role, command.offers);
      if (quantity) specialExport(game, effect === 'brand-export' ? 'luxury' : 'food', quantity, effect === 'brand-export' ? 6 : 4, effect === 'brand-export' ? 10 : 15);
      return;
    case 'foreign-partner':
      businessDeal(game, command);
      if (command.offers?.length) exportGoods(game, role, command.offers, ['food', 'luxury']);
      return;
    case 'machinery': {
      const ids = command.companies;
      requireRule(Array.isArray(ids) && ids.length >= 1 && ids.length <= 2 && new Set(ids).size === ids.length, '請選一或兩家企業。');
      requireRule(Object.values(economy.companies).filter(item => item.machine).length + ids.length <= 6, '機械標記不足。');
      spend(game, role, ids.length === 1 ? 20 : 45);
      for (const id of ids) {
        const item = collectCompany(game, id, role);
        requireRule(companyDefinition(id).machineryBonus && !item.machine, '企業無機械工位或已放置。');
        item.machine = true;
      }
      return;
    }
    case 'exit': sellCompany(game, role, company, 2); return;
    case 'employment-support':
      for (const seat of ['working', 'middle']) { transfer('state', seat, 15, true); adjustLegitimacy(game, seat, 1); }
      return;
    case 'agenda-influence': supplyInfluence(game, role, matches(game, role)); return;
    case 'agenda-money': credit(game, role, 10 * matches(game, role)); return;
    case 'vat': case 'speech': {
      const seats = command.recipients;
      requireRule(Array.isArray(seats) && seats.length === 2 && new Set(seats).size === 2 && seats.every(seat => classes.includes(seat) && game.legitimacy[seat] > 1), '請選兩個合法性可下降的階級。');
      if (effect === 'vat') for (const seat of classes) transfer(seat, 'state', 15, true);
      else {
        requireRule(Number.isInteger(quantity) && quantity >= 0 && quantity <= 2 && quantity <= game.publicServices.influence
          && seats.every(seat => players[seat].influence > 0), '影響力不足或轉換量不符。');
        game.publicServices.influence -= quantity;
        players.state.influence += quantity + 2;
        for (const seat of seats) players[seat].influence--;
      }
      for (const seat of seats) adjustLegitimacy(game, seat, -1);
      return;
    }
    case 'representation': case 'allowance': case 'provide-health': case 'provide-education': {
      requireRule(classes.includes(recipient) && (!effect.startsWith('provide-') || recipient !== 'capitalist'), '請選可提供福利的階級。');
      if (effect === 'representation') {
        transferPersonalBenefit(game, recipient, 1, 2);
        adjustLegitimacy(game, recipient, 2);
      } else {
        const resource = effect === 'allowance' ? 'cash' : effect.slice(8);
        provide(game, recipient, resource, effect === 'allowance' ? 20 : population(game, recipient));
        legitimacyToken(game, recipient);
      }
      return;
    }
    case 'export-health': case 'export-education': {
      const resource = effect.slice(7);
      requireRule(Number.isInteger(quantity) && quantity >= 1 && quantity <= 8 && game.publicServices[resource] >= quantity, '出售數量不符，至少要出售 1 份。');
      game.publicServices[resource] -= quantity;
      credit(game, role, quantity * base.policies.public_health_and_education_price[game.policies[resource === 'health' ? 3 : 4]]);
      return;
    }
    case 'state-grants': {
      const count = ownedCompanies(economy, 'capitalist').length;
      provide(game, 'capitalist', 'cash', 5 * count);
      adjustLegitimacy(game, 'capitalist', Math.floor(count / 3));
      return;
    }
    case 'emergency':
      requireRule(game.bills.length >= 3 && Number.isInteger(command.policy) && availablePolicies(game, role, false, true)
        .some(choice => choice.policy === command.policy && choice.target === command.target), '此政策不可緊急變更。');
      game.policies[command.policy] = command.target;
      startPolicyChoices(game, [command.policy], 'action');
      return;
    case 'repeat-event':
      requireRule(Array.isArray(command.events) && command.events.length === 2 && command.events[0].eventId === command.events[1].eventId, '請對同一事件作兩次選擇。');
      resolveEvent(game, command.events[0], { remove: false });
      resolveEvent(game, command.events[1], { keep: true });
      return;
    default: throw new GameError('此卡效果尚未支援。');
  }
}

function playCard(game, role, command, card) {
  const player = game.players[role];
  const definition = cardDefinition(role, card);
  requireRule(!definition.policyAnyOf?.length || definition.policyAnyOf.some(section => game.policies[Number(section[0]) - 1] === section[1]), '目前政策不符合卡牌前提。');
  const { quantity } = command;
  const fiscalSupport = game.policies[0] !== 'C';
  switch (definition.effect) {
    case 'pressing': propose(game, role, command, true); break;
    case 'offshore': {
      const amount = Math.floor(player.revenue / 2);
      player.revenue -= amount;
      player.capital += amount;
      break;
    }
    case 'service': {
      const { resource, policy } = definition;
      const section = game.policies[policy];
      requireRule(section !== 'A', '目前的政策不符合卡牌前提。');
      requireRule(Number.isInteger(quantity) && quantity > 0 && quantity <= population(game, role) && quantity <= game.publicServices[resource], '請選擇可購買的數量。');
      const unit = base.policies.public_health_and_education_price[section];
      const cost = Math.ceil(quantity * unit / 2);
      spend(game, role, cost);
      game.treasury += cost;
      game.publicServices[resource] -= quantity;
      recordResourceSale(game, 'state', resource, quantity);
      player[resource] = (player[resource] ?? 0) + quantity;
      adjustLegitimacy(game, role, 1);
      if (unit === 5) game.players.state.vp++;
      break;
    }
    case 'import': {
      const { resource } = command;
      requireRule(game.policies[5] !== 'C', '進口補貼需要外貿政策 6A 或 6B。');
      requireRule(['food', 'luxury'].includes(resource) && Number.isInteger(quantity) && quantity > 0 && quantity <= population(game, role), '請選擇可進口的資源與數量。');
      spend(game, role, quantity * marketQuote(game, 'foreign', resource).base);
      player[resource] += quantity;
      adjustLegitimacy(game, role, Math.floor(quantity / 4));
      break;
    }
    case 'bill':
      requireRule(command.policy === definition.policy, '此卡只能提出指定政策。');
      propose(game, role, command, false);
      addCubes(game, role, 2);
      break;
    case 'solidarity': addCubes(game, role, population(game, role)); break;
    case 'housing': {
      const { recipient } = command;
      requireRule(['middle', 'capitalist'].includes(recipient), '請選擇收款階級。');
      const cost = recipient === 'middle' ? 10 : 20;
      spend(game, role, cost);
      credit(game, recipient, cost);
      player.vp += recipient === 'middle' ? 3 : 5;
      break;
    }
    case 'issues':
      requireRule(game.publicServices.influence >= 3, '公共媒體影響力不足。');
      spend(game, role, 15);
      game.treasury += 15;
      game.publicServices.influence -= 3;
      player.influence += 3;
      adjustLegitimacy(game, role, 1);
      break;
    case 'voice': addCubes(game, role, 2 + outsideEmployers(game.economy, role)); break;
    case 'theme-park':
      spend(game, role, population(game, role) * 6);
      gainMiddleProsperity(game);
      break;
    case 'export-subsidy': {
      requireRule(fiscalSupport, '出口補貼需要財政政策 1A 或 1B。');
      exportGoods(game, role, command.offers);
      const payment = 5 * command.offers.length;
      pay(game, 'state', payment, true);
      credit(game, role, payment);
      adjustLegitimacy(game, role, 1);
      break;
    }
    case 'endorse':
      spend(game, role, 15);
      addCubes(game, role, 6);
      break;
    case 'island':
      requireRule(player.capital >= 50, '資本不足 $50，不能只用資本購買私人島嶼。');
      player.capital -= 50;
      game.treasury += 50;
      player.vp += 7;
      break;
    case 'protection': {
      requireRule(game.policies[5] !== 'C', '此卡需要外貿政策 6A 或 6B。');
      const firms = ownedCompanies(game.economy, role).filter(item => item.resource === 'food' || (game.policies[5] === 'A' && item.resource === 'luxury'));
      addCubes(game, role, 2 * firms.length);
      break;
    }
    case 'grants': {
      requireRule(fiscalSupport, '企業補助需要財政政策 1A 或 1B。');
      const count = ownedCompanies(game.economy, role).length;
      pay(game, 'state', 5 * count, true);
      credit(game, role, 5 * count);
      adjustLegitimacy(game, role, Math.floor(count / 3));
      break;
    }
    case 'easing': credit(game, role, game.economy.loans.state ? 35 : 25); break;
    case 'distribution':
      credit(game, role, 15);
      for (const recipient of definition.recipients) {
        credit(game, recipient, 15);
        adjustLegitimacy(game, recipient, 1);
      }
      break;
    case 'geopolitics': credit(game, role, { A: 15, B: 30, C: 45 }[game.policies[5]]); break;
    case 'investment':
      requireRule(player.influence >= 2, '需要 2 個人影響力。');
      player.influence -= 2;
      credit(game, role, 40);
      break;
    default: extendedCard(game, role, command, definition);
  }
  log(game, `${names[role]}打出「${definition.name}」。`);
}

function awaitProductionConfirmation(game, stage, role = productionOrder[0]) {
  game.phase = 'production-confirm';
  game.match.productionStep = { stage, role };
}

function settleFood(game, role, quantities, personalFood) {
  coverNeeds(game, role, quantities, personalFood);
  if (!game.match.needs.role) awaitProductionConfirmation(game, 'imf');
}

function startTaxSettlement(game) {
  updateUnions(game.economy);
  const needs = game.match.needs;
  needs.taxes = createTaxSettlement(game, needs.labor);
  awaitProductionConfirmation(game, 'taxes');
}

function confirmProduction(game, role, command) {
  const { stage, role: expected } = game.match.productionStep;
  requireRule(command.type === 'production-confirm' && role === expected && command.option === stage, '等待指定階級確認目前的生產步驟。');
  const nextRole = productionOrder[productionOrder.indexOf(role) + 1];
  if (stage === 'wages' || stage === 'goods') {
    settleProductionStep(game, role, stage);
    if (stage === 'wages' && productionPlans(game, role).some(plan => plan.produced > 0)) {
      awaitProductionConfirmation(game, 'goods', role);
    }
    else if (nextRole) awaitProductionConfirmation(game, 'wages', nextRole);
    else {
      delete game.match.productionStep;
      completeProduction(game);
      if (game.economy.demonstration) game.phase = 'demonstration';
      else openNeeds(game);
    }
    return;
  }
  if (stage === 'imf') {
    delete game.match.productionStep;
    const needs = game.match.needs;
    needs.imf = checkIMF(game, Boolean(game.content));
    if (game.content && needs.imf?.intervened && startPolicyChoices(game, [0, 3, 4, 5], 'imf')) return;
    startTaxSettlement(game);
    return;
  }
  if (role !== 'state') payTaxStep(game, role, game.match.needs.taxes);
  if (nextRole) awaitProductionConfirmation(game, 'taxes', nextRole);
  else finishProduction(game);
}

function finishProduction(game) {
  const needs = game.match.needs;
  delete game.match.productionStep;
  log(game, `國庫收到稅款 $${needs.taxes.total}。`);
  needs.electionsHeld = game.bills.length > 0;
  if (needs.electionsHeld) {
    refill(game);
    stateElectionInfluence(game);
  } else {
    log(game, '沒有待表決法案，本輪略過選舉階段。');
  }
  nextScheduledElection(game);
}

function discardForAction(game, role, index) {
  const [usedCard] = game.players[role].hand.splice(index, 1);
  if (game.economy) updateUnions(game.economy);
  game.decks?.[role].discard.push(usedCard);
  game.mainUsed = true;
}

function startPreparation(game) {
  beginPreparation(game);
  for (const role of classes) fillHand(game, role, base.setup.hand_size);
}

function finishPreparation(game, middleSkill) {
  prepareWorkers(game, middleSkill);
  finishWorkerArrivals(game);
}

function finishWorkerArrivals(game, replacement) {
  game.workerArrival = advanceWorkerArrivals(game, replacement);
  if (game.workerArrival) {
    game.phase = 'worker-arrival';
    return;
  }
  if (game.content) revealStateContent(game);
  fillHand(game, 'state', base.setup.hand_size);
  game.phase = 'action';
  log(game, `第 ${game.match.round} 輪準備完成，進入行動階段。`);
}

function finishTransaction(game, role, type) {
  const transaction = game.transaction;
  requireRule(transaction.role === role && ['transaction-confirm', 'transaction-cancel'].includes(type), '請先確認或取消待處理的購買／借貸。');
  if (type === 'transaction-confirm') {
    if (transaction.kind === 'food-loan') {
      settleFood(game, role, transaction.quantities, transaction.fromPersonal);
    } else if (transaction.kind === 'repay') {
      repayLoan(game, role);
      game.freeUsed = true;
      log(game, `${names[role]}償還一筆貸款。`);
    } else {
      const index = game.players[role].hand.findIndex(card => card.id === transaction.cardId);
      requireRule(index >= 0 && !game.mainUsed, '購買使用的手牌已失效。');
      buyGoods(game, role, transaction.resource, transaction.distribution);
      const { resource, distribution, cost } = transaction;
      game.purchaseReceipt = { role, resource, distribution, cost };
      discardForAction(game, role, index);
    }
  }
  game.transaction = null;
}

const hostAdjustLiving = ['food', 'luxury', 'health', 'education', 'influence'];
const hostAdjustStored = ['food', 'luxury', 'health', 'education'];
const hostAdjustPublic = ['food', 'luxury', 'health', 'education', 'influence'];
const hostAdjustBenefits = ['cash', 'food', 'luxury', 'health', 'education', 'influence', 'votes'];
const hostAdjustClasses = ['working', 'middle', 'capitalist'];

function hostAdjustCount(value, label, minimum = 0) {
  requireRule(Number.isInteger(value) && value >= minimum, `${label}須為 ${minimum} 以上的整數。`);
  return value;
}

function hostAdjustFields(source, allowed, label, apply) {
  if (source === undefined) return;
  requireRule(source && typeof source === 'object' && !Array.isArray(source), `${label}格式錯誤。`);
  for (const [key, value] of Object.entries(source)) {
    requireRule(allowed.includes(key), `${label}包含未知項目。`);
    apply(key, hostAdjustCount(value, `${label}的${key}`));
  }
}

export function applyHostAdjustment(game, command) {
  if (command.target === 'policy') {
    if (command.policies !== undefined) {
      requireRule(Array.isArray(command.policies) && command.policies.length === game.policies.length, '政策數量不符。');
      const [fiscal, labor] = game.policies;
      requireRule(command.policies.every(section => sections.includes(section)), '請選擇 A、B 或 C 區政策。');
      game.policies = [...command.policies];
      if (game.policies[1] !== labor) setWagePolicy(game);
      if (game.policies[0] !== fiscal) {
        for (const resource of ['health', 'education', 'influence']) {
          delete game.economy.publicCapacityOverride?.[resource];
        }
        const { opening, count, companies } = publicSectorChoices(game);
        const selected = opening ? companies.slice(0, count) : companies.slice(companies.length - count);
        resizePublicSector(game, selected.map(item => item.id), { testing: true });
      }
      updateUnions(game.economy);
    }
    if (command.bag !== undefined) {
      requireRule(command.bag && typeof command.bag === 'object' && !Array.isArray(command.bag), '投票袋格式錯誤。');
      const bag = { ...game.bag };
      for (const [role, count] of Object.entries(command.bag)) {
        requireRule(hostAdjustClasses.includes(role), '投票袋包含未知階級。');
        bag[role] = hostAdjustCount(count, `${names[role]}投票袋`);
        requireRule(bag[role] <= 25, '投票袋方塊數不可超過 25。');
      }
      game.bag = bag;
    }
    log(game, '房長調整了公共政策與投票袋。');
    return;
  }
  const target = command.target;
  requireRule(roles.includes(target), '請選擇要調整的階級。');
  const player = game.players[target];
  const economy = game.economy;
  if (target === 'state') {
    if (command.treasury !== undefined) game.treasury = hostAdjustCount(command.treasury, '國庫');
    if (command.cash !== undefined) throw new GameError('國家的金錢請調整國庫。');
  } else if (command.treasury !== undefined) {
    throw new GameError('只有國家使用國庫。');
  } else if (command.cash !== undefined) {
    player.cash = hostAdjustCount(command.cash, `${names[target]}現金`);
  }
  if (command.revenue !== undefined) {
    requireRule(target === 'capitalist', '只有資本家使用營收。');
    player.revenue = hostAdjustCount(command.revenue, '資本家營收');
  }
  if (command.capital !== undefined) {
    requireRule(target === 'capitalist', '只有資本家使用資本。');
    player.capital = hostAdjustCount(command.capital, '資本家資本');
  }
  hostAdjustFields(command.living, hostAdjustLiving, '生活資源', (key, value) => { player[key] = value; });
  if (command.inventory !== undefined || command.storageUnits !== undefined) {
    requireRule(['middle', 'capitalist'].includes(target), '只有中產與資本家有商業倉庫。');
    economy.inventory[target] ??= {};
    hostAdjustFields(command.inventory, hostAdjustStored, '倉庫庫存', (key, value) => { economy.inventory[target][key] = value; });
    economy.storageUnits ??= { middle: {}, capitalist: {} };
    economy.storageUnits[target] ??= {};
    hostAdjustFields(command.storageUnits, hostAdjustStored, '倉庫容量', (key, value) => {
      economy.storageUnits[target][key] = hostAdjustCount(value, `倉庫容量的${key}`, 1);
    });
  }
  if (command.prices !== undefined) {
    requireRule(['middle', 'capitalist'].includes(target), '只有中產與資本家可調整國內售價。');
    requireRule(command.prices && typeof command.prices === 'object' && !Array.isArray(command.prices), '售價格式錯誤。');
    const allowed = domesticPriceLevels[target];
    const pricesByRole = economy.domesticPrices ??= {};
    pricesByRole[target] ??= {};
    for (const [resource, price] of Object.entries(command.prices)) {
      requireRule(Object.hasOwn(allowed, resource) && allowed[resource].includes(price), '請選擇圖版上的售價。');
      pricesByRole[target][resource] = price;
    }
  }
  if (command.benefits !== undefined) {
    requireRule(target === 'state', '只有國家可以調整福利區。');
    requireRule(game.content, '目前對局沒有國家福利資料。');
    requireRule(command.benefits && typeof command.benefits === 'object' && !Array.isArray(command.benefits), '國家福利格式錯誤。');
    for (const [role, values] of Object.entries(command.benefits)) {
      requireRule(hostAdjustClasses.includes(role), '國家福利包含未知階級。');
      requireRule(values && typeof values === 'object' && !Array.isArray(values), '國家福利格式錯誤。');
      game.content.benefits[role] ??= {};
      for (const [resource, amount] of Object.entries(values)) {
        requireRule(hostAdjustBenefits.includes(resource), '國家福利包含未知項目。');
        game.content.benefits[role][resource] = hostAdjustCount(amount, `${names[role]}福利的${resource}`);
      }
    }
  }
  if (command.public !== undefined || command.publicCapacity !== undefined) {
    requireRule(target === 'state', '只有國家有公共庫存與公共容量。');
    hostAdjustFields(command.public, hostAdjustPublic, '公共庫存', (key, value) => { game.publicServices[key] = value; });
    economy.publicCapacityOverride ??= {};
    hostAdjustFields(command.publicCapacity, hostAdjustPublic, '公共容量', (key, value) => {
      economy.publicCapacityOverride[key] = value;
    });
  }
  log(game, `房長調整了${names[target]}的狀態。`);
}

export function applyCommand(game, role, command, allSeated) {
  const player = game.players[role];
  const { type } = command;
  if (type === 'host-adjust') {
    requireRule(game.testMode === true, '只有測試房間可以使用房長調整。');
    requireRule(game.phase === 'action' && !game.transaction, '請在行動階段且沒有待確認交易時調整。');
    applyHostAdjustment(game, command);
    return;
  }
  if (game.phase === 'vote-confirmation') {
    confirmVoteResult(game, role, command);
    return;
  }
  if (game.transaction) {
    finishTransaction(game, role, type);
    return;
  }
  if (game.phase === 'policy-choice') {
    finishPolicyChoice(game, role, command);
    return;
  }
  if (game.phase === 'worker-arrival') {
    requireRule(type === 'worker-arrival' && game.workerArrival.role === role && game.workerArrival.options.includes(command.skill),
      '等待指定階級選擇替代技術工。');
    finishWorkerArrivals(game, command.skill);
    return;
  }
  if (type === 'start-skill') {
    requireRule(game.phase === 'lobby' && role === 'middle' && game.content
      && availableWorkerSkill(command.skill), '請由中產在開局前選擇技術工技能。');
    game.content.startSkill = command.skill;
    return;
  }
  if (type === 'start') {
    requireRule(game.phase === 'lobby' && allSeated, '四個角色都已入座後才能開始。');
    if (game.content) {
      revealTradeContent(game);
      revealStateContent(game);
    }
    for (const seat of roles) fillHand(game, seat, base.setup.hand_size);
    if (game.content) {
      const id = game.economy.startingMiddleSkill;
      const skill = game.content.startSkill ?? 'food';
      if (game.economy.workers[id]) game.economy.workers[id].skill = skill;
    }
    game.phase = 'action';
    log(game, '第 1 輪略過準備，進入行動階段。');
    return;
  }
  if (type === 'next-round') {
    requireRule(game.match && game.phase === 'scoring' && game.match.round < base.rounds, '目前無法開始下一輪。');
    startPreparation(game);
    if (game.content) {
      game.content.marketRole = 'capitalist';
      return;
    }
    finishPreparation(game);
    return;
  }
  if (game.phase === 'market') {
    requireRule(role === game.content.marketRole, '等待企業市場更新。');
    if (game.content.marketSkillPending) {
      requireRule(type === 'market-skill' && availableWorkerSkill(command.skill), '請選擇中產新增技術工的技能。');
      game.content.marketRole = null;
      game.content.marketSkillPending = false;
      finishPreparation(game, command.skill);
      return;
    }
    requireRule(type === 'market', '請先更新企業市場。');
    refreshMarket(game.economy, role, command.companies);
    if (legacyPreparation(game)) {
      startPreparation(game);
      if (role === 'middle') revealTradeContent(game);
    }
    if (role === 'capitalist') {
      revealTradeContent(game);
      game.content.marketRole = 'middle';
    } else {
      game.content.marketSkillPending = true;
    }
    return;
  }
  if (game.phase === 'event-penalty') {
    requireRule(type === 'event-penalty' && role === 'state', '等待國家選擇事件懲罰。');
    choosePenalty(game, command.eventId, command.recipients);
    nextScheduledElection(game);
    return;
  }
  if (game.phase === 'production-confirm') {
    confirmProduction(game, role, command);
    return;
  }
  if (game.phase === 'demonstration') {
    requireRule(role === 'working' && type === 'demonstration-losses', '等待勞工分配示威扣分。');
    const { limits, losses } = demonstrationStatus(game.economy);
    const entries = Object.entries(limits);
    const assigned = entries.map(([seat]) => command.losses?.[seat]);
    requireRule(entries.every(([, limit], index) => Number.isInteger(assigned[index]) && assigned[index] >= 0 && assigned[index] <= limit)
      && assigned.reduce((total, amount) => total + amount, 0) === losses, `請分配合計 ${losses} VP 的扣分，並遵守各席上限。`);
    for (const [seat, amount] of Object.entries(command.losses)) if (Object.hasOwn(limits, seat)) game.players[seat].vp -= amount;
    supplyInfluence(game, 'working', 1);
    game.economy.demonstration = false;
    log(game, `示威結算，其他階級合計扣除 ${losses} VP。`);
    openNeeds(game);
    return;
  }
  if (game.phase === 'event-hire') {
    completeIndustry(game, role, command);
    return;
  }
  if (game.phase === 'card-choice') {
    finishCardChoice(game, role, command);
    return;
  }
  if (game.phase === 'event-choice') {
    const civil = game.content.civil;
    if (type === 'civil-bill') {
      requireRule(role === civil.recipient && !civil.proposed && availablePolicies(game, 'state')
        .some(choice => choice.policy === command.policy && choice.target === command.target), '請選擇國家可以提出的法案。');
      civil.proposed = { policy: command.policy, target: command.target };
      return;
    }
    requireRule(type === 'civil-confirm' && role === 'state' && civil.proposed, '等待選案完成。');
    propose(game, 'state', { ...civil.proposed, immediate: command.immediate }, false);
    if (civil.recipient !== 'middle') adjustLegitimacy(game, civil.recipient, 2);
    game.content.civil = null;
    if (game.phase === 'event-choice') game.phase = 'action';
    return;
  }
  if (game.phase === 'needs') {
    requireRule(type === 'food', '請先完成食物需求結算。');
    if (game.content) {
      const quote = quoteFood(game, role, command.quantities, command.personalFood);
      if (quote.loans) {
        const taken = Object.values(game.economy.loans).reduce((sum, count) => sum + count, 0);
        requireRule(taken + quote.loans <= base.components.small_cards.loans, '全桌貸款牌不足，請先調整食物來源。');
        game.transaction = { role, kind: 'food-loan', quantities: command.quantities, ...quote };
        return;
      }
    }
    settleFood(game, role, command.quantities, command.personalFood);
    return;
  }
  if (game.phase === 'election') {
    const election = game.election;
    if (type === 'side') {
      const next = roles.find(seat => !(seat in election.sides));
      requireRule(role === next && ['for', 'against'].includes(command.side), '目前不能提交此投票立場。');
      election.sides[role] = command.side;
      if (roles.every(seat => seat in election.sides)) Object.assign(election, drawElectionCubes(game, election.drawn, election.bagDraw));
      return;
    }
    if (type === 'bid') {
      requireRule(command.electionId === election.id && election.drawn.length === 5 && election.sides[role] !== 'absent' && !(role in election.bids), '目前不能投入影響力。');
      const amount = command.amount;
      requireRule(Number.isInteger(amount) && amount >= 0 && amount <= player.influence, '影響力投入量無效。');
      election.bids[role] = amount;
      if (roles.every(seat => election.sides[seat] === 'absent' || seat in election.bids)) settleElection(game);
      return;
    }
    throw new GameError('請先完成表決。');
  }
  requireRule(currentRole(game) === role, '目前不是你的回合。');
  if (type === 'end') {
    requireRule(game.mainUsed, '請先完成主要行動。');
    game.turn++;
    if (game.purchaseReceipt) game.purchaseReceipt = null;
    game.mainUsed = false;
    game.freeUsed = false;
    if (game.turn === roles.length * base.turns_per_role_per_round) {
      if (game.match) {
        beginProduction(game);
        awaitProductionConfirmation(game, 'wages');
      } else {
        if (game.economy) produceRound(game);
        if (game.bills.length) refill(game);
        nextScheduledElection(game);
      }
    }
    return;
  }
  if (type === 'swap-card') {
    requireRule(game.testMode === true, '只有測試房間可以換牌。');
    // 檢查用途：把手牌與待抽牌庫／棄牌堆中的指定卡牌交換，方便逐一驗證卡牌效果。
    requireRule(game.decks?.[role], '目前對局沒有手牌庫資料。');
    requireRule(['draw', 'discard'].includes(command.pile), '請選擇要交換的牌堆。');
    const handIndex = player.hand.findIndex(card => card.id === command.handCardId);
    requireRule(handIndex >= 0, '請選擇要交換的手牌。');
    const pile = game.decks[role][command.pile];
    const pileIndex = pile.findIndex(card => card.id === command.pileCardId);
    requireRule(pileIndex >= 0, '請選擇牌堆中的卡牌。');
    [player.hand[handIndex], pile[pileIndex]] = [pile[pileIndex], player.hand[handIndex]];
    log(game, `測試：將手牌與${command.pile === 'draw' ? '待抽牌庫' : '棄牌堆'}的卡牌交換。`);
    return;
  }
  if (['wages', 'repay', 'benefits', 'buy-storage', 'use-education', 'use-health', 'use-luxury', 'swap-workers', 'adjust-prices', 'give-bonus'].includes(type)) {
    requireRule(!game.freeUsed, '此回合已執行免費行動。');
    if (type === 'wages') {
      requireRule(['state', 'middle', 'capitalist'].includes(role), '此階級不能調薪。');
      log(game, `${names[role]}${companyAction(game, role, command)}`);
    } else if (type === 'adjust-prices') {
      adjustPrices(game, role, command.prices);
      log(game, `${names[role]}調整國內售價。`);
    } else if (type === 'give-bonus') {
      requireRule(role === 'capitalist', '只有資本家可發放獎金。');
      const item = collectCompany(game, command.company, role, true);
      const workers = item.slots.map(slot => game.economy.workers[slot.worker]).filter(Boolean);
      requireRule(workers.length, '請選擇有工人的營運企業。');
      pay(game, role, 5);
      credit(game, workers[0].role, 5);
      for (const worker of workers) worker.committed = true;
      log(game, `資本家向${names[workers[0].role]}發放 $5獎金並承諾該企業工人。`);
    } else if (type === 'use-education') {
      useEducation(game, role, command);
    } else if (type === 'use-health' || type === 'use-luxury') {
      useLivingResource(game, role, type === 'use-health' ? 'health' : 'luxury', command.skill);
    } else if (type === 'swap-workers') {
      swapWorkers(game, role, command.swaps);
    } else if (type === 'buy-storage') {
      addStorage(game, role, command.resource);
      log(game, `${names[role]}支付 $20擴充倉庫。`);
    } else if (type === 'repay') {
      if (game.content) {
        repayLoan(structuredClone(game), role);
        game.transaction = { role, kind: 'repay', cost: base.loans.free_action_repay };
        return;
      }
      repayLoan(game, role);
      log(game, `${names[role]}償還一筆貸款。`);
    } else {
      takeBenefits(game, role);
      log(game, `${names[role]}領取國家福利。`);
    }
    game.freeUsed = true;
    return;
  }
  requireRule(!game.mainUsed, '此回合的主要行動已完成。');
  const cardIndex = player.hand.findIndex(card => card.id === command.cardId);
  requireRule(cardIndex >= 0, '請選擇自己的手牌。');
  switch (type) {
    case 'play': playCard(game, role, command, player.hand[cardIndex]); break;
    case 'event':
      requireRule(role === 'state', '只有國家可處理事件。');
      if (command.eventId === 'event-civil-unrest') requireRule(availablePolicies(game, 'state').length, '國家目前無法提出法案。');
      resolveEvent(game, command);
      break;
    case 'buy':
      if (game.content) {
        const preview = structuredClone(game);
        buyGoods(preview, role, command.resource, command.distribution);
        game.transaction = { role, kind: 'buy', cardId: command.cardId, resource: command.resource,
          distribution: command.distribution, cost: funds(game, role) - funds(preview, role) };
        return;
      }
      buyGoods(game, role, command.resource, command.distribution);
      break;
    case 'deal':
      requireRule(role === 'capitalist', '只有資本家可做商業交易。');
      businessDeal(game, command);
      break;
    case 'strike':
      requireRule(role === 'working', '只有勞工可發起罷工。');
      strike(game, command.companies);
      break;
    case 'export': exportGoods(game, role, command.offers); break;
    case 'assign':
    case 'build':
    case 'sell':
      log(game, `${names[role]}${companyAction(game, role, command)}`);
      break;
    case 'propose': propose(game, role, command, false); break;
    case 'pressure':
      requireRule(role !== 'state', '國家沒有投票方塊。');
      addCubes(game, role, 3);
      log(game, `${names[role]}施加政治壓力。`);
      break;
    case 'campaign':
      requireRule(role === 'state' && game.publicServices.influence > 0, '公共媒體目前沒有可轉換的影響力。');
      const amount = command.amount;
      requireRule(Number.isInteger(amount) && amount >= 1 && amount <= Math.min(3, game.publicServices.influence), '請選擇可轉換的影響力數量。');
      game.publicServices.influence -= amount;
      player.influence += amount;
      log(game, `國家將 ${amount} 公共媒體影響力轉為個人影響力。`);
      break;
    case 'extra-shift': extraShift(game, role, command.company); break;
    case 'demonstrate':
      requireRule(role === 'working' && !game.economy.demonstration && demonstrationStatus(game.economy).eligible,
        '勞工待業人數須比可用空工位至少多 2，且場上尚無示威。');
      game.economy.demonstration = true;
      log(game, '勞工發起示威。');
      break;
    case 'lobby':
      requireRule(role === 'capitalist', '只有資本家可以遊說。');
      spend(game, role, 30, true);
      supplyInfluence(game, role, 3);
      break;
    case 'meet-mps':
      requireRule(role === 'state' && classes.includes(command.recipient) && player.influence >= 2, '請選擇階級，並準備 2 個人影響力。');
      player.influence -= 2;
      game.players[command.recipient].influence += 2;
      adjustLegitimacy(game, command.recipient, 1);
      break;
    case 'extra-tax':
      requireRule(role === 'state', '只有國家可以徵收額外稅。');
      extraTax(game, command.recipients);
      break;
    case 'trial-pass':
      requireRule(!game.content && role === 'state' && !game.publicServices.influence && !availablePolicies(game, role).length,
        '正式對局必須執行主要行動。');
      break;
    default: throw new GameError('未知的行動。');
  }
  discardForAction(game, role, cardIndex);
}

export function playerView(game, role) {
  const election = game.election;
  const players = Object.fromEntries(roles.map(seat => {
    const { hand, ...publicStats } = game.players[seat];
    return [seat, { ...publicStats, handCount: hand.length }];
  }));
  const { hand } = game.players[role];
  const { publicServices, legitimacy, treasury, phase, turn, mainUsed, bills, log, lastVote, bag } = game;
  const choice = game.content?.cardChoice;
  const transaction = game.transaction;
  const privateChoice = choice?.role === role ? { ...choice } : undefined;
  const pollReveal = choice?.effect === 'poll' ? { role: choice.role, drawn: [...choice.drawn] } : undefined;
  if (privateChoice?.effect === 'investment-build') privateChoice.cards = investmentDeckQuotes(game, role, choice.options);
  const canInvestFromDeck = currentRole(game) === role && !mainUsed
    && hand.some(card => cardDefinition(role, card).effect === 'investment-build')
    && investmentDeckQuotes(game, role).some(item => !item.blocked);
  if (privateChoice?.effect === 'export-insight') privateChoice.cards = choice.options.map(id => ({
    ...catalogCard(id), offers: exportOffers({ ...game, content: { ...game.content, export: id } }, role),
  }));
  if (['shift-event', 'priority-event'].includes(privateChoice?.effect)) privateChoice.cards = choice.options.map(id => eventView(game, id));
  return {
    phase, turn, currentRole: currentRole(game), canInvestFromDeck, mainUsed, freeUsed: Boolean(game.freeUsed), players,
    hand: hand.map(card => cardView(role, card)), publicServices, legitimacy, treasury,
    testMode: game.testMode === true,
    cardPiles: game.testMode === true && game.decks?.[role] ? {
      draw: game.decks[role].draw.map(card => cardView(role, card)),
      discard: game.decks[role].discard.map(card => cardView(role, card)),
    } : undefined,
    economy: economyView(game.economy),
    storageOptions: currentRole(game) === role && !game.freeUsed && !game.transaction ? purchasableStorage(game.economy, role) : [],
    educationOptions: currentRole(game) === role && !game.freeUsed && !game.transaction ? educationOptions(game, role) : null,
    demonstration: demonstrationStatus(game.economy),
    policyChoice: policyChoiceView(game),
    workerArrival: game.workerArrival,
    specializationSupply: currentRole(game) === role && ['working', 'middle'].includes(role)
      ? Object.fromEntries(['any', ...workerSkills].map(skill => [skill, workerSupply(game.economy, 'working', skill)])) : undefined,
    workerFallback: ['working', 'middle'].includes(role) && workerSupply(game.economy, role, 'any') <= 0
      ? workerSkills.filter(skill => workerSupply(game.economy, role, skill) > 0) : [],
    match: matchView(game, role),
    purchaseReceipt: game.purchaseReceipt?.role === role ? game.purchaseReceipt : undefined,
    transaction: transaction && (transaction.role === role
      ? Object.fromEntries(Object.entries(transaction).filter(([key]) => key !== 'cardId'))
      : { role: transaction.role, kind: transaction.kind }),
    content: game.content && { events: game.content.events.map(id => eventView(game, id)), deals: game.content.deals.map(catalogCard),
      export: catalogCard(game.content.export), benefits: game.content.benefits, legitimacyTokens: game.content.legitimacyTokens,
      civil: game.content.civil, civilPolicies: game.phase === 'event-choice' ? availablePolicies(game, 'state') : [],
      choosingRole: choice?.role, cardChoice: privateChoice, pollReveal, marketRole: game.content.marketRole,
      marketSkillPending: Boolean(game.content.marketSkillPending), eventHire: game.content.eventHire, startSkill: game.content.startSkill },
    bills, log, lastVote, voteResults: game.voteResults ?? [], voteConfirmation: game.voteConfirmation ?? null,
    bag: choice?.drawn && choice.role !== role && choice.effect !== 'poll' ? Object.fromEntries(classes.map(seat => [seat, bag[seat] + choice.drawn.filter(cube => cube === seat).length])) : bag,
    policies: game.policies,
    taxMultiplier: taxMultiplier(game),
    availablePolicies: currentRole(game) === role ? availablePolicies(game, role) : [],
    radicalPolicies: currentRole(game) === role ? availablePolicies(game, role, true) : [],
    emergencyPolicies: currentRole(game) === role ? availablePolicies(game, role, false, true) : [],
    election: election && {
      id: election.id, bill: election.bill, sides: election.sides,
      drawn: roles.every(seat => seat in election.sides) ? election.drawn : [],
      submitted: Object.keys(election.bids),
      nextVoter: roles.find(seat => !(seat in election.sides)) ?? null,
    },
  };
}
