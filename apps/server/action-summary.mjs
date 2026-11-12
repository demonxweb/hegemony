import { cardDefinition } from '../../packages/engine/cards.mjs';
import { activeCompany, operational, publicCapacity, workplace } from '../../packages/engine/companies.mjs';
import { catalogCard } from '../../packages/engine/content.mjs';
import { names, policies, roles } from '../../packages/engine/game.mjs';
import { marketQuote } from '../../packages/engine/prices.mjs';

const goods = { food: '食物', luxury: '奢侈品', health: '醫療', education: '教育', influence: '影響力' };
const stats = { cash: '現金', revenue: '營收', capital: '資本', vp: '勝利分數', ...goods };
const moneyFields = new Set(['cash', 'revenue', 'capital']);
const wageLabel = (level, wages) => `L${level}${wages ? ` · $${wages[level - 1]}` : ''}`;
const skill = key => goods[key] ?? '通用';
const company = (game, id) => {
  const { name } = activeCompany(game.economy, id);
  const copy = id.match(/~(\d+)$/)?.[1];
  return copy ? `${name}（第 ${copy} 張）` : name;
};

export function summarizeAction(before, after, role, command) {
  const lines = [];
  const change = (label, from = 0, to = 0, money = false) => {
    if (from === to) return;
    const delta = to - from;
    const unit = money ? '$' : '';
    lines.push(`${label}：${unit}${from} → ${unit}${to}（${delta > 0 ? '+' : '-'}${unit}${Math.abs(delta)}）`);
  };
  const quantities = (label, fields, from = {}, to = {}) => {
    for (const [key, name] of Object.entries(fields)) change(`${label}${name}`, from[key], to[key], moneyFields.has(key));
  };
  const card = before.players[role].hand.find(item => item.id === command.cardId);
  const main = !before.mainUsed && after.mainUsed;
  const effect = main && command.type === 'play' ? cardDefinition(role, card) : null;
  if (main && card) {
    const name = cardDefinition(role, card).name;
    lines.push(command.type === 'play' ? `使用行動卡「${name}」` : `棄掉手牌「${name}」以執行基本行動`);
  }
  change('國庫', before.treasury, after.treasury, true);
  quantities('公共服務 · ', goods, before.publicServices, after.publicServices);
  for (const [key, name] of Object.entries(goods)) {
    change(`國家 · ${name}庫存容量`, publicCapacity(before.economy, key), publicCapacity(after.economy, key));
  }
  for (const seat of roles) {
    const label = names[seat];
    quantities(`${label} · `, stats, before.players[seat], after.players[seat]);
    change(`${label} · 貸款筆數`, before.economy.loans[seat], after.economy.loans[seat]);
    if (seat !== 'state') {
      change(`${label} · 合法性`, before.legitimacy[seat], after.legitimacy[seat]);
      change(`${label} · 持有的合法性標記`, before.content?.legitimacyTokens[seat], after.content?.legitimacyTokens[seat]);
      if (!['fake-news', 'poll', 'interest-groups'].includes(effect?.effect)) {
        change(`${label} · 袋內投票方塊`, before.bag[seat], after.bag[seat]);
      }
      quantities(`${label} · 福利區 · `, { ...goods, cash: '現金', votes: '投票方塊' },
        before.content?.benefits[seat], after.content?.benefits[seat]);
    }
    if (before.economy.inventory[seat]) quantities(`${label}倉庫 · `, goods, before.economy.inventory[seat], after.economy.inventory[seat]);
    for (const key of after.economy.storage?.[seat] ?? []) {
      if (!before.economy.storage?.[seat]?.includes(key)) lines.push(`擴充${label}的${goods[key]}倉庫`);
    }
    if (['middle', 'capitalist'].includes(seat)) for (const [key, resource] of Object.entries(goods)) {
      change(`${label}國內售價 · ${resource}`, marketQuote(before, seat, key)?.price, marketQuote(after, seat, key)?.price, true);
    }
  }
  quantities('自由貿易區 · ', goods, before.economy.tradeZone, after.economy.tradeZone);
  change('勞工 · 繁榮軌格位', before.match.workingProsperity, after.match.workingProsperity);
  change('中產 · 繁榮軌格位', before.match.middleProsperity, after.match.middleProsperity);
  if (!before.economy.demonstration && after.economy.demonstration) lines.push('放置示威標記');
  if (before.economy.demonstration && !after.economy.demonstration) lines.push('移除示威標記');

  const previous = before.economy.companies;
  const next = after.economy.companies;
  for (const id of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const old = previous[id];
    const item = next[id];
    const label = company(item ? after : before, id);
    if (!old) {
      const wages = activeCompany(after.economy, id).wages;
      lines.push(`新增企業「${label}」${wages ? `，薪級 ${wageLabel(item.wage, wages)}` : ''}`);
    }
    else if (!item) lines.push(`移除企業「${label}」`);
    else {
      const from = activeCompany(before.economy, id).owner;
      const to = activeCompany(after.economy, id).owner;
      if (from !== to) lines.push(`「${label}」移交給${names[to]}`);
      if (old.wage !== item.wage) {
        lines.push(`「${label}」薪級 ${wageLabel(old.wage, activeCompany(before.economy, id).wages)} → ${wageLabel(item.wage, activeCompany(after.economy, id).wages)}`);
      }
      if (operational(old) !== operational(item)) lines.push(`「${label}」${operational(item) ? '開始營運' : '停止營運'}`);
      if (Boolean(old.strike) !== Boolean(item.strike)) lines.push(`「${label}」${item.strike ? '放置' : '移除'}罷工標記`);
      if (Boolean(old.machine) !== Boolean(item.machine)) lines.push(`「${label}」${item.machine ? '加裝' : '移除'}機械`);
    }
  }
  const location = (game, id) => {
    if (game.economy.unions?.includes(id)) return '工會';
    const firm = workplace(game.economy, id);
    return firm ? `${company(game, firm.id)}工位 ${firm.slots.findIndex(slot => slot.worker === id) + 1}` : '待業區';
  };
  const oldWorkers = before.economy.workers;
  const workers = after.economy.workers;
  for (const id of new Set([...Object.keys(oldWorkers), ...Object.keys(workers)])) {
    const old = oldWorkers[id];
    const worker = workers[id];
    const label = `${names[(worker ?? old).role]}工人 #${id.split('-').at(-1)}`;
    if (!old) lines.push(`新增${label}（${skill(worker.skill)}），放在${location(after, id)}${worker.committed ? '並承諾' : ''}`);
    else if (!worker) lines.push(`移除${label}（${skill(old.skill)}）`);
    else {
      const from = location(before, id);
      const to = location(after, id);
      const changes = [];
      if (from !== to) changes.push(`${from} → ${to}`);
      if (old.skill !== worker.skill) changes.push(`技能 ${skill(old.skill)} → ${skill(worker.skill)}`);
      if (old.committed !== worker.committed) changes.push(worker.committed ? '承諾' : '解除承諾');
      if (changes.length) lines.push(`${label} · ${changes.join('，')}`);
    }
  }
  for (const [index, name] of policies.entries()) {
    if (before.policies[index] !== after.policies[index]) lines.push(`${name}政策 ${before.policies[index]} → ${after.policies[index]}`);
  }
  for (const bill of after.bills) {
    if (!before.bills.some(old => old.role === bill.role && old.policy === bill.policy && old.target === bill.target)) {
      const timing = after.phase === 'action' ? '，在本輪選舉階段表決' : '';
      lines.push(`提出${policies[bill.policy]}法案 ${bill.target}${timing}`);
    }
  }
  for (const [key, verb] of [['events', '處理事件'], ['deals', '使用商業交易卡']]) {
    for (const id of before.content?.[key] ?? []) {
      if (!after.content[key].includes(id)) lines.push(`${verb}「${catalogCard(id).nameZh}」`);
    }
  }
  for (const [seat, market] of Object.entries(after.economy.markets)) {
    const added = market.filter(id => !before.economy.markets[seat].includes(id)).length;
    if (added) lines.push(`確認後${names[seat]}企業市場將揭示 ${added} 張新牌`);
  }
  if (command.type === 'buy' && after.purchaseReceipt) {
    const sources = Object.entries(command.distribution).filter(([, count]) => count > 0)
      .map(([seat, count]) => `${names[seat] ?? '外國市場'} ${count} 份`);
    lines.unshift(`購買${goods[command.resource]} · ${sources.join('、')} · 支付 $${after.purchaseReceipt.cost}`);
  }
  if (after.phase !== 'action') {
    lines.push(({ election: '確認後開始表決，投票結果依實際表決決定',
      'policy-choice': '確認後進入政策調整，等待指定席位作出選擇',
      'card-choice': '確認後揭示牌庫或抽取結果，並進入卡牌選擇',
      'event-choice': '確認後等待指定席位選擇事件法案',
      'event-hire': '確認後等待企業持有人安排雇用' })[after.phase] ?? '確認後進入下一個處理步驟');
  }
  if (effect?.effect === 'interest-groups') lines.push('確認後抽取並替換投票方塊，實際替換結果屆時揭示');
  if (main) lines.push('本回合的主要行動將用完');
  if (!before.freeUsed && after.freeUsed) lines.push('本回合的免費行動將用完');
  return { kind: main ? 'main' : 'free', changes: lines };
}
