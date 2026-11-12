import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import { GameError, requireRule } from './errors.mjs';
import { catalogCard, catalogDecks, marketSizes, shuffled, drawImmigrant } from './content.mjs';

const definitions = {
  supermarket: ['超市', 'capitalist', 16, 'food', 4, ['food', 'any'], [15, 20, 25]],
  mall: ['購物中心', 'capitalist', 16, 'luxury', 6, ['luxury', 'any'], [15, 20, 25]],
  college: ['學院', 'capitalist', 16, 'education', 6, ['education', 'any'], [10, 20, 30]],
  clinic: ['診所', 'capitalist', 16, 'health', 6, ['health', 'any'], [10, 20, 30]],
  hospital: ['大學醫院', 'state', 30, 'health', 6, ['health', 'any', 'any'], [25, 30, 35]],
  university: ['技術大學', 'state', 30, 'education', 6, ['education', 'any', 'any'], [25, 30, 35]],
  broadcaster: ['全國公共廣播', 'state', 30, 'influence', 4, ['influence', 'any', 'any'], [25, 30, 35]],
  convenience: ['便利商店', 'middle', 14, 'food', 2, ['food'], [6, 8, 10], { skill: 'any', output: 1 }],
  doctors: ['醫師診所', 'middle', 12, 'health', 2, ['health'], [6, 8, 10], { skill: 'any', output: 2 }],
  fish: ['養魚場', 'capitalist', 20, 'food', 6, ['food', 'any', 'any'], [25, 30, 35]],
  radio: ['電台', 'capitalist', 8, 'influence', 2, ['any', 'any'], [10, 15, 20]],
  academy: ['專科學院', 'capitalist', 20, 'education', 7, ['education', 'any'], [10, 20, 30]],
  organic: ['有機農場', 'middle', 20, 'food', 2, ['food'], [9, 12, 15], { skill: 'food', output: 2 }],
  games: ['遊戲商店', 'middle', 12, 'luxury', 2, ['luxury'], [6, 8, 10], { skill: 'any', output: 2 }],
  lab: ['醫學實驗室', 'middle', 20, 'health', 2, ['health'], [9, 12, 15], { skill: 'health', output: 4 }],
};

const publicReserve = ['local-hospital', 'local-university', 'regional-tv', 'second-hospital', 'second-university', 'second-tv'];
for (const id of ['local-hospital', 'second-hospital']) definitions[id] = ['公立醫院', 'state', 20, 'health', 4, ['health', 'any'], [15, 20, 25]];
for (const id of ['local-university', 'second-university']) definitions[id] = ['公立大學', 'state', 20, 'education', 4, ['education', 'any'], [15, 20, 25]];
for (const id of ['regional-tv', 'second-tv']) definitions[id] = ['地方電視台', 'state', 20, 'influence', 3, ['influence', 'any'], [15, 20, 25]];
const startingPublic = catalogDecks.stateCompanies.filter(item => item.startingPlayerCounts.includes(4)).map(item => item.id);
const reservePublic = catalogDecks.stateCompanies.filter(item => !item.startingPlayerCounts.length);
const publicBoard = [...startingPublic, ...[1, 2].flatMap(copy => reservePublic.map(item => copy === 1 ? item.id : `${item.id}~${copy}`))];
const trialPublicBoard = ['hospital', 'university', 'broadcaster', ...publicReserve];

export function publicRoster(economy) {
  if (economy.publicSlots) return economy.publicSlots;
  if (!economy.publicReserve) return trialPublicBoard;
  return [...publicBoard.filter(id => economy.publicReserve.includes(id)), ...economy.publicReserve.filter(id => !publicBoard.includes(id))];
}

export function replacePublicCompany(economy, removed, acquired) {
  economy.publicSlots = publicRoster(economy).map(id => id === removed ? acquired : id === acquired ? null : id);
}

export function companyDefinition(id) {
  const source = catalogCard(id.replace(/~\d+$/, ''));
  if (source?.requiredSlots) {
    const [resource, output] = Object.entries(source.output)[0];
    const employee = source.optionalEmployee && { skill: source.optionalEmployee.skill, output: source.optionalEmployee.bonus[resource] };
    const wages = source.wages ?? source.optionalEmployee?.wages;
    return { id, name: source.nameZh, owner: source.owner, cost: source.cost, resource, output,
      skills: source.requiredSlots.map(slot => slot.skill), wages: wages ? [wages.L1, wages.L2, wages.L3] : null,
      employee, automated: source.automated, machineryBonus: source.machineryBonus };
  }
  const [name, owner, cost, resource, output, skills, wages, employee] = definitions[id];
  return { id, name, owner, cost, resource, output, skills, wages, employee };
}

const card = companyDefinition;

export function activeCompany(economy, id) {
  const definition = card(id);
  const owner = economy.companies[id]?.owner;
  return owner ? { ...definition, owner } : definition;
}

export function company(id, wage = 2) {
  const item = card(id);
  const requiredRole = ['middle', 'working'].includes(item.owner) ? item.owner : null;
  const slots = item.skills.map(skill => ({ skill, role: requiredRole, worker: null }));
  if (item.employee) slots.push({ skill: item.employee.skill, role: 'working', worker: null, optional: true });
  return { id, wage, slots };
}

const workerLimits = { working: { unskilled: 23, skilledPerColor: 5 }, middle: { unskilled: 12, skilledPerColor: 6 } };

export function workerSupply(economy, role, skill) {
  const limit = workerLimits[role][skill === 'any' ? 'unskilled' : 'skilledPerColor'];
  return limit - Object.values(economy.workers).filter(worker => worker.role === role && worker.skill === skill).length;
}

export function addWorker(economy, role, skill, replacement) {
  if (workerSupply(economy, role, skill) <= 0) {
    if (skill !== 'any' && workerSupply(economy, role, 'any') > 0) skill = 'any';
    else {
      const available = ['food', 'luxury', 'health', 'education', 'influence'].filter(type => workerSupply(economy, role, type) > 0);
      if (!available.length) return null;
      requireRule(available.includes(replacement), '無通用工人可用，請選一名仍有供應的技術工。');
      skill = replacement;
    }
  }
  if (!economy.nextWorker) economy.nextWorker = Math.max(0, ...Object.keys(economy.workers).map(id => Number(id.split('-').at(-1)))) + 1;
  const id = `${role}-${economy.nextWorker++}`;
  economy.workers[id] = { id, role, skill, committed: false };
  return id;
}

export function createEconomy(content) {
  const economy = {
    workers: {}, companies: {},
    markets: { capitalist: ['fish', 'radio', 'academy'], middle: ['organic', 'games', 'lab'] },
    inventory: { capitalist: { food: 1, luxury: 2, health: 0, education: 2 }, middle: { food: 1, luxury: 0, health: 1, education: 0 } },
    storageUnits: { middle: {}, capitalist: {} },
    publicCapacityOverride: {},
    tradeZone: { food: 0, luxury: 0 },
    loans: { state: 0, capitalist: 0, middle: 0, working: 0 },
    production: null,
  };
  const trialSetup = [
    ['supermarket', 'working', 'food', 'any'], ['mall', 'middle', 'luxury', 'any'],
    ['college', 'working', 'education', 'any'], ['clinic'],
    ['hospital', 'working', 'health', 'any', 'any'], ['university', 'middle', 'education', 'any', 'any'], ['broadcaster'],
    ['convenience', 'middle', 'food'], ['doctors', 'middle', 'health'],
  ];
  const setup = content ? [
    ['company-capitalist-supermarket-start', 'working', 'food', 'any'], ['company-capitalist-shopping-mall-start', 'middle', 'luxury', 'any'],
    ['company-capitalist-college-start', 'working', 'education', 'any'], ['company-capitalist-clinic-start'],
    ['company-state-university-hospital-start-34p', 'working', 'health', 'any', 'any'],
    ['company-state-technical-university-start-34p', 'middle', 'education', 'any', 'any'], ['company-state-national-public-broadcasting-start-34p'],
    ['company-middle-convenience-store-start', 'middle', 'food'], ['company-middle-doctors-office-start', 'middle', 'health'],
  ] : trialSetup;
  for (const [id, role, ...skills] of setup) {
    const item = company(id);
    economy.companies[id] = item;
    skills.forEach((skill, index) => { item.slots[index].worker = addWorker(economy, role, skill); });
  }
  if (content) {
    const instanceIds = cards => cards.flatMap(item => Array.from({ length: item.copies }, (_, i) => i ? `${item.id}~${i + 1}` : item.id));
    economy.companyDecks = Object.fromEntries(['capitalist', 'middle'].map(role => [role,
      shuffled(instanceIds(catalogDecks[`${role}Companies`].filter(item => !item.startingPlayerCounts.length)))]));
    economy.publicSlots = [...publicBoard];
    economy.markets = { capitalist: [], middle: [] };
    economy.companyDiscard = { capitalist: [], middle: [] };
    for (const role of ['working', 'middle']) {
      const starting = addWorker(economy, role, role === 'working' ? 'any' : 'food');
      if (role === 'middle') economy.startingMiddleSkill = starting;
      for (let i = 0; i < 2; i++) addWorker(economy, role, drawImmigrant({ content }, role));
    }
    for (const role of ['capitalist', 'middle']) refreshMarket(economy, role);
  } else {
    for (const skill of ['any', 'health', 'influence']) addWorker(economy, 'working', skill);
    for (const skill of ['any', 'luxury', 'food']) addWorker(economy, 'middle', skill);
  }
  return economy;
}

export function refreshMarket(economy, role, removed = []) {
  const market = economy.markets[role];
  requireRule(Array.isArray(removed) && new Set(removed).size === removed.length && removed.every(id => market.includes(id)), '只能棄置自己市場上的企業。');
  if (!economy.companyDecks) return;
  economy.companyDiscard[role].push(...removed);
  const retained = market.filter(id => !removed.includes(id));
  retained.push(...economy.companyDecks[role].splice(0, marketSizes[role] - retained.length));
  economy.markets[role] = retained;
}

export function operational(item) {
  return item.slots.every(slot => slot.optional || slot.worker);
}

export function operationalCount(economy, owner) {
  return Object.values(economy.companies).filter(item => activeCompany(economy, item.id).owner === owner && operational(item)).length;
}

export function outsideEmployers(economy, role) {
  return Object.values(economy.companies).filter(item => activeCompany(economy, item.id).owner !== role
    && operational(item) && item.slots.some(slot => economy.workers[slot.worker]?.role === role)).length;
}

export function ownedCompanies(economy, role) {
  return Object.values(economy.companies).map(item => activeCompany(economy, item.id)).filter(item => item.owner === role);
}

export function workplace(economy, worker) {
  return Object.values(economy.companies).find(item => item.slots.some(slot => slot.worker === worker));
}

export function demonstrationStatus(economy) {
  const unemployed = Object.values(economy.workers).filter(worker => worker.role === 'working'
    && !unionMember(economy, worker.id) && !workplace(economy, worker.id)).length;
  const openings = Object.values(economy.companies).reduce((sum, item) => {
    const owner = activeCompany(economy, item.id).owner;
    if ((owner === 'middle' && !operational(item))
      || item.slots.some(slot => economy.workers[slot.worker]?.role === 'middle') && owner !== 'middle') return sum;
    return sum + item.slots.filter(slot => !slot.worker && (!slot.role || slot.role === 'working')).length;
  }, 0);
  const limits = { middle: Math.max(0, base.limits.middle_companies - ownedCompanies(economy, 'middle').length),
    capitalist: Math.max(0, base.limits.capitalist_companies - ownedCompanies(economy, 'capitalist').length),
    state: publicRoster(economy).filter(id => !id || !economy.companies[id]).length };
  return { eligible: unemployed >= openings + 2, active: Boolean(economy.demonstration), unemployed, openings, limits,
    losses: Math.min(unemployed + (economy.unions?.length ?? 0), Object.values(limits).reduce((sum, limit) => sum + limit, 0)) };
}

function checkDemonstration(economy, newCompany) {
  if (economy.demonstration && newCompany.slots.some(slot => economy.workers[slot.worker]?.role === 'working')
    && !demonstrationStatus(economy).eligible) economy.demonstration = false;
}

export function unionMember(economy, id) {
  return economy.unions?.includes(id) ?? false;
}

function unionEmployment(economy, skill) {
  return Object.values(economy.companies).filter(item => operational(item) && card(item.id).resource === skill)
    .flatMap(item => item.slots).filter(slot => economy.workers[slot.worker]?.role === 'working').length;
}

export function updateUnions(economy) {
  if (!economy.unions) return;
  economy.unions = economy.unions.filter(id => {
    const worker = economy.workers[id];
    if (unionEmployment(economy, worker.skill) >= 4) return true;
    worker.committed = false;
    return false;
  });
}

function formUnion(economy, id) {
  const worker = economy.workers[id];
  const unions = economy.unions ??= [];
  requireRule(worker?.role === 'working' && worker.skill !== 'any' && !worker.committed && !workplace(economy, id)
    && !unions.some(member => economy.workers[member].skill === worker.skill)
    && unionEmployment(economy, worker.skill) >= 4, '工會須由一名待業技術工成立，且同產業須已有至少四名勞工。');
  unions.push(id);
  worker.committed = true;
}

function fits(worker, slot) {
  return worker && (!slot.role || slot.role === worker.role) && (slot.skill === 'any' || worker.skill === slot.skill);
}

function finishStaffing(economy, sources, destinations) {
  for (const id of new Set([...sources, ...destinations])) {
    const item = economy.companies[id];
    const workers = item.slots.map(slot => economy.workers[slot.worker]).filter(Boolean);
    if (!operational(item)) {
      requireRule(!destinations.has(id), '必須填滿公司所有必要工位。');
      requireRule(workers.every(worker => !worker.committed), '不能讓已承諾的工人失業。');
      for (const slot of item.slots) slot.worker = null;
      if (item.strike) delete item.strike;
      continue;
    }
    if (activeCompany(economy, id).owner !== 'middle') {
      requireRule(workers.every(worker => worker.role === workers[0].role), '同一家公營或資本家企業的工人須屬於同一階級。');
      if (workers.some(worker => !worker.committed)) for (const worker of workers) worker.committed = false;
    }
  }
}

export function assign(economy, role, moves, limit = 3, { preserveUncommitted = false, allowSource } = {}) {
  requireRule(Array.isArray(moves) && moves.length >= 1 && moves.length <= limit, `每次可指派 1 至 ${limit} 名工人。`);
  const uncommittedCompanies = new Set();
  if (preserveUncommitted) {
    const moving = new Set(moves.map(move => move?.worker));
    for (const item of Object.values(economy.companies)) {
      if (!operational(item)) continue;
      const staff = item.slots.map(slot => economy.workers[slot.worker]).filter(Boolean);
      const ownStaff = staff.filter(worker => worker.role === role);
      if (staff.every(worker => !worker.committed) && ownStaff.length && ownStaff.every(worker => moving.has(worker.id))) {
        uncommittedCompanies.add(item.id);
      }
    }
  }
  const sources = new Set();
  const destinations = new Set();
  const workers = new Set();
  for (const move of moves) {
    const worker = move && Object.hasOwn(economy.workers, move.worker) && economy.workers[move.worker];
    const destination = move && Object.hasOwn(economy.companies, move.company) && economy.companies[move.company];
    const slot = Number.isInteger(move?.slot) && destination?.slots[move.slot];
    requireRule(worker?.role === role && !worker.committed && !workers.has(worker.id), '請選擇不同且尚未承諾的己方工人。');
    const source = workplace(economy, worker.id);
    requireRule(!allowSource || allowSource(source, worker), '不能從這家企業調動工人。');
    requireRule(slot && fits(worker, slot), '請指派至符合階級與技能的企業工位。');
    requireRule(source?.id !== destination.id, '指派需移往另一家企業。');
    destinations.add(destination.id);
    if (source) {
      sources.add(source.id);
      source.slots.find(item => item.worker === worker.id).worker = null;
    }
    workers.add(worker.id);
  }
  for (const { worker, company: id, slot: index } of moves) {
    const slot = economy.companies[id].slots[index];
    requireRule(!slot.worker, '工位已有人或在本次行動中重複選取。');
    slot.worker = worker;
    economy.workers[worker].committed = !uncommittedCompanies.has(id);
  }
  finishStaffing(economy, sources, destinations);
}

export function funds(game, role) {
  if (role === 'state') return game.treasury;
  const player = game.players[role];
  return role === 'capitalist' ? player.revenue + player.capital : player.cash;
}

export function credit(game, role, amount) {
  if (role === 'state') game.treasury += amount;
  else if (role === 'capitalist') game.players[role].revenue += amount;
  else game.players[role].cash += amount;
}

export function pay(game, role, amount, mandatory = false, capitalFirst = false) {
  const required = Math.max(0, Math.ceil((amount - funds(game, role)) / base.loans.principal));
  if (required) {
    requireRule(mandatory, '資金不足，自願支出不能借貸。');
    const taken = Object.values(game.economy.loans).reduce((sum, count) => sum + count, 0);
    requireRule(game.settlementEstimate || taken + required <= base.components.small_cards.loans, '全桌貸款牌不足，無法支付這筆強制支出。');
  }
  while (funds(game, role) < amount) {
    const loans = game.economy.loans;
    loans[role] = (loans[role] ?? 0) + 1;
    if (role === 'capitalist') game.players[role].capital += base.loans.principal;
    else credit(game, role, base.loans.principal);
  }
  if (role === 'capitalist') {
    const player = game.players.capitalist;
    const first = capitalFirst ? 'capital' : 'revenue';
    const second = capitalFirst ? 'revenue' : 'capital';
    const fromFirst = Math.min(amount, player[first]);
    player[first] -= fromFirst;
    player[second] -= amount - fromFirst;
  } else credit(game, role, -amount);
}

function availableHires(economy, slots, role) {
  const idle = Object.values(economy.workers).filter(worker => worker.role === role && !worker.committed && !workplace(economy, worker.id));
  idle.sort((a, b) => Number(b.skill === 'any') - Number(a.skill === 'any'));
  const selected = new Map();
  const orderedSlots = [...slots].sort((a, b) => Number(a.skill === 'any') - Number(b.skill === 'any'));
  for (const slot of orderedSlots) {
    const index = idle.findIndex(worker => fits(worker, slot));
    if (index < 0) return null;
    selected.set(slot, idle.splice(index, 1)[0]);
  }
  return selected;
}

function commitHires(selected) {
  for (const [slot, worker] of selected) {
    slot.worker = worker.id;
    worker.committed = true;
  }
}

export function hireUnemployed(economy, slots, role) {
  const selected = availableHires(economy, slots, role);
  requireRule(selected, '失業區沒有符合全部工位的同階級工人。');
  commitHires(selected);
}

export function fillRequiredHires(economy, item, role) {
  const vacancies = item.slots.filter(slot => !slot.optional && !slot.worker);
  requireRule(vacancies.length, '這家企業沒有需要補人的必要工位。');
  const selected = availableHires(economy, vacancies, role);
  requireRule(selected, '失業區沒有符合必要工位的同階級工人。');
  commitHires(selected);
}

export function setWagePolicy(game, forcedLevel) {
  const minimum = base.policies.minimum_wage_level[game.policies[1]];
  for (const item of Object.values(game.economy.companies)) {
    if (card(item.id).wages) item.wage = forcedLevel ?? Math.max(item.wage, minimum);
  }
}

export function publicCapacity(economy, resource) {
  const override = economy.publicCapacityOverride?.[resource];
  if (Number.isInteger(override) && override >= 0) return override;
  return Object.values(economy.companies).map(item => activeCompany(economy, item.id))
    .filter(item => item.owner === 'state' && item.resource === resource).reduce((sum, item) => sum + item.output, 6);
}

export function syncPublicStorage(game) {
  for (const resource of Object.keys(game.publicServices)) {
    game.publicServices[resource] = Math.min(game.publicServices[resource], publicCapacity(game.economy, resource));
  }
}

export function storageUnits(economy, role, resource) {
  const units = economy.storageUnits?.[role]?.[resource];
  if (Number.isInteger(units) && units >= 1) return units;
  return economy.storage?.[role]?.includes(resource) ? 2 : 1;
}

export function storageCapacity(economy, role, resource) {
  return base.limits[`${role}_storage`][resource] * storageUnits(economy, role, resource);
}

export function publicSectorChoices(game) {
  const { economy } = game;
  const limit = base.policies.fiscal[game.policies[0]].public_count;
  const roster = publicRoster(economy);
  const active = roster.map(id => economy.companies[id]).filter(item => item && activeCompany(economy, item.id).owner === 'state');
  const closed = roster.filter(id => id && !economy.companies[id]);
  const count = limit - active.length;
  return { opening: count > 0, count: count < 0 ? -count : Math.min(count, closed.length),
    companies: (count < 0 ? active.map(item => item.id) : closed)
      .map(id => ({ ...companyDefinition(id), position: roster.indexOf(id) + 1 })) };
}

export function publicHiringChoices(economy, item) {
  return ['working', 'middle'].flatMap(role => {
    const proposed = availableHires(economy, item.slots, role);
    if (!proposed) return [];
    const idle = Object.values(economy.workers).filter(worker => worker.role === role && !worker.committed && !workplace(economy, worker.id));
    const slots = item.slots.map(slot => ({ skill: slot.skill, preferred: proposed.get(slot).id,
      workers: idle.filter(worker => fits(worker, slot)).map(worker => worker.id) }));
    return [{ role, slots }];
  });
}

export function resizePublicSector(game, selections, { testing = false } = {}) {
  const { economy } = game;
  const { opening, count, companies } = publicSectorChoices(game);
  const ids = selections ?? (opening ? companies.slice(0, count) : companies.slice(companies.length - count)).map(item => item.id);
  requireRule(Array.isArray(ids) && ids.length === count && new Set(ids).size === count
    && ids.every(id => companies.some(item => item.id === id)), `請選擇 ${count} 家公營企業。`);
  const added = [];
  const closed = [];
  for (const id of opening ? [] : ids) {
    const item = economy.companies[id];
    const definition = card(item.id);
    if (!testing) credit(game, 'state', definition.cost);
    for (const slot of item.slots) if (slot.worker) economy.workers[slot.worker].committed = false;
    delete economy.companies[item.id];
    closed.push(definition.name);
  }
  const minimum = base.policies.minimum_wage_level[game.policies[1]];
  for (const id of opening ? ids : []) {
    const definition = card(id);
    if (!testing) pay(game, 'state', definition.cost, true);
    const item = company(id, minimum);
    if (definition.owner !== 'state') item.owner = 'state';
    if (!selections) {
      const selected = availableHires(economy, item.slots, 'working') ?? availableHires(economy, item.slots, 'middle');
      if (selected) commitHires(selected);
    }
    economy.companies[id] = item;
    added.push(definition.name);
  }
  for (const id of added.length ? ids.filter(id => economy.companies[id]) : []) {
    const item = economy.companies[id];
    if (item && item.slots.some(slot => economy.workers[slot.worker]?.role === 'working')) checkDemonstration(economy, item);
  }
  syncPublicStorage(game);
  if (added.length) game.log.push(`公營部門開設 ${added.join('、')}。`);
  if (closed.length) game.log.push(`公營部門關閉 ${closed.join('、')}。`);
  return closed;
}

export function hirePublicCompany(economy, item, role, staff) {
  if (staff === undefined) hireUnemployed(economy, item.slots, role);
  else {
    const choice = publicHiringChoices(economy, item).find(option => option.role === role);
    requireRule(Array.isArray(staff) && staff.length === item.slots.length && new Set(staff).size === staff.length
      && choice?.slots.every((slot, index) => slot.workers.includes(staff[index])), '請為每個工位選擇不同且符合條件的待業工人。');
    commitHires(new Map(item.slots.map((slot, index) => [slot, economy.workers[staff[index]]])));
  }
  checkDemonstration(economy, item);
}

function legalWage(game, wage) {
  requireRule(Number.isInteger(wage) && wage >= base.policies.minimum_wage_level[game.policies[1]] && wage <= 3, '薪資必須符合勞動市場政策。');
}

export function canBuildIndustry(game, role, id) {
  const { economy } = game;
  const definition = card(id);
  const limit = role === 'capitalist' ? base.limits.capitalist_companies : base.limits.middle_companies;
  return definition.cost >= 15 && funds(game, 'state') >= definition.cost && ownedCompanies(economy, role).length < limit
    && (role !== 'middle' || Boolean(availableHires(economy, company(id).slots.filter(slot => !slot.optional), 'middle')));
}

function planBuildStaff(economy, item, role, staff, unemployedOperators) {
  requireRule(Array.isArray(staff) && staff.length === item.slots.length, '請逐一指定新企業的工位。');
  const seen = new Set();
  const operators = [];
  const hires = new Map();
  const isIdle = worker => !workplace(economy, worker.id);
  for (const [index, slot] of item.slots.entries()) {
    const id = staff[index];
    const operator = role === 'middle' && !slot.optional;
    if (id === null) {
      requireRule(!operator, '必須填滿中產企業的必要工位。');
      continue;
    }
    const worker = typeof id === 'string' && Object.hasOwn(economy.workers, id) && economy.workers[id];
    requireRule(fits(worker, slot) && !worker.committed && !unionMember(economy, id) && !seen.has(id), '工人不可重複，且必須符合工位技能和階級。');
    requireRule((operator && !unemployedOperators) || isIdle(worker), '立即雇用只能從待業區選擇工人。');
    seen.add(id);
    if (operator) operators.push({ worker: id, company: item.id, slot: index });
    else hires.set(slot, worker);
  }
  const hired = [...hires.values()];
  if (role === 'capitalist' && hired.length) {
    requireRule(hired.length === item.slots.length && hired.every(worker => worker.role === hired[0].role), '資本家立即雇用時，必須由同一階級工人填滿全部工位。');
  }
  if ([...hires].some(([slot, worker]) => slot.skill === 'any' && worker.skill !== 'any')) {
    requireRule(!Object.values(economy.workers).some(worker => worker.role === hired[0].role && worker.skill === 'any'
      && !worker.committed && !unionMember(economy, worker.id) && !seen.has(worker.id) && isIdle(worker)), '通用工位須優先使用待業的非技術工人。');
  }
  return { operators, hires };
}

export function canStaffInvestment(economy, role, id) {
  if (role !== 'middle') return true;
  const item = company(id);
  const required = item.slots.filter(slot => !slot.optional);
  const workers = Object.values(economy.workers).filter(worker => worker.role === role
    && !worker.committed && !unionMember(economy, worker.id));
  function match(moves) {
    const slot = required[moves.length];
    if (slot) return workers.some(worker => fits(worker, slot) && !moves.some(move => move.worker === worker.id)
      && match([...moves, { worker: worker.id, company: id, slot: moves.length }]));
    const projected = structuredClone(economy);
    projected.companies[id] = structuredClone(item);
    try {
      assign(projected, role, moves);
      return true;
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      return false;
    }
  }
  return match([]);
}

export function build(game, role, command, options = {}) {
  const economy = game.economy;
  const { company: id, wage, operator, hire } = command;
  const market = economy.markets[role];
  const source = options.fromDeck ? economy.companyDecks?.[role] : market;
  requireRule(source?.includes(id), '請選擇符合條件的企業牌。');
  const item = company(id, wage);
  const definition = card(id);
  const limit = role === 'capitalist' ? base.limits.capitalist_companies : base.limits.middle_companies;
  requireRule(ownedCompanies(economy, role).length < limit, '已達企業數量上限。');
  if (definition.wages) legalWage(game, wage);
  const staffing = command.staff === undefined ? null : planBuildStaff(economy, item, role, command.staff, options.unemployedOperators);
  const discount = options.discount ?? 0;
  const cost = Math.max(0, definition.cost - discount);
  pay(game, options.payer ?? role, cost, options.mandatoryPay ?? false);
  if (options.subsidy) pay(game, 'state', options.subsidy, true);
  economy.companies[id] = item;
  if (staffing) {
    if (staffing.operators.length) assign(economy, role, staffing.operators);
    commitHires(staffing.hires);
  } else if (role === 'middle') {
    const operators = command.operators ?? [operator];
    requireRule(Array.isArray(operators) && operators.length === definition.skills.length, '必須為每個必要工位指定中產工人。');
    if (options.unemployedOperators) requireRule(operators.every(worker => !workplace(economy, worker)), '必須使用待業中產工人。');
    assign(economy, role, operators.map((worker, slot) => ({ worker, company: id, slot })));
    if (hire === 'working' && definition.employee) hireUnemployed(economy, item.slots.filter(slot => slot.optional), 'working');
  } else if (hire) {
    requireRule(['working', 'middle'].includes(hire), '請選擇可雇用的階級。');
    hireUnemployed(economy, item.slots, hire);
  }
  if (options.fromDeck) economy.companyDecks[role] = shuffled(source.filter(key => key !== id));
  else economy.markets[role] = market.filter(key => key !== id);
  checkDemonstration(economy, item);
  return `建造${definition.name}（${definition.cost}）。`;
}

export function adjustWages(game, role, changes, policyChange = false) {
  requireRule(Array.isArray(changes) && changes.length > 0 && changes.length <= 12, '請選擇要調整薪資的企業。');
  requireRule(new Set(changes.map(change => change?.company)).size === changes.length, '同一家企業只能調整一次。');
  for (const change of changes) {
    const item = change && Object.hasOwn(game.economy.companies, change.company) && game.economy.companies[change.company];
    requireRule(item && activeCompany(game.economy, item.id).owner === role && card(item.id).wages, '只能調整自己有薪資的企業。');
    legalWage(game, change.wage);
    const workers = item.slots.filter(slot => role !== 'middle' || slot.optional)
      .map(slot => game.economy.workers[slot.worker]).filter(Boolean);
    requireRule(change.wage !== item.wage, '請選擇不同的薪資級距。');
    if (change.wage < item.wage) requireRule(workers.every(worker => !worker.committed), '已承諾的工人不得降薪。');
    if (!policyChange && change.wage > item.wage) for (const worker of workers) worker.committed = true;
    item.wage = change.wage;
  }
  return `調整 ${changes.length} 家企業的薪資。`;
}

export function companyAction(game, role, command) {
  const economy = game.economy;
  requireRule(economy, '這個房間使用先前的政治試玩規則。');
  switch (command.type) {
    case 'assign':
      requireRule(['working', 'middle'].includes(role), '只有勞工與中產可執行工人指派。');
      requireRule(!command.unionWorker || role === 'working', '只有勞工可成立工會。');
      if (command.moves?.length || !command.unionWorker) assign(economy, role, command.moves, command.unionWorker ? 2 : 3);
      if (command.unionWorker) formUnion(economy, command.unionWorker);
      return `指派 ${command.moves?.length ?? 0} 名工人。${command.unionWorker ? '成立一個工會。' : ''}`;
    case 'build': return build(game, role, command);
    case 'wages': return adjustWages(game, role, command.changes);
    case 'sell': return sellCompany(game, role, command.company);
    default: return null;
  }
}

export function sellCompany(game, role, id, multiplier = 1) {
  const { economy } = game;
  const item = Object.hasOwn(economy.companies, id) && economy.companies[id];
  requireRule(item && ['middle', 'capitalist'].includes(role) && activeCompany(economy, item.id).owner === role, '只能出售自己的私營企業。');
  requireRule(item.slots.every(slot => !economy.workers[slot.worker]?.committed), '企業有已承諾的工人，不能出售。');
  const definition = card(item.id);
  requireRule(multiplier === 1 || (!definition.machineryBonus && !definition.automated), '此企業印有機械符號。');
  delete economy.companies[item.id];
  if (!publicRoster(economy).includes(id)) economy.companyDiscard?.[role].push(id);
  const amount = definition.cost * multiplier;
  credit(game, role, amount);
  return `出售${definition.name}（${amount}）。`;
}

export function makeFarm(game, ids) {
  const { economy } = game;
  const baseId = 'company-working-cooperative-farm';
  const id = [baseId, `${baseId}~2`].find(key => !economy.companies[key]);
  requireRule(id && Array.isArray(ids) && ids.length === 3 && ids.every(worker => !workplace(economy, worker)), '請選三名待業工人並確認尚有農場。');
  economy.companies[id] = company(id);
  assign(economy, 'working', ids.map((worker, slot) => ({ worker, company: id, slot })));
  checkDemonstration(economy, economy.companies[id]);
}

function heldGoods(game, resource) {
  const { economy, publicServices, players } = game;
  return (publicServices[resource] ?? 0) + (economy.tradeZone[resource] ?? 0)
    + Object.values(economy.inventory).reduce((sum, stock) => sum + (stock[resource] ?? 0), 0)
    + Object.values(players).reduce((sum, player) => sum + (player[resource] ?? 0), 0)
    + Object.values(game.content?.benefits ?? {}).reduce((sum, benefit) => sum + (benefit?.[resource] ?? 0), 0);
}

function produce(game, definition, amount) {
  const { economy, publicServices, players } = game;
  const { owner, resource } = definition;
  if (owner === 'working') {
    const stored = Math.min(amount, Math.max(0, 62 - heldGoods(game, resource)));
    players.working.food += stored;
    return { stored, discarded: amount - stored };
  }
  const inventory = owner === 'state' ? publicServices : economy.inventory[owner];
  if (resource === 'influence') {
    amount = Math.min(amount, availableInfluence(game));
    if (owner !== 'state') {
      players[owner].influence += amount;
      return { stored: amount, discarded: 0 };
    }
  } else {
    const supply = resource === 'food' ? 62 : 64;
    amount = Math.min(amount, Math.max(0, supply - heldGoods(game, resource)));
  }
  const capacity = owner === 'state' ? publicCapacity(economy, resource) : storageCapacity(economy, owner, resource);
  const stored = Math.min(amount, Math.max(0, capacity - (inventory[resource] ?? 0)));
  inventory[resource] = (inventory[resource] ?? 0) + stored;
  if (owner !== 'capitalist' || !Object.hasOwn(economy.tradeZone, resource)) {
    return { stored, discarded: amount - stored };
  }
  const overflow = Math.min(amount - stored, base.limits.free_trade_zone_capacity[resource] - economy.tradeZone[resource]);
  economy.tradeZone[resource] += overflow;
  return { stored: stored + overflow, discarded: amount - stored - overflow };
}

export function availableInfluence(game) {
  const personal = Object.values(game.players).reduce((sum, player) => sum + player.influence, 0);
  const benefits = Object.values(game.content?.benefits ?? {}).reduce((sum, benefit) => sum + (benefit.influence ?? 0), 0);
  return Math.max(0, base.components.wooden.influence - game.publicServices.influence - personal - benefits);
}

function planProduction(game, id, operatorOnly = false) {
  const item = Object.hasOwn(game.economy.companies, id) && game.economy.companies[id];
  requireRule(item && operational(item), '此企業未營運。');
  const definition = activeCompany(game.economy, item.id);
  const { owner } = definition;
  const paidSlot = owner === 'middle' ? item.slots.find(slot => slot.optional) : item.slots[0];
  const strike = item.strike && item.wage !== 3;
  if (strike && owner !== 'middle') return null;
  const recipient = !strike && !operatorOnly && game.economy.workers[paidSlot?.worker]?.role;
  const wage = recipient ? (definition.wages?.[item.wage - 1] ?? 0) : 0;
  const produced = definition.output + (owner === 'middle' && recipient ? definition.employee.output : 0)
    + (item.machine ? definition.machineryBonus ?? 0 : 0);
  return { definition, recipient, wage, produced };
}

function payProductionWage(game, { definition, recipient, wage }, mandatory, deferWorking = false) {
  if (!wage) return;
  pay(game, definition.owner, wage, mandatory);
  if (deferWorking && recipient === 'working' && game.match?.pendingWorkingWages !== undefined) {
    game.match.pendingWorkingWages += wage;
  } else credit(game, recipient, wage);
}

function storeProduction(game, { definition, recipient, wage, produced }) {
  const { stored, discarded } = produce(game, definition, produced);
  return { company: definition.name, owner: definition.owner, resource: definition.resource, produced, stored, discarded, recipient, wage };
}

export function produceCompany(game, id, mandatory = false, operatorOnly = false) {
  const plan = planProduction(game, id, operatorOnly);
  if (!plan) return null;
  payProductionWage(game, plan, mandatory);
  return storeProduction(game, plan);
}

export const productionOrder = ['state', 'capitalist', 'middle', 'working'];

export function productionPlans(game, owner) {
  return Object.values(game.economy.companies)
    .filter(item => activeCompany(game.economy, item.id).owner === owner && operational(item))
    .map(item => planProduction(game, item.id)).filter(Boolean);
}

export function runProductionStep(game, owner, stage) {
  const plans = productionPlans(game, owner);
  if (stage === 'wages') {
    for (const plan of plans) payProductionWage(game, plan, true, true);
  } else {
    for (const plan of plans) game.economy.production.push(storeProduction(game, plan));
  }
}

export function finishCompanyProduction(game) {
  const { economy } = game;
  for (const worker of Object.values(economy.workers)) worker.committed = unionMember(economy, worker.id);
  for (const item of Object.values(economy.companies)) delete item.strike;
  game.log.push(`完成 ${economy.production.length} 家營運企業的生產與發薪。`);
}

export function economyView(economy) {
  if (!economy) return null;
  return {
    companies: Object.values(economy.companies).map(item => ({ ...activeCompany(economy, item.id), ...item, operational: operational(item) })),
    workers: Object.values(economy.workers).map(worker => ({ ...worker, company: workplace(economy, worker.id)?.id ?? null, union: unionMember(economy, worker.id) })),
    markets: Object.fromEntries(Object.entries(economy.markets).map(([role, ids]) => [role, ids.map(card)])),
    inventory: economy.inventory, tradeZone: economy.tradeZone, loans: economy.loans, production: economy.production,
    publicSector: publicRoster(economy).map(id => {
      if (!id) return { face: 'empty' };
      const item = economy.companies[id];
      if (!item) return { face: 'closed' };
      return activeCompany(economy, id).owner === 'state' ? { face: 'open', id } : { face: 'empty' };
    }),
    storageCapacity: Object.fromEntries(['middle', 'capitalist'].map(role => [role, Object.fromEntries(
      Object.keys(base.limits[`${role}_storage`]).map(resource => [resource, storageCapacity(economy, role, resource)]))])),
    storageUnits: Object.fromEntries(['middle', 'capitalist'].map(role => [role, Object.fromEntries(
      Object.keys(base.limits[`${role}_storage`]).map(resource => [resource, storageUnits(economy, role, resource)]))])),
    publicStorageCapacity: Object.fromEntries(['food', 'luxury', 'health', 'education', 'influence']
      .map(resource => [resource, publicCapacity(economy, resource)])),
    freeTradeCapacity: base.limits.free_trade_zone_capacity,
    unions: economy.unions ?? [],
  };
}
