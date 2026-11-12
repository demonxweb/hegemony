import { companyGear, companySlotDetails, exportOfferLabel } from './boards.js';
import { catalogActionDetail } from './catalog-action-details.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const resources = { food: '食物', luxury: '奢侈品', health: '醫療', education: '教育', influence: '媒體影響力', any: '通用／非技術' };
const industries = { agriculture: '農業', luxury: '奢侈品', healthcare: '醫療', education: '教育', media: '媒體' };
const formatResources = amounts => Object.entries(amounts).map(([key, amount]) => `${resources[key]} ${amount}`).join('、');
const formatWages = wages => Object.entries(wages).map(([level, amount]) => `${level} $${amount}`).join(' ／ ');
const categories = { action: '行動卡', company: '企業卡', export: '出口卡', agenda: '政治綱領卡', event: '事件卡',
  immigration: '移民卡', deal: '商務合約卡', loan: '貸款卡', storage: '倉庫板塊與容量' };
const componentGroups = [
  { title: '一般卡', categories: ['action', 'company', 'export', 'agenda', 'event'] },
  { title: '小型卡', categories: ['immigration', 'deal', 'loan'] },
  { title: '板塊與圖版', categories: ['storage'] },
];
const $ = id => document.getElementById(id);

function buildGroups({ decks, marketSizes, policies, names, storage }) {
  const classes = Object.keys(names);
  const companyDecks = { working: 'cooperativeFarms', middle: 'middleCompanies', capitalist: 'capitalistCompanies', state: 'stateCompanies' };
  const group = (type, deck, title, roles, note, details, color = '') => ({
    type, title, roles, note, color,
    entries: decks[deck].map(card => ({ ...card, rows: details(card), quantity: `×${card.copies} 張`,
      ...(type === 'action' && { detail: catalogActionDetail(card) }) })),
  });
  const actionDetails = card => [
    ['效果', card.effectZh],
    ['政策條件', card.policyAnyOf.join(' 或 ') || '無政策限制'],
    ['國家合法性變化', card.legitimacyZh || '無'],
  ];
  const companyDetails = card => {
    const employee = card.optionalEmployee;
    const slots = [...card.requiredSlots];
    if (employee) slots.push({ ...employee, bonus: employee.bonus[Object.keys(card.output)[0]] });
    return [
      ...(card.owner === 'middle' ? [['企業類型', employee ? '有勞工員工工位' : '僅由中產工人營運']] : []),
      ['成本', card.requiresActionCard ? '由行動卡建立' : `$${card.cost}`],
      ['基本產量', formatResources(card.output)],
      ...(card.automated ? [['工位', '全自動化，無須工人']]
        : slots.map((slot, index) => [`工位${index + 1}`, companySlotDetails(slot, names)])),
      ...(card.wages ? [['薪資', formatWages(card.wages)]] : []),
      ...(employee ? [['員工薪資', formatWages(employee.wages)]] : []),
      ...(card.machineryBonus ? [['機械加成', `產量 +${card.machineryBonus}`]] : []),
      ['適用人數', `${card.eligiblePlayerCounts.join('、')} 人局`],
      ['卡片配置', card.startingPlayerCounts.length ? `${card.startingPlayerCounts.join('、')} 人局起始企業`
        : card.owner === 'state' ? '公營部門擴充' : card.requiresActionCard ? '合作農場' : '企業市場牌庫'],
    ];
  };
  const groups = [
    ...classes.map(role => group('action', `${role}Actions`, `${names[role]}行動卡`, [role], '', actionDetails, role)),
    ...classes.map(role => group('company', companyDecks[role], role === 'working' ? '合作農場' : role === 'state' ? '公營企業卡' : `${names[role]}企業卡`, [role],
      marketSizes[role] ? `對局企業市場 ${marketSizes[role]} 張。` : '', companyDetails, role)),
    group('export', 'exports', '出口卡', ['middle', 'capitalist', 'state'],
      `場上同時公開 ${marketSizes.exportCardsOnBoard} 張。以下為每張卡的出口條件與收入。中產每筆出口另得 1 VP。國家可出口食物及奢侈品。`,
      () => []),
    group('immigration', 'immigration', '移民卡', ['working', 'middle'],
      '移民政策 A／B／C 時，勞工與中產各自抽 0／1／2 張，依卡上自己階級的欄位新增工人。',
      card => Object.entries(card.skillsByRole).map(([role, skill]) => [names[role], resources[skill]])),
    group('deal', 'businessDeals', '商務合約卡（商業交易）', ['capitalist'],
      `資本家向外國市場批量採購。對外貿易 A／B／C 時，場上分別公開 ${Object.values(marketSizes.businessDealsByPolicy6).join('／')} 張。全部進自由貿易區時免關稅。`,
      card => [['貨物', formatResources(card.goods)], ['基礎費用', `$${card.cost}`],
        ['政策 6 關稅', Object.entries(card.tariffByForeignTrade).map(([section, tariff]) => `${section} $${tariff}`).join(' ／ ')]]),
    group('agenda', 'agendas', '政治綱領卡（政治理念）', ['state'], '國家每輪公開一張。計分時，政策 1–5 每符合一項綱領目標，國家得 1 VP。',
      card => Object.entries(card.targets).map(([policy, target]) => [`${policy}. ${policies[Number(policy) - 1]}`, `${policy}${target}`])),
    group('event', 'events', '事件卡', ['state'],
      `每輪公開 ${marketSizes.events} 張。國家處理事件可取得對應獎勵，輪末對未處理的事件套用懲罰。現有卡面資料的首輪使用限制仍待核對。`,
      card => [['處理方式', card.taskZh], ['處理後獎勵', card.rewardZh], ['未處理懲罰', card.unresolvedPenaltyZh],
        ...(card.minimumRound ? [['最早出現輪次', `第 ${card.minimumRound} 輪`]] : [])]),
    group('loan', 'loans', '貸款卡', classes, '強制支出資金不足時取得貸款。', ({ terms }) => [
      ['貸款本金', `$${terms.principal}`],
      ['每輪準備利息', `$${terms.preparation_interest}`],
      ['免費行動還款', `$${terms.free_action_repay}`],
      ['終局 · 資本家', `每筆未清貸款扣 ${terms.capitalist_endgame_penalty_per_loan} VP。`],
      ['終局 · 其他階級', `每筆須還 $${terms.endgame_repay_non_capitalist}，每欠 $${terms.endgame_unpaid_unit} 扣 ${terms.endgame_penalty_per_unpaid_unit} VP。`],
    ]),
  ];

  const storageGroup = (nameZh, roles, quantity, rows, color = '') => ({
    type: 'storage', title: nameZh, roles, color, entries: [{ id: nameZh, nameZh, quantity, rows }],
  });
  const capacities = role => Object.entries(storage[role]).map(([key, amount]) => [resources[key], `${amount} 份`]);
  groups.push(
    storageGroup('倉庫擴充板塊', ['capitalist', 'middle'], `共 ${storage.tiles} 片`, [
      ['取得方式', '資本家可花 $20購買；中產可透過行動卡取得。'],
      ['容量', `擴充一種指定資源的倉庫至原容量的 ${storage.storageTileMultiplier} 倍。同一階級每種資源最多放一片。`],
    ]),
    storageGroup('資本家商業倉庫', ['capitalist'], '玩家圖版內建', capacities('capitalist'), 'capitalist'),
    storageGroup('中產商業倉庫', ['middle'], '玩家圖版內建', [...capacities('middle'),
      ['用途', '商業庫存獨立於生活資源區。一般自用須先轉入生活資源區；輪末缺食時可直接取用倉庫食物。'],
      ['媒體影響力', '生產後直接放入生活資源區。'],
    ], 'middle'),
    storageGroup('自由貿易區', ['capitalist'], `×${storage.freeTradeTiles} 片`, [...capacities('freeTradeZone'),
      ['用途', '資本家開局持有，只存食物與奢侈品，這裡的庫存只能出口。'],
    ], 'capitalist'),
    storageGroup('國家公共服務與商品', ['state'], '圖板區域', [
      ['容量', `每種資源以相應已開放公營企業的總產量加 ${storage.publicServiceExtraCapacity} 計算，即使企業目前未營運也計入。`],
      ['用途', '醫療、教育、媒體存放於公共服務區；國家取得食物或奢侈品企業時，產出的商品存於國家玩家圖版。'],
    ], 'state'),
    storageGroup('勞工生活資源', ['working'], '玩家圖版內建', [
      ['用途', '勞工使用生活資源區存放商品與服務，沒有獨立商業倉庫。合作農場生產的食物可直接使用。'],
    ], 'working'),
  );
  return groups;
}

const physicalCards = entries => entries.reduce((sum, entry) => sum + (entry.copies ?? 0), 0);
const countText = entries => `${entries.length} 款・${physicalCards(entries)} 張`;
const detailRows = rows => rows.map(([key, value]) =>
  `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('');

function entryTitle(entry, group) {
  return group.type === 'deal' ? `商務合約 (${Number(entry.id.slice(5))})` : entry.nameZh;
}

function entryDetails(entry, group) {
  const icon = (resource, label = '') => `<img class="icon" src="/assets/icons/${escape(resource)}.svg" alt="${escape(label)}">`;
  if (group.type === 'export') {
    return `<div class="export-list">${entry.offers.map(offer => `<span>${exportOfferLabel(offer, resource => icon(resource, resources[resource]))}</span>`).join('')}</div>`;
  }
  if (group.type === 'deal') {
    const goods = Object.entries(entry.goods).map(([resource, count]) =>
      `${icon(resource)} ${escape(resources[resource])} ${escape(count)} 份`).join('、');
    return `<div class="deal-details"><small>${goods}</small><small>基價 $${escape(entry.cost)}</small>
      ${['A', 'B', 'C'].map(section => `<small>關稅 6${section} $${escape(entry.tariffByForeignTrade[section])}</small>`).join('')}</div>`;
  }
  return `<dl class="catalog-details">${detailRows(entry.rows)}</dl>`;
}

function entryTile(entry, group) {
  const badge = entry.industry ? industries[entry.industry] : '';
  const goods = group.type === 'deal' ? Object.keys(entry.goods) : [];
  const palette = entry.industry ? `industry-${entry.industry}` : goods.length > 1 ? 'trade-mixed'
    : goods[0] === 'food' ? 'industry-agriculture' : goods[0] === 'luxury' ? 'industry-luxury' : '';
  return `<article class="panel catalog-card ${palette}${entry.id === '自由貿易區' ? ' free-trade-tile' : ''}" data-card-type="${group.type}">
    <header><h3>${escape(entryTitle(entry, group))}${group.type === 'company' ? companyGear(entry) : ''}</h3><span class="catalog-count">${escape(entry.quantity)}</span>
      ${badge ? `<small class="catalog-industry">${escape(badge)}</small>` : ''}</header>
    ${entry.name ? `<p class="catalog-english">${escape(entry.name)}</p>` : ''}
    ${entryDetails(entry, group)}
    ${entry.detail ? `<section class="catalog-action-detail"><h4>詳細說明</h4><p>${escape(entry.detail)}</p></section>` : ''}
  </article>`;
}

async function openCatalog() {
  const response = await fetch('/api/catalog');
  if (!response.ok) throw new Error('圖鑑資料載入失敗');
  const data = await response.json();
  const groups = buildGroups(data);
  const allCards = Object.values(data.decks).flat();
  $('catalog-total').textContent = `${allCards.length} 款卡面・${physicalCards(allCards)} 張實體卡・${data.storage.tiles} 片倉庫擴充・${data.storage.freeTradeTiles} 片自由貿易區`;
  $('catalog-role').insertAdjacentHTML('beforeend', Object.entries(data.names).map(([role, name]) => `<option value="${role}">${escape(name)}</option>`).join(''));
  $('catalog-industry').insertAdjacentHTML('beforeend', Object.entries(industries).map(([key, name]) => `<option value="${key}">${name}</option>`).join(''));
  const cardsOf = types => groups.filter(group => types.includes(group.type)).flatMap(group => group.entries);
  const categoryButton = (type, label, amount) => `<button type="button" data-category="${type}" aria-pressed="${!type}"><strong>${label}</strong><small>${amount}</small></button>`;
  $('catalog-categories').innerHTML = categoryButton('', '全部元件', countText(allCards)) + componentGroups.map(({ title, categories: types }) => {
    const total = types[0] === 'storage' ? `${data.storage.tiles + data.storage.freeTradeTiles} 片板塊` : `${physicalCards(cardsOf(types))} 張`;
    return `<section class="catalog-category-set"><h2>${title} <span>${total}</span></h2><div class="catalog-category-buttons">${types.map(type =>
      categoryButton(type, categories[type], type === 'storage' ? total : countText(cardsOf([type])))).join('')}</div></section>`;
  }).join('');
  $('catalog-sources').innerHTML = `資料來源 <a href="${escape(data.sources.official)}" target="_blank" rel="noopener">官方規則書 v1.2</a>
    <a href="${escape(data.sources.cards)}" target="_blank" rel="noopener">參考卡面索引</a>`;
  for (const id of ['catalog-controls', 'catalog-categories', 'catalog-sources']) $(id).hidden = false;

  let category = '';
  function render() {
    const role = $('catalog-role').value;
    const industry = $('catalog-industry').value;
    const terms = $('catalog-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const visible = groups.filter(group => (!category || group.type === category) && (!role || group.roles.includes(role)))
      .map(group => ({ ...group, entries: group.entries.filter(entry => {
        const text = [group.title, categories[group.type], entry.id, entry.name, entry.nameZh, entryTitle(entry, group), industries[entry.industry], entry.detail, ...entry.rows.flat()].join(' ').toLowerCase();
        return (!industry || entry.industry === industry) && terms.every(term => text.includes(term));
      }) })).filter(group => group.entries.length);
    const cards = visible.filter(group => group.type !== 'storage').flatMap(group => group.entries);
    const storageCount = visible.filter(group => group.type === 'storage').length;
    $('catalog-results').textContent = `符合 ${countText(cards)}${storageCount ? `，${storageCount} 筆倉庫說明` : ''}`;
    $('catalog-list').innerHTML = componentGroups.map(({ title, categories: types }) => {
      const matching = visible.filter(group => types.includes(group.type));
      if (!matching.length) return '';
      const sections = types[0] === 'storage'
        ? `<div class="catalog-grid">${matching.map(group => `<div class="${group.color}">${entryTile(group.entries[0], group)}</div>`).join('')}</div>`
        : matching.map(group => `<section class="catalog-group ${group.color}"><header><h3>${escape(group.title)}</h3><span>${countText(group.entries)}</span></header>
          ${group.note ? `<p class="muted">${escape(group.note)}</p>` : ''}<div class="catalog-grid">${group.entries.map(entry => entryTile(entry, group)).join('')}</div></section>`).join('');
      return `<section class="catalog-component"><h2>${title}</h2>${sections}</section>`;
    }).join('') || '<p class="panel">沒有符合條件的卡牌或倉庫，請調整篩選條件。</p>';
    for (const button of $('catalog-categories').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.category === category));
  }

  $('catalog-categories').addEventListener('click', event => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;
    category = button.dataset.category;
    if (category !== 'company') $('catalog-industry').value = '';
    render();
  });
  $('catalog-search').addEventListener('input', render);
  $('catalog-role').addEventListener('change', render);
  $('catalog-industry').addEventListener('change', () => {
    if ($('catalog-industry').value) category = 'company';
    render();
  });
  $('catalog-reset').addEventListener('click', () => {
    category = '';
    $('catalog-search').value = '';
    $('catalog-role').value = '';
    $('catalog-industry').value = '';
    render();
  });
  render();
}

openCatalog().catch(() => { $('catalog-total').textContent = '圖鑑資料載入失敗，請重新整理頁面。'; });
