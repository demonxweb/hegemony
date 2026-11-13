// 所有策略共用的階段預設：只求合法、能讓遊戲往下走。策略可針對個別階段覆寫。
import { eventVariants } from '../engine/candidates.mjs';

function foodPlan(ctx) {
  const needs = ctx.view.match.needs;
  if (!needs) return [{ type: 'food', quantities: {} }];
  // 先向比進口便宜的本國賣家買，不足的部分由進口補。
  const sellers = Object.entries(needs.sellers)
    .filter(([, quote]) => quote.price <= needs.importPrice && quote.stock > 0)
    .sort((a, b) => a[1].price - b[1].price);
  let remaining = needs.shortage;
  const quantities = {};
  for (const [seller, quote] of sellers) {
    const amount = Math.min(quote.stock, remaining);
    if (amount > 0) quantities[seller] = amount;
    remaining -= amount;
  }
  return [{ type: 'food', quantities }, { type: 'food', quantities: {} }];
}

function demonstrationLosses(ctx) {
  const { limits, losses } = ctx.view.demonstration;
  const assigned = {};
  let remaining = losses;
  for (const [seat, limit] of Object.entries(limits)) {
    assigned[seat] = Math.min(limit, remaining);
    remaining -= assigned[seat];
  }
  return { type: 'demonstration-losses', losses: assigned };
}

function policyChoice(ctx) {
  const choice = ctx.view.policyChoice;
  const input = { type: 'policy-choice' };
  if (choice.kind === 'public') input.companies = choice.companies.slice(0, choice.count).map(company => company.id);
  if (choice.kind === 'hire') [input.company, input.hire] = choice.options[0];
  if (choice.kind === 'wages') input.changes = [];
  if (choice.kind === 'prices') input.prices = {};
  return input;
}

function cardChoice(ctx) {
  const { view, role } = ctx;
  const choice = view.content.cardChoice;
  const base = { type: 'card-choice' };
  switch (choice.effect) {
    case 'fake-news': {
      // 移除最多四個不屬於自己階級的方塊。
      const indices = choice.drawn.flatMap((cube, index) => cube === role ? [] : [index]).slice(0, 4);
      return [{ ...base, indices }, { ...base, indices: [] }];
    }
    case 'second-bill':
      return (choice.policies ?? []).map(({ policy, target }) => ({ ...base, policy, target, immediate: false }));
    case 'poll':
      return [{ ...base, immediate: false }];
    case 'export-insight':
      return choice.cards.flatMap(card => {
        const offers = card.offers.filter(offer => offer.available).slice(0, 1).map(offer => offer.id);
        return [{ ...base, option: card.id, offers }, { ...base, option: card.id }];
      });
    case 'investment-build':
      return [
        ...choice.cards.filter(item => !item.blocked).map(item => ({ ...base, company: item.id, wage: 2 })),
        { ...base, option: 'cancel-investment' },
      ];
    case 'shift-event': case 'priority-event': {
      const current = view.content.events;
      const offered = choice.cards ?? [];
      const cancel = [{ ...base, option: choice.effect === 'shift-event' ? 'cancel-shift-focus' : 'cancel-priority' }];
      // 直接處理場上事件；或先把剛看到的事件放上場（換掉一張）再處理。
      const direct = eventVariants(current).map(variant => ({ ...base, ...variant }));
      const swapped = offered.flatMap(card => {
        const events = choice.effect === 'shift-event' ? current.map(event => ({ replaced: event.id, pool: [card, ...current.filter(item => item.id !== event.id)] }))
          : [{ pool: [card, ...current] }];
        return events.flatMap(({ replaced, pool }) => eventVariants(pool)
          .map(variant => ({ ...base, option: card.id, ...(replaced && { replaced }), ...variant })));
      });
      return [...direct, ...swapped, ...cancel];
    }
    default: return [base];
  }
}

function marketCommands(ctx) {
  if (ctx.view.content.marketSkillPending) {
    return ['food', 'luxury', 'health', 'education', 'influence'].map(skill => ({ type: 'market-skill', skill }));
  }
  return [{ type: 'market', companies: [] }];
}

function eventChoice(ctx) {
  const { content } = ctx.view;
  if (content.civil.proposed) return [{ type: 'civil-confirm', immediate: false }];
  return content.civilPolicies.map(({ policy, target }) => ({ type: 'civil-bill', policy, target }));
}

function eventHire(ctx) {
  const { view, role } = ctx;
  const { company } = view.content.eventHire;
  const base = { type: 'event-hire', company };
  const hires = [{ hire: 'working' }, { hire: 'middle' }, {}];
  const candidates = [1, 2, 3].flatMap(wage => hires.map(hire => ({ ...base, wage, ...hire })));
  if (role === 'middle') {
    // 中產須指定自己的待業工人擔任必要工位。
    const card = view.economy.markets.middle.find(item => item.id === company);
    const idle = view.economy.workers.filter(worker => worker.role === 'middle' && !worker.company && !worker.committed && !worker.union);
    const used = new Set();
    const staff = (card?.skills ?? []).map(skill => {
      const worker = idle.find(item => !used.has(item.id) && item.skill === skill) ?? idle.find(item => !used.has(item.id) && item.skill === 'any');
      if (worker) used.add(worker.id);
      return worker?.id ?? null;
    });
    candidates.unshift(...[1, 2, 3].map(wage => ({ ...base, wage, staff })));
  }
  return candidates;
}

function election(ctx) {
  const { election: vote, role } = ctx.view;
  if (vote.nextVoter) return [{ type: 'side', side: vote.bill.role === role ? 'for' : 'against' }];
  return [{ type: 'bid', electionId: vote.id, amount: 0 }];
}

// 回傳候選命令清單（依優先順序）。主要行動由策略的 turn() 決定，不在此處理。
export function defaultCandidates(ctx) {
  const { view } = ctx;
  switch (ctx.phase) {
    case 'vote-confirmation': return [{ type: 'confirm-vote', electionId: view.lastVote.id }];
    case 'policy-choice': return [policyChoice(ctx)];
    case 'worker-arrival': return view.workerArrival.options.map(skill => ({ type: 'worker-arrival', skill }));
    case 'market': return marketCommands(ctx);
    case 'event-penalty': return [{ type: 'event-penalty', eventId: view.content.events[0].id, recipients: ['working', 'middle'] }];
    case 'production-confirm': return [{ type: 'production-confirm', option: view.match.productionStep.stage }];
    case 'demonstration': return [demonstrationLosses(ctx)];
    case 'event-hire': return eventHire(ctx);
    case 'card-choice': return cardChoice(ctx);
    case 'event-choice': return eventChoice(ctx);
    case 'needs': return foodPlan(ctx);
    case 'election': return election(ctx);
    case 'scoring': return [{ type: 'next-round' }];
    default: return [];
  }
}
