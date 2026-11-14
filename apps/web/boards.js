export const roleColors = { working: '#ed3346', middle: '#ffc400', capitalist: '#149bd2', state: '#afb2b7' };
export const policyColors = ['#007eaa', '#7565a4', '#a43e88', '#b72027', '#d08007', '#9b7952', '#646c70'];
const classes = ['working', 'middle', 'capitalist'];
const industries = { food: '農業', luxury: '奢侈品', health: '醫療', education: '教育', influence: '媒體' };
export const workerColors = { any: '#b6b8bb', food: '#829543', luxury: '#0095c7', health: '#fff9f7', education: '#f39200', influence: '#a82b98' };
const workerShapes = {
  working: 'M10.2 3.7h1V2.5h1.6v1.2h1l1.1 3h1.6v1.6h-2.6l-.4 2 2.2.8 3.5 7.5-2.1 1.2-1.4-2.3.9 4.3h-2.1l1.1 4.7h-3.1l-.5-3.5-.5 3.5H8.4l1.1-4.7H7.4l.9-4.3-1.4 2.3-2.1-1.2 3.5-7.5 2.2-.8-.4-2H7.5V6.7h1.6Z',
  middle: 'M8.6 4.7 12 2l3.4 2.1-1 1.3-.4 4 3 1.4 1.6 8.5-2 .8-1-3.5v9.9H8.4v-9.9l-1 3.5-2-.8 1.6-8.5 3-1.4-.5-3.3Z',
};

export function workerFigure(role, skill, fill = workerColors[skill]) {
  return `<svg class="worker-figure" viewBox="3 0 18 29" aria-hidden="true">
    <path d="${workerShapes[role]}" ${role === 'working' ? 'transform="translate(0 4) scale(1 .85)"' : ''} fill="${fill}" stroke="${skill === 'health' ? '#e11c2e' : '#141922'}" stroke-width="${skill === 'health' ? 1.1 : .65}" stroke-linejoin="round"/>
  </svg>`;
}

export const slotRoleLabel = role => ({ middle: '中產專屬', working: '勞工專屬' })[role] ?? '勞工、中產皆可';

export function slotRoleIcons(role) {
  const roles = role ? [role] : ['working', 'middle'];
  return `<span class="slot-roles" title="${slotRoleLabel(role)}" aria-hidden="true">${roles.map(seat =>
    workerFigure(seat, 'any', roleColors[seat])).join('')}</span>`;
}

export function companySlots(item) {
  const role = ['middle', 'working'].includes(item.owner) ? item.owner : null;
  const slots = item.skills.map(skill => ({ skill, role }));
  if (item.employee) slots.push({ skill: item.employee.skill, role: 'working', optional: true, bonus: item.employee.output });
  return slots;
}

export function companySlotDetails({ role, skill, bonus }, names) {
  const classes = role ? names[role] : `${names.working}、${names.middle}`;
  return `${classes} ${industries[skill] ?? '通用'}${bonus > 0 ? ` 產量+${bonus}` : ''}`;
}

export function companyStopped(item) {
  return item.operational === false || (item.owner !== 'middle' && item.strike && item.wage !== 3);
}

export function companyGear(item, active = false) {
  if (!item.machineryBonus && !item.automated) return '';
  const label = `${item.automated ? '自動化' : '機械加成'}${active ? '已生效' : '未生效'}`;
  return `<svg class="company-gear${active ? ' is-active' : ''}" viewBox="0 0 24 24" role="img" aria-label="${label}">
    <path fill="currentColor" fill-rule="evenodd" d="M10 2h4l.6 3.1 1.6.9 3-1 2 3.5-2.3 2.1v1.8l2.3 2.1-2 3.5-3-1-1.6.9L14 21h-4l-.6-3.1-1.6-.9-3 1-2-3.5 2.3-2.1v-1.8L2.8 8.5l2-3.5 3 1 1.6-.9L10 2Zm2 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/>
  </svg>`;
}

function companyProductionBonus(item, hasEmployee) {
  const employeeBonus = hasEmployee && item.owner === 'middle' && (!item.strike || item.wage === 3)
    ? item.employee?.output ?? 0 : 0;
  const machineryBonus = item.machine ? item.machineryBonus ?? 0 : 0;
  return employeeBonus + machineryBonus;
}

export function companyProductionTotal(item) {
  if (companyStopped(item)) return 0;
  const hasEmployee = item.slots.some(slot => slot.optional && slot.worker);
  return item.output + companyProductionBonus(item, hasEmployee);
}

export function companyOutput(item, hasEmployee, stopped = companyStopped(item)) {
  if (stopped) return String(item.output);
  const bonus = companyProductionBonus(item, hasEmployee);
  return bonus > 0 ? `${item.output} + ${bonus}` : String(item.output);
}

export function boardSurface(id) {
  return `<svg class="board-surface" viewBox="0 0 640 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><pattern id="map-${id}" width="126" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(-23)">
      <path fill="currentColor" d="M5 5h51v23H5zm59 0h57v23H64zM5 36h32v53H5zm40 0h46v22H45zm0 30h46v23H45zm54-30h22v53H99z"/>
    </pattern></defs>
    <rect width="640" height="520" fill="url(#map-${id})"/>
  </svg>`;
}

export function track(label, values, active, color = '#efc274') {
  const step = 28;
  return `<svg class="board-track" viewBox="0 0 ${values.length * step} 27" role="img" aria-label="${label}">
    <title>${label}</title>${values.map((value, index) => `<g transform="translate(${index * step} 0)">
      <rect x="1" y="2" width="26" height="23" rx="4" fill="${index === active ? color : '#151c24'}" stroke="${color}" stroke-opacity="${index === active ? 1 : .38}"/>
      <text x="14" y="17" text-anchor="middle" fill="${index === active ? '#121820' : '#f3ecdb'}">${value}</text>
    </g>`).join('')}</svg>`;
}

export function exportOfferLabel(offer, icon) {
  return `${icon(offer.resource)} ${offer.quantity} → $${offer.money ?? offer.price}`;
}

export function scoreEdge(players, edge) {
  const positions = {
    top: [0, 1], right: [25, 1], bottom: [74, -1], left: [99, -1],
  };
  const [first, direction] = positions[edge];
  return `<div class="score-edge score-${edge}" aria-hidden="true">
    ${Array.from({ length: 25 }, (_, i) => {
      const value = first + direction * i;
      const markers = Object.keys(roleColors).filter(role => Math.max(0, players[role].vp) % 100 === value);
      return `<span class="${value % 5 === 0 ? 'score-five' : ''}"><svg viewBox="0 0 26 26">
        <text x="13" y="${markers.length ? 11 : 16}" fill="${value % 5 === 0 ? '#f5cd7d' : '#b7c0c7'}" text-anchor="middle">${value}</text>
        ${markers.map((role, index) => `<circle cx="${5 + index * 5}" cy="19" r="2.4" fill="${roleColors[role]}"/>`).join('')}
      </svg></span>`;
    }).join('')}
  </div>`;
}

function policyEffect(index, section, rules) {
  const welfare = index === 3 ? '醫療' : '教育';
  switch (index) {
    case 0: {
      const { public_count: count, imf_loan_threshold_inclusive: limit } = rules.fiscal[section];
      return [`公營 ×${count} · IMF ${limit}`, `開放 ${count} 家公營企業。生產階段檢查 IMF 時，國家若仍有至少 ${limit} 筆貸款，可能觸發介入。`];
    }
    case 1: {
      const level = rules.minimum_wage_level[section];
      return [`最低薪資 L${level}`, `企業的薪資不得低於 L${level}。政策變更後，低於新門檻的薪資須調高。`];
    }
    case 2: {
      const base = rules.tax_multiplier_base[section];
      const factor = rules.tax_multiplier_welfare_factor[section];
      return [`基礎 ${base} · 福利 ×${factor}`, `稅倍率為 ${base} ＋ ${factor} ×（醫療與教育福利修正值總和）。中產與資本家以此計算僱用稅。`];
    }
    case 3: case 4: {
      const price = rules.public_health_and_education_price[section];
      const modifier = rules.welfare_modifier[section];
      return [`${welfare} $${price} · 稅 +${modifier}`, `公共${welfare}每份 $${price}，福利稅倍率修正 +${modifier}。${section === 'A' ? '國家每提供三份免費服務，對購買階級的合法性 +1。' : section === 'B' ? '國家每次以優惠價出售可得 1 VP。' : ''}`];
    }
    case 5: {
      const { food_tariff: food, luxury_tariff: luxury, deals_on_preparation: deals } = rules.foreign_trade[section];
      return [`關稅 $${food}/$${luxury} · 合約 ${deals}`, `每份進口食物的關稅為 $${food}，奢侈品為 $${luxury}。準備階段公開 ${deals} 張商務合約。`];
    }
    default: {
      const count = rules.immigration_extra_each_class[section];
      return [`額外工人 +${count}`, `準備階段，勞工與中產各自抽 ${count} 張移民卡，並各新增 ${count} 名對應工人。`];
    }
  }
}

export function policyDiagram(state, meta, escape, tipAttrs, choiceAttrs = () => '') {
  return `<svg class="policy-table" viewBox="0 0 638 410" aria-label="政治議題政策表">
    <text class="policy-axis" x="14" y="16">社會主義</text><path d="M82 11h302m-6-5 6 5-6 5"/><text class="policy-axis" x="449" y="16" text-anchor="end">新自由主義</text>
    <text class="policy-axis" x="551" y="16" text-anchor="middle">民族主義 → 全球主義</text>
    ${state.policies.map((active, index) => {
      const side = index >= 5;
      const x = side ? 455 : 4;
      const y = side ? 25 + (index - 5) * 192 : 25 + index * 76;
      const width = side ? 179 : 444;
      const height = side ? 184 : 72;
      const choiceWidth = side ? 163 : 128;
      const bill = state.bills.find(item => item.policy === index);
      const name = meta.policies[index];
      return `<g class="policy-band" transform="translate(${x} ${y})" style="--policy:${policyColors[index]}"
        ${tipAttrs(`${index + 1}${active} ${name}・生效中`, [policyEffect(index, active, meta.policyRules)[1]])}>
        <rect class="policy-band-bg" width="${width}" height="${height}" rx="6"/>
        <text class="policy-number" x="10" y="${side ? 27 : 48}">${index + 1}</text>
        <text class="policy-name" x="${side ? 97 : 240}" y="${side ? 22 : 18}" text-anchor="middle">${escape(name)}</text>
        ${['A', 'B', 'C'].map((section, column) => {
          const [short, effect] = policyEffect(index, section, meta.policyRules);
          const isActive = section === active;
          const isPending = bill?.target === section;
          const title = `${index + 1}${section} ${name}`;
          return `<g class="policy-choice${isActive ? ' active' : ''}${isPending ? ' pending' : ''}" tabindex="0" role="group" aria-label="${escape(title + (isActive ? '・生效中' : '') + (isPending ? '・待表決' : ''))}"
            ${choiceAttrs(index, section)}
            ${tipAttrs(title, [effect, isActive && '目前生效', isPending && `${meta.names[bill.role]}提案，待表決`])}
            transform="translate(${side ? 8 : 42 + column * 133} ${side ? 35 + column * 47 : 25})">
            <rect width="${choiceWidth}" height="43" rx="3"/>
            <text class="policy-letter" x="${choiceWidth / 2}" y="17" text-anchor="middle">${section}</text>
            <text class="policy-value" x="${choiceWidth / 2}" y="35" text-anchor="middle">${escape(short)}</text>
            ${isActive ? `<circle class="policy-marker" cx="${side ? 151 : 118}" cy="14" r="5"/>` : ''}
            ${isPending ? `<path class="policy-bill" d="M${side ? 150 : 117} 7l6 7-6 7-6-7z"/>` : ''}
          </g>`;
        }).join('')}</g>`;
    }).join('')}</svg>`;
}

const numbers = (length, start = 0) => Array.from({ length }, (_, index) => start + index);

function populationTrack(workers, population, bands, color) {
  const first = 10;
  const last = bands.at(-1).minWorkers;
  const step = 25;
  const cell = (start, width, y, value, selected) => `<g transform="translate(${start} ${y})">
    <rect x="1" y="1" width="${width - 2}" height="22" rx="3" fill="${selected ? color : '#211e24'}" stroke="${color}"/>
    <text x="${width / 2}" y="16" class="${selected ? 'selected-number' : ''}">${value}</text></g>`;
  return `<svg class="mat-number-track mat-population-svg" viewBox="0 0 ${(last - first + 1) * step} 49" role="img" aria-label="工人 ${workers} 人，人口 ${population}">
    ${numbers(last - first + 1, first).map((number, index) => cell(index * step, step, 0, number, number === Math.min(last, workers))).join('')}
    ${bands.map(({ minWorkers, population: value }, index) => {
      const start = Math.max(first, minWorkers);
      const span = ((bands[index + 1]?.minWorkers ?? last + 1) - start) * step;
      return cell((start - first) * step, span, 25, value, value === population);
    }).join('')}</svg>`;
}

function wealthTrack(wealth, record, color) {
  return `<svg class="mat-number-track mat-wealth-svg" viewBox="0 0 ${wealth.thresholds.length * 35} 41" role="img" aria-label="最高財富 $${wealth.thresholds[record]}，財富軌各級距與勝利分數">
    ${wealth.thresholds.map((amount, index) => `<g transform="translate(${35 * index} 0)" class="${index === record ? 'selected-tier' : ''}">
      <rect x="1" y="1" width="33" height="38" rx="3" fill="${index === record ? color : '#133849'}" stroke="${color}"/>
      <text x="17.5" y="14">${amount}${index === wealth.thresholds.length - 1 ? '+' : ''}</text>
      <text x="17.5" y="31">${wealth.vp[index]}★</text></g>`).join('')}</svg>`;
}

const populationHelp = [
  '開局設置\n勞工與中產各有 10 名工人，包含 7 名在職與 3 名待業。工人數標記放在 10，對應人口 3。',
  '上排是本階級的工人總數，下排是對應的人口。每滿 3 名工人算 1 人口，人口最低為 3、最高為 10。例如 10 或 11 名工人都是人口 3，到了 12 名才升到人口 4。',
  '準備階段補充工人、移民政策、使用醫療或卡牌效果都可能改變工人總數。就業和待業工人都計入，單純換工作不會改變人口。',
  '人口決定輪末必須消耗的食物、使用醫療／教育／奢侈品時要消耗的份數，以及一般購買行動每個來源的購買上限。',
].join('\n\n');

const personalGoodsHelp = [
  '開局設置\n勞工與中產各放入 1 份個人影響力。食物、醫療、教育與奢侈品的生活資源格從 0 開始。中產的起始商品放在商業倉庫。',
  '取得時機\n在自己的行動回合用「購買商品與服務」，一次選一種資源，最多向兩個來源購買，每個來源最多買等同目前人口的份數。買到的資源直接放入生活資源區。部分卡牌或「領取福利」也會把資源交給你。中產可把自己的倉庫當成其中一個來源，免費移入生活資源區。',
  '食物\n每輪生產階段發薪後，進入食物需求結算。必須消耗等同當時人口的食物。先扣生活資源區的食物，缺額可從國內有庫存的賣方購買，其餘從外國市場補足。人口 4、手上有 2 份時，須再買 2 份並立即消耗。',
  '醫療\n輪到自己時，選免費行動「使用醫療」，從生活資源區消耗等同目前人口的醫療。繁榮前進一格，取得新格的 VP，另得 2 VP，並新增一名通用工人到待業區。新增工人後更新人口軌。',
  '教育\n輪到自己時，選免費行動「使用教育」，消耗等同目前人口的教育。選一名可受訓的己方工人，以及供應區仍有的不同技能。工會成員與占用指定技能工位的工人不能受訓。中產若要改換已具技能的工人，該工人須在待業區。完成後繁榮前進一格，取得新格的 VP。',
  '奢侈品\n輪到自己時，選免費行動「使用奢侈品」，消耗等同目前人口的奢侈品，將繁榮推進一格並取得新格的 VP。例如人口 4、繁榮 3 時，消耗 4 份奢侈品可升到繁榮 4 並立即得 4 VP。使用醫療、教育或奢侈品，各會占用本回合的一次免費行動。',
  '個人影響力\n可向國家購買公共媒體影響力，或透過卡牌等效果取得。一般提案時可花 1 影響力，讓該法案立即進入表決。表決時先表態並抽出方塊，再決定要投入多少影響力。每投入 1 份，所支持的一方加 1 票。投入的影響力在表決結束時消耗。',
].join('\n\n');

const warehouseHelp = [
  '企業在生產階段產出的資源按種類入庫。格內顯示庫存／容量和目前售價。超過容量的部分會丟棄。勞工與中產可在自己的購買行動中按標示售價購買。倉庫持有人可在自己的行動回合選「對外出口」，按現行出口牌交出指定數量並取得金錢。',
  '食物\n由農業企業生產，資本家也能透過商務合約進貨。中產與資本家的基礎容量皆為 8 份。除了平時出售或出口，也可在輪末食物需求結算時賣給需要補足食物的勞工或中產。終局每滿 2 份得 1 VP。',
  '奢侈品\n由奢侈品企業生產，資本家也能透過商務合約進貨。中產基礎容量為 8 份，資本家為 12 份。可供國內購買，或依出口牌出售。終局每滿 3 份得 1 VP。',
  '醫療\n由醫療企業生產。中產基礎容量為 8 份，資本家為 12 份。可供國內購買，依出口牌出售，或按特定卡牌效果賣給國家。終局每滿 3 份得 1 VP。',
  '教育\n由教育企業生產。中產基礎容量為 8 份，資本家為 12 份。可供國內購買，依出口牌出售，或按特定卡牌效果賣給國家。終局每滿 3 份得 1 VP。',
  '終局按資源種類各自取整。例如 5 份食物得 2 VP，4 份醫療得 1 VP，合計 3 VP。',
  '倉庫擴充\n中產與資本家共用 6 塊倉庫板塊。每個階級的每種資源最多擴充一次。擴充只會讓選定資源的容量翻倍，板塊之後固定用於該資源。例如食物容量從 8 增至 16 份。',
].join('\n\n');

const revenueHelp = [
  '開局設置\n資本家的營收區放入 $120。',
  '營收是資本家本輪可優先動用的金錢。國內銷售、出口等新收入通常先存入這裡。建造企業、發薪和繳稅等支出一般先從營收扣，營收不足再用資本補差額。',
  '生產階段發薪後，先繳僱用稅（營運企業數 × 稅倍率）。再以繳完僱用稅後的營收餘額，依政策 3 的稅表查出企業稅。剩餘營收在輪末計分階段全部轉入資本。',
  '例如發薪後剩 $80，有 2 家營運企業且稅倍率為 5，先繳 $10 僱用稅。營收剩 $70，若政策是 3B，再繳 $15 企業稅，最後轉入資本 $55。',
].join('\n\n');

const capitalHelp = [
  '開局設置\n資本區從 $0 開始。',
  '資本累積歷輪轉入的營收，也可以補足本輪支出。一般支出先用營收，差額由資本支付。若卡牌指定優先用資本，例如「購買私人島嶼」，就先扣資本，差額再用營收。兩邊加總仍付不起強制支出時，每筆貸款的 $50 會先存入資本。',
  '輪末把繳稅後剩餘的營收轉入資本，再依資本總額對照財富軌計分。支付支出會降低資本餘額，因此也可能降低這一輪的基本財富分。',
  '例如原有資本 $50，輪末轉入 $55，營收歸零、資本變成 $105。這輪按 $100 級距得 5 VP，若刷新財富紀錄，再加上跨格獎勵。',
].join('\n\n');

const wealthHelp = [
  '開局設置\n財富紀錄標記從 $0 級距開始。',
  '輪末計分時，將繳完薪資與稅後剩餘的營收轉入資本。以資本總額對照軌道上已達到的最高門檻，取得該格標示的 VP。',
  '財富標記記錄你曾達到的最高資本門檻。打破紀錄時，每比舊紀錄多前進一格，就多得 3 VP。如果資本之後下降，基本分照當輪實際達到的門檻計算，財富標記留在原格。',
  '例如紀錄在 $50，這輪資本到 $100，基本得 5 VP。跨過 $75 和 $100 兩格再得 6 VP，合計 11 VP。',
].join('\n\n');

const legitimacyHelp = [
  '開局設置\n國家對勞工、中產及資本家的合法性標記各放在第 2 格。三個階級的永久標記數都是 0。',
  '國家對勞工、中產和資本家各有一條合法性軌，範圍為 1 到 10。處理事件、執行卡牌效果，或依 A 區福利政策免費提供醫療或教育，都可能提高指定階級的合法性。部分事件的懲罰會降低合法性。',
  '事件或卡牌獎勵可能給予永久標記。每獲得一枚，該階級的合法性立即 +1，之後每輪重設時也會再加 1。軌道旁的 +N 是該階級持有的永久標記數。',
  '輪末將三條合法性軌中最低的兩個數字相加，就是國家這輪的合法性分數。接著重設每條軌道：先將數值除以 2，有小數就進到下一個整數，再加上該階級的永久標記數，最高為 10。',
  '例如三條軌道為 7、5、4，國家得 5＋4＝9 VP。若第一條有 2 枚永久標記，重設後為 7÷2 向上取整得 4，再加 2，成為 6。',
].join('\n\n');

const freeTradeHelp = [
  '開局設置\n資本家把自由貿易區板塊放在圖版旁。食物和奢侈品的起始庫存都是 0。',
  '取得貨物\n資本家在行動回合選「商業交易」，挑一張場上的商務合約，再指定食物與奢侈品的到貨位置。整批放進自由貿易區只付合約基價。只要有任何貨物進商業倉庫，就按目前對外貿易政策支付整張合約的關稅。線上版可在交易確認前選擇「分配到兩處」。',
  '容量與轉移\n食物最多存 8 份，奢侈品最多存 12 份，各自計算，超出容量的貨物會丟棄。交易確認後，自由貿易區與商業倉庫的庫存各自保留，不能互相轉移。自由貿易區的貨物僅供出口，國內銷售和輪末食物需求結算使用商業倉庫的庫存。',
  '出口\n輪到自己時選「對外出口」，勾選現行出口牌的交易。可用兩處的同類庫存湊足牌上要求，線上版會先扣自由貿易區，再扣商業倉庫。例如一筆出口需要 5 份食物，自由貿易區有 3 份，就從商業倉庫再扣 2 份。一般出口行動中每個交易選項可做一次，所得存入營收。',
  '終局計分\n將兩處的食物合計後，每滿 2 份得 1 VP。奢侈品也先合計，每滿 3 份得 1 VP。',
].join('\n\n');

const loanHelp = [
  '開局設置\n所有階級都從 0 筆貸款開始。',
  '何時借款\n付不起強制支出時才借款，例如生產階段的薪資、食物需求結算、稅款，或準備階段的利息。其他玩家的卡牌也可能造成強制支出。每筆貸款取得 $50，玩家板的貸款數加 1。資本家的借款存入資本。線上版若在食物結算時需要借款，須先確認借貸才能完成結算。',
  '利息\n每輪準備階段按當時持有的貸款筆數，每筆支付 $5。例如有 2 筆貸款，這次就付 $10。利息與本金分開計算。若付不起利息，會再借款。資本家優先用資本付息。',
  '如何還款\n輪到自己時，選免費行動「償還貸款」，確認支付 $50，清掉 1 筆貸款。資本家優先用資本還款。還清的貸款之後免付利息。國家的貸款若達財政政策門檻，生產階段還會檢查是否能以每筆 $55 償還足夠筆數，以避免 IMF 介入。',
  '終局結算\n第五輪後，資本家每筆未還貸款扣 5 VP。勞工、中產與國家每筆按 $55 結清。若金錢不足，以 $5 為單位盡量償還，每欠 $5 扣 1 VP。例如有 1 筆貸款、手上有 $38，可先還 $35，剩欠 $20，因此扣 4 VP。',
].join('\n\n');

export function boardHelpButton(title, description, escape) {
  return `<button type="button" class="mat-help" aria-haspopup="dialog"
    aria-label="${escape(title)}說明" data-mat-help="${escape(title)}" data-description="${escape(description)}">?</button>`;
}

export function availableUnionWorkers(economy, moves = []) {
  if (!economy) return [];
  const { companies, workers, unions } = economy;
  const workingById = new Map(workers.filter(worker => worker.role === 'working').map(worker => [worker.id, worker]));
  const occupiedSkills = new Set(unions.map(id => workingById.get(id)?.skill));
  const movedWorkers = new Set(moves.map(move => move.worker));
  const destinations = new Map(moves.map(move => [`${move.company}:${move.slot}`, move.worker]));
  if (movedWorkers.size !== moves.length || destinations.size !== moves.length) return [];
  for (const move of moves) {
    const worker = workingById.get(move.worker);
    const slot = companies.find(company => company.id === move.company)?.slots[move.slot];
    if (!worker || worker.committed || worker.company === move.company || !slot
      || (slot.role && slot.role !== 'working') || (slot.skill !== 'any' && slot.skill !== worker.skill)
      || (slot.worker && !movedWorkers.has(slot.worker))) return [];
  }
  const employed = new Map();
  for (const company of companies) {
    const staff = company.slots.map((slot, index) => destinations.get(`${company.id}:${index}`)
      ?? (movedWorkers.has(slot.worker) ? null : slot.worker));
    if (company.slots.some((slot, index) => !slot.optional && !staff[index])) {
      if (moves.some(move => move.company === company.id)) return [];
      continue;
    }
    if (moves.some(move => move.company === company.id) && company.owner !== 'middle'
      && staff.some(id => id && !workingById.has(id))) return [];
    const count = staff.filter(id => workingById.has(id)).length;
    employed.set(company.resource, (employed.get(company.resource) ?? 0) + count);
  }
  return [...workingById.values()].filter(worker => worker.skill !== 'any' && !worker.company && !worker.committed
    && !movedWorkers.has(worker.id) && !occupiedSkills.has(worker.skill) && employed.get(worker.skill) >= 4);
}

export function playerDiagram(state, role, meta, wells, resources, escape, unionWorkers = availableUnionWorkers(state.economy)) {
  const { names, playerTracks, policyRules } = meta;
  const player = state.players[role];
  const economy = state.economy;
  const color = roleColors[role];
  const inventory = economy?.inventory[role] ?? {};
  const storedResources = ['food', 'luxury', 'health', 'education'];
  const influence = wells('影響力', player.influence, 'influence', role, 'influence');
  const help = (title, description) => boardHelpButton(title, description, escape);
  const heading = (title, description, detail = '') =>
    `<h4><span class="mat-zone-title">${title} ${help(title, description)}</span>${detail}</h4>`;
  const warehouse = () => `<section class="warehouse mat-zone" aria-label="${names[role]}商業倉庫">
    ${heading('商業倉庫', role === 'middle'
      ? '開局設置\n中產的商業倉庫放入 1 份食物與 1 份醫療，奢侈品和教育從 0 開始。\n\n' + warehouseHelp + '\n\n中產在主要行動打出「企業成長」時，可選一種尚未擴充的資源免費加倉。中產要自用時，須在「購買商品與服務」把自己的倉庫選為來源。移轉免費，仍占一個來源且受人口上限限制。'
      : '開局設置\n資本家的商業倉庫放入 1 份食物、2 份奢侈品及 2 份教育，醫療從 0 開始。個人影響力從 1 開始。\n\n' + warehouseHelp + '\n\n資本家在自己的回合選免費行動「購買倉庫」，選擇一種旗下企業能生產且尚未擴充的資源，再支付 $20 確認。例如醫療容量可從 12 增至 24 份。終局把自由貿易區的同類貨物合併計分。此處顯示的個人影響力可用於提案或表決。', '<small>庫存／容量</small>')}
    <div class="mat-storage-wells">${storedResources.map(key =>
      wells(resources[key], inventory[key] ?? 0, key, role, undefined, economy?.storageCapacity?.[role]?.[key])).join('')}${role === 'capitalist' ? influence : ''}</div>
  </section>`;
  const moneyZone = (title, amount, description) => `<section class="mat-zone mat-money">${heading(title, description)}${wells('金錢', amount, 'money')}</section>`;
  let body;
  if (role === 'working' || role === 'middle') {
    const workers = economy?.workers.filter(worker => worker.role === role).length ?? 0;
    const population = state.match?.populations[role] ?? 3;
    const goods = ['food', 'luxury', 'health', 'education'].map(key => wells(resources[key], player[key] ?? 0, key, role, 'goods')).join('');
    const prosperity = role === 'middle' ? state.match?.middleProsperityIndex : state.match?.workingProsperity;
    const prosperityHelp = [
      '開局設置\n勞工與中產的繁榮標記都放在第 0 格。',
      '使用醫療、教育或奢侈品時，從生活資源區消耗等同人口的份數。繁榮標記前進一格，立即獲得新格印的 VP。使用醫療另得 2 VP 並新增一名通用工人，使用教育還能訓練一名工人。',
      role === 'middle'
        ? '中產在輪末計分時，若目前繁榮值低於滿編企業數，可再前進一格並得分。滿編企業須有兩名工人，有勞工選用工位的企業也要填滿該格。中產軌有重複數字，例如從第一個 5 前進到第二個 5，仍可再得 5 VP。下一輪準備時退兩格。'
        : '例如人口 4、繁榮 3，使用 4 份奢侈品會前進到 4，立即得 4 VP。下一輪準備時退一格。',
      '繁榮最低退到 0，退格時已獲得的 VP 仍然保留。',
    ].join('\n\n');
    const eligibleUnionSkills = new Set(unionWorkers.map(worker => worker.skill));
    const unionZone = () => `<section class="mat-zone mat-unions">${heading('產業工會', '開局設置\n五個產業工會格開局皆為空。\n\n勞工可透過「指派工人」，將一名該產業的技術工派進工會。成立時須有至少 4 名其他勞工在該產業的企業工作。若人數後來低於 4 人，工會工人回到待業區。\n\n每個工會在生產階段給 1 影響力、在輪末計分給 2 VP。例如維持 3 個工會，一輪可得 3 影響力及 6 VP。')}<div class="mat-union-grid">
      ${Object.entries(industries).map(([skill, name]) => {
        const count = economy?.unions.filter(id => economy.workers.find(worker => worker.id === id)?.skill === skill).length ?? 0;
        const status = count ? 'established' : eligibleUnionSkills.has(skill) ? 'eligible' : 'ineligible';
        const label = count ? '已成立' : status === 'eligible' ? '可成立' : '未達成立條件';
        const tip = count ? `tabindex="0" data-tip-title="${escape(name + '工會成員')}" data-tip-body="已承諾\n承諾到期 · 工會維持期間一直承諾。該產業在職勞工少於 4 人，工會解散，工人回到待業區。"` : '';
        return `<div class="mat-union-slot ${status}" style="--skill:${workerColors[skill]}" aria-label="${name}工會 ${label}" ${tip}>
          ${workerFigure('working', skill)}<span>${name}</span><b>${count}</b></div>`;
      }).join('')}</div></section>`;
    body = `<section class="mat-zone mat-population">${heading('人口軌', populationHelp, `<span>工人 ${workers} 人 · 人口 ${population}</span>`)}
      ${populationTrack(workers, population, playerTracks.population, color)}</section>
      <div class="mat-class-layout"><div class="mat-stack"><section class="mat-zone mat-prosperity">${heading('繁榮軌', prosperityHelp)}
        ${track('繁榮', playerTracks.prosperity[role], prosperity, color)}</section>${role === 'working' ? unionZone() : warehouse()}</div>
        <div class="mat-stack">${moneyZone('收入', player.cash, `開局設置\n勞工從 $30 開始，中產從 $40 開始。\n\n` + '這是本階級可支用的現金。生產階段領取薪資，部分福利或卡牌也會給現金。中產另可透過國內銷售和出口取得現金。\n\n行動回合可用現金購買商品與服務。輪末須支付補買食物的費用與稅款。資金不足以支付強制支出時，每筆貸款取得 $50，後續每輪準備階段每筆付 $5 利息。')}<section class="mat-zone mat-personal">${heading('生活資源', personalGoodsHelp)}
          <div class="mat-goods-wells">${goods}${influence}</div></section></div></div>`;
  } else if (role === 'capitalist') {
    body = `<div class="mat-capital-accounts">${moneyZone('營收', player.revenue, revenueHelp)}${moneyZone('資本', player.capital, capitalHelp)}</div>
      <section class="mat-zone mat-wealth">${heading('財富軌', wealthHelp, '<span>資本級距／分數</span>')}${wealthTrack(playerTracks.wealth, state.match?.wealth ?? 0, color)}</section>
      ${warehouse()}
      <section class="mat-zone mat-free-trade">${heading('自由貿易區', freeTradeHelp, '<small>僅供出口</small>')}<div class="well-row">${['food', 'luxury'].map(key =>
        wells(resources[key], economy?.tradeZone[key] ?? 0, key, undefined, undefined, economy?.freeTradeCapacity?.[key])).join('')}</div></section>`;
  } else {
    const welfare = ['醫療', '教育'].map((name, index) => {
      const section = state.policies[3 + index];
      const price = policyRules.public_health_and_education_price[section];
      return `<div><strong class="mat-zone-title">${name} $${price} ${help('公共' + name, (index === 0 ? '開局設置\n醫療福利設在 4B，公共醫療每份 $5。' : '開局設置\n教育福利設在 5C，公共教育每份 $10。') + '\n\n這裡顯示當前福利政策對應的公共服務單價。勞工或中產在自己的行動回合從國家購買，資源由主圖板的公共服務區扣除，貨款存入國庫。\n\nA 區每份 $0，每免費提供 3 份，購買階級的合法性 +1。例如一次提供 6 份可加 2。B 區每份 $5，每筆交易讓國家得 1 VP。C 區每份 $10。')}</strong><small>${section === 'A' ? '每 3 份 · 合法性 +1' : section === 'B' ? '每筆 · +1 VP' : '原價'}</small></div>`;
    }).join('');
    body = `<section class="mat-zone mat-legitimacy">${heading('合法性與永久標記', legitimacyHelp)}<div class="mat-state-top"><div class="legitimacy-tracks">${classes.map(seat =>
      `<div><span>${names[seat]} <b>+${state.content?.legitimacyTokens[seat] ?? 0}</b></span>
        ${track(`${names[seat]}合法性 ${state.legitimacy[seat]}`, numbers(10, 1), state.legitimacy[seat] - 1, roleColors[seat])}</div>`).join('')}</div>
        <div class="mat-welfare">${welfare}</div></div></section>
      <section class="warehouse mat-zone" aria-label="國家貨物倉庫與影響力">${heading('貨物倉庫與個人影響力', '開局設置\n國家的食物和奢侈品各從 0 開始，個人影響力從 1 開始。主圖板公共服務區的媒體影響力另行設置。\n\n國家可透過卡牌取得食物和奢侈品，也可能透過公營企業生產，所得放入這裡。格內顯示庫存／容量與售價。勞工與中產可在購買行動向國家購買，國家也可在自己的行動回合按出口牌出售。國家終局每滿 2 份食物、每滿 3 份奢侈品，各得 1 VP。\n\n國家可用「競選」把最多 3 份公共媒體影響力轉為個人影響力。個人影響力可用於發起即時表決，或在表決抽票後投入，每份加 1 票。')}
        <div class="mat-storage-wells">${['food', 'luxury'].map(resource => wells(resources[resource], state.publicServices[resource] ?? 0,
          resource, 'state', undefined, economy?.publicStorageCapacity?.[resource])).join('')}${influence}</div></section>
      <section class="mat-zone mat-agenda">${heading('政治綱領', '開局設置\n洗勻政治綱領牌庫，翻開頂部 1 張，放在國家圖版旁讓所有玩家查看。這張牌列出第一輪的五項政策目標。\n\n後續每輪準備階段翻開新的政治綱領。每個代碼標示政策編號及目標區段，例如 3B 代表稅制目標為 B 區。國家可透過提案或卡牌效果推動政策變更。\n\n輪末計分時，逐一核對政策 1 到 5 的生效區段，每符合一項得 1 VP。例如綱領有 1C、3B、5A 三項與現行政策相符，就得 3 VP。這筆分數與合法性得分分開相加。')}
        <p class="agenda-tags">${state.match?.agenda.map((section, index) => `<span style="--policy:${policyColors[index]}">${escape(meta.policies[index])} ${index + 1}${escape(section)}</span>`).join('') ?? '—'}</p></section>`;
  }
  return `<section class="player-mat ${role}" style="--role:${color}" aria-label="${names[role]}圖板">
    ${boardSurface(role)}<div class="player-mat-content"><header><h3>${names[role]}圖板</h3><span>${player.vp} VP · <span class="mat-zone-title">貸款 ${economy?.loans[role] ?? 0} ${help('貸款', loanHelp)}</span></span></header>${body}</div></section>`;
}
