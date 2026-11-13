import { randomInt, randomUUID } from './random.mjs';
import { catalogCard, catalogDecks } from './content.mjs';

const scholarship = { key: 'scholarship', name: '國家獎學金', effect: 'service', resource: 'education', policy: 4,
  description: '按人口上限向國家買教育。總價折半向上取整，所屬階級合法性 +1。' };
const healthcare = { key: 'healthcare', name: '醫療福利', effect: 'service', resource: 'health', policy: 3,
  description: '按人口上限向國家買醫療。總價折半向上取整，所屬階級合法性 +1。' };
const definitions = {
  working: [
    { ...scholarship, copies: 2, asset: 'working-state-scholarship' },
    { ...healthcare, copies: 2 },
    { key: 'solidarity', name: '全世界無產者聯合起來', effect: 'solidarity', copies: 2, description: '依人口數量向投票袋加入己方方塊。' },
    { key: 'students', name: '學生運動', effect: 'bill', policy: 4, copies: 1, description: '就教育福利提出法案，加入 2 枚己方投票方塊。' },
    { key: 'workers', name: '工人運動', effect: 'bill', policy: 1, copies: 1, description: '就勞動市場提出法案，加入 2 枚己方投票方塊。' },
    { key: 'housing', name: '經濟適用房', effect: 'housing', copies: 1, description: '支付資本家 $20 得 5 VP，或支付中產 $10 得 3 VP。' },
  ],
  middle: [
    { key: 'import', name: '進口補貼', effect: 'import', copies: 2, asset: 'middle-import-subsidy', description: '外貿 6A 或 6B。免關稅進口食物或奢侈品，每買 4 份合法性 +1。' },
    { ...scholarship, copies: 1 },
    { ...healthcare, copies: 1 },
    { key: 'issues', name: '凸顯社會議題', effect: 'issues', copies: 1, description: '向國家支付 $15 買 3 媒體影響力，中產合法性 +1。' },
    { key: 'voice', name: '中產勞工之聲', effect: 'voice', copies: 1, description: '向投票袋加入 2 枚方塊，再按僱用中產工人的外部公司數加方塊。' },
    { key: 'theme-park', name: '新主題樂園', effect: 'theme-park', copies: 1, description: '支付 $6 × 人口，提升一級繁榮。' },
    { key: 'export-subsidy', name: '出口補貼', effect: 'export-subsidy', copies: 2, description: '財政 1A 或 1B。執行出口，每筆另獲國家支付的 $5，中產合法性 +1。' },
  ],
  capitalist: [
    { key: 'offshore', name: '境外公司', effect: 'offshore', copies: 2, asset: 'capitalist-offshore-companies', description: '將營收的一半轉為資本，轉入金額向下取整。' },
    { key: 'endorse', name: '支持政治競選', effect: 'endorse', copies: 1, description: '支付 $15，向投票袋加入 6 枚己方方塊。' },
    { key: 'tax-bill', name: '稅負夠重了', effect: 'bill', policy: 2, copies: 1, description: '就稅制提出法案，加入 2 枚己方投票方塊。' },
    { key: 'trade-bill', name: '開拓新市場', effect: 'bill', policy: 5, copies: 1, description: '就外貿提出法案，加入 2 枚己方投票方塊。' },
    { key: 'island', name: '購買私人島嶼', effect: 'island', copies: 1, description: '由資本優先支付國家 $50，獲得 7 VP。' },
    { key: 'protection', name: '貿易保護遊說', effect: 'protection', copies: 1, description: '外貿 6A 或 6B。每家農業企業加入 2 枚己方方塊。若為 6A，奢侈品企業亦計入。' },
    { key: 'grants', name: '企業補助', effect: 'grants', copies: 1, description: '財政 1A 或 1B。國家按你擁有的企業數每家支付 $5，每 3 家合法性 +1。' },
  ],
  state: [
    { key: 'pressing', name: '緊急議案', effect: 'pressing', copies: 2, asset: 'state-pressing-matters', description: '提出法案，可免費發起即時投票。' },
    { key: 'easing', name: '量化寬鬆', effect: 'easing', copies: 1, description: '國庫增加 $25。有貸款時改為增加 $35。' },
    { key: 'tourism', name: '觀光成長', effect: 'distribution', copies: 1, recipients: ['middle', 'capitalist'], description: '國家、中產與資本家各獲 $15，中產與資本家合法性各 +1。' },
    { key: 'construction', name: '營建繁榮', effect: 'distribution', copies: 1, recipients: ['working', 'capitalist'], description: '國家、勞工與資本家各獲 $15，勞工與資本家合法性各 +1。' },
    { key: 'geopolitics', name: '地緣政治援助', effect: 'geopolitics', copies: 2, description: '依外貿政策增加國庫。6A 得 $15、6B 得 $30、6C 得 $45。' },
    { key: 'investment', name: '外國投資計畫', effect: 'investment', copies: 2, description: '支付 2 個人影響力，國庫增加 $40。' },
  ],
};

function shuffle(cards) {
  for (let index = cards.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

function cardSerial(index, copyIndex, copies) {
  return `${String(index + 1).padStart(2, '0')}${copies > 1 ? `-${copyIndex + 1}` : ''}`;
}

export function createDecks(full = false) {
  if (full) return Object.fromEntries(Object.keys(definitions).map(role => [role, {
    draw: shuffle(catalogDecks[`${role}Actions`].flatMap((card, index) => Array.from({ length: card.copies },
      (_, copyIndex) => ({ id: randomUUID(), key: card.id, serial: cardSerial(index, copyIndex, card.copies) })))),
    discard: [],
  }]));
  return Object.fromEntries(Object.entries(definitions).map(([role, cards]) => [role, {
    draw: shuffle(cards.flatMap((card, index) => Array.from({ length: card.copies },
      (_, copyIndex) => ({ id: randomUUID(), key: card.key, serial: cardSerial(index, copyIndex, card.copies) })))),
    discard: [],
  }]));
}

export function cardDefinition(role, card) {
  const source = catalogCard(card.key);
  if (source?.role === role) {
    const legacy = definitions[role].find(item => item.name === source.nameZh);
    return { ...legacy, key: source.id, name: source.nameZh, nameEn: source.name, description: source.effectZh,
      policyAnyOf: source.policyAnyOf, legitimacy: source.legitimacyZh, effect: legacy?.effect ?? extraEffects[source.id] };
  }
  return definitions[role].find(item => card.key ? item.key === card.key : item.asset && item.asset === card.asset);
}

const additional = {
  working: { 'highlight-social-issues': 'issues', 'healthcare-movement': 'health-bill', 'immigration-reform': 'immigration-bill',
    migration: 'migration', 'workplace-accident': 'accident', 'signing-bonus': 'signing', 'general-strike': 'general-strike',
    specialization: 'specialize', 'cooperative-farm': 'farm', 'labor-market-deregulation': 'deregulate',
    'supplemental-income-program': 'income', 'unemployment-benefits': 'unemployment', 'extra-shift': 'public-overtime',
    'boost-domestic-tourism': 'tourism-purchase', 'need-for-change': 'two-bills' },
  middle: { 'immigration-reform': 'immigration-bill', migration: 'migration', 'health-crisis': 'sell-health',
    'higher-education-program': 'sell-education', 'small-business-grant': 'grant-build', 'land-of-opportunity': 'land-build',
    'investment-opportunities': 'investment-build', 'labor-market-deregulation': 'deregulate', 'personal-consumption': 'personal-buy',
    'growing-business': 'grow-storage', 'employment-subsidy': 'employment-subsidy', 'unemployment-initiative-program': 'middle-hiring',
    'public-sector-overtime': 'public-overtime', specialization: 'specialize', 'supplemental-income-program': 'income',
    'foreign-market-insight': 'export-insight' },
  capitalist: { 'health-crisis': 'sell-health', 'higher-education-program': 'sell-education', 'bid-rigging': 'bid-rigging',
    'foreign-recruitment': 'recruit', 'competitive-wages': 'competitive-wages', 'global-branding': 'brand-export',
    'global-food-crisis': 'food-export', 'extra-shift': 'private-overtime', 'technological-progress': 'machinery',
    'exit-strategy': 'exit', 'industrialization': 'industry-build', 'investment-opportunities': 'investment-build',
    'business-expansion': 'expand-build', 'foreign-market-insight': 'export-insight', 'foreign-partner': 'foreign-partner',
    'unemployment-initiative-program': 'fill-unemployed', 'push-political-agenda': 'two-bills' },
  state: { 'employment-support-scheme': 'employment-support', 'agenda-setting': 'agenda-influence', 'foreign-financial-assistance': 'agenda-money',
    'higher-vat': 'vat', 'denial-of-free-speech': 'speech', 'step-for-representation': 'representation', 'allowances-and-subsidies': 'allowance',
    'healthcare-program': 'provide-health', 'literacy-program': 'provide-education', 'foreign-students': 'export-education',
    'medical-tourism': 'export-health', 'supplemental-income-program': 'income', 'unemployment-initiative-program': 'fill-unemployed',
    'public-sector-overtime': 'private-overtime', 'business-grants': 'state-grants', 'emergency-state': 'emergency',
    'shift-focus': 'shift-event', 'a-matter-of-high-priority': 'priority-event', 'immediate-response': 'repeat-event',
    nationalization: 'nationalize', privatization: 'privatize' },
};
const shared = { 'fake-news': 'fake-news', 'interest-groups': 'interest-groups', 'public-opinion-polling': 'poll', 'radical-reforms': 'radical' };
const extraEffects = Object.fromEntries(Object.entries(additional).flatMap(([role, effects]) =>
  Object.entries({ ...shared, ...effects }).map(([key, effect]) => [`action-${role}-${key}`, effect])));

export function fillHand(game, role, size) {
  const hand = game.players[role].hand;
  const deck = game.decks?.[role];
  if (!deck) {
    const { key } = definitions[role][0];
    while (hand.length < size) hand.push({ id: randomUUID(), key });
    return;
  }
  while (hand.length < size) {
    if (!deck.draw.length) {
      deck.draw = shuffle(deck.discard);
      deck.discard = [];
    }
    const card = deck.draw.pop();
    if (!card) return;
    hand.push(card);
  }
}

export function cardView(role, card) {
  const { key, name, nameEn, asset, effect, policy, resource, description, policyAnyOf, legitimacy } = cardDefinition(role, card);
  return { id: card.id, key, name, nameEn, asset, effect, policy, resource, description, policyAnyOf, legitimacy, serial: card.serial };
}
