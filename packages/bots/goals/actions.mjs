import { playVariants, stateMainCandidates } from '../../engine/candidates.mjs';
import { domesticPriceLevels } from '../../engine/prices.mjs';

// 各席位「可能做的行動」。這裡只負責列舉候選；是否合法由 ctx.preview 在複本上試跑判定，
// 行動對各指標的影響也是試跑前後的指標差，不需要手寫每個行動的效果表。
const resources = ['food', 'luxury', 'health', 'education'];
const fits = (worker, slot) => slot.skill === 'any' || slot.skill === worker.skill;
const safe = (generate, view, role) => {
  try {
    return generate(view, role);
  } catch {
    return [];
  }
};

// 把待業工人排進空缺：整間企業的必要工位一次填滿，薪資高的優先。
function assignments(view, role) {
  if (!['working', 'middle'].includes(role)) return [];
  const idle = view.economy.workers.filter(worker => worker.role === role && !worker.company && !worker.committed && !worker.union);
  if (!idle.length) return [];
  const options = [];
  for (const company of view.economy.companies) {
    const vacancies = company.slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => !slot.worker && (!slot.role || slot.role === role));
    if (!vacancies.length || vacancies.length > 3) continue;
    const used = new Set();
    const moves = [];
    for (const { slot, index } of vacancies) {
      const worker = idle.find(item => !used.has(item.id) && item.skill === slot.skill) ?? idle.find(item => !used.has(item.id) && fits(item, slot));
      if (!worker) break;
      used.add(worker.id);
      moves.push({ worker: worker.id, company: company.id, slot: index });
    }
    if (moves.length === vacancies.length) options.push({ moves, value: (company.wages?.[(company.wage ?? 1) - 1] ?? 0) * moves.length });
  }
  return options.sort((a, b) => b.value - a.value).slice(0, 4).map(option => ({ type: 'assign', moves: option.moves }));
}

function builds(view, role) {
  if (!['middle', 'capitalist'].includes(role)) return [];
  const idle = view.economy.workers.filter(worker => worker.role === role && !worker.company && !worker.committed && !worker.union);
  const commands = [];
  for (const company of view.economy.markets[role] ?? []) {
    for (const wage of [2, 1, 3]) {
      if (role === 'capitalist') {
        for (const hire of [undefined, 'working', 'middle']) commands.push({ type: 'build', company: company.id, wage, ...(hire && { hire }) });
      } else {
        const used = new Set();
        const operators = company.skills.map(skill => {
          const worker = idle.find(item => !used.has(item.id) && item.skill === skill) ?? idle.find(item => !used.has(item.id) && item.skill === 'any');
          if (worker) used.add(worker.id);
          return worker?.id;
        });
        if (operators.every(Boolean)) for (const hire of [undefined, 'working']) commands.push({ type: 'build', company: company.id, wage, operators, ...(hire && { hire }) });
      }
    }
  }
  return commands;
}

function purchases(view, role) {
  if (!['working', 'middle'].includes(role)) return [];
  const prices = view.match?.prices ?? {};
  const population = view.match?.populations?.[role] ?? 3;
  const commands = [];
  for (const resource of resources) {
    for (const seller of ['middle', 'capitalist', 'state', 'foreign']) {
      if (seller === role) continue;
      const quote = prices[seller]?.[resource];
      if (!quote) continue;
      const available = quote.stock ?? population;
      for (const quantity of new Set([1, Math.min(population, available)])) {
        if (quantity > 0) commands.push({ type: 'buy', resource, distribution: { [seller]: quantity } });
      }
    }
  }
  return commands;
}

function exports_(view, role) {
  if (!['middle', 'capitalist'].includes(role)) return [];
  return (view.match?.exports ?? []).filter(offer => offer.available).map(offer => ({ type: 'export', offers: [offer.id] }));
}

function deals(view, role) {
  if (role !== 'capitalist') return [];
  return (view.content?.deals ?? []).flatMap(deal => ['warehouse', 'free-zone'].map(destination => ({ type: 'deal', dealId: deal.id, destination })));
}

function labor(view, role) {
  if (role !== 'working') return [];
  const commands = [];
  for (const company of view.economy.companies) {
    const mine = company.slots.some(slot => view.economy.workers.find(worker => worker.id === slot.worker)?.role === 'working');
    if (mine && company.owner !== 'working' && company.wage !== 3 && !company.strike) commands.push({ type: 'strike', companies: [company.id] });
  }
  if (view.demonstration?.eligible && !view.demonstration.active) commands.push({ type: 'demonstrate' });
  return commands;
}

// 出售自己的企業（企業有已承諾工人時引擎會拒絕）。
function sales(view, role) {
  if (!['middle', 'capitalist'].includes(role)) return [];
  return view.economy.companies.filter(company => company.owner === role).map(company => ({ type: 'sell', company: company.id }));
}

// 勞工：待業的技術工可成立工會（同產業須已有四名勞工，不足時引擎會拒絕）。
function unions(view, role) {
  if (role !== 'working') return [];
  return view.economy.workers.filter(worker => worker.role === role && worker.skill !== 'any' && !worker.company && !worker.committed && !worker.union)
    .map(worker => ({ type: 'assign', unionWorker: worker.id }));
}

function ownBusiness(view, role) {
  const commands = [];
  if (role === 'capitalist') commands.push({ type: 'lobby' });
  if (role === 'middle') {
    for (const company of view.economy.companies) if (company.owner === 'middle') commands.push({ type: 'extra-shift', company: company.id });
  }
  return commands;
}

// 免費行動：調整自己企業的薪資級距（降薪須工人未承諾，升薪會鎖定員工）。
function wageChanges(view, role) {
  if (role === 'working') return [];
  const commands = [];
  for (const company of view.economy.companies) {
    if (company.owner !== role || !company.wages) continue;
    for (const wage of [1, 2, 3]) if (wage !== company.wage) commands.push({ type: 'wages', changes: [{ company: company.id, wage }] });
  }
  return commands;
}

// 免費行動：調整自己的國內售價（只能選圖板上列出的價格）。
function priceChanges(view, role) {
  const levels = domesticPriceLevels[role];
  if (!levels) return [];
  return Object.entries(levels).flatMap(([resource, prices]) => prices.map(price => ({ type: 'adjust-prices', prices: { [resource]: price } })));
}

// 免費行動：用待業工人換下在非技術工位工作的技術工，讓技術工回到待業去做專業工位。
function swaps(view, role) {
  if (!['working', 'middle'].includes(role)) return [];
  const idle = view.economy.workers.filter(worker => worker.role === role && !worker.company && !worker.committed && !worker.union);
  const commands = [];
  for (const worker of view.economy.workers) {
    if (worker.role !== role || worker.skill === 'any' || !worker.company) continue;
    for (const replacement of idle.slice(0, 2)) commands.push({ type: 'swap-workers', swaps: [{ employed: worker.id, idle: replacement.id }] });
  }
  return commands;
}

// 免費行動：資本家付 $5 獎金鎖定一家企業的員工。
function bonuses(view, role) {
  if (role !== 'capitalist') return [];
  return view.economy.companies.filter(company => company.owner === role && company.operational).map(company => ({ type: 'give-bonus', company: company.id }));
}

// 主要行動候選。第一個一定是「施加政治壓力」（國家改用自己的清單），作為永遠合法的後備。
export function mainActions(view, role) {
  const cardId = view.hand[0]?.id;
  const commands = role === 'state' ? stateMainCandidates(view) : [{ type: 'pressure' }];
  for (const generate of [assignments, builds, purchases, exports_, deals, labor, ownBusiness, sales, unions]) commands.push(...safe(generate, view, role));
  if (role !== 'state') {
    for (const { policy, target } of view.availablePolicies) commands.push({ type: 'propose', policy, target, immediate: false });
    for (const card of view.hand) for (const variant of playVariants(view).slice(0, 2)) commands.push({ type: 'play', cardId: card.id, ...variant });
  }
  return commands.map(command => ({ cardId, ...command }));
}

// 免費行動候選：領福利、還貸、使用生活資源、買倉庫。
export function freeActions(view, role) {
  const commands = [{ type: 'benefits' }, { type: 'repay' }];
  if (['working', 'middle'].includes(role)) {
    commands.push({ type: 'use-luxury' }, { type: 'use-health' }, { type: 'use-health', skill: 'food' });
    const worker = view.educationOptions?.workers?.[0];
    if (worker) commands.push({ type: 'use-education', worker: worker.id, skill: worker.skills[0] });
  }
  for (const resource of view.storageOptions ?? []) commands.push({ type: 'buy-storage', resource });
  for (const generate of [wageChanges, priceChanges, swaps, bonuses]) commands.push(...safe(generate, view, role));
  return commands;
}
