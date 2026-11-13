import { catalogCard } from './content.mjs';
import { build, canBuildIndustry, credit, funds, operationalCount, pay, publicCapacity, ownedCompanies } from './companies.mjs';
import { population } from './rounds.mjs';
import { marketQuote } from './prices.mjs';
import { requireRule } from './errors.mjs';

export const classes = ['working', 'middle', 'capitalist'];
const people = ['working', 'middle'];
const sellers = ['middle', 'capitalist'];
const workers = ['working', 'capitalist'];
const half = amount => Math.ceil(amount / 2);

const eventSpecs = {
  'political-scandal': { kind: 'distribute', resource: 'influence', max: 3, cost: 25 },
  'neighbors-at-war': { kind: 'spend', resource: 'health', max: 6 },
  pandemic: { kind: 'buy', resource: 'health' },
  'strike-at-the-port': { kind: 'provide', targets: workers, resources: ['influence'], amount: 2, reward: 'token' },
  'low-education-index': { kind: 'provide', targets: people, resources: ['education'], amount: 'half-population', reward: 1 },
  'need-for-sustainability-initiative': { kind: 'two', amount: 25 },
  'fear-of-deflation': { kind: 'budget', amounts: [15, 30, 45] },
  'declining-birth-rate': { kind: 'provide', targets: people, resources: ['health'], amount: 'half-population', reward: 1 },
  'need-for-stimulus-package': { kind: 'stimulus', amounts: [10, 15] },
  'demand-for-thirteen-month-pay': { kind: 'provide', targets: people, resources: ['cash'], amount: 'public-jobs', reward: 'thirteen' },
  'companies-demand-better-internet': { kind: 'provide', targets: sellers, resources: ['luxury'], amount: 'half-firms', reward: 'per-two' },
  drought: { kind: 'provide', targets: workers, resources: ['food'], amount: 'half-role', reward: 'token' },
  'local-industries-in-turmoil': { kind: 'provide', targets: sellers, resources: ['cash'], amount: 'firms-money', reward: 'industries' },
  'technological-illiteracy': { kind: 'provide', targets: workers, resources: ['luxury', 'education'], amount: 'half-role', reward: 'per-two' },
  'demand-for-higher-welfare-standards': { kind: 'provide', targets: people, resources: ['health', 'education'], amount: 'half-population', reward: 1 },
  'developing-countries-in-need': { kind: 'spend', resource: 'education', max: 6 },
  'infant-industry-requires-help': { kind: 'industry', targets: sellers },
  'outdated-public-sector-infrastructure': { kind: 'buy', resource: 'luxury' },
  earthquake: { kind: 'provide', targets: people, resources: ['food', 'health'], amount: 'half-population', reward: 'per-two' },
  'demand-for-pension-reform': { kind: 'provide', targets: people, resources: ['cash'], amount: 'population-money', reward: 'pension' },
  'political-polarization': { kind: 'distribute', resource: 'votes', max: 4, cost: 30 },
  'civil-unrest': { kind: 'civil', targets: classes },
  'unfair-representation': { kind: 'representation', targets: classes },
  'low-university-ratings': { kind: 'buy', resource: 'education' },
  'global-supply-chain-crisis': { kind: 'provide', targets: people, resources: ['food', 'luxury'], amount: 'half-population', reward: 'chain' },
};

export function eventSpec(id) {
  return eventSpecs[id?.slice(6)];
}

export function adjustLegitimacy(game, role, delta) {
  game.legitimacy[role] = Math.max(1, Math.min(10, game.legitimacy[role] + delta));
}

export function legitimacyToken(game, role, count = 1) {
  if (!game.content) return;
  const current = game.content.legitimacyTokens[role];
  const total = Object.values(game.content.legitimacyTokens).reduce((sum, amount) => sum + amount, 0);
  const granted = Math.min(count, 18 - total);
  game.content.legitimacyTokens[role] = current + granted;
  adjustLegitimacy(game, role, granted);
}

export function giveBenefit(game, role, resource, amount, keep = false) {
  const benefits = game.content.benefits;
  if (!keep) benefits[role] = {};
  benefits[role][resource] = (benefits[role][resource] ?? 0) + amount;
}

export function provide(game, role, resource, amount, keep = false) {
  if (resource === 'cash') pay(game, 'state', amount);
  else {
    let remaining = amount;
    const own = Math.min(remaining, game.publicServices[resource] ?? 0);
    if (own) game.publicServices[resource] -= own;
    remaining -= own;
    if (resource !== 'influence') {
      for (const seller of sellers.filter(item => item !== role)) {
        const stock = game.economy.inventory[seller];
        const quantity = Math.min(remaining, stock[resource]);
        const cost = quantity * marketQuote(game, seller, resource).price;
        pay(game, 'state', cost);
        stock[resource] -= quantity;
        credit(game, seller, cost);
        remaining -= quantity;
      }
    }
    if (remaining && ['food', 'luxury'].includes(resource)) {
      pay(game, 'state', remaining * (resource === 'food' ? 10 : 6));
      remaining = 0;
    }
    requireRule(remaining === 0, '國家與可交易來源的資源不足。');
  }
  giveBenefit(game, role, resource, amount, keep);
}

export function transferPersonalBenefit(game, role, amount, votes, keep = false) {
  requireRule(game.players.state.influence >= amount, '國家個人影響力不足。');
  game.players.state.influence -= amount;
  giveBenefit(game, role, 'influence', amount, keep);
  reserveVotes(game, role, votes);
}

function reserveVotes(game, role, amount) {
  const current = game.content.benefits[role].votes ?? 0;
  requireRule(amount <= 25 - game.bag[role] - current, '投票方塊供應不足。');
  giveBenefit(game, role, 'votes', amount, true);
}

export function takeBenefits(game, role) {
  const benefit = game.content?.benefits[role];
  requireRule(benefit && Object.values(benefit).some(amount => amount > 0), '此階級目前沒有可領的福利。');
  for (const [resource, amount] of Object.entries(benefit)) {
    if (resource === 'cash') credit(game, role, amount);
    else if (resource === 'votes') game.bag[role] += amount;
    else game.players[role][resource] = (game.players[role][resource] ?? 0) + amount;
  }
  game.content.benefits[role] = {};
  game.players.state.vp++;
}

function expectedAmount(game, role, spec) {
  const pop = population(game, role);
  const firms = operationalCount(game.economy, role);
  switch (spec.amount) {
    case 'half-population': return half(pop);
    case 'half-firms': return half(firms);
    case 'half-role': return half(role === 'capitalist' ? firms : pop);
    case 'firms-money': return firms * 5;
    case 'population-money': return pop * 5;
    case 'public-jobs': return ownedCompanies(game.economy, 'state').reduce((sum, item) => sum + game.economy.companies[item.id].slots
      .filter(slot => game.economy.workers[slot.worker]?.role === role).length, 0) * 5;
    default: return spec.amount;
  }
}

function applyReward(game, role, spec, amount) {
  if (typeof spec.reward === 'number') adjustLegitimacy(game, role, spec.reward);
  if (spec.reward === 'token') legitimacyToken(game, role);
  if (spec.reward === 'per-two' || (spec.reward === 'chain' && role === 'working')) adjustLegitimacy(game, role, Math.floor(amount / 2));
  if (spec.reward === 'chain' && role === 'middle') game.players.state.vp += amount;
  if (spec.reward === 'thirteen') {
    if (role === 'working') legitimacyToken(game, role, Math.floor(amount / 25));
    else adjustLegitimacy(game, role, Math.floor(amount / 15));
  }
  if (spec.reward === 'pension' || spec.reward === 'industries') {
    if (role === 'middle') legitimacyToken(game, role, Math.floor(amount / 20));
    else game.players.state.vp += 2 * Math.floor(amount / 15);
  }
}

export function resolveEvent(game, command, { keep = false, remove = true } = {}) {
  const { content } = game;
  requireRule(content?.events.includes(command.eventId), '請選擇場上的事件。');
  const event = catalogCard(command.eventId);
  const spec = eventSpec(event.id);
  const { recipient, amount } = command;
  if (spec.targets) requireRule(spec.targets.includes(recipient), '請選擇符合事件條件的階級。');
  switch (spec.kind) {
    case 'provide': {
      const count = expectedAmount(game, recipient, spec);
      requireRule(count > 0, '此階級目前沒有符合的數量。');
      if (spec.resources.length === 1) provide(game, recipient, spec.resources[0], count, keep);
      else {
        requireRule(Number.isInteger(amount) && amount > 0 && amount < count, `兩種資源各至少 1，合計 ${count}。`);
        provide(game, recipient, spec.resources[0], amount, keep);
        provide(game, recipient, spec.resources[1], count - amount, true);
      }
      applyReward(game, recipient, spec, count);
      break;
    }
    case 'spend':
      requireRule(Number.isInteger(amount) && amount >= 1 && amount <= spec.max && amount <= game.publicServices[spec.resource], '支出的資源數量無效，至少要支出 1 份。');
      game.publicServices[spec.resource] -= amount;
      game.players.state.vp += amount;
      break;
    case 'budget':
      requireRule(spec.amounts.includes(amount), '請選擇事件上的金額。');
      pay(game, 'state', amount);
      game.players.state.vp += amount / 15 * 2;
      break;
    case 'stimulus':
      requireRule(spec.amounts.includes(amount), '請選擇事件上的金額。');
      for (const role of classes) provide(game, role, 'cash', amount, keep);
      if (amount === 10) game.players.state.vp += 3;
      else for (const role of classes) adjustLegitimacy(game, role, 1);
      break;
    case 'two': {
      const choices = command.recipients;
      requireRule(Array.isArray(choices) && choices.length === 2 && new Set(choices).size === 2 && choices.every(role => classes.includes(role)), '請選兩個不同階級。');
      for (const role of choices) {
        provide(game, role, 'cash', spec.amount, keep);
        legitimacyToken(game, role);
      }
      break;
    }
    case 'representation':
      transferPersonalBenefit(game, recipient, 1, 2, keep);
      adjustLegitimacy(game, recipient, 1);
      break;
    case 'buy': {
      const qty = validateDistribution(command.distribution, sellers);
      const count = Object.values(qty).reduce((sum, value) => sum + value, 0);
      const stock = game.publicServices[spec.resource] ?? 0;
      requireRule(count > 0 && count <= ownedCompanies(game.economy, 'state').length && stock + count <= publicCapacity(game.economy, spec.resource), '超出可購買數量或公營容量。');
      for (const [role, value] of Object.entries(qty)) {
        const inventory = game.economy.inventory[role];
        requireRule(inventory[spec.resource] >= value, '賣方庫存不足。');
        const cost = value * marketQuote(game, role, spec.resource).price;
        pay(game, 'state', cost);
        inventory[spec.resource] -= value;
        credit(game, role, cost);
        adjustLegitimacy(game, role, Math.floor(value / 3));
      }
      game.publicServices[spec.resource] = stock + count;
      break;
    }
    case 'distribute': {
      const qty = validateDistribution(command.distribution, classes);
      const count = Object.values(qty).reduce((sum, value) => sum + value, 0);
      requireRule(spec.resource === 'votes' ? count === spec.max : count >= 1 && count <= spec.max && count <= game.publicServices.influence, '分配數量不符合事件，至少要分配 1 份。');
      pay(game, 'state', spec.cost);
      for (const [role, value] of Object.entries(qty)) {
        if (!value) continue;
        if (spec.resource === 'influence') {
          provide(game, role, 'influence', value, keep);
          adjustLegitimacy(game, role, value);
        } else {
          if (!keep) content.benefits[role] = {};
          reserveVotes(game, role, value);
          if (role !== 'middle') adjustLegitimacy(game, role, Math.floor(value / 2));
        }
      }
      break;
    }
    case 'industry': {
      const offer = game.economy.markets[recipient].find(id => id === command.company);
      requireRule(offer && canBuildIndustry(game, recipient, offer), '請選擇國庫能支付、有足夠工人且成本至少 15 的市場企業。');
      if (!remove || keep) {
        build(game, recipient, command, { payer: 'state', unemployedOperators: true });
        legitimacyToken(game, recipient);
      } else {
        content.eventHire = { recipient, company: offer };
        game.phase = 'event-hire';
      }
      break;
    }
    case 'civil':
      requireRule(remove, '同一事件不能同時開啟兩項選案。');
      game.content.civil = { recipient, proposed: null };
      game.phase = 'event-choice';
      break;
  }
  if (remove) content.events = content.events.filter(id => id !== event.id);
  game.log.push(`國家處理「${event.nameZh}」。`);
}

export function completeIndustry(game, role, command) {
  const { eventHire } = game.content;
  requireRule(command.type === 'event-hire' && role === eventHire.recipient, '等待新企業的所有者選擇雇用。');
  build(game, role, { ...command, company: eventHire.company }, { payer: 'state', unemployedOperators: true });
  legitimacyToken(game, role);
  game.content.eventHire = null;
  game.phase = 'action';
}

function validateDistribution(input, roles) {
  requireRule(input && typeof input === 'object' && !Array.isArray(input)
    && Object.entries(input).every(([role, value]) => roles.includes(role) && Number.isInteger(value) && value >= 0 && value <= 25), '分配欄位無效。');
  return input;
}

export function eventPenalties(game) {
  if (!game.content) return false;
  for (const id of [...game.content.events]) {
    const { unresolvedPenalty: penalty } = catalogCard(id);
    if (!penalty.roles.length) continue;
    for (const role of penalty.roles) adjustLegitimacy(game, role, penalty.legitimacyDelta);
    game.content.events = game.content.events.filter(item => item !== id);
    game.log.push(`未處理「${catalogCard(id).nameZh}」，結算合法性懲罰。`);
  }
  return game.content.events.length > 0;
}

export function choosePenalty(game, id, recipients) {
  requireRule(game.content.events.includes(id) && Array.isArray(recipients) && recipients.length === 2
    && new Set(recipients).size === 2 && recipients.every(role => classes.includes(role)), '請為此事件選擇兩個不同的受罰階級。');
  for (const role of recipients) adjustLegitimacy(game, role, -1);
  game.content.events = game.content.events.filter(item => item !== id);
  game.log.push(`未處理「${catalogCard(id).nameZh}」，結算合法性懲罰。`);
}

export function eventView(game, id) {
  const spec = eventSpec(id);
  const amounts = spec.kind === 'provide' ? Object.fromEntries(spec.targets.map(role => [role, expectedAmount(game, role, spec)])) : undefined;
  const offers = spec.kind === 'industry' ? spec.targets.flatMap(role => game.economy.markets[role]
    .filter(id => canBuildIndustry(game, role, id))) : undefined;
  return { ...catalogCard(id), form: { ...spec, targetAmounts: amounts, offers } };
}
