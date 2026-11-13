import { availableUnionWorkers, boardHelpButton, boardSurface, companyGear, companyOutput, companyProductionTotal, companySlotDetails, companySlots as buildSlots, companyStopped, exportOfferLabel, playerDiagram, policyColors, policyDiagram, scoreEdge, slotRoleIcons, slotRoleLabel,
  track, workerColors, workerFigure } from './boards.js';
import { attachPieces } from './pieces.js';
import { catalogActionDetail } from './catalog-action-details.js';

const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const warningDialog = document.querySelector('#warning-dialog');
const connection = document.querySelector('#connection');
const headerRoomCode = document.querySelector('#header-room-code');
const headerRoomActions = document.querySelector('#header-room-actions');
const headerAccount = document.querySelector('#header-account');
const headerAccountName = document.querySelector('#header-account-name');
const returnLobby = document.querySelector('#return-lobby');
const copyInvite = document.querySelector('#copy-invite');
const saveRoomButton = document.querySelector('#save-room');
const loadRoomButton = document.querySelector('#load-room');
const closeRoom = document.querySelector('#close-room');
const roomSavesDialog = document.querySelector('#room-saves');
const tooltip = document.querySelector('#board-tooltip');
const actionConfirmation = document.querySelector('#action-confirmation');
const electionDialog = document.querySelector('#election-dialog');
const voteResultDialog = document.querySelector('#vote-result-dialog');
const roundResultDialog = document.querySelector('#round-result-dialog');
const matHelpDialog = document.querySelector('#mat-help-dialog');
const matHelpTabs = matHelpDialog.querySelector('[role="tablist"]');
const matHelpPanel = matHelpDialog.querySelector('[role="tabpanel"]');
const cardPilesDialog = document.querySelector('#card-piles-dialog');
const cardPilesBody = cardPilesDialog.querySelector('[data-card-piles-body]');
const hostAdjustDialog = document.querySelector('#host-adjust-dialog');
const hostAdjustTabs = hostAdjustDialog.querySelector('.host-adjust-tabs');
const hostAdjustBody = hostAdjustDialog.querySelector('[data-host-adjust-body]');
const adjustGameButton = document.querySelector('#adjust-game');

// One label per paragraph after the optional opening setup paragraph.
// Empty labels leave the paragraph in 基本說明.
const matHelpTopics = {
  '勝利分數軌 (VP)': ['', '', '共同得分', '勞工', '中產', '資本家', '國家', '終局結算'],
  政治議題: ['', '提案與表決', '政策效果', '政策效果', '政策效果', '政策效果', '政策效果', '政策效果', '政策效果', '計算方式'],
  輪次: ['', '回合與終局'],
  稅倍率: ['計算方式', '計算方式', '計算方式'],
  投票袋: ['補充方塊', '抽票與回收', '抽票與回收'],
  國家福利: ['', '發放規則', '領取福利', '計分方式'],
  國家事件: ['', '事件行動', '發放福利', '未處理懲罰'],
  國庫: ['', '支出與結算', '貸款與 IMF', '計分方式'],
  對外貿易: ['商務合約', '出口', '進口'],
  公共服務: ['庫存與容量', '醫療與教育', '醫療與教育', '醫療與教育', '媒體影響力'],
  私營部門: ['', '營運條件', ...Array(5).fill('工位承諾'), '無薪資', '機械加成', '機械加成', '機械加成'],
  公營部門: ['', '開放與營運條件', ...Array(5).fill('工位承諾'), '無薪資'],
  待業工人: ['取得工人', '', '移民', '指派工人', '建造與雇用'],
  人口軌: ['', '人口變動', '使用規則'],
  繁榮軌: ['', '計分與重設', '計分與重設'],
  產業工會: ['成立條件', '收益與計分'],
  收入: ['', '使用規則'],
  生活資源: ['取得資源', '食物', '醫療', '教育', '奢侈品', '個人影響力'],
  商業倉庫: ['', '資源明細', '資源明細', '資源明細', '資源明細', '計分方式', '倉庫擴充', '倉庫擴充'],
  營收: ['', '計算方式', '計算方式'],
  資本: ['', '計算方式', '計算方式'],
  財富軌: ['', '計算方式', '計算方式'],
  自由貿易區: ['取得貨物', '容量與轉移', '出口', '終局計分'],
  合法性與永久標記: ['', '永久標記', '計算方式', '計算方式'],
  公共醫療: ['', '定價與計分'],
  公共教育: ['', '定價與計分'],
  貨物倉庫與個人影響力: ['貨物與計分', '個人影響力'],
  政治綱領: ['', '計算方式'],
  貸款: ['何時借款', '利息', '如何還款', '終局結算'],
  私人手牌: ['', '補牌規則', '使用規則'],
  主要行動: ['', '行動類型', '操作方式', '回合限制'],
  免費行動: ['', '使用規則'],
  準備階段: ['', '市場與牌庫', '工人與輪初結算'],
  行動階段: ['', '回合規則', '進入下一階段'],
  生產階段: ['', '生產與發薪', '食物需求', 'IMF 與稅款'],
  選舉階段: ['', '表決流程', '結果與確認'],
  計分階段: ['', '各階級計分', '下一輪與終局'],
};

const actionHelpDetails = {
  propose: '提出法案\n自己須有可用提案標記，且該議題沒有待決法案。選擇議題及相鄰的政策區段，再選表決時機。等到輪末表決不花影響力，立即表決需花 1 個人影響力。',
  pressure: '施加政治壓力\n選擇此行動並確認，從供應區加入最多 3 枚己方方塊到投票袋。供應區不足 3 枚時，只加入剩餘的方塊。不花金錢或影響力。',
  assign: '指派工人\n選尚未承諾的己方工人，一次最多 3 人，不花金錢。拖曳到另一家企業符合階級及技能的空工位，或在選單指定。要啟動停工企業，須在同一次行動補齊必要工位。完成指派的工人會進入承諾狀態。',
  union: '成立產業工會\n勞工可在「指派工人」選一名尚未承諾的待業技術工成立工會。該產業須有至少 4 名其他勞工在營運企業工作，且尚無該產業的工會。可以在同一次行動先把企業人數補到 4 人，再用剩下的一次指派成立工會。不花金錢。',
  buy: '購買商品與服務\n選一種資源，最多向兩個來源購買，各來源最多買等同人口的份數，且不得超過庫存。選來源、輸入數量，核對總額再確認。按來源的每份價格付款，外國市場只供應食物和奢侈品，進口價已含關稅。中產可把自家倉庫選為來源，免費移入生活資源區，仍算一個來源。',
  strike: [
    '發起罷工',
    '怎麼發起\n勾選 1 或 2 家有勞工在職的資本家、中產或公營企業，再確認。薪資為 L3、有已承諾工人或已放罷工標記的企業不能選。每家限 1 枚罷工標記，須有足夠的標記，不花金錢。',
    '行動階段的影響\n罷工中的企業不能靠卡牌提前生產。中產仍可用基本行動「加班」，但罷工的勞工員工不參與，不領加班薪資，也不提供額外產量。',
    '生產階段的影響\n若企業在生產前已加薪到 L3，輪末照常生產與發薪，勞工不會因該企業獲得罷工影響力。仍在營運且薪資為 L1 或 L2 的罷工企業，每家讓勞工得 1 影響力。資本家和公營企業跳過生產及發薪；中產企業保留經營者的基本產量，只扣掉勞工員工的額外產量與薪資。輪末生產後清除罷工標記。',
    '停工時的標記\n依官方規則，企業在輪中停工時應立即移除罷工標記。線上版目前統一在輪末生產時清除。',
  ].join('\n'),
  demonstrate: [
    '發起示威',
    '怎麼發起\n勞工待業人數須比可用空工位至少多 2，且場上尚無示威。計算空工位時看工位是否開放給勞工，無須逐一比對技術。例如有 5 名待業勞工、3 個可用工位，就能發起。核對畫面上的人數後確認，不花金錢。',
    '何時取消\n發起後，若有玩家新建企業、在建造時指派勞工進去，而且指派後待業人數與可用工位的差距已低於 2，示威便取消。取消時不扣分，也不給影響力。',
    '生產階段的影響\n若示威仍在，線上版會在生產與發薪後、食物需求前，請勞工分配扣分。勞工得 1 影響力，其他階級合計扣除當時的待業勞工人數加上已成立工會數。每個階級最多扣到其部門的空企業格數，國家未開放的公營企業格也算。',
    '扣分例子\n若結算時有 5 名待業勞工、2 個工會，原本要分配 7 VP。若中產、資本家、國家最多分別只能扣 2、1、3 VP，合計上限是 6 VP，這次就分配 6 VP。確認後移除示威標記。',
  ].join('\n'),
  middleBuild: '建造企業\n自家企業未達 8 家時，可從市場選一張企業牌拖進中央圖板的中產部門，支付牌上的建造費。每個必要工位都須指派符合技能且尚未承諾的中產工人。有選用勞工工位時，可指定符合條件的待業勞工。若企業有薪資欄，須選符合最低薪資的級距，再核對建造及工位後確認。',
  capitalistBuild: '建造企業\n自家企業未達 12 家時，可從市場選一張企業牌拖進中央圖板的資本家部門，支付牌上的建造費。若企業有薪資欄，須選符合最低薪資的級距。可以先不雇人。若要立即雇用，須用同一階級且符合技能的待業工人填滿全部工位。通用工位優先用待業通用工。',
  sell: '出售企業\n選一間自家且沒有已承諾工人的企業。確認後移除企業，原工人回到待業區。無須付款，收回牌上印的建造費。',
  export: '對外出口\n勾選現行出口牌上可完成的交易。一次可選多筆不同交易，每筆只能做一次，合計不得超過庫存。沒有額外費用，交出牌上要求的貨物並領取牌上金額。中產用商業倉庫出貨，每筆另得 1 VP。資本家可合併兩處庫存，先扣自由貿易區，再扣商業倉庫。國家只可出口食物與奢侈品。',
  shift: '加班\n選一家正在營運且必要工位的中產工人都尚未承諾的自家企業。不花金錢，確認後立即生產一次並承諾參與的工人。若選用工位的勞工已承諾，或該企業正在罷工且薪資未達 L3，只計中產工人的產量。',
  deal: '商業交易\n選一張場上的商務合約，再指定貨物進商業倉庫、自由貿易區或分到兩處。支付牌上的基價。只要有貨進商業倉庫，另付整張合約在現行貿易政策下的關稅。超出容量的貨物會丟棄，交易後棄掉合約，當輪不補牌。',
  lobby: '遊說\n須有足夠資金。選擇後確認支付 $30，優先從資本支付，取得 3 個人影響力。',
  campaign: '競選\n公共服務須有媒體影響力。選 1 到 3 份，且不得超過庫存。確認後把所選份數從公共庫存移到國家的個人影響力，不花金錢。',
  meet: '會晤政黨議員\n國家須有至少 2 個人影響力。選勞工、中產或資本家，確認後交給對方 2 個人影響力，並讓國家對該階級的合法性加 1。',
  tax: '額外稅\n從合法性最低的階級中選兩席，兩席合法性都須高於 1。確認後向勞工、中產和資本家各徵 $10，國庫共收 $30，被選中的兩席各降 1 合法性。',
  event: '處理國家事件\n場上須有可處理的事件。選事件及牌面選項，依提示指定受益階級、交付資源或執行指定行動。條件、費用及獎勵依事件牌，確認前可檢查所選方案。',
  health: '使用醫療\n生活資源區須有等同人口的醫療。確認時消耗這些醫療，繁榮前進並按新格得分，另得 2 VP，新增一名通用工人。通用工供應不足時，依畫面選擇仍有供應的替代技能。',
  education: '使用教育\n生活資源區須有等同人口的教育。選一名可受訓的己方工人，再選仍有供應且不同於原技能的新技能。工會成員與占用指定技能工位的工人不可選。中產若要改換技術工的技能，該工人須待業。確認後消耗教育，繁榮前進並按新格得分。',
  luxury: '使用奢侈品\n生活資源區須有等同人口的奢侈品。確認後消耗這些奢侈品，繁榮前進並按新格得分。',
  swap: '交換工人\n選一名占用通用工位的己方技術工，再配一名尚未承諾的己方待業工人。可填多組，確認後待業工接替工位並承接該工位原工人的承諾狀態，技術工回到待業區。不花金錢。',
  prices: '調整售價\n在自家國內商品的價格選單中，至少為一項商品選擇不同的允許價格。可一次調整多項，確認後新價格立即生效，不花金錢。',
  wages: '調整薪資\n選至少一家自己管理且有薪資欄的企業，選擇不同的薪資級距。不能低於現行最低薪資，有已承諾工人的薪資不得調低。加薪會承諾相關工人。確認時不另付調薪費，發薪時按新級距支付。',
  bonus: '發放獎金\n選一家自家正在營運且有工人的企業。確認支付 $5 給工人所屬階級，該企業的工人進入承諾狀態。',
  storage: '購買倉庫\n須有尚未使用的倉庫板塊，且自家至少有一家能生產該資源的企業。選一種尚未擴充的資源，確認支付 $20，該資源的商業倉庫容量翻倍。',
  repay: '償還貸款\n至少有 1 筆貸款且付得起 $50。選還款、核對金額再確認，每次清掉 1 筆。資本家優先用資本支付。',
  benefits: '領取福利\n自己的福利區須有待領項目。確認後一次免費領完，金錢與資源入帳，投票方塊入袋。國家因此得 1 VP。',
};

const actionHelpByClass = {
  主要行動: {
    勞工: ['propose', 'pressure', 'assign', 'union', 'buy', 'strike', 'demonstrate'],
    中產: ['propose', 'pressure', 'assign', 'buy', 'middleBuild', 'sell', 'shift', 'export'],
    資本家: ['propose', 'pressure', 'capitalistBuild', 'sell', 'deal', 'export', 'lobby'],
    國家: ['propose', 'campaign', 'meet', 'tax', 'export', 'event'],
  },
  免費行動: {
    勞工: ['health', 'education', 'luxury', 'swap', 'repay', 'benefits'],
    中產: ['health', 'education', 'luxury', 'swap', 'prices', 'wages', 'repay', 'benefits'],
    資本家: ['prices', 'wages', 'bonus', 'storage', 'repay', 'benefits'],
    國家: ['wages', 'repay'],
  },
};

const matHelpIntroductions = {
  稅倍率: '稅倍率由稅制、醫療福利及教育福利的現行政策決定。中產與資本家用它計算僱用稅。',
  投票袋: '投票袋存放勞工、中產及資本家的方塊。抽到的方塊依各階級的立場計入表決票數。',
  對外貿易: '對外貿易區顯示場上的商務合約、出口交易，以及外國市場的進口價格。',
  公共服務: '這裡顯示國家供應的醫療、教育及媒體影響力，包括各自的庫存、容量與價格。',
  產業工會: '勞工可以在各產業成立工會。已成立的工會會在生產和計分階段帶來收益。',
  生活資源: '勞工與中產在這裡存放自用的食物、醫療和教育等資源，也能查看個人影響力。',
  自由貿易區: '資本家可將商務合約的食物及奢侈品存放於此，供對外出口。',
  貨物倉庫與個人影響力: '這裡顯示國家持有的食物、奢侈品與個人影響力。',
  貸款: '各階級在無法支付強制支出時借款。未還貸款需要付息，也會影響終局結算。',
};

function openMatHelp(title, description) {
  const paragraphs = description.split('\n\n');
  const sections = new Map([['基本說明', []]]);
  if (paragraphs[0].startsWith('開局設置\n')) {
    sections.set('開局設置', [paragraphs.shift().slice('開局設置\n'.length)]);
  }
  if (matHelpIntroductions[title]) sections.get('基本說明').push(matHelpIntroductions[title]);
  const topics = matHelpTopics[title.split(' · ')[0]] ?? [];
  paragraphs.forEach((paragraph, index) => {
    const label = topics[index] || '基本說明';
    if (!sections.has(label)) sections.set(label, []);
    const heading = label + '\n';
    sections.get(label).push(paragraph.startsWith(heading) ? paragraph.slice(heading.length) : paragraph);
  });
  const classActions = actionHelpByClass[title] ?? {};
  for (const [role, actions] of Object.entries(classActions)) {
    sections.set(role, actions.map(action => actionHelpDetails[action]));
  }

  const buttons = Array.from(sections, ([label, paragraphs], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `mat-help-tab-${index}`;
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', matHelpPanel.id);
    button.addEventListener('click', () => {
      for (const tab of matHelpTabs.children) {
        tab.setAttribute('aria-selected', String(tab === button));
        tab.tabIndex = tab === button ? 0 : -1;
      }
      matHelpPanel.setAttribute('aria-labelledby', button.id);
      const breakSentences = text => text.replace(/(。[」』”’）】]*)(?=[^\s])/gu, '$1\n');
      if (Object.hasOwn(classActions, label)) {
        const fragment = document.createDocumentFragment();
        for (const [index, paragraph] of paragraphs.entries()) {
          const separator = paragraph.indexOf('\n');
          const heading = document.createElement('strong');
          renderHelpText(heading, `[${paragraph.slice(0, separator)}]`);
          const body = document.createElement('span');
          renderHelpText(body, breakSentences(paragraph.slice(separator + 1)));
          if (index) fragment.append('\n\n');
          fragment.append(heading, '\n', body);
        }
        matHelpPanel.replaceChildren(fragment);
      } else renderHelpText(matHelpPanel, breakSentences(paragraphs.join('\n\n')));
      matHelpPanel.scrollTop = 0;
    });
    return button;
  });
  matHelpTabs.replaceChildren(...buttons);
  renderHelpText(matHelpDialog.querySelector('h2'), title);
  buttons[0].click();
  matHelpDialog.showModal();
  matHelpTabs.scrollLeft = 0;
}

matHelpTabs.addEventListener('keydown', event => {
  const tabs = Array.from(matHelpTabs.children);
  const index = tabs.indexOf(event.target);
  if (index === -1) return;
  const nextIndex = {
    ArrowLeft: (index + tabs.length - 1) % tabs.length,
    ArrowRight: (index + 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  }[event.key];
  if (nextIndex === undefined) return;
  event.preventDefault();
  tabs[nextIndex].click();
  tabs[nextIndex].focus();
});
const storageKey = 'hegemony-seat-v1';
const accountKey = 'hegemony-player-account';
const seatRoomsKey = 'hegemony-seat-rooms-v1';
const invite = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const icon = name => `<img class="icon" src="/assets/icons/${name}.svg" alt="">`;
const resources = { food: '食物', luxury: '奢侈品', health: '醫療', education: '教育', influence: '媒體', any: '通用' };
const industries = { ...resources, food: '農業' };
const roundPhases = [['preparation', '準備'], ['action', '行動'], ['production', '生產'], ['elections', '選舉'], ['scoring', '計分']];
const roundPhaseHelp = {
  preparation: [
    '第 2 到第 5 輪開始時，先為新一輪補充手牌、更新市場並處理輪初結算。第 1 輪完成開局設置後直接進入行動階段。',
    '依畫面提示，由資本家及中產更新各自的企業市場。換上新出口牌，依現行對外貿易政策翻出商務合約，並翻開新的國家事件及政治綱領。各階級保留未用的手牌，再補到 7 張。',
    '每筆未還貸款支付 $5 利息。勞工繁榮退 1 格，中產退 2 格，最低退到 0。勞工與中產補充工人，再依移民政策加入額外工人。中產須選擇新增技術工的技能，若畫面要求替代技能，也須選完才會進入行動階段。',
  ],
  action: [
    '四個階級依序輪流行動，每席每輪有 5 個回合。',
    '輪到自己時，選一張手牌打出效果，或棄掉一張手牌執行基本行動。每回合另可選做一次免費行動，可在主要行動前或後執行。同回合已取得的資源可以接著使用。',
    '完成主要行動和待確認的交易後，按「結束回合」交給下一席。若行動觸發即時表決，先完成表決再回到行動流程。四席都完成各自的第 5 個回合後進入生產階段。',
  ],
  production: [
    '行動回合全部結束後，依序處理企業生產與發薪、食物需求、IMF 和稅款。發薪、生產、食物需求、IMF 與繳稅都會等待對應席位確認。',
    '每個步驟依國家、資本家、中產、勞工的順序結算。發薪與生產屬於同一步，各階級先發薪，再將企業產出放入對應庫存。罷工可能影響生產及發薪。勞工依工會及罷工取得影響力，若有示威，依畫面分配扣分。',
    '中產先結算，接著是勞工。各消耗等同人口的食物，先使用自有庫存，再選有貨的國內賣方補足，剩餘缺額由外國市場供應。強制支出需要借款時，先確認借款再完成結算。',
    '食物結算後檢查國家貸款是否達財政政策的 IMF 門檻。若觸發，先完成相關調整，再按規則繳稅。有待決法案就進入選舉，沒有則直接進入計分。',
  ],
  elections: [
    '本階段處理行動期間留到輪末的法案。沒有待決法案時略過。行動中觸發的即時表決會在當下處理。',
    '輪末有法案才先補充投票袋，再逐案表決。依畫面選贊成或反對，抽出 5 枚方塊後，各席再決定投入多少個人影響力。每枚抽出的方塊與每份投入的影響力各算 1 票。',
    '贊成票至少和反對票一樣多就通過。結果視窗顯示各席立場、抽出的方塊、投入的影響力及總票數。等四席確認後，通過的法案才套用，接著處理下一案或進入計分。',
  ],
  scoring: [
    '先處理仍留在場上的國家事件懲罰，再計算各階級本輪獲得的 VP。需要國家指定懲罰對象時，先依畫面選擇。',
    '勞工每個成立的產業工會得 2 VP。中產的繁榮值低於滿編企業數時，繁榮前進 1 格並按新格得分。資本家把營收轉入資本，按財富軌得分，刷新紀錄每跨一格另得 3 VP。國家把最低兩條合法性軌的數值相加，再加上政治綱領每符合一項的 1 VP，之後重設合法性。',
    '第 1 到第 4 輪計分後，由房主開始下一輪準備。第 5 輪計分後，依階級結算貸款、政策、現金與庫存等終局分數，再比較最終 VP。',
  ],
};
let meta;
let accountToken = sessionStorage.getItem(accountKey);
let account;
let seat = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
const seatRooms = JSON.parse(sessionStorage.getItem(seatRoomsKey) ?? '{}');
if (seat) seatRooms[seat.code] = seat;
if (invite && seat?.code !== invite) seat = seatRooms[invite] ?? null;

function rememberSeat() {
  seatRooms[seat.code] = seat;
  sessionStorage.setItem(seatRoomsKey, JSON.stringify(seatRooms));
  sessionStorage.setItem(storageKey, JSON.stringify(seat));
}

const fragmentSeat = new URLSearchParams(location.hash.slice(1)).get('seat');
if (/^[A-F0-9]{8}$/.test(invite) && /^[a-f0-9]{64}$/.test(fragmentSeat ?? '')) {
  seat = { code: invite, token: fragmentSeat };
  history.replaceState(null, '', location.pathname + location.search);
}
if (seat) rememberSeat();
let state;
let busy = false;
let pendingId;
let pendingBody;
let selectedCard;
let selectedBoardTab = 'settlement';
let draft;
let cardBuildStaff = [];
let purchaseDraft;
let selectedAction;
let selectedFreeAction = '';
let adjustTab = 'state';
let boardStatus = '';
let electionPrompt = '';
let pendingVoteDialogId;
let shownRoundResult;
const legacyEffects = {
  'working-state-scholarship': { effect: 'service', resource: 'education', policy: 4 },
  'middle-import-subsidy': { effect: 'import' },
  'capitalist-offshore-companies': { effect: 'offshore' },
  'state-pressing-matters': { effect: 'pressing' },
};

async function request(path, body, { method = body ? 'POST' : 'GET', token = seat?.token, signal, presence } = {}) {
  const response = await fetch(path, {
    method, cache: 'no-store', signal,
    headers: {
      ...(presence && { 'X-Room-Presence': '1' }),
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status });
  return result;
}

function message(text = '') {
  notice.textContent = text;
  notice.hidden = !text;
}

function warning(text, focusAfter) {
  warningDialog.querySelector('#warning-text').textContent = text;
  if (focusAfter) warningDialog.addEventListener('close', () => focusAfter.focus(), { once: true });
  if (!warningDialog.open) warningDialog.showModal();
}

function showPlayerLogin() {
  app.innerHTML = `<div class="lobby"><section class="panel"><h1>玩家登入</h1>
    <form data-player-login>
      <label>暱稱<input name="name" required maxlength="24" autocomplete="username"></label>
      <label>密碼<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="primary" name="operation" value="login">登入</button>
      <button name="operation" value="register">註冊</button>
    </form>
  </section></div>`;
}

function headerClassLabel(role) {
  const label = meta?.names[role];
  return label ? `<span class="header-class ${escape(role)}">${escape(label)}</span>-` : "";
}

function updateHeaderAccountName() {
  const role = state?.waiting ? state.waiting.players.find(player => player.id === state.role)?.role : state?.role;
  const hostLabel = state && state.role === state.host ? ' (房長)' : '';
  headerAccountName.innerHTML = account ? headerClassLabel(role) + escape(account.name) + hostLabel : '';
}

async function loadPlayerRooms() {
  const token = accountToken;
  const result = await request('/api/player/rooms', undefined, { token });
  if (accountToken === token) {
    account = result;
    updateHeaderAccountName();
    headerAccount.hidden = false;
  }
}

async function enterPlayerRoom(code, testMode = false) {
  const path = code ? `/api/rooms/${code}/join` : '/api/rooms';
  seat = await request(path, code ? {} : { testMode }, { token: accountToken });
  rememberSeat();
  history.replaceState(null, '', `/?room=${seat.code}`);
  update(await request(`/api/rooms/${seat.code}`, undefined, { presence: true }));
}

function forgetPlayerAccount() {
  accountToken = null;
  account = undefined;
  sessionStorage.removeItem(accountKey);
  headerAccount.hidden = true;
  headerAccountName.textContent = '';
}

function showLobby() {
  updateHeaderAccountName();
  headerRoomActions.hidden = true;
  if (roomSavesDialog.open) roomSavesDialog.close();
  electionPrompt = '';
  if (electionDialog.open) electionDialog.close();
  pendingVoteDialogId = undefined;
  if (voteResultDialog.open) voteResultDialog.close();
  if (roundResultDialog.open) roundResultDialog.close();
  if (hostAdjustDialog.open) hostAdjustDialog.close();
  shownRoundResult = undefined;
  if (!account) return showPlayerLogin();
  const code = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  const phases = { lobby: '等待區', complete: '已完成' };
  app.innerHTML = `<div class="lobby">
    <div class="hero"><h1>四個席位，一個國家</h1></div>
    <section class="panel"><h2>建立／加入房間</h2><form data-room>
      <label>房間代碼<input name="code" value="${escape(code)}" spellcheck="false"></label>
      <label class="check" data-test-room ${code ? 'hidden' : ''}><input type="checkbox" name="testMode">建立測試房間</label>
      <button class="primary">${code ? '加入房間' : '建立房間'}</button>
    </form></section>
    <section class="panel"><h2>我的房間</h2>${account.rooms.length ? account.rooms.map(room =>
      `<p><button type="button" data-resume-room="${room.code}">${room.code}</button>
      · ${room.host ? '建立' : '加入'} · ${phases[room.phase] ?? '對局中'}${room.round ? ` · 第 ${room.round} 輪` : ''}</p>`
    ).join('') : '<p class="muted">還沒有建立或加入的房間。</p>'}</section>
  </div>`;
}

function seatMoney(role, player) {
  if (role === 'state') return `<span>國庫 $${state.treasury}</span>`;
  if (role === 'capitalist') return `<span>營收 $${player.revenue}</span><span>資本 $${player.capital}</span>`;
  return `<span>現金 $${player.cash}</span>`;
}

function startingStock(role) {
  const stock = role === 'state' ? state.publicServices : state.economy?.inventory[role] ?? {};
  const resourcesOnBoard = Object.entries(stock).filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => `${resource === 'influence' ? '媒體影響力' : resources[resource]} ${amount}`);
  if (!resourcesOnBoard.length) return '';
  return `<p class="muted">${role === 'state' ? '公共服務' : '商業倉庫'} · ${resourcesOnBoard.join('、')}</p>`;
}

function seatCards() {
  return meta.roles.map(role => {
    const player = state.players[role];
    return `<div class="seat ${role}"><strong>${meta.names[role]}${role === state.role ? ' · 你' : ''}</strong>
      <p>${escape(state.seats[role] ?? '等待入座')}${role === state.host ? ' · 房主' : ''}</p>
      <div class="stats">${seatMoney(role, player)}<span>${icon('influence')} 個人影響力 ${player.influence}</span>
        ${state.phase === 'lobby' ? '' : `<span>VP ${player.vp}</span><span>手牌 ${player.handCount}</span>`}</div>
      ${state.phase === 'lobby' ? startingStock(role) : ''}</div>`;
  }).join('');
}

function billFields(choices = state.availablePolicies, { freeImmediate = false } = {}) {
  const policy = selectField('bill', '政策變更', choices.map(({ policy, target }) =>
    policyOption(policy, target, `${policy + 1} ${meta.policies[policy]} · ${state.policies[policy]} → ${target}`)), true);
  return policy + (freeImmediate
    ? selectField('vote-timing', '表決時機', [['now', '立即表決（免費）'], ['round-end', '本輪選舉階段表決']])
    : '<label class="check"><input type="checkbox" name="immediate">立即投票（未勾選則在本輪選舉階段表決）</label>');
}

function secondBillField(firstPolicy) {
  return selectField('bill1', '第二案政策', [['', '選擇第二案政策'],
    ...state.availablePolicies.filter(choice => choice.policy !== firstPolicy)
      .map(({ policy, target }) => policyOption(policy, target))], true);
}

function form(type, title, fields = '') {
  return `<form data-command="${type}">${fields}<button>${title}</button></form>`;
}

function selectField(name, title, options, required = false, disabled = false) {
  const colored = options.some(([, , color]) => color);
  const firstColor = options.find(option => !option[3])?.[2];
  return `<label>${title}<select name="${name}" ${required || !options.length ? 'required' : ''}${disabled ? ' disabled' : ''}
    ${colored ? 'data-colored-options' : ''}${firstColor ? ` style="color:${firstColor}"` : ''}>${options.map(([value, label, color, disabled]) =>
    `<option value="${escape(value)}"${disabled ? ' disabled' : color ? ` style="color:${color}"` : ''}>${escape(label)}</option>`).join('') || '<option value="">目前沒有可用選項</option>'}</select></label>`;
}

function syncSelectColor(select) {
  select.style.color = select.selectedOptions[0]?.style.color ?? '';
}

const cardAssignmentOptions = new WeakMap();

function filterRepeatedCardChoices(selects) {
  const chosen = new Set();
  for (const select of selects) {
    let options = cardAssignmentOptions.get(select);
    if (!options) {
      options = Array.from(select.options);
      cardAssignmentOptions.set(select, options);
    }
    const value = select.value;
    select.replaceChildren(...options.filter(option => !chosen.has(option.value)));
    select.value = chosen.has(value) ? '' : value;
    if (select.value) chosen.add(select.value);
    syncSelectColor(select);
  }
}

function syncCardMoves(moves) {
  filterRepeatedCardChoices(moves.querySelectorAll('select[name^="worker"]'));
  filterRepeatedCardChoices(moves.querySelectorAll('select[name^="slot"]'));
}

function wageOptions(wages) {
  const min = { A: 3, B: 2, C: 1 }[state.policies[1]];
  return [1, 2, 3].filter(level => level >= min).map(level => [level, `L${level}${wages ? ` · $${wages[level - 1]}` : ''}`]);
}

function workerLabel(worker, companies, location) {
  const workplace = companies.find(item => item.id === worker.company)?.name;
  const skill = worker.skill === 'any' ? '非技術' : resources[worker.skill];
  return `${skill} #${worker.id.split('-').at(-1)} · ${location ?? workplace ?? '待業'}`;
}

const workerSkillColor = skill => `color-mix(in srgb, ${workerColors[skill]} 72%, white)`;

function workerOption(worker) {
  const workplace = state.economy.companies.find(item => item.id === worker.company);
  const slotIndex = workplace?.slots.findIndex(slot => slot.worker === worker.id) ?? -1;
  const position = slotIndex >= 0 ? `${workplace.name} 工位 ${slotIndex + 1}` : workplace?.name;
  const status = state.economy.unions.includes(worker.id) ? '工會' : position ?? '待業';
  const skill = worker.skill === 'any' ? '通用' : industries[worker.skill];
  const label = worker.id === 'specialization-new-worker' ? `${meta.names.working}-${skill}（新工人 · 待業）`
    : `${meta.names[worker.role]}-${skill} #${worker.id.split('-').at(-1)} (${status}${worker.committed ? ' · 已承諾' : ''})`;
  return [worker.id, label,
    workerSkillColor(worker.skill)];
}

function slotOption(company, slot, index) {
  return [`${company.id}:${index}`, `${companyActionLabel(company)} (${industries[slot.skill]} ${index + 1})`, `var(--industry-${company.resource})`];
}

const classes = ['working', 'middle', 'capitalist'];
const policyColor = policy => `color-mix(in srgb, ${policyColors[policy]} 72%, white)`;

function coloredGameText(value) {
  const colors = new Map();
  for (const [role, name] of Object.entries(meta.names)) {
    colors.set(name, `var(--${role})`);
    if (role !== 'state') colors.set(name + '階級', colors.get(name));
  }
  for (const resource of ['food', 'luxury', 'health', 'education', 'influence']) {
    const color = `var(--industry-${resource})`;
    colors.set(resources[resource], color);
    colors.set(industries[resource], color);
  }
  colors.set('通用', workerSkillColor('any'));
  colors.set('影響力', colors.get('媒體'));
  for (const prefix of ['個人', '媒體', '公共媒體']) colors.set(prefix + '影響力', colors.get('影響力'));
  for (const [index, name] of meta.policies.entries()) colors.set(name, policyColor(index));
  colors.set('教育', 'var(--industry-education)');
  colors.set('教育政策', policyColor(4));
  colors.set('醫療政策', policyColor(3));
  colors.set('外貿政策', policyColor(5));
  colors.set('稅倍率', policyColor(2));
  colors.set('金錢', 'var(--gold)');
  colors.set('勝利分數', 'var(--gold)');
  for (const company of [...(state?.economy?.companies ?? []), ...Object.values(state?.economy?.markets ?? {}).flat()]) {
    if (company.name && resources[company.resource]) colors.set(company.name, `var(--industry-${company.resource})`);
  }

  const terms = [...colors.keys()].sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    ['政策\\s*([1-7])(?:[ABC](?!\\w)|(?![\\dABC～]))', '\\b([1-7])[ABC]\\b', '\\$\\d[\\d,]*(?:\\.\\d+)?', '\\bVP\\b', ...terms].join('|'), 'g');
  const source = String(value ?? '');
  let content = '';
  let end = 0;
  for (const match of source.matchAll(pattern)) {
    const [term, policyNumber, sectionNumber] = match;
    const policy = policyNumber ?? sectionNumber;
    const color = policy ? policyColor(Number(policy) - 1) : colors.get(term) ?? 'var(--gold)';
    content += escape(source.slice(end, match.index)) + coloredGameLabel(term, color);
    end = match.index + term.length;
  }
  return content + escape(source.slice(end));
}

function coloredGameLabel(label, color) {
  return `<span style="color:${escape(color)}">${escape(label)}</span>`;
}

function renderHelpText(element, value) {
  element.innerHTML = coloredGameText(value);
}
const policyOption = (policy, target, label = `${meta.policies[policy]} → ${target}`) =>
  [`${policy}:${target}`, label, policyColor(policy)];
const roleOption = (role, label = meta.names[role]) => [role, label, role === 'foreign' ? policyColor(5) : `var(--${role})`];
const roleOptions = roles => roles.map(role => roleOption(role));
const productOption = (key, label = resources[key]) => [key, label, `var(--industry-${key})`];
const productOptions = keys => keys.map(key => productOption(key));
const skillOptions = keys => keys.map(key => [key, resources[key], workerSkillColor(key)]);
const products = ['food', 'luxury', 'health', 'education', 'influence'];

function checks(name, options) {
  return options.map(([value, label]) => `<label class="check"><input name="${name}" type="checkbox" value="${escape(value)}">${escape(label)}</label>`).join('');
}

let quantityHintId = 0;
const quantityRange = (min, max) => max < min ? '目前無可用數量' : `可填 ${min}～${max}`;

function numberField(name, label, max, min = 0, value = min) {
  const hint = `quantity-range-${++quantityHintId}`;
  return `<label>${label}<span class="quantity-field"><input name="${name}" type="number" min="${min}" max="${max}"
    value="${value}" aria-describedby="${hint}" required><small id="${hint}" class="quantity-range">${quantityRange(min, max)}</small></span></label>`;
}

function updateQuantityMax(input, max, clamp = true) {
  input.max = max;
  if (clamp && input.value !== '' && input.valueAsNumber > max) input.value = Math.max(Number(input.min), max);
  input.nextElementSibling.textContent = quantityRange(Number(input.min), max);
}

function companyActionLabel(item, label = item.name) {
  return `${meta.names[item.owner]}-${label}`;
}

function companyOptions(companies, label = item => `${item.name} · $${item.cost}`) {
  return companies.map(item => [item.id, companyActionLabel(item, label(item)), `var(--industry-${item.resource})`]);
}

function companyCardInfo(item) {
  const wages = item.wages?.map((amount, index) => `L${index + 1} ${amount}`).join('／');
  return `<p>建造 $${item.cost} · 基本產量 ${escape(resources[item.resource])} ${item.output}
    <br>${wages ? `薪資 ${wages}` : '無薪資'}
    ${item.automated ? ' · 自動化' : ''}${item.machineryBonus ? ` · 機械加成 +${item.machineryBonus}` : ''}
    ${buildSlots(item).map((slot, index) => `<br>工位 ${index + 1} · ${escape(companySlotDetails(slot, meta.names))}`).join('')}</p>`;
}

function companyCardChoices(items) {
  if (!items.length) return '';
  return `<details><summary>查看企業卡內容</summary>${items.map(item =>
    `<details><summary>${escape(companyActionLabel(item))}</summary>${companyCardInfo(item)}</details>`).join('')}</details>`;
}

function buildBudget(role) {
  if (role === 'state') return state.treasury;
  const player = state.players[role];
  return role === 'capitalist' ? player.revenue + player.capital : player.cash;
}

function buildCompanyChoices(offers, budget, storageResource, excluded) {
  return offers.map(item => {
    const cost = storageResource && item.resource === storageResource ? Math.max(0, item.cost - 4) : item.actualCost;
    const blocked = item.id === excluded ? '已選為第一家企業' : item.blocked || (cost > budget ? '資金不足' : '');
    const label = companyActionLabel(item, `${item.name} · 實付 $${cost}${blocked ? `（${blocked}）` : ''}`);
    return [item.id, label, `var(--industry-${item.resource})`, Boolean(blocked)];
  });
}

function buildFields(role, companies, { optional = false, prefix = '', land = false, idle = false,
  price = item => item.cost, payer = role, mandatoryPay = false, storage = false, firstCompany } = {}) {
  const offers = companies.map(item => ({ ...item, owner: item.owner ?? role, actualCost: item.actualCost ?? price(item) }));
  let budget = buildBudget(payer);
  if (mandatoryPay) {
    const taken = Object.values(state.economy.loans).reduce((sum, count) => sum + count, 0);
    budget += Math.max(0, meta.loanSupply - taken) * meta.loanPrincipal;
  }
  const choices = buildCompanyChoices(offers, budget - (firstCompany?.cost ?? 0), storage ? products[0] : null, firstCompany?.id);
  const first = offers.find((_, index) => !choices[index][3]);
  return `<fieldset class="card-build" data-card-build="${escape(JSON.stringify({ offers, prefix, land, idle, budget, storage, expansion: prefix === 'build1-' }))}">
    ${selectField(prefix + 'company', '企業', [...(optional ? [['', '略過']] : !first ? [['', '目前無法建造']] : []), ...choices], !optional)}
    ${companyCardChoices(offers)}
    <div data-card-build-slots>${optional ? '' : cardBuildSlots(first, { prefix, land, idle })}</div>
    <button type="button" data-cancel-card-build hidden>取消建造配置</button>
  </fieldset>`;
}

function cardBuildSlots(item, { prefix, land, idle }, staff = []) {
  if (!item) return '';
  const slots = buildSlots(item);
  const workers = state.economy.workers;
  return (item.wages ? selectField(prefix + 'wage', '薪資級距', wageOptions(item.wages)) : '')
    + slots.map((slot, index) => {
      const name = prefix + 'card-staff-' + index;
      const label = `工位 ${index + 1} · ${companySlotDetails(slot, meta.names)}${slot.optional ? '（選用）' : ''}`;
      if (land && index === 0) return `<p>${label} · 由供應區加入新工人</p><input type="hidden" name="${name}" value="">`;
      let candidates = workers.filter(worker => canStaffBuild(worker, item, slot, index, staff, idle));
      if (slot.skill === 'any' && (item.owner === 'capitalist' || slot.optional)) {
        const unskilledRoles = new Set(candidates.filter(worker => worker.skill === 'any').map(worker => worker.role));
        candidates = candidates.filter(worker => worker.skill === 'any' || !unskilledRoles.has(worker.role));
      }
      return selectField(name, label, [['', '空置'], ...candidates.map(workerOption)], item.owner === 'middle' && !slot.optional);
    }).join('');
}

function syncNationalize(container) {
  const selected = container.querySelector('select[name="company"]')?.value ?? '';
  for (const block of container.querySelectorAll('[data-nationalize-slots]')) {
    const active = block.dataset.nationalizeSlots === selected;
    block.hidden = !active;
    for (const field of block.querySelectorAll('select')) field.disabled = !active;
  }
}

function previewCardBuild(form) {
  const staff = [];
  for (const fieldset of form.querySelectorAll('[data-card-build]')) {
    const selected = Array.from(fieldset.querySelectorAll('select[name*="card-staff-"]:not(:disabled)'), field => field.value).filter(Boolean);
    fieldset.querySelector('[data-cancel-card-build]').hidden = !selected.length;
    staff.push(...selected);
  }
  if (staff.length === cardBuildStaff.length && staff.every((id, index) => id === cardBuildStaff[index])) return;
  cardBuildStaff = staff;
  hideTip();
  app.querySelector('.main-board').outerHTML = tableBoard();
}

function updateCardBuild(fieldset, changed) {
  const { offers, prefix, land, idle, budget, storage, expansion } = JSON.parse(fieldset.dataset.cardBuild);
  const form = fieldset.form;
  fieldset.hidden = fieldset.disabled = form.elements.namedItem('source')?.value === 'deck';
  if (fieldset.disabled) return;
  const company = form.elements.namedItem(prefix + 'company');
  if ((storage && changed === 'resource') || (expansion && changed === 'build0-company')) {
    const selected = company.value;
    const first = expansion ? offers.find(item => item.id === form.elements.namedItem('build0-company').value) : null;
    const choices = buildCompanyChoices(offers, budget - (first?.cost ?? 0), storage ? form.elements.namedItem('resource').value : null, first?.id);
    const label = document.createElement('template');
    const placeholder = storage ? '略過' : '選擇第二家企業';
    label.innerHTML = selectField(company.name, '企業', [['', placeholder], ...choices]);
    company.replaceChildren(...label.content.querySelector('select').options);
    company.value = choices.some(([id, , , disabled]) => id === selected && !disabled) ? selected : '';
    if (selected !== company.value) changed = company.name;
    syncSelectColor(company);
  }
  const item = offers.find(offer => offer.id === company.value);
  const fields = fieldset.querySelector('[data-card-build-slots]');
  const staff = changed === prefix + 'company' ? [] : Array.from(fields.querySelectorAll('[name*="card-staff-"]'), field => field.value);
  const wage = changed === prefix + 'company' ? '' : form.elements.namedItem(prefix + 'wage')?.value;
  fields.innerHTML = cardBuildSlots(item, { prefix, land, idle }, staff);
  for (const select of fields.querySelectorAll('select')) {
    const index = Number(select.name.slice((prefix + 'card-staff-').length));
    const value = select.name === prefix + 'wage' ? wage : staff[index];
    if (Array.from(select.options).some(option => option.value === value)) select.value = value;
    syncSelectColor(select);
  }
}

function moveFields(role, count = 3, { unemployed = false, employeeOnly = false, owner, newWorker } = {}) {
  const { companies, workers } = state.economy;
  const movable = workers.filter(worker => worker.role === role && !worker.committed && (!unemployed || !worker.company));
  if (newWorker) movable.unshift(newWorker);
  const slots = companies.filter(item => !owner || item.owner === owner).flatMap(item => item.slots.flatMap((slot, index) => {
    const current = workers.find(worker => worker.id === slot.worker);
    if ((employeeOnly && !slot.optional) || (slot.role && slot.role !== role)
      || (current && (unemployed || current.role !== role || current.committed))) return [];
    if (!movable.some(worker => worker.company !== item.id && (slot.skill === 'any' || slot.skill === worker.skill))) return [];
    return [slotOption(item, slot, index)];
  }));
  const rows = Array.from({ length: Math.min(count, movable.length) }, (_, index) => `<div class="two">
    ${selectField(`worker${index}`, `工人 ${index + 1}`, [['', '略過'], ...movable.map(workerOption)])}
    ${selectField(`slot${index}`, '目的工位', [['', '選擇工位'], ...slots])}</div>`).join('');
  return `<div data-card-moves>${rows}</div>`;
}

function specializationFields(skill, replacement) {
  const supply = state.specializationSupply;
  let newWorker;
  let status = '選好技能後，可在下方任一「工人」選單指派新工人；全部略過則讓他留在待業區。';
  if (skill && supply) {
    const actualSkill = supply[skill] > 0 ? skill : supply.any > 0 ? 'any' : replacement;
    if (supply[actualSkill] > 0) {
      newWorker = { id: 'specialization-new-worker', skill: actualSkill };
      status = `將新增 1 名${industries[actualSkill]}工人。可在下方選擇「新工人」指派工位，或略過讓他留在待業區。`;
    } else {
      status = products.some(key => supply[key] > 0)
        ? '指定技能與通用工人皆已用完，請選擇仍有庫存的替代技能。'
        : '工人供應已用完，本次仍可指派現有工人。';
    }
  } else if (skill) {
    status = '目前伺服器未提供工人供應資料。請重啟遊戲伺服器並重新整理頁面。';
  }
  const middle = state.role === 'middle';
  return `<p class="muted" role="status">${status}</p>${
    moveFields('working', 3, { unemployed: middle, employeeOnly: middle, owner: middle ? 'middle' : undefined, newWorker })
  }`;
}

function purchaseFields({ optional = false, flexible = false, sources = ['middle', 'capitalist', 'state', 'foreign'] } = {}) {
  return `<div data-card-purchase="${flexible}">` + selectField('resource', '購買資源', [...(optional ? [['', '略過']] : []), ...productOptions(products)])
    + sources.map(role => numberField(`dist-${role}`, role === 'foreign' ? '進口數量' : `向${meta.names[role]}購買`,
      purchaseLimit(optional ? '' : products[0], role, flexible ? 2 : 1))).join('')
    + (flexible ? '<small class="muted">只向一個來源購買時，上限可達人口的兩倍。</small>' : '') + '</div>';
}

function updateCardPurchaseLimits(panel, clamp) {
  const resource = panel.querySelector('[name="resource"]').value;
  const fields = [...panel.querySelectorAll('input[name^="dist-"]')];
  for (const field of fields) {
    const double = panel.dataset.cardPurchase === 'true' && !fields.some(other => other !== field && other.valueAsNumber > 0);
    updateQuantityMax(field, purchaseLimit(resource, field.name.slice(5), double ? 2 : 1), clamp);
  }
}

const sellerName = seller => seller === 'foreign' ? '外國市場' : seller === state.role ? '自己的商業倉庫' : meta.names[seller];
const marketQuote = (seller, resource) => state.match?.prices?.[seller]?.[resource];
const purchaseRows = ({ resource, distribution }) => Object.entries(distribution).filter(([, quantity]) => quantity > 0)
  .map(([seller, quantity]) => ({ resource, seller, quantity }));

function purchaseLimit(resource, seller, populationMultiplier = 1) {
  if (!resource || (state.role === 'working' && seller === 'working')) return 0;
  const stock = seller === 'foreign' ? (['food', 'luxury'].includes(resource) ? Infinity : 0)
    : seller === 'state' ? state.publicServices[resource]
      : state.economy.inventory[seller]?.[resource];
  return Math.min((state.match?.populations[state.role] ?? 3) * populationMultiplier, stock ?? 0);
}

function purchaseSourceLabel(seller, resource) {
  const quote = marketQuote(seller, resource);
  if (!quote) return sellerName(seller);
  const price = seller === state.role ? '免費移轉' : `單價 $${quote.price}`;
  return `${sellerName(seller)} · ${price}${quote.stock == null ? '' : ` · 庫存 ${quote.stock}`}`;
}

function subsidizedImportLimit(resource) {
  const price = marketQuote('foreign', resource)?.base ?? (resource === 'food' ? 10 : 6);
  return Math.min(state.match?.populations[state.role] ?? 3, price ? Math.floor(state.players[state.role].cash / price) : Infinity);
}

function tourismLimit(seller) {
  const quote = marketQuote(seller, 'luxury');
  const budget = state.players[state.role].cash;
  return Math.min(state.match?.populations[state.role] ?? 3, quote?.stock ?? 0,
    quote?.price ? Math.floor(budget * 2 / quote.price) : Infinity);
}

function purchasePanel() {
  const resource = purchaseDraft?.resource ?? 'food';
  const sellers = ['middle', 'capitalist', 'state', 'foreign'].filter(seller => purchaseLimit(resource, seller) > 0);
  const fields = [0, 1].map(index => {
    const line = purchaseDraft?.lines[index];
    const other = purchaseDraft?.lines[1 - index]?.seller;
    const available = sellers.filter(seller => seller !== other);
    const limit = purchaseLimit(resource, line?.seller);
    return `<div class="purchase-fields">${selectField(`seller${index}`, `購買來源 ${index + 1}`,
      [['', index ? '不使用第二個來源' : '選擇來源'], ...available.map(seller => roleOption(seller, purchaseSourceLabel(seller, resource)))])}
      ${numberField(`quantity${index}`, '數量', limit, limit ? 1 : 0, limit ? Math.min(limit, line.quantity || 1) : 0)}</div>`;
  }).join('');
  return `<section class="purchase-panel" data-purchase-panel ${dropAttrs('buy')}>
    <p class="muted">一次選一種商品或服務，最多向兩個來源購買。每個來源的上限是目前人口數。</p>
    ${form('buy', '查看購買明細', selectField('resource', '商品或服務', productOptions(products)) + fields)}
    </section>`;
}

function readPurchase(fields) {
  return { resource: fields.get('resource'), lines: [0, 1].map(index => ({
    seller: fields.get(`seller${index}`), quantity: Number(fields.get(`quantity${index}`)),
  })) };
}

function dealCardInfo(deal) {
  const section = state.policies[5];
  const tariff = deal.tariffByForeignTrade[section];
  const goods = Object.entries(deal.goods).map(([resource, count]) =>
    `${icon(resource)} ${resources[resource]} ${count} 份`).join('、');
  return `<small>${goods}</small><small>基價 ${deal.cost}</small>
    <small>關稅 6${section.toLowerCase()} ${tariff}</small>
    <small>進商業倉庫 ${deal.cost + tariff}</small><small>進自由貿易區 ${deal.cost}</small>`;
}

function dealFields() {
  const deals = state.content?.deals ?? [];
  const goods = (deals.find(deal => draft?.type === 'deal' && deal.id === draft.fields.dealId) ?? deals[0])?.goods;
  return selectField('dealId', '商業交易', deals.map(deal => [
    deal.id, `${deal.nameZh} · $${deal.cost} · ${Object.entries(deal.goods).map(([kind, amount]) => `${resources[kind]} ${amount}`).join('、')}`,
  ])) + selectField('destination', '到貨位置', [['free-zone', '全部進自由貿易區'], ['warehouse', '全部進國內倉庫'], ['split', '分配到兩處']])
    + '<p class="muted">選擇分配時，填寫進國內倉庫的數量，其餘進自由貿易區。只要有貨進國內倉庫，就需支付關稅。</p>'
    + numberField('allocation-food', '食物進國內倉庫', goods?.food ?? 0)
    + numberField('allocation-luxury', '奢侈品進國內倉庫', goods?.luxury ?? 0)
    + deals.map(deal => `<details><summary>商務合約(${Number(deal.id.split('-').at(-1))})</summary><p class="deal-card-details">${dealCardInfo(deal)}</p></details>`).join('');
}

function strikeOptions() {
  return companyOptions(state.economy.companies.filter(item => !item.strike && item.wage !== 3 && item.owner !== 'working'
    && item.slots.some(slot => state.economy.workers.some(worker => worker.id === slot.worker && worker.role === 'working'))));
}

const assignmentMoves = () => draft?.type === 'assign' ? draft.moves : [];
const assignmentUnionWorkers = (moves = assignmentMoves()) => moves.length < 3
  ? availableUnionWorkers(state.economy, moves) : [];
const slotVacant = (slot, moves) => !slot.worker || moves.some(move => move.worker === slot.worker);
const pendingBuild = () => acting('build') && draft?.type === 'build'
  ? state.economy.markets[state.role].find(item => item.id === draft.fields.company) : null;

function canStaffBuild(worker, item, slot, index, staff = draft.staff, idle = false) {
  if (!worker || worker.committed || state.economy.unions.includes(worker.id)
    || (slot.role && slot.role !== worker.role) || (slot.skill !== 'any' && slot.skill !== worker.skill)) return false;
  if (worker.company && (idle || item.owner !== 'middle' || slot.optional)) return false;
  if (staff.some((id, position) => id === worker.id && position !== index)) return false;
  return item.owner !== 'capitalist' || staff.every((id, position) => !id || position === index
    || state.economy.workers.find(candidate => candidate.id === id)?.role === worker.role);
}

function startBuild(companyId) {
  if (draft?.type === 'build' && draft.fields.company === companyId) return;
  const item = state.economy.markets[state.role].find(company => company.id === companyId);
  const wage = draft?.type === 'build' ? draft.fields.wage : wageOptions()[0][0];
  draft = item ? { type: 'build', fields: { company: item.id, wage }, staff: buildSlots(item).map(() => null) } : null;
  announceBoard(item ? '已放置企業預覽，可將工人拖入空工位，再確認建造。' : '');
}

function basicBuildForm(companies) {
  const item = pendingBuild();
  const fields = selectField('company', '企業', [['', '選擇企業'], ...companyOptions(companies)]);
  if (!item) return `<form data-command="build">${fields}<button disabled>確認建造</button></form>`;
  const slots = buildSlots(item);
  const complete = item.owner === 'middle' ? slots.every((slot, index) => slot.optional || draft.staff[index])
    : !draft.staff.some(Boolean) || draft.staff.every(Boolean);
  const help = item.owner === 'middle' ? '填滿中產必要工位。選用勞工須來自待業區。'
    : '可先空置；若立即雇用，須由同一階級的待業工人填滿全部工位。';
  return `<form data-command="build">${fields}
    ${item.wages ? selectField('wage', '薪資級距', wageOptions(item.wages)) : ''}
    <p class="muted">${help}${item.owner === 'capitalist' && slots.length || item.employee ? '立即雇用的通用工位優先選非技術工人。' : ''}</p>
    ${slots.map((slot, index) => selectField(`staff-${index}`, `工位 ${index + 1} · ${companySlotDetails(slot, meta.names)}${slot.optional ? '（選用）' : ''}`,
      [['', '空置'], ...state.economy.workers.filter(worker => canStaffBuild(worker, item, slot, index))
        .map(workerOption)])).join('')}
    <div class="buttons"><button ${complete ? '' : 'disabled'}>確認建造</button><button type="button" data-clear-draft>取消建造</button></div></form>`;
}

function companyActions() {
  const { economy, role } = state;
  if (!economy) return [];
  const { companies, workers, markets } = economy;
  const movable = workers.filter(worker => worker.role === role && !worker.committed);
  const own = companies.filter(item => item.owner === role);
  const unionWorkers = role === 'working' ? assignmentUnionWorkers() : [];
  const actions = [];
  if (movable.length) {
    const moves = assignmentMoves();
    const destinations = companies.flatMap(item => item.slots.flatMap((slot, index) => {
      if ((slot.role && slot.role !== role) || !slotVacant(slot, moves)) return [];
      if (!movable.some(worker => worker.company !== item.id && (slot.skill === 'any' || worker.skill === slot.skill))) return [];
      return [slotOption(item, slot, index)];
    }));
    if (destinations.length || unionWorkers.length) {
      const choices = movable.map(workerOption);
      const fields = [0, 1, 2].map(index => `<div class="two">
        ${selectField(`worker${index}`, `工人 ${index + 1}`, [['', '略過'], ...choices])}
        ${selectField(`slot${index}`, '目的工位', [['', '選擇工位'], ...destinations])}</div>`).join('');
      const union = unionWorkers.length ? selectField('unionWorker', '成立工會（算一次指派）', [['', '略過'],
        ...unionWorkers.map(workerOption)]) : '';
      actions.push(['assign', '指派工人', `<p class="muted">可一次指派最多三人。請選擇空工位，或先排入移出原工人的操作。送出時必須填滿目標企業的必要工位。</p>${form('assign', '確認指派', fields + union)}`]);
    }
  }
  const buildable = item => {
    if (item.cost > actionFunds()) return false;
    if (role !== 'middle') return true;
    const available = movable.map(worker => worker.skill);
    for (const skill of item.skills.filter(skill => skill !== 'any')) {
      const index = available.indexOf(skill);
      if (index < 0) return false;
      available.splice(index, 1);
    }
    return available.length >= item.skills.filter(skill => skill === 'any').length;
  };
  if (markets[role]?.some(buildable) && own.length < (role === 'middle' ? 8 : 12)) {
    actions.push(['build', '建造企業', selectedAction === 'build' ? basicBuildForm(markets[role]) : '']);
  }
  const sellable = own.filter(item => item.slots.every(slot => !workers.find(worker => worker.id === slot.worker)?.committed));
  if (markets[role] && sellable.length) {
    const fields = selectField('company', '出售企業', companyOptions(sellable, item => `${item.name} · 收回 $${item.cost}`));
    actions.push(['sell', '出售企業', form('sell', '確認出售', fields)]);
  }
  return actions;
}

function educationFields(options) {
  const { cost, stock, workers } = options;
  const choices = stock < cost ? '<p class="muted">生活資源區的教育不足。</p>'
    : workers.length ? form('use-education', '確認使用教育', `
      ${selectField('worker', '受訓工人', [['', '選擇工人'],
        ...workers.map(({ id }) => workerOption(state.economy.workers.find(item => item.id === id)))], true)}
      <label>新技能<select name="skill" required data-colored-options><option value="">先選擇工人</option></select></label>`)
      : '<p class="muted">目前沒有可受訓的工人和技能組合。</p>';
  return `<p class="muted">生活資源區有 ${stock} 份教育，這次需消耗 ${cost} 份。訓練一名己方工人，繁榮前進一格並按繁榮軌得分。</p>${choices}`;
}

const conditionalBasicActions = {
  working: { propose: '提出法案', assign: '指派工人', strike: '發起罷工', demonstrate: '發起示威' },
  middle: { propose: '提出法案', assign: '指派工人', build: '建造企業', sell: '出售企業', 'extra-shift': '加班', export: '對外出口' },
  capitalist: { propose: '提出法案', build: '建造企業', sell: '出售企業', deal: '商業交易', export: '對外出口' },
  state: { propose: '提出法案', campaign: '競選', 'meet-mps': '會晤政黨議員', 'extra-tax': '額外稅', export: '對外出口', event: '處理國家事件' },
};

function actionFunds() {
  const player = state.players[state.role];
  return state.role === 'capitalist' ? player.capital + player.revenue : state.role === 'state' ? state.treasury : player.cash;
}

function completeActionOptions(actions, expected) {
  return [...actions, ...Object.entries(expected).filter(([id]) => !actions.some(action => action[0] === id))
    .map(([id, label]) => [id, label, null])];
}

function actionOption([id, label, fields], selected, used = false) {
  const disabled = used || fields === null;
  return `<option value="${id}" ${disabled ? 'disabled' : id === selected ? 'selected' : ''}>${escape(label)}${disabled ? '（不符合行動條件）' : ''}</option>`;
}

function freeActions() {
  const actions = [];
  const player = state.players[state.role];
  const population = state.match?.populations[state.role] ?? 3;
  const education = state.educationOptions;
  const expected = {};
  if (['working', 'middle'].includes(state.role)) Object.assign(expected, { 'use-education': '使用教育', 'swap-workers': '交換工人' });
  if (state.role !== 'working') expected.wages = '調整薪資';
  if (state.role === 'capitalist') Object.assign(expected, { 'give-bonus': '發放獎金', 'buy-storage': '購買倉庫' });
  if (state.role !== 'state' && state.content) expected.benefits = '領取福利';
  if (education && education.stock >= education.cost && education.workers.length) actions.push(['use-education', '使用教育', educationFields(education)]);
  if (meta.turnCommands.includes('use-health') && ['working', 'middle'].includes(state.role)) {
    const own = state.economy.workers.filter(worker => worker.role === state.role);
    const employed = own.filter(worker => worker.skill !== 'any' && state.economy.companies.some(item =>
      item.id === worker.company && item.slots.some(slot => slot.worker === worker.id && slot.skill === 'any')));
    const idle = own.filter(worker => !worker.company && !worker.committed && !worker.union);
    const workerOptions = list => [['', '不選擇'], ...list.map(workerOption)];
    if (employed.length && idle.length) actions.push(['swap-workers', '交換工人', form('swap-workers', '確認交換',
      employed.map((_, index) => selectField(`swap-employed-${index}`, '在非技術工位的技術工', workerOptions(employed))
        + selectField(`swap-idle-${index}`, '交換的待業工人', workerOptions(idle))).join(''))]);
    actions.push(['use-health', '使用醫療', player.health >= population ? form('use-health', '消耗等同人口的醫療',
      state.workerFallback?.length ? selectField('skill', '無通用工人，選擇替代技術工', skillOptions(state.workerFallback)) : '') : null]);
    actions.push(['use-luxury', '使用奢侈品', player.luxury >= population ? form('use-luxury', '消耗等同人口的奢侈品') : null]);
  }
  if (['middle', 'capitalist'].includes(state.role)) {
    const fields = Object.entries(meta.domesticPriceLevels[state.role]).map(([resource, levels]) => {
      const current = marketQuote(state.role, resource).price;
      return selectField(`price-${resource}`, `${resources[resource]} · 目前 $${current}`,
        [['', '維持'], ...levels.filter(price => price !== current).map(price => [price, `$${price}`])]);
    }).join('');
    actions.push(['adjust-prices', '調整售價', form('adjust-prices', '確認調整售價', fields)]);
  }
  const own = state.economy.companies.filter(item => item.owner === state.role && item.wages);
  const wages = own.flatMap(item => {
    const committed = item.slots.some(slot => (state.role !== 'middle' || slot.optional)
      && state.economy.workers.find(worker => worker.id === slot.worker)?.committed);
    const options = wageOptions(item.wages).filter(([level]) => level > item.wage || (level < item.wage && !committed));
    return options.length ? [selectField(`wage-${item.id}`, `${companyActionLabel(item)} · 目前 L${item.wage}`, [['', '維持'], ...options])] : [];
  });
  if (wages.length) actions.push(['wages', '調整薪資', form('wages', '確認調薪', wages.join(''))]);
  if (state.role === 'capitalist') {
    const companies = own.filter(item => item.operational && item.slots.some(slot => slot.worker));
    if (companies.length && actionFunds() >= 5) actions.push(['give-bonus', '發放獎金', form('give-bonus', '支付 $5',
      '<p class="muted">選擇一家有工人的營運企業，支付 $5給工人所屬階級，並承諾該企業工人。</p>'
      + selectField('company', '選擇企業', companyOptions(companies, item => item.name)))]);
  }
  const storageOptions = state.storageOptions ?? [];
  if (storageOptions.length && actionFunds() >= 20) actions.push(['buy-storage', '購買倉庫', `
    <p class="muted">花 $20，將所選資源的商業倉庫容量翻倍。</p>
    ${form('buy-storage', '支付 $20 擴充', selectField('resource', '擴充資源', storageOptions.map(resource => {
      const capacity = state.economy.storageCapacity.capitalist[resource];
      return productOption(resource, `${resources[resource]} · ${capacity} → ${capacity * 2}`);
    })))}`]);
  const loans = state.economy.loans[state.role];
  if (state.match) actions.push(['repay', `償還貸款（${loans} 筆）`, loans && actionFunds() >= 50
    ? form('repay', state.content ? '檢查還款金額' : '支付 $50') : null]);
  const benefits = Object.entries(state.content?.benefits[state.role] ?? {}).filter(([, amount]) => amount > 0);
  if (benefits.length) actions.push(['benefits', '領取福利', `<p>${benefits.map(([resource, amount]) =>
    resource === 'cash' ? `$${amount}` : `${resources[resource] ?? '投票方塊'} ${amount}`).join('、')}</p>${form('benefits', '領取')}`]);
  return completeActionOptions(actions, expected);
}

function freeActionPanel() {
  if (!state.economy || state.role !== state.currentRole) return '';
  const actions = freeActions();
  return `<section class="panel" id="free-action-options"><h2>${boardHeadingHelp('免費行動',
    '免費行動是自己回合中可選做的額外行動。每回合最多做一次，可以在主要行動前或後執行。',
    '從下拉選單選擇一項，填好所需資料，再確認執行。不需要棄手牌，但仍要支付該行動要求的金錢或資源。確認後取得的資源可在同一回合使用。可選項目依階級和目前情況而定。')}</h2>
    ${state.freeUsed ? '<p class="muted">本回合的免費行動已使用。</p>' : ''}
    <select name="free-action" aria-label="選擇免費行動"><option value="">選擇一項免費行動</option>${actions.map(action =>
      actionOption(action, selectedFreeAction, state.freeUsed)).join('')}</select>
    <div class="basic-action-fields" data-free-action-fields>${state.freeUsed ? '' : actions.find(([id]) => id === selectedFreeAction)?.[2] ?? ''}</div>
    </section>`;
}

function exportFields(offers = state.match?.exports ?? [], times = 1) {
  return offers.filter(offer => offer.available).map(offer => times === 1
    ? checks('offer', [[offer.id, `${resources[offer.resource]} ${offer.quantity} → $${offer.price}`]])
    : numberField(`export-${offer.id}`, `${resources[offer.resource]} ${offer.quantity} → ${offer.price}`,
      Math.min(times, Math.floor(state.economy.inventory[state.role][offer.resource] / offer.quantity)))).join('');
}

const dropAttrs = (type, id = '') => `data-drop="${type}" data-drop-id="${escape(id)}"`;
const pieceAttrs = (type, id, label) => `data-piece="${type}" data-piece-id="${escape(id)}" data-piece-label="${escape(label)}"`;
const tipAttrs = (title, lines, footer = []) => `data-tip-title="${escape(title)}" data-tip-body="${escape(lines.filter(Boolean).join('\n'))}"`
  + (footer.length ? ` data-tip-footer="${escape(footer.filter(Boolean).join('\n'))}"` : '');
const cardTipAttrs = card => `data-tip-card="${escape(JSON.stringify({
  name: card.name,
  nameEn: card.nameEn ?? '',
  effect: card.description ?? '',
  policy: card.policyAnyOf?.length ? card.policyAnyOf.join(' 或 ') : '無政策限制',
  legitimacy: card.legitimacy || '無',
  detail: catalogActionDetail({ role: state.role, name: card.nameEn }) ?? '',
}))}"`;
const mainTurn = () => state.phase === 'action' && state.role === state.currentRole && !state.mainUsed && !state.transaction;
const acting = type => mainTurn() && selectedAction === type;
const canShop = () => acting('buy') && Boolean(state.content) && ['working', 'middle'].includes(state.role);
const canBid = () => state.phase === 'election' && !state.election.nextVoter
  && state.election.sides[state.role] !== 'absent' && !state.election.submitted.includes(state.role);

function well(label, value, resource, owner, kind, capacity, { showPriceLabel = true } = {}) {
  const isMedia = kind === 'media' && acting('campaign') && state.role === 'state' && value > 0;
  const isInfluence = kind === 'influence' && owner === state.role && canBid() && value > 0;
  const isCampaignTarget = kind === 'influence' && owner === 'state' && state.role === 'state' && acting('campaign');
  const isSeller = canShop() && owner && resource && value > 0 && (!kind || kind === 'media');
  const isGoodsTarget = canShop() && owner === state.role && kind === 'goods';
  const isInfluenceTarget = canShop() && owner === state.role && kind === 'influence';
  const pick = isMedia || isInfluence ? pieceAttrs(kind, owner, label) : isSeller ? pieceAttrs('goods', `${owner}:${resource}`, label) : '';
  const drop = isCampaignTarget ? dropAttrs('campaign') : isGoodsTarget || isInfluenceTarget ? dropAttrs('buy', resource) : '';
  const tag = pick || drop ? 'button' : 'div';
  const price = owner && (!kind || kind === 'media') ? marketQuote(owner, resource)?.price : undefined;
  return `<${tag} ${tag === 'button' ? 'type="button"' : ''} class="resource-well" ${resource ? `data-resource="${resource}"` : ''} ${pick} ${drop}>
    <span>${resource ? icon(resource) : ''}${escape(label)}</span><strong>${resource === 'money' ? '$' : ''}${value}${capacity == null ? '' : ` / ${capacity}`}</strong>
    ${price === undefined ? '' : `<small class="well-price">${showPriceLabel ? '單價 ' : ''}$${price}</small>`}
    </${tag}>`;
}

function workerToken(worker, interactive = true, atDestination = false) {
  const label = `${meta.names[worker.role]} · ${workerLabel(worker, state.economy.companies, atDestination ? '待確認' : undefined)}${worker.committed ? '（承諾）' : ''}`;
  const item = interactive && pendingBuild();
  const movable = interactive && (acting('assign') && worker.role === state.role && !worker.committed
    || item && buildSlots(item).some((slot, index) => !draft.staff[index] && canStaffBuild(worker, item, slot, index)));
  const tag = movable ? 'button' : 'span';
  const union = state.economy.unions.includes(worker.id);
  const skill = worker.skill === 'any' ? '非技術' : resources[worker.skill];
  const commitment = worker.committed && (union
    ? '承諾到期 · 工會維持期間一直承諾，直到工會解散。'
    : `承諾到期 · 本輪（第 ${state.match?.round ?? 1} 輪）生產與發薪完成後。`);
  return `<${tag} ${movable ? `type="button" ${pieceAttrs('worker', worker.id, label)}` : 'tabindex="0"'} class="worker-token ${worker.role} skill-${worker.skill}" aria-label="${escape(label)}"
    ${tipAttrs(label, [`技能 · ${skill}`, atDestination ? '待確認指派' : union ? '工會成員' : worker.company ? '已就業' : '待業',
      worker.committed && '已承諾，暫時不能重新指派。', commitment])}>
    ${workerFigure(worker.role, worker.skill)}${worker.committed ? '<small aria-hidden="true">◆</small>' : ''}</${tag}>`;
}

function companyTip(item) {
  const product = resources[item.resource];
  const slotLines = buildSlots(item).map((slot, index) => `工位${index + 1}: ${companySlotDetails(slot, meta.names)}`);
  return tipAttrs(item.name, [
    `${meta.names[item.owner]} · ${industries[item.resource]}${item.cost == null ? '' : ` · 建造成本 $${item.cost}`}`,
    `基本產量: ${product} ${item.output}`,
    item.automated && '自動化企業，無須工人。',
    ...slotLines,
    item.wages && `薪資: ${item.wages.map((amount, index) => `L${index + 1} $${amount}`).join('／')}${item.wage ? `（目前 L${item.wage}）` : ''}`,
    item.machineryBonus && `機械加成: +${item.machineryBonus}${item.machine ? '（已裝設）' : ''}`,
    item.slots && `目前產能: ${product} ${companyProductionTotal(item)}`,
  ], item.slots ? [
    `${item.operational ? '營運中' : '未營運'}${item.strike ? ' · 罷工' : ''}`,
    item.strike && (item.wage === 3
      ? '罷工解除 · 薪資已達 L3，本輪生產時清除標記。若企業營運，照常生產與發薪。'
      : '罷工解除 · 可用免費行動「調整薪資」加薪到 L3，讓企業在本輪生產時照常生產與發薪。若維持 L1 或 L2，先結算罷工影響，標記在本輪生產階段清除。'),
  ] : []);
}

function companyTile(item) {
  const workers = state.economy.workers;
  const moves = assignmentMoves();
  const buildStaff = pendingBuild() ? draft.staff : cardBuildStaff;
  const slots = item.slots.map((slot, index) => {
    const worker = workers.find(candidate => candidate.id === slot.worker);
    const staged = moves.find(move => move.company === item.id && move.slot === index);
    const incoming = staged && workers.find(candidate => candidate.id === staged.worker);
    const vacated = Boolean(worker && (slotVacant(slot, moves) || buildStaff.includes(worker.id)));
    return { slot, worker, incoming, vacated };
  });
  const pendingClosure = item.operational && slots.some(({ slot, incoming, vacated }) => !slot.optional && vacated && !incoming);
  const stopped = pendingClosure || companyStopped(item);
  const hasEmployee = slots.some(({ slot, worker, incoming, vacated }) => slot.optional && (incoming || worker && !vacated));
  const resolvedStrike = item.wage === 3;
  const strike = item.strike ? `<svg class="company-strike${resolvedStrike ? ' is-resolved' : ''}" viewBox="0 0 24 24"
    role="img" aria-label="${resolvedStrike ? '罷工已解除，標記尚未移除' : '罷工中'}">
    <path d="M8 22v-4l-4-4.3a3 3 0 0 1 0-4.2l1.5-1.4V5a1.75 1.75 0 0 1 3.5 0V3.8a1.75 1.75 0 0 1 3.5 0v.7a1.75 1.75 0 0 1 3.5 0v1a1.75 1.75 0 0 1 3.5 0V13a5 5 0 0 1-1.3 3.4L16 19v3H8Z
      M9 5v2m3.5-2.5V7M16 5.5V8M5.5 8.1 10 7.5a2 2 0 0 1 .9 3.9l-2.1.7 2.2 2.4"
      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>` : '';
  return `<article class="company industry-card industry-${item.resource} ${item.owner}${stopped ? ' company-stopped' : ''}" data-company="${escape(item.id)}" tabindex="0" ${companyTip(item)} ${acting('assign') ? `${dropAttrs('company-worker', item.id)} data-drop-quiet` : ''}>
    <strong>${escape(item.name)}${strike}${companyGear(item, !stopped && Boolean(item.machine || item.automated))}</strong>${pendingClosure ? '<span class="pending-piece">待確認停工</span>' : ''}
    <span class="company-output">${icon(item.resource)} ${industries[item.resource]} ${companyOutput(item, hasEmployee, stopped)} <span>${item.wages ? `L${item.wage} · $${item.wages[item.wage - 1]}` : '無薪資'}</span></span>
    <div class="company-slots">${slots.map(({ slot, worker, incoming, vacated }, index) => {
      const occupied = Boolean(incoming || slot.worker && !vacated);
      const label = `${item.name} · ${resources[slot.skill]}工位 ${index + 1} · ${slotRoleLabel(slot.role)}（${slot.optional ? '選用' : '必要'}）${occupied ? '・已佔用' : ''}`;
      const target = `<button type="button" class="slot-drop${slot.optional ? ' slot-optional' : ''}" aria-label="${escape(label)}"
        ${acting('assign') && !occupied ? dropAttrs('slot', `${item.id}:${index}`) : 'disabled'}>${slot.skill === 'any' ? '通' : icon(slot.skill)}${slotRoleIcons(slot.role)}</button>`;
      return `<div class="company-slot ${incoming ? 'staged' : ''}" ${acting('assign') ? dropAttrs('slot', `${item.id}:${index}`) : ''}>
        ${target}${incoming ? workerToken(incoming, true, true) + '<span class="pending-piece">待確認</span>'
          : vacated ? '<span class="pending-piece">待移出</span>'
            : worker ? workerToken(worker) + (pendingClosure ? '<span class="pending-piece pending-unemployment">待確認回到待業區</span>' : '') : ''}</div>`;
    }).join('')}${!item.slots.length ? '<small>自動化</small>' : ''}</div></article>`;
}

function boardHeadingHelp(title, ...details) {
  return `<span class="mat-zone-title">${escape(title)} ${boardHelpButton(title, details.join('\n\n'), escape)}</span>`;
}

function commitmentHelp(owner) {
  const methods = {
    capitalist: '資本家建造企業時若立即雇用，整組新工人會承諾。資本家也可用免費行動提高企業薪資，或對一家有工人的營運企業支付 $5 獎金，讓該企業工人承諾。',
    middle: '中產建造企業時，新派入的必要工人與立即雇用的勞工會承諾。免費調薪加薪時，承諾的是領薪的勞工員工。用「加班」生產時，參與加班的中產工人及勞工員工也會承諾。',
    state: '國家開放公營企業後，若選擇用同一階級的待業工人填滿工位，新雇用的工人會承諾。國家也可用免費行動提高公營企業的薪資，讓該企業的工人承諾。',
  };
  return [
    '如何辨認\n承諾是工人的狀態。遊戲圖板上的已承諾工人旁會有 ◆，工人選項也會標示「已承諾」。待確認的指派要等送出確認後才會正式套用。',
    `如何承諾\n勞工與中產用「指派工人」將自己的工人派進企業，新指派的工人通常會承諾。指定派工或雇用的卡牌效果依牌面及指派規則處理。${methods[owner]}因勞動市場政策提高最低薪資而必須調薪時，工人不因此承諾。`,
    '承諾期間的限制\n已承諾的工人不能改派到其他企業，企業也不能降低這些工人的薪資。有已承諾工人的私營企業不能用一般「出售企業」行動出售。若移走必要工人會使其他已承諾工人因停工而失業，該指派也不能執行。',
    '免費行動「交換工人」\n勞工與中產可以把在通用工位工作的己方技術工，與己方待業工人交換，即使該技術工已承諾也可以。接替者沿用原工位的承諾狀態。原技術工回到待業區並解除承諾，同回合仍可用主要行動指派他。',
    '補人與解除\n資本家企業和公營企業若在補人後同時有已承諾與未承諾的工人，該次補人按交換處理，全員視為未承諾。中產經營者和勞工員工的承諾可分開。一般企業工人的承諾在本輪生產與發薪完成後解除。',
  ];
}

function sector(role, capacity) {
  const firms = state.economy?.companies.filter(item => item.owner === role) ?? [];
  const empty = Math.max(0, capacity - firms.length);
  const interactive = empty > 0 && acting('build') && state.role === role;
  const pending = interactive && pendingBuild();
  return `<section class="board-zone sector sector-${role} ${role}" ${interactive ? dropAttrs('sector', role) : ''}>
    <h3>${boardHeadingHelp(`私營部門 · ${meta.names[role]}`,
      role === 'capitalist'
        ? '開局設置\n放置超市、購物中心、學院與診所，起始薪資皆設為 L2。超市配置勞工的農業工與通用工各 1 名。購物中心配置中產的奢侈品工與通用工各 1 名。學院配置勞工的教育工與通用工各 1 名。診所起始空置。企業市場另從洗好的企業牌庫翻開 4 張。'
        : '開局設置\n放置便利商店與醫師診所，起始薪資皆設為 L2。便利商店配置 1 名中產農業工，醫師診所配置 1 名中產醫療工，兩間的選用勞工工位開局空置。企業市場另從洗好的企業牌庫翻開 3 張。',
      `這裡放置${meta.names[role]}已建造的企業。右側數字是已建造家數／上限（${capacity} 家）。選擇「建造企業」後，可將市場企業拖到空位並確認。`,
      '企業卡顯示產能、薪資與工位。實線工位是營運所需，虛線工位為選用。派工時須符合工位標示的階級與技能。',
      ...commitmentHelp(role),
      role === 'middle'
        ? '企業卡顯示「無薪資」，表示這家企業只有中產經營工位，沒有領薪的勞工員工工位。中產經營者填滿必要工位後可照常生產，產出入庫，經營者不領這家企業的薪資。若卡上有選用的勞工員工工位，薪資只付給參與生產的勞工員工。'
        : '企業卡顯示「無薪資」的自動化企業沒有工位，建成後無須派工即可生產，也不必發薪。普通企業即使裝上機械標記，仍須填滿必要工位並依薪資級距發薪。停工的普通企業本輪沒有薪資支出，但卡上的薪資設定仍然保留。',
      ...(role === 'capitalist' ? [
        '取得方式\n輪到資本家時，可透過「科技進步」等行動卡取得機械標記。「科技進步」花 $20 取得 1 枚，或花 $45 取得 2 枚。線上版在卡牌效果中勾選要裝設的企業，再確認支出。',
        '裝設條件\n取得時立即裝到自己旗下已建成、印有機械加成圖示的企業。每家最多放 1 枚，取得 2 枚時分開裝。未營運的企業也可以裝設。沒有符合條件的企業可放時，該枚標記失去，無法留到以後使用。',
        '生產效果\n企業營運並生產時，依卡上機械圖示旁的數字增加產量，薪資不因此增加。例如基本產量 4、機械加成 2，裝設後生產 6 份。裝設機械後仍須填滿必要工位才能生產。企業的浮動說明會標示「已裝設」。',
      ] : []))} <span>${firms.length} / ${capacity}</span></h3>
    <div class="sector-grid">${firms.map(companyTile).join('')}${Array.from({ length: empty }, (_, index) => {
      const number = String(index + firms.length + 1).padStart(2, '0');
      if (pending && index === 0) return `<div class="company industry-card industry-${pending.resource} pending-company" tabindex="0" ${companyTip(pending)}><strong>${escape(pending.name)}${companyGear(pending)}</strong>
        <span class="company-output">${icon(pending.resource)} ${industries[pending.resource]} ${pending.output} · $${pending.cost}</span>
        <div class="company-slots">${buildSlots(pending).map((slot, index) => {
          const worker = state.economy.workers.find(candidate => candidate.id === draft.staff[index]);
          const label = `新企業工位 ${index + 1} · ${resources[slot.skill]} · ${slotRoleLabel(slot.role)}（${slot.optional ? '選用' : '必要'}）`;
          return `<div class="company-slot ${worker ? 'staged' : ''}"><button type="button" class="slot-drop${slot.optional ? ' slot-optional' : ''}" aria-label="${escape(label)}"
            ${worker ? 'disabled' : dropAttrs('build-slot', index)}>${slot.skill === 'any' ? '通' : icon(slot.skill)}${slotRoleIcons(slot.role)}</button>
            ${worker ? workerToken(worker, false, true) : ''}</div>`;
        }).join('')}</div><span class="pending-piece">待確認建造</span></div>`;
      return interactive ? `<button type="button" class="sector-empty" aria-label="建造工位 ${number}" ${dropAttrs('sector', role)}>${number}</button>`
        : `<div class="sector-empty" aria-hidden="true">${number}</div>`;
    }).join('')}</div></section>`;
}

function publicSector() {
  const opened = state.economy?.companies.filter(item => item.owner === 'state') ?? [];
  const positions = state.economy?.publicSector ?? [
    ...opened.map(item => ({ face: 'open', id: item.id })),
    ...Array.from({ length: Math.max(0, 9 - opened.length) }, () => ({ face: 'closed' })),
  ];
  const companies = new Map(opened.map(item => [item.id, item]));
  return `<section class="board-zone sector sector-state state" aria-label="公營部門">
    <h3>${boardHeadingHelp('公營部門',
      '開局設置\n四人局使用對應人數版本的公營牌。第一列正面放置大學醫院、技術大學與全國公共廣播，起始薪資設為 L2。大學醫院配置 1 名勞工醫療工與 2 名勞工通用工，技術大學配置 1 名中產教育工與 2 名中產通用工。其餘兩列各放醫療、教育、媒體企業各一張，開局朝下。起始財政 1C 開放第一列共 3 家。',
      '國家經營公營企業並由國庫發薪，產出的醫療、教育及媒體影響力放入公共服務區。',
      '財政政策（第 1 項）決定開放規模。正面是已開放企業，仍需填滿必要工位才能營運。背面表示尚未開放。',
      ...commitmentHelp('state'),
      '基本版公營企業卡都有薪資級距。企業營運並在生產階段發薪時，由國庫按卡上目前的級距向工人所屬階級支付一次企業薪資。企業未營運，或因罷工而跳過生產時，本輪不發薪，原本的薪資級距仍然保留。')} <span>已開放 ${opened.length} / ${positions.length}</span></h3>
    <div class="sector-grid">${positions.map((position, index) => {
      if (position.face === 'open') return companyTile(companies.get(position.id));
      if (position.face === 'empty') return `<div class="sector-empty" aria-label="公營牌位 ${index + 1} 空置">空置</div>`;
      return `<div class="public-card-back" role="img" tabindex="0" aria-label="公營牌位 ${index + 1} 未開放"
        ${tipAttrs('未開放的公營企業', [`目前財政政策為 1${state.policies[0]}。企業開放後，正面會顯示企業規格。`])}>
        <svg viewBox="0 0 56 46" aria-hidden="true">
          <path d="M28 6 8 16h40ZM12 20h32M15 22v12m9-12v12m8-12v12m9-12v12M10 36h36M7 40h42"/>
        </svg><span>未開放</span></div>`;
    }).join('')}</div></section>`;
}

function companyMarket(movable, instruction = '') {
  const { role, economy } = state;
  const companies = economy?.markets[role];
  if (!companies) return '';
  return `<section class="market-board ${role}"><h3>企業市場 · ${companies.length} 張</h3>
    ${instruction ? `<p class="muted">${instruction}</p>` : ''}<div class="market-rack">
    ${companies.map(item => {
      const tag = movable ? 'button' : 'div';
      return `<${tag} class="market-card industry-card industry-${item.resource}" ${movable ? `type="button" ${pieceAttrs('company', item.id, item.name)}` : 'tabindex="0"'} ${companyTip(item)}>
        <strong>${escape(item.name)}${companyGear(item)}</strong><span>${icon(item.resource)} ${industries[item.resource]} ${item.output} · $${item.cost}</span>
        <span class="company-slots">${buildSlots(item).map(slot => `<span class="slot-drop${slot.optional ? ' slot-optional' : ''}" title="${slotRoleLabel(slot.role)}（${slot.optional ? '選用' : '必要'}）">
          ${slot.skill === 'any' ? '通' : icon(slot.skill)}${slotRoleIcons(slot.role)}</span>`).join('')}</span></${tag}>`;
    }).join('') || '<p class="muted">市場已空</p>'}</div></section>`;
}

function boardEvents(events = []) {
  return `<section class="board-events"><h3>${boardHeadingHelp('國家事件',
    '開局設置\n洗勻事件牌庫，翻開 2 張放到圖板的事件格。若翻到限第 2～5 輪使用的牌，將它洗回牌庫並補翻，直到兩格都是第一輪可用的事件。',
    '後續每輪準備階段公開兩張事件牌。將滑鼠移到卡牌上，可查看處理條件、各選項的獎勵與未處理懲罰。',
    '輪到國家時，可用「事件行動」選一張事件，依牌面選擇對象並完成任務。任務可能要求支出金錢或資源、提供福利，或執行指定行動。完成後取得該選項的獎勵，例如提升合法性、取得永久標記或獲得 VP，再棄掉事件牌。',
    '若事件要求提供福利，資源或金錢會放到指定階級的國家福利區，由該階級用免費行動「領取福利」領走。每次領取讓國家得 1 VP。',
    '輪末計分時，先對每張留在場上的事件結算未處理懲罰，再計算合法性分數。')}</h3><div class="board-event-slots">${Array.from({ length: 2 }, (_, index) => {
    const event = events[index];
    return event ? `<div class="board-event-card" tabindex="0" ${tipAttrs(event.nameZh,
      [`處理方式 · ${event.taskZh}`, `獎勵 · ${event.rewardZh}`, `未處理懲罰 · ${event.unresolvedPenaltyZh}`])}>${escape(event.nameZh)}</div>`
      : '<div class="board-event-card empty">空置</div>';
  }).join('')}</div></section>`;
}

function tradeTips(deals, offers) {
  const section = state.policies[5];
  const tariffs = meta.policyRules.foreign_trade[section];
  return {
    deals: tipAttrs(deals.length ? `商務合約(${deals.map(deal => Number(deal.id.slice(5))).join('、')})` : '商務合約', [`對外貿易 6${section} · 準備階段公開 ${tariffs.deals_on_preparation} 張。資本家可向外國市場批量採購。`,
      ...deals.map(deal => `${Object.entries(deal.goods).map(([resource, count]) => `${resources[resource]} ${count} 份`).join('、')} · 基價 $${deal.cost} ＋ 關稅 $${deal.tariffByForeignTrade[section]}`),
      '貨物全部存入自由貿易區時可免關稅，該庫存只供出口。']),
    exports: tipAttrs(state.content?.export ? `出口(${Number(state.content.export.id.slice(7))})` : '出口', ['以公開的出口條件向外國市場出售貨物。',
      ...offers.map(offer => `${resources[offer.resource]} ${offer.quantity} 份 → $${offer.money ?? offer.price}`),
      '中產每筆出口另得 1 VP。國家可出口食物與奢侈品。']),
    imports: tipAttrs('進口', [`對外貿易 6${section} · 進口基價付給供應區，關稅付給國庫。`,
      ...['food', 'luxury'].map(resource => {
        const quote = marketQuote('foreign', resource);
        return quote && `${resources[resource]}每份 $${quote.price}（基價 $${quote.base} ＋ 關稅 $${quote.tariff}）`;
      })]),
  };
}

function tableBoard() {
  const { economy, content, publicServices, match } = state;
  const plannedStaff = pendingBuild() ? draft.staff : cardBuildStaff;
  const moves = assignmentMoves();
  const idle = economy?.workers.filter(worker => !worker.company && !economy.unions.includes(worker.id)
    && !plannedStaff.includes(worker.id) && !moves.some(move => move.worker === worker.id)) ?? [];
  const farms = economy?.companies.filter(item => item.owner === 'working') ?? [];
  const emptyFarms = Math.max(0, 2 - farms.length);
  const range = length => Array.from({ length }, (_, index) => index + 1);
  const rounds = track('輪次', range(5), (match?.round ?? 1) - 1);
  const multipliers = [1, 2, 3, 4, 5, 6, 7, 9, 11];
  const tax = track('稅倍率', multipliers, multipliers.indexOf(state.taxMultiplier));
  const deals = content?.deals ?? [];
  const offers = content?.export?.offers ?? match?.exports ?? [];
  const trade = tradeTips(deals, offers);
  const scoreHelp = [
    '開局設置\n四個階級各將自己的勝利分數標記放在第 0 格，所有玩家都從 0 VP 開始。線上圖板的第 0 格會同時顯示四個階級的顏色。',
    '勝利分數軌用各階級的顏色標記目前累積的 VP。順著圖板外圈從 0 讀到 99，同一格可以有多個階級的標記。',
    '每滿 100 VP 繞回 0，軌道只顯示最後兩位數。例如 103 VP 的標記會在第 3 格。完整總分可在「四席摘要」查看。',
    '共同得分\n法案通過時，提案者得 3 VP。其他贊成者若有抽出至少 1 枚己方方塊，或投入至少 1 影響力，也各得 1 VP。卡牌與事件另依牌面給分。',
    '勞工\n使用醫療、教育或奢侈品時，繁榮前進一格並取得新格的 VP。使用醫療另得 2 VP。例如從繁榮 3 升到 4，使用醫療共得 4＋2＝6 VP。輪末每個成立的產業工會得 2 VP。\n終局計算政策 1～5 中落在 A 區的數量。符合 0～5 項依序得 0、1、4、8、12、18 VP。剩餘現金每滿 $10 得 1 VP，最多 15 VP。',
    '中產\n繁榮前進時按新格得分，使用醫療另得 2 VP。每完成一筆出口交易得 1 VP。輪末若繁榮值低於滿編企業數，再前進一格並得分。例如繁榮 3、有 4 家滿編企業，就前進到 4 並得 4 VP。\n終局計算政策 1～5 中落在 B 區的數量。符合 0～5 項依序得 0、1、3、6、10、15 VP。剩餘現金每滿 $15 得 1 VP，另加商業倉庫的庫存分。',
    '資本家\n輪末把剩餘營收轉入資本，按資本總額對照財富軌得分。每超過歷史最高紀錄一格，額外得 3 VP。例如紀錄在 $50，這輪資本到 $100，基本得 5 VP，跨兩格再得 6 VP，共 11 VP。\n終局計算政策 1～5 中落在 C 區的數量。符合 0～5 項依序得 0、1、4、8、12、18 VP。商業倉庫與自由貿易區的同類資源合併計算庫存分。',
    '國家\n以 B 區優惠價售出醫療或教育時，每筆得 1 VP。每當其他階級領取國家福利，也得 1 VP。輪末把三條合法性軌中最低兩項相加，再加本輪政治綱領每符合一項的 1 VP。例如合法性為 7、5、4，另符合 2 項綱領，共得 5＋4＋2＝11 VP。\n終局每滿 $30 國庫金錢得 1 VP，另加貨物倉庫和公共服務的庫存分。每滿 3 份公共媒體影響力也得 1 VP。',
    '終局庫存與貸款\n庫存按種類分開算。食物每滿 2 份得 1 VP，奢侈品、醫療、教育各自每滿 3 份得 1 VP。例如 5 食物、4 醫療和 2 教育，共得 2＋1＋0＝3 VP。\n資本家每筆未還貸款扣 5 VP。其餘階級每筆先以 $55 償還，現金不足時以 $5 為單位盡量償還，每欠 $5 扣 1 VP。現金加分以還款後的餘額計算。',
  ].join('\n\n');
  return `<section class="main-board" aria-labelledby="main-board-title">
    <h1 id="main-board-title">遊戲圖板</h1>
    ${boardSurface('central')}${['top', 'right', 'bottom', 'left'].map(edge => scoreEdge(state.players, edge)).join('')}
    <div class="score-help">${boardHelpButton('勝利分數軌 (VP)', scoreHelp, escape)}</div>
    <div class="board-interior">
      <section class="board-zone board-politics"><h3>${boardHeadingHelp('政治議題',
        '開局設置\n將七項政策的標記分別放在財政 1C、勞動市場 2B、稅制 3A、醫療福利 4B、教育福利 5C、對外貿易 6B、移民 7B。開局時沒有待決法案，提案標記由各階級保管。',
        '每項政策有 A、B、C 三個區段。金色圓點表示目前採用的政策。虛線框和菱形標出還沒表決的提案。前五項從 A 到 C 代表從社會主義走向新自由主義，後兩項則代表從民族主義走向全球主義。',
        '提案與表決\n通常只能提案移到相鄰區段，例如 7B 可提案改成 7A 或 7C。同一項已有待決法案時，須先等它結案。提案時可花 1 影響力即時表決，或等輪末選舉。一般表決先表態、再抽 5 枚方塊，最後加上玩家投入的影響力。贊成票至少與反對票一樣多就通過。線上版等四席確認結果後套用新政策。',
        '財政\n1A 開放 9 家公營企業，IMF 貸款門檻為 2 筆。\n1B 開放 6 家公營企業，IMF 貸款門檻為 2 筆。\n1C 開放 3 家公營企業，IMF 貸款門檻為 1 筆。',
        '勞動市場\n2A 最低薪資為 L3。\n2B 最低薪資為 L2。\n2C 最低薪資為 L1。\n門檻提高時，低於門檻的薪資須調高。',
        '稅制\n3A 稅倍率＝3＋2 × 福利修正值總和。\n3B 稅倍率＝2＋福利修正值總和。\n3C 稅倍率固定為 1。\n福利修正值取醫療與教育兩項相加，各自的 A、B、C 區為 2、1、0。例如稅制 3B、醫療 4A、教育 5B，倍率就是 2＋2＋1＝5。',
        '醫療福利\n4A 每份 $0，每免費提供 3 份，購買階級的合法性加 1。\n4B 每份 $5，每筆交易讓國家得 1 VP。\n4C 每份 $10，按原價收費。',
        '教育福利\n5A 每份 $0，每免費提供 3 份，購買階級的合法性加 1。\n5B 每份 $5，每筆交易讓國家得 1 VP。\n5C 每份 $10，按原價收費。',
        '對外貿易\n6A 食物關稅 $10、奢侈品關稅 $6，下輪準備時公開 0 張商務合約。\n6B 食物關稅 $5、奢侈品關稅 $3，下輪準備時公開 1 張商務合約。\n6C 食物與奢侈品關稅皆為 $0，下輪準備時公開 2 張商務合約。',
        '移民\n7A 下輪準備時，勞工與中產各額外抽 0 張移民牌。\n7B 下輪準備時，勞工與中產各額外抽 1 張移民牌。\n7C 下輪準備時，勞工與中產各額外抽 2 張移民牌。',
        '計分\n第 1～5 項也影響計分。國家在每輪計分時，現行政策每符合政治綱領一項得 1 VP。終局時，勞工、中產、資本家分別按這五項中落在 A、B、C 區的數量查表得分。')}</h3>${policyDiagram(state, meta, escape, tipAttrs)}</section>
      <div class="board-civic-stack"><section class="board-zone board-civic"><div class="board-metrics"><div><h3>${boardHeadingHelp('輪次',
        '一局共五輪。每輪依序進行準備、行動、生產、選舉、計分。第一輪跳過準備階段，沒有待決法案時跳過輪末選舉。',
        '行動階段四席各有五個回合。第五輪計分後，結算貸款和各階級的終局分數。')}</h3>${rounds}</div><div><h3>${boardHeadingHelp('稅倍率',
        '開局設置\n稅倍率標記放在 5。起始稅制是 3A，醫療福利 4B 的修正值是 1，教育福利 5C 的修正值是 0，所以倍率為 3＋2 ×（1＋0）＝5。',
        '先看醫療福利和教育福利目前各在哪個區段。A 算 2、B 算 1、C 算 0，再把兩項數字加起來。',
        '再套用稅制。\n3A 稅倍率＝3＋2 × 福利修正值總和。\n3B 稅倍率＝2＋福利修正值總和。\n3C 稅倍率固定為 1。',
        '例如稅制為 3B、醫療福利為 4A、教育福利為 5B。福利修正值總和是 2＋1＝3，稅倍率是 2＋3＝5。中產與資本家的僱用稅＝各自的營運企業數 × 稅倍率，因此有 3 家營運企業就繳 3 × 5＝$15。')}</h3>${tax}</div></div>
        <h3>${boardHeadingHelp('投票袋',
          '開局設置\n把勞工、中產、資本家的方塊各取 8 枚放入袋中，共 24 枚。其餘方塊留在供應區。國家用個人影響力參與表決。',
          '補充方塊\n輪末有法案要表決時，先補充一次。\n勞工補人口的一半，向上取整。\n中產取人口與營運企業數中較大者，再除以 2 並向上取整。\n資本家補營運企業數的一半，向上取整。\n例如勞工人口 5、中產人口 4 且有 5 家營運企業、資本家有 4 家營運企業，分別補 3、3、2 枚。',
          '抽票與回收\n一般表決先表態，再抽 5 枚方塊。每枚按所屬階級的立場算 1 票，投入的影響力也每份算 1 票。抽票途中袋子空了，就按上述方塊公式補兩次再繼續抽。',
          '結果確定後，抽出的方塊只有落敗方放回投票袋。勝方方塊回到供應區，雙方投入的影響力都會消耗。平票視為贊成方勝出，因此反對方抽出的方塊放回袋中。')}</h3><div class="bag-row">${Object.entries(state.bag).map(([role, count]) => `<span class="${role}">${meta.names[role]} <b>${count}</b></span>`).join('')}</div>
        ${boardEvents(content?.events)}
        <h3>${boardHeadingHelp('國家福利',
          '開局設置\n勞工、中產、資本家的福利區都從空白開始，畫面顯示 0。國家第一次提供福利時，才把指定的金錢、資源或方塊放入對應階級的區域。',
          '國家可透過事件或卡牌，將金錢、資源或投票方塊放到勞工、中產或資本家的福利區。主圖板顯示各階級待領福利的合計，實際品項可在自己的「領取福利」行動中查看。',
          '同一階級已有待領福利時，下一次提供通常會用新的福利替換原有內容。部分卡牌效果允許保留並合併。',
          '輪到自己時，選擇免費行動「領取福利」即可一次領完。金錢與資源交給該階級，投票方塊立即放進投票袋，福利區隨即清空。',
          '國家每次有人領取福利得 1 VP。例如中產一次領走 $10 和 2 枚投票方塊，國家共得 1 VP。')}</h3><div class="benefit-row">${classes.map(role => `<span class="${role}">${meta.names[role]} <b>${Object.values(content?.benefits[role] ?? {}).reduce((sum, count) => sum + count, 0)}</b></span>`).join('')}</div></section>
        <section class="board-zone board-treasury"><h3>${boardHeadingHelp('國庫',
          '開局設置\n從供應區取 $120 放入主圖板的國庫，作為國家的起始資金。國家開局有 0 筆貸款。',
          '國庫顯示國家目前可支用的金錢。其他階級繳的稅、進口關稅、公共服務銷售收入，以及部分卡牌給的金錢都會存入國庫。',
          '公營企業薪資、事件支出與借款利息由國庫支付。輪末生產階段先發薪，接著檢查 IMF，最後收稅。規劃支出時，可在「結算試算」查看預計收入及支出。',
          '國庫付不起強制支出時，每筆貸款提供 $50。後續準備階段每筆支付 $5 利息。貸款筆數達到財政政策的門檻時，可能觸發 IMF 介入。',
          '終局結算貸款後，國庫每滿 $30 得 1 VP。例如剩 $95，可得 3 VP。')}</h3><p class="treasury-amount"><strong>$${state.treasury}</strong></p></section></div>
      <section class="board-zone board-trade"><h3>${boardHeadingHelp('對外貿易',
        '開局設置\n商務合約牌庫和出口牌庫分開洗勻，各從牌庫頂翻開 1 張。進口從政策 6B 開始，食物每份 $15（基價 $10、關稅 $5），奢侈品每份 $9（基價 $6、關稅 $3）。',
        '商務合約\n開局將合約牌洗好，翻開 1 張。從第二輪起，每輪準備階段先棄掉場上未使用的合約，再按當時生效的對外貿易政策從牌庫頂翻新牌。6A 不翻、6B 翻 1 張、6C 翻 2 張。政策在輪中改變時，場上的合約繼續保留，但關稅立即按新政策計算。\n資本家選擇「商業交易」，挑一張場上的合約並指定到貨位置。合約的貨物種類、數量和基價固定，完成後該牌棄置，當輪不補牌。\n整批放進自由貿易區可免關稅，區內貨物只供出口。只要有貨進國內倉庫，就要付整張合約在目前政策下的關稅。兩處各有容量，超出的貨物會丟棄。\n例如一張合約基價 $30，對外貿易政策 6B 欄標示關稅 $8。有貨進國內倉庫就付 $38，全部進自由貿易區則付 $30。',
        '出口\n開局將出口牌洗好，從牌庫頂翻開 1 張。從第二輪起，每輪準備階段棄掉舊出口牌，再從牌庫頂翻開 1 張。完成交易後，出口牌仍留在場上，下一次出口行動可以再按同一張牌選交易。部分卡牌效果可提前更換出口牌。\n中產、資本家或國家選擇「對外出口」，勾選現行出口牌上的交易再確認。每筆必須備足牌上指定數量，確認後交出資源並取得列出的金錢。同一次行動可做多筆不同交易，每筆通常只能做一次。\n中產從商業倉庫出貨，每完成一筆另得 1 VP。資本家可用商業倉庫及自由貿易區的庫存。國家只出口食物與奢侈品。',
        '進口\n進口區常駐在主圖板。食物基價每份 $10，奢侈品基價每份 $6。畫面的大數字是每份基價加上當前政策的關稅，下面會分別列出基價與關稅。政策變更生效時，進口價會同步更新。\n6A 食物 $10＋$10＝$20，奢侈品 $6＋$6＝$12。\n6B 食物 $10＋$5＝$15，奢侈品 $6＋$3＝$9。\n6C 食物 $10＋$0＝$10，奢侈品 $6＋$0＝$6。\n勞工或中產在「購買商品與服務」選食物或奢侈品，再選「外國市場」、填數量並確認。一般購買一次選一種資源，最多選兩個來源，向每個來源購買的數量不得超過目前人口。\n每份總價＝基價＋對外貿易政策規定的關稅。基價付給供應區，關稅付給國庫。例如 6B 時進口 3 份奢侈品，每份基價 $6、關稅 $3，總共付 3 ×（$6＋$3）＝$27，其中 $9 進國庫。')}</h3><div class="trade-grid">
        <div tabindex="0" ${trade.deals}><h4>商務合約${deals.length ? ` (${deals.map(deal => Number(deal.id.slice(5))).join('、')})` : ''}</h4>${deals.map(deal => {
          const details = dealCardInfo(deal);
          return state.role === 'capitalist' && acting('deal')
            ? `<button type="button" class="trade-piece" ${pieceAttrs('deal', deal.id, deal.nameZh)}>${details}</button>`
            : `<p>${details}</p>`;
        }).join('') || '<p>無</p>'}</div>
        <div tabindex="0" ${trade.exports}><h4>出口${content?.export ? `(${Number(content.export.id.slice(7))})` : ''}</h4><div class="export-list">${offers.map((offer, id) => {
          const label = exportOfferLabel(offer, icon);
          const available = match?.exports.some(choice => choice.id === id && choice.available);
          return acting('export') && available ? `<button type="button" class="trade-piece" ${pieceAttrs('export', id, `${resources[offer.resource]} ${offer.quantity}`)}>${label}</button>`
            : `<span>${label}</span>`;
        }).join('') || '<span>無出口牌</span>'}</div></div>
        <div tabindex="0" ${trade.imports}><h4>進口</h4>${['food', 'luxury'].map(resource => {
          const quote = marketQuote('foreign', resource);
          const importPrice = quote?.price ?? match?.importPrices?.[resource];
          const label = `${icon(resource)} ${resources[resource]} ${importPrice == null ? '—' : `$${importPrice}`}`;
          const breakdown = quote ? `<small>基價 $${quote.base} ＋ 關稅 $${quote.tariff}</small>` : '';
          return canShop()
            ? `<button type="button" class="trade-piece" ${pieceAttrs('goods', `foreign:${resource}`, resources[resource])}>${label}${breakdown}</button>`
            : `<p>${label}${breakdown}</p>`;
        }).join('')}</div>
      </div></section>
      <section class="board-zone board-services"><h3>${boardHeadingHelp('公共服務',
        '開局設置\n從供應區放入 6 份醫療、6 份教育與 4 份媒體影響力。醫療福利從 4B 開始，每份 $5。教育福利從 5C 開始，每份 $10。媒體影響力每份 $10。',
        '庫存與容量\n每格左邊是目前庫存，右邊是容量，金額是每份售價。容量按資源各自計算，等於 6 加上所有已開放且生產該資源的公營企業標示產能。已開放但停工的企業仍計入容量。例如一間已開放的公營醫院標示產能為 4，且沒有其他已開放的公營醫療企業，醫療容量就是 6＋4＝10。畫面顯示 6／10 時，表示現有 6 份，還能存 4 份。超出容量的資源會丟棄。',
        '醫療\n由營運中的公營醫院等醫療企業在生產階段產出。勞工或中產可用「購買商品與服務」向國家購買，買到後放入生活資源區。輪到自己時，可用免費行動「使用醫療」，消耗等同人口的份數，提升繁榮一格、按新格得分、另得 2 VP，並新增一名通用工人。',
        '教育\n由營運中的公營大學等教育企業在生產階段產出。勞工或中產可向國家購買並放入生活資源區。輪到自己時，可用免費行動「使用教育」，消耗等同人口的份數，訓練一名符合條件的己方工人，並提升繁榮一格、按新格得分。',
        '醫療與教育的價格\n兩者各依對應的福利政策定價。A 區每份 $0，每提供 3 份，國家對購買階級的合法性加 1。B 區每份 $5，每筆優惠交易讓國家得 1 VP。C 區每份 $10。貨款存入國庫。',
        '媒體影響力\n由營運中的公營媒體企業在生產階段產出。勞工或中產可向國家以每份 $10 購買，轉為自己的個人影響力。國家可在自己的回合選「競選」，將最多 3 份公共媒體影響力轉為自己的個人影響力。個人影響力可用於發起即時表決，或在表決時投入以增加票數。')}</h3><div class="well-row">
        ${['health', 'education', 'influence'].map(resource => {
          const media = resource === 'influence';
          return well(media ? '媒體影響力' : resources[resource], publicServices[resource], resource, 'state',
            media ? 'media' : undefined, economy?.publicStorageCapacity?.[resource], { showPriceLabel: false });
        }).join('')}</div></section>
      ${sector('capitalist', 12)}${publicSector()}${sector('middle', 8)}
      <section class="board-zone board-workers"><h3 tabindex="0" ${tipAttrs('待業工人', ['新增或失業的工人會放在這裡。選擇「指派工人」後，可把符合技能的工人移入企業。',
        ...['working', 'middle'].map(role => `${meta.names[role]}待業 ${idle.filter(worker => worker.role === role).length} 人`)])}>${boardHeadingHelp('待業工人',
        '開局設置\n洗好移民牌庫。勞工先在待業區放 1 名通用工人，中產先放 1 名自選技能工人。兩個階級再各自抽 2 張移民牌，只看自己階級那一側，各放入 2 名對應工人，再把抽過的牌放回牌庫底。開局兩個階級各有 3 名待業工人。',
        '後續準備階段\n第 2～5 輪，勞工先加入 2 名通用工人，中產先加入 1 名通用工人及 1 名自選技能工人，再依移民政策補人。',
        '兩個階級使用醫療也可新增通用工人，部分卡牌可增加特定工人。失去工作的工人會回到待業區。待業工人仍計入所屬階級的人口軌。',
        '移民\n底部顯示生效中的移民政策。準備階段，7A、7B、7C 分別讓勞工與中產各額外抽 0、1、2 張移民牌。兩個階級分開抽牌，只看自己那一側，拿對應工人放入待業區，再把牌放回牌庫底。',
        '指派工人\n準備階段新增的工人先進待業區。同輪進入行動階段後，輪到自己時可選主要行動「指派工人」，一般一次最多指派 3 名尚未承諾的己方工人。將工人拖到相符工位，再確認行動。技能工位須符合指定技能，通用工位可容納符合階級條件的工人。要啟動停工企業，須在同一次行動補齊必要工位。',
        '建造與雇用\n資本家和國家可依建造或卡牌效果雇用待業工人，工人仍屬勞工或中產。中產建造企業時，必須補齊自己的必要工位，有選用勞工工位時也可按條件雇用勞工。新派到企業的工人會進入承諾狀態，通常要等本輪生產結算後才可再調動。')} <span>${idle.length}</span>${state.demonstration?.active ? ' · 示威中' : ''}</h3>
        ${['working', 'middle'].map(role => {
          const target = acting('assign') && state.role === role && moves.length > 0;
          return `<div class="worker-pool-row ${role}"><strong>${meta.names[role]}</strong>
            <div class="worker-pool" ${target ? dropAttrs('unemployed', role) : ''}>
              ${idle.filter(worker => worker.role === role).map(worker => workerToken(worker)).join('')}
              ${target ? `<button type="button" class="idle-drop" ${dropAttrs('unemployed', role)}>撤回待確認指派</button>` : ''}</div></div>`;
        }).join('')}
        <div class="worker-pool-row"><strong id="immigration-label">移民</strong>
          <div class="immigration-well" tabindex="0" aria-labelledby="immigration-label immigration-policy"
            ${tipAttrs('移民', [`目前政策 7${state.policies[6]}。準備階段，勞工與中產各自新增 ${meta.policyRules.immigration_extra_each_class[state.policies[6]]} 名移民工人。`])}>
            <span id="immigration-policy">政策 7${state.policies[6]}</span></div></div></section>
      <section class="board-zone cooperative-zone"><h3>${boardHeadingHelp('合作農場', '這裡放置勞工透過行動卡建立的合作農場。填滿必要工位後可在生產階段產出食物，供勞工滿足輪末需求。')} <span>${farms.length} / 2</span></h3><div class="sector-grid">${farms.map(companyTile).join('')}${Array.from({ length: emptyFarms }, (_, index) =>
        `<div class="sector-empty" aria-hidden="true">${String(farms.length + index + 1).padStart(2, '0')}</div>`).join('')}</div></section>
    </div></section>`;
}

const productionOrder = ['state', 'capitalist', 'middle', 'working'];
const productionStageNames = { wages: '發薪', goods: '生產與入庫', imf: '檢查 IMF', taxes: '繳稅' };

const productionStageLabel = ({ stage, role }) => {
  if (stage === 'wages' && role === 'working') return '薪資收入';
  if (stage === 'taxes' && role === 'state') return '收稅';
  return productionStageNames[stage];
};

const newLoanSummary = loans => `本次新增貸款 ${loans} 筆，共 $${loans * meta.loanPrincipal}`;

function taxConfirmationDetails({ role, due, loans, taxDetails: tax }) {
  const rows = [];
  if (role === 'capitalist' || role === 'middle') {
    rows.push(['就業稅', `營運企業 ${tax.companies} 家 × 稅倍率 ${tax.multiplier}`,
      `$${role === 'capitalist' ? tax.employment : tax.middleEmployment}`]);
  }
  if (role === 'capitalist') {
    const { min, max } = tax.bracket;
    const bracket = max === null ? `$${min} 以上` : `$${min}～$${max}`;
    rows.push(['公司稅', `扣除就業稅後的營收 $${tax.revenue} → 查稅制 3${tax.taxation} 的 ${bracket} 級距`, `$${tax.corporate}`]);
  } else {
    const count = role === 'middle' ? `外部雇主 ${tax.employers} 家` : `人口 ${tax.people}`;
    rows.push(['所得稅', `${count} × $${tax.unit}（勞動市場 2${tax.labor}、稅制 3${tax.taxation}）`,
      `$${role === 'middle' ? tax.middleIncome : tax.workingIncome}`]);
  }
  return settlementTable('', ['稅目', '計算公式', '應繳'], rows, ['合計', '', `$${due}`])
    + (loans ? `<p>${newLoanSummary(loans)}。</p>` : '');
}

function productionConfirmationPanel() {
  const step = state.match.productionStep;
  const { stage, role, companies, due, loans, income, pendingIncome } = step;
  const label = productionStageLabel(step);
  const heading = `<h2>${coloredGameLabel(meta.names[role], `var(--${role})`)} · ${label}</h2>`;
  if (role !== state.role) return `<section class="panel">${heading}<p role="status">等待${meta.names[role]}確認。</p></section>`;
  let details;
  if (stage === 'wages' && role === 'working') {
    details = companies.length ? settlementTable('', ['企業', '付款階級', '薪資收入'], companies.map(item => [
      coloredGameLabel(item.company, `var(--industry-${item.resource})`),
      coloredGameLabel(meta.names[item.owner], `var(--${item.owner})`), `$${item.wage}`,
    ]), ['合計', '', `$${income}`]) : '<p>本輪薪資收入 $0。</p>';
  } else if (stage === 'wages') {
    const paid = companies.filter(item => item.wage);
    details = paid.length ? settlementTable('', ['企業', '收款階級', '薪資'], paid.map(item => [
      coloredGameLabel(item.company, `var(--industry-${item.resource})`),
      coloredGameLabel(meta.names[item.recipient], `var(--${item.recipient})`), `$${item.wage}`,
    ]), ['合計', '', `$${due}`]) : '<p>本席沒有應付薪資。</p>';
    if (loans) details += `<p>${newLoanSummary(loans)}。</p>`;
  } else if (stage === 'goods') {
    details = companies.length ? settlementTable('', ['企業', '資源', '產量'], companies.map(item => [
      coloredGameLabel(item.company, `var(--industry-${item.resource})`),
      coloredGameLabel(resources[item.resource], `var(--industry-${item.resource})`), item.produced,
    ])) : '<p>本席沒有企業產出。</p>';
  } else if (stage === 'imf') {
    details = `<p>國家目前有 ${state.economy.loans.state} 筆貸款。確認後檢查是否需調整政策或清償貸款。</p>`;
  } else {
    details = role === 'state' ? '<p>確認開始收稅。各階級依序確認後，稅款會轉入國庫。</p>'
      : taxConfirmationDetails(step);
  }
  let balance = '';
  let projectedBalance = '';
  if (stage === 'wages') {
    const player = state.players[role];
    const borrowed = (loans ?? 0) * meta.loanPrincipal;
    let balances;
    if (role === 'capitalist') {
      const revenuePayment = Math.min(player.revenue, due);
      balances = [
        ['營收', player.revenue, player.revenue - revenuePayment],
        ['資本', player.capital, player.capital + borrowed - (due - revenuePayment)],
      ];
    } else if (role === 'working') {
      balances = [['現金餘額', player.cash, player.cash + pendingIncome]];
    } else {
      const cash = role === 'state' ? state.treasury : player.cash;
      balances = [[role === 'state' ? '國庫餘額' : '現金餘額', cash, cash + borrowed - (due ?? 0)]];
    }
    balance = `<p>${balances.map(([name, current]) => `目前${name} <strong>$${current}</strong>`).join('<br>')}</p>`;
    projectedBalance = `<p>${balances.map(([name, , projected]) => `結算後預計${name} <strong>$${projected}</strong>`).join('<br>')}</p>`;
  }
  return `<section class="panel">${heading}${balance}${details}${projectedBalance}${form('production-confirm', `確認${label}`,
    `<input type="hidden" name="option" value="${stage}">`)}</section>`;
}

function productionPanel() {
  const production = state.economy?.production;
  if (!production) return '';
  if (!state.match) return `<section class="panel"><h2>生產與發薪結果</h2>${productionDetails(production)}</section>`;
  const { roundPhase, needsRole, productionStep } = state.match;
  const current = roundPhase !== 'production' ? null : state.phase === 'needs' ? 'needs'
    : state.phase === 'demonstration' ? 'demonstration'
      : ['wages', 'goods'].includes(productionStep?.stage) ? 'production' : productionStep?.stage ?? 'imf';
  const steps = [
    ['production', '發薪與生產'],
    ...(current === 'demonstration' ? [['demonstration', '處理示威']] : []),
    ['needs', '滿足食物需求'], ['imf', '檢查 IMF'], ['taxes', '繳稅'],
  ];
  const activeIndex = current ? steps.findIndex(([id]) => id === current) : steps.length;
  return `<section class="panel"><h2>生產階段結算</h2>
    <p>結算順序 · ${productionOrder.map(role => coloredGameLabel(meta.names[role], `var(--${role})`)).join(' → ')}</p>
    <ol class="round-phases" aria-label="生產階段步驟">${steps.map(([id, label], index) => {
      const active = index === activeIndex;
      const status = active ? (id === 'needs' && needsRole ? `等待${meta.names[needsRole]}確認`
        : productionStep ? `等待${meta.names[productionStep.role]}確認${productionStageLabel(productionStep)}` : '進行中')
        : index < activeIndex ? '已完成' : '待進行';
      return `<li${active ? ' aria-current="step"' : ''}><strong>${label}</strong><small>${status}</small></li>`;
    }).join('')}</ol>
    ${production.length ? productionTotals(production) + companyProductionDetails(production, false, productionOrder) : ''}</section>`;
}

function productionDetails(production, forecast = false) {
  return productionTotals(production, forecast) + companyProductionDetails(production, forecast);
}

function productionTotals(production, forecast = false) {
  const received = forecast ? '預計取得' : '實際取得';
  const totals = products.map(resource => {
    const rows = production.filter(row => row.resource === resource);
    const produced = rows.reduce((sum, row) => sum + row.produced, 0);
    const stored = rows.reduce((sum, row) => sum + row.stored, 0);
    return [coloredGameLabel(resources[resource], `var(--industry-${resource})`), produced, stored, produced - stored];
  });
  const columns = ['資源', '產量', received, '未取得'];
  return settlementTable(forecast ? '各資源預計產量（份）' : '各資源生產結算（份）', columns, totals);
}

function companyProductionDetails(production, forecast = false, ownerOrder = ['capitalist', 'middle', 'state']) {
  if (!production?.length) return '';
  const columns = ['資源', '企業', '產量', forecast ? '預計取得' : '實際取得', '未取得', '薪資'];
  return ownerOrder.map(owner => {
    const companies = production.filter(row => row.owner === owner)
      .sort((a, b) => products.indexOf(a.resource) - products.indexOf(b.resource));
    if (!companies.length) return '';
    const rows = companies.map(row => [
        coloredGameLabel(resources[row.resource], `var(--industry-${row.resource})`),
        coloredGameLabel(row.company, `var(--industry-${row.resource})`), row.produced, row.stored,
        row.produced - row.stored, row.wage
          ? `${coloredGameLabel(meta.names[row.recipient], `var(--${row.recipient})`)} ${coloredGameLabel(`$${row.wage}`, 'var(--gold)')}`
          : '-',
    ]);
    const wages = companies.reduce((sum, row) => sum + (row.wage ?? 0), 0);
    return `<details><summary>${coloredGameLabel(meta.names[owner], `var(--${owner})`)}生產薪資明細</summary>
      ${settlementTable(null, columns, rows, ['薪資合計', '', '', '', '', `$${wages}`])}
    </details>`;
  }).join('');
}

function phaseProgress() {
  if (!state.match) return '';
  const { round, roundPhase, electionsHeld } = state.match;
  const current = roundPhase === 'endgame' ? roundPhases.length : roundPhases.findIndex(([id]) => id === roundPhase);
  return `<ol class="round-phases" aria-label="本輪五個階段">${roundPhases.map(([id, label], index) => {
    const skipped = (id === 'preparation' && round === 1) || (id === 'elections' && electionsHeld === false);
    const status = skipped ? '略過' : index === current ? '進行中' : index < current ? '已完成' : '待進行';
    return `<li data-round-phase="${id}" ${index === current ? 'aria-current="step"' : ''}>
      <strong class="mat-zone-title">${index + 1}. ${label} ${boardHelpButton(label + '階段', roundPhaseHelp[id].join('\n\n'), escape)}</strong><small>${status}</small></li>`;
  }).join('')}</ol>`;
}

function resourcePricePanel() {
  if (!state.match?.prices) return '';
  const roles = ['working', 'middle', 'capitalist', 'state', 'foreign'];
  return `<section class="panel"><h2>各項資源價格</h2>
    <p class="muted">每份以金錢計價。中產可免費把自己的倉庫庫存轉到生活資源區。</p>
    <div class="price-table-scroll"><table class="price-table" aria-label="各項資源目前單價及庫存">
      <thead><tr><th scope="col">階級</th><th scope="col">項目</th>
        ${products.map(resource => `<th scope="col">${icon(resource)} ${resource === 'influence' ? '影響力' : resources[resource]}</th>`).join('')}</tr></thead>
      ${roles.map(role => {
        const warehouse = state.economy?.inventory?.[role];
        const tradeZone = role === 'capitalist' ? state.economy?.tradeZone : null;
        const rows = role === 'foreign' ? ['單價'] : ['單價', '庫存', ...(warehouse ? ['倉庫'] : []), ...(tradeZone ? ['貿易區'] : [])];
        const values = products.map(resource => {
          const quote = marketQuote(role, resource);
          const price = quote ? `<strong>$${quote.price}</strong>${role === 'foreign' ? `<small>基價 $${quote.base}</small><small>關稅 $${quote.tariff}</small>` : ''}` : '-';
          const stock = role === 'working' || role === 'middle' || (role === 'capitalist' && resource === 'influence')
            ? state.players[role][resource] ?? 0 : role === 'state' ? quote?.stock ?? '-' : '-';
          return [price, stock, ...(warehouse ? [warehouse[resource] ?? '-'] : []), ...(tradeZone ? [tradeZone[resource] ?? '-'] : [])];
        });
        return `<tbody>${rows.map((label, index) => `<tr>${index === 0
          ? `<th scope="rowgroup" rowspan="${rows.length}">${role === 'foreign' ? '外國市場' : meta.names[role]}</th>` : ''}
          <th scope="row">${label}</th>${values.map(column => `<td>${column[index]}</td>`).join('')}</tr>`).join('')}</tbody>`;
      }).join('')}</table></div></section>`;
}

function matchesCardPolicy(card) {
  return !card?.policyAnyOf?.length || card.policyAnyOf.some(section => state.policies[Number(section[0]) - 1] === section[1]);
}

function playForm(card) {
  if (!card) return '';
  if (!matchesCardPolicy(card)) return '';
  const { effect, resource, policy } = card.effect ? card : (legacyEffects[card.asset] ?? {});
  const population = state.match?.populations[state.role] ?? 3;
  const amountField = limit => numberField('quantity', '數量', limit, 1);
  const play = fields => form('play', `打出${escape(card.name)}`, fields);
  const player = state.players[state.role];
  if (effect === 'service') {
    const section = state.policies[policy];
    const price = section === 'B' ? 5 : 10;
    const limit = Math.min(population, state.publicServices[resource], Math.floor(player.cash * 2 / price));
    return section !== 'A' && limit > 0 ? play(amountField(limit)) : '';
  }
  if (effect === 'import') {
    const choices = ['food', 'luxury'].filter(resource => subsidizedImportLimit(resource) > 0);
    return state.policies[5] !== 'C' && choices.length
      ? play(`<div data-card-import>${selectField('resource', '進口種類', productOptions(choices))}
        ${amountField(subsidizedImportLimit(choices[0]))}</div>`) : '';
  }
  if (effect === 'pressing' || effect === 'bill') {
    const choices = state.availablePolicies.filter(choice => effect === 'pressing' || choice.policy === policy);
    return choices.length ? play(billFields(choices, { freeImmediate: effect === 'pressing' })) : '';
  }
  if (effect === 'housing') {
    const options = [['middle', '中產 · $10 → 3 VP'], ['capitalist', '資本家 · $20 → 5 VP']].filter((_, index) => player.cash >= (index + 1) * 10);
    return options.length ? play(selectField('recipient', '付款對象', options.map(([role, label]) => roleOption(role, label)))) : '';
  }
  if (effect === 'export-subsidy') {
    const choices = exportFields();
    return choices && state.policies[0] !== 'C' ? play(choices) : '';
  }
  if ((effect === 'issues' && (player.cash < 15 || state.publicServices.influence < 3))
    || (effect === 'theme-park' && player.cash < 6 * population)
    || (effect === 'endorse' && player.revenue + player.capital < 15)
    || (effect === 'island' && player.revenue + player.capital < 50)
    || (effect === 'protection' && state.policies[5] === 'C')
    || (effect === 'grants' && state.policies[0] === 'C')
    || (effect === 'investment' && player.influence < 2)) return '';
  const { role, economy } = state;
  const { companies, workers, markets } = economy ?? {};
  const own = companies?.filter(item => item.owner === role) ?? [];
  const companyField = (items, label = '企業', optional = false, name = 'company') =>
    selectField(name, label, [...(optional ? [['', '略過']] : []), ...companyOptions(items)]) + companyCardChoices(items);
  const eligibleBills = state.availablePolicies.filter(choice =>
    !['health-bill', 'immigration-bill'].includes(effect) || choice.policy === (effect === 'health-bill' ? 3 : 6));
  const recipients = (options = classes) => selectField('recipient', '選擇階級', roleOptions(options));
  const idle = workers?.filter(worker => worker.role === role && !worker.company && !worker.committed && !economy.unions.includes(worker.id)) ?? [];
  const workerChecks = checks('workers', idle.map(worker => [worker.id, workerLabel(worker, companies)]));
  const quantity = max => numberField('quantity', '數量', max);
  const billSelect = (name, options) => selectField(name, '政策', options.map(({ policy, target }) =>
    policyOption(policy, target)));
  switch (effect) {
    case 'health-bill': case 'immigration-bill': case 'poll':
      return eligibleBills.length ? play(effect === 'poll' ? billSelect('bill', eligibleBills) : billFields(eligibleBills)) : '';
    case 'radical': return state.radicalPolicies.length ? play(billSelect('bill', state.radicalPolicies)) : '';
    case 'emergency': return state.bills.length >= 3 && state.emergencyPolicies.length
      ? play(billSelect('bill', state.emergencyPolicies) + '<p class="muted">確認後直接調整政策，不進入表決。</p>') : '';
    case 'two-bills': return new Set(eligibleBills.map(item => item.policy)).size >= 2
      ? play(selectField('bill0', '第一案政策', eligibleBills.map(({ policy, target }) => policyOption(policy, target)), true)
        + '<label class="check"><input type="checkbox" name="immediate0">立即表決第 1 案</label>'
        + `<div data-second-bill>${secondBillField(eligibleBills[0].policy)}</div>`
        + '<label class="check"><input type="checkbox" name="immediate1">立即表決第 2 案</label>') : '';
    case 'migration': return idle.length >= 4 ? play(workerChecks) : '';
    case 'farm': return idle.length >= 3 && own.filter(item => item.id.startsWith('company-working-cooperative-farm')).length < 2 ? play(workerChecks) : '';
    case 'accident': return play(recipients(['middle', 'capitalist', 'state']) + selectField('resource', '產業', productOptions(products)));
    case 'specialize': return play(selectField('skill', '技能', [['', '選擇新工人的技能'], ...skillOptions(products)], true)
      + selectField('replacement', '供應不足時的替代技能', [['', '不指定'], ...skillOptions(products)])
      + `<div data-specialization-fields>${specializationFields()}</div>`);
    case 'deregulate': {
      const unemployed = state.policies[1] === 'B';
      const instructions = unemployed ? '勞動市場 2B：可指派尚未承諾的己方待業工人。'
        : '勞動市場 2C：可指派尚未承諾的己方待業工人，也可將尚未承諾的己方在職工人調往其他企業。';
      return play(`<p class="muted">${instructions}</p>` + moveFields(role, 48, { unemployed }));
    }
    case 'signing': return play(moveFields(role, 4, { unemployed: true }));
    case 'middle-hiring': return play(moveFields('working', 3, { unemployed: true, employeeOnly: true }));
    case 'general-strike': {
      const options = strikeOptions();
      const eligibleIds = new Set(options.map(([id]) => id));
      return options.length ? play(checks('companies', options) + companyCardChoices(companies.filter(item => eligibleIds.has(item.id)))) : '';
    }
    case 'income': case 'unemployment': return play(role === 'state' ? recipients(['working', 'middle'])
      : purchaseFields({ optional: true, ...(effect === 'unemployment' && { sources: ['state'] }) }));
    case 'public-overtime': return play(companyField(companies.filter(item => item.owner === 'state' && item.operational && !item.automated && !item.strike)) + quantity(population));
    case 'private-overtime': return play(companyField(own.filter(item => item.operational && !item.automated && !item.strike)));
    case 'tourism-purchase': {
      const sellers = ['middle', 'capitalist'].filter(seller => tourismLimit(seller) > 0);
      return sellers.length ? play(`<div data-card-tourism>${recipients(sellers)}${amountField(tourismLimit(sellers[0]))}</div>`) : '';
    }
    case 'sell-health': case 'sell-education': case 'bid-rigging': {
      const product = effect === 'bid-rigging' ? 'luxury' : effect.slice(5);
      const space = (economy.publicStorageCapacity?.[product] ?? 6) - (state.publicServices[product] ?? 0);
      const max = Math.min(role === 'middle' || product === 'luxury' ? 6 : 9, economy.inventory[role][product], Math.max(0, space));
      return max >= 1 ? play(quantity(max)) : '';
    }
    case 'personal-buy': return play(purchaseFields({ flexible: true }));
    case 'grant-build': case 'land-build':
      return markets[role]?.length ? play(buildFields(role, markets[role], { land: effect === 'land-build', payer: effect === 'grant-build' ? 'state' : role, mandatoryPay: effect === 'grant-build' })) : '';
    case 'industry-build': {
      const offers = markets[role]?.filter(item => ['food', 'luxury'].includes(item.resource));
      return offers?.length ? play(buildFields(role, offers, { price: item => Math.ceil(item.cost / 2) })) : '';
    }
    case 'investment-build':
      return play(selectField('source', '企業來源', [['market', '市場'], ['deck',
        state.canInvestFromDeck ? '企業牌庫' : '企業牌庫（沒有可負擔且能建造的企業）', null, !state.canInvestFromDeck]])
        + buildFields(role, markets[role], { price: item => Math.max(0, item.cost - (role === 'middle' ? 8 : 10)) }));
    case 'expand-build': {
      const budget = buildBudget(role);
      const offers = markets[role]?.map(item => ({ ...item, blocked: markets[role].some(other => other.id !== item.id
        && item.cost + other.cost <= budget) ? '' : '資金不足以建造兩家企業' }));
      const firstCompany = offers?.find(item => !item.blocked);
      return offers?.length >= 2 ? play(buildFields(role, offers, { prefix: 'build0-' })
        + buildFields(role, markets[role], { prefix: 'build1-', firstCompany })) : '';
    }
    case 'grow-storage':
      return play(selectField('resource', '倉庫種類', productOptions(products.slice(0, 4))) + buildFields(role, markets[role], { optional: true, storage: true }));
    case 'employment-subsidy': return play(companyField(own.filter(item => item.slots.some(slot => slot.optional && slot.worker)), '加班企業', true));
    case 'fill-unemployed': case 'recruit':
      return play(companyField(own.filter(item => !item.operational)) + recipients(['working', 'middle'])
        + (effect === 'recruit' ? selectField('replacement', '供應不足時的替代技能', [['', '不指定'], ...skillOptions(products)]) : ''));
    case 'competitive-wages':
      return play(companyField(own.filter(item => !item.operational && item.wages))
        + companyField(companies.filter(item => item.owner === 'state' && item.operational), '移出全組工人的公營企業', false, 'sourceCompany'));
    case 'brand-export': case 'food-export': {
      const product = effect === 'brand-export' ? 'luxury' : 'food';
      const stock = economy.inventory[role][product] + economy.tradeZone[product];
      const max = Math.min(product === 'luxury' ? 6 : 4, stock);
      return play(exportFields() + (max >= 1 ? quantity(max) : ''));
    }
    case 'foreign-partner': return state.content?.deals.length ? play(dealFields()
      + exportFields(state.match.exports.filter(offer => ['food', 'luxury'].includes(offer.resource)))) : '';
    case 'machinery': {
      const eligible = own.filter(item => item.machineryBonus && !item.machine);
      return play(checks('companies', companyOptions(eligible)) + companyCardChoices(eligible));
    }
    case 'exit': return play(companyField(own.filter(item => !item.machineryBonus && !item.automated)));
    case 'vat': case 'speech': return play(checks('recipients', roleOptions(classes)) + (effect === 'speech' ? quantity(Math.min(2, state.publicServices.influence)) : ''));
    case 'representation': case 'allowance': return play(recipients());
    case 'provide-health': case 'provide-education': return play(recipients(['working', 'middle']));
    case 'export-health': case 'export-education': {
      const max = Math.min(8, state.publicServices[effect.slice(7)]);
      return max >= 1 ? play(quantity(max)) : '';
    }
    case 'shift-event':
      return state.content?.events.length ? play() : '<p>場上沒有事件，無法使用「轉移重點」。可棄掉此牌執行基本行動。</p>';
    case 'repeat-event':
      return (state.content?.events ?? []).filter(event => event.form.kind !== 'civil').map(event =>
        play(`<h4>${escape(event.nameZh)}</h4>${eventCardInfo(event)}${eventFields(event, 'event0-')}${eventFields(event, 'event1-')}`)).join('');
    case 'nationalize': {
      const targets = companies.filter(item => item.owner === 'capitalist' && !item.operational && !item.machineryBonus && !item.automated);
      const blocks = targets.map(item => `<div data-nationalize-slots="${escape(item.id)}" hidden>${item.slots.map((slot, index) => {
        const candidates = workers.filter(worker => !worker.committed
          && (!worker.company || companies.find(company => company.id === worker.company)?.owner === 'state')
          && (!slot.role || slot.role === worker.role) && (slot.skill === 'any' || slot.skill === worker.skill));
        return selectField('card-staff-' + index,
          `工位 ${index + 1} · ${companySlotDetails(slot, meta.names)}${slot.optional ? '（選用）' : ''}`,
          [['', slot.optional ? '空置' : '選擇工人'], ...candidates.map(workerOption)], false, true);
      }).join('')}</div>`).join('');
      return targets.length ? play(`<div data-nationalize>${companyField(own.filter(item => !item.operational), '撤下的公營企業', false, 'replaced')}
        ${selectField('company', '轉為公營', [['', '選擇企業'], ...companyOptions(targets)])}
        ${companyCardChoices(targets)}
        ${selectField('hire', '指派工人的階級', [['', '略過指派'], ...roleOptions(['working', 'middle'])])}
        <p class="muted">可從待業區或公營企業調動最多 3 名未承諾工人；企業須一次補滿必要工位。</p>
        ${blocks}</div>`) : '';
    }
    case 'privatize': return play(companyField(own.filter(item => item.operational)));
  }
  return effect ? play() : '';
}

function eventFields(event, prefix = '') {
  const { form: spec } = event;
  let fields = `<input type="hidden" name="${prefix}eventId" value="${escape(event.id)}">`;
  if (spec.targets) fields += selectField(prefix + 'recipient', '選擇階級', roleOptions(spec.targets));
  if (spec.amounts) fields += selectField(prefix + 'amount', '金額', spec.amounts.map(amount => [amount, `$${amount}`]));
  if (spec.kind === 'provide' && spec.resources.length === 2) fields += numberField(prefix + 'amount',
    `其中 ${resources[spec.resources[0]]} 的數量`, Math.max(0, spec.targetAmounts[spec.targets[0]] - 1), 1);
  if (spec.kind === 'provide') fields += `<p class="muted">${Object.entries(spec.targetAmounts)
    .map(([role, amount]) => `${meta.names[role]} ${spec.resources[0] === 'cash' ? '$' : ''}${amount}`).join('、')}</p>`;
  if (spec.kind === 'spend') fields += numberField(prefix + 'amount', `支出 ${resources[spec.resource]}`,
    Math.min(spec.max, state.publicServices[spec.resource]));
  if (spec.kind === 'two') fields += checks(prefix + 'recipients', roleOptions(classes));
  if (spec.kind === 'distribute') fields += classes.map(role => numberField(prefix + 'dist-' + role, meta.names[role],
    spec.resource === 'votes' ? spec.max : Math.min(spec.max, state.publicServices.influence))).join('');
  if (spec.kind === 'buy') {
    const space = (state.economy.publicStorageCapacity[spec.resource] ?? 6) - (state.publicServices[spec.resource] ?? 0);
    const companies = state.economy.companies.filter(company => company.owner === 'state').length;
    fields += ['middle', 'capitalist'].map(role => numberField(prefix + 'dist-' + role, meta.names[role],
      Math.min(state.economy.inventory[role][spec.resource], companies, Math.max(0, space)))).join('');
  }
  if (spec.kind === 'industry') {
    const eligible = [...state.economy.markets.middle, ...state.economy.markets.capitalist].filter(item => spec.offers.includes(item.id));
    fields += prefix ? buildFields('middle', eligible, { prefix, idle: true, payer: 'state' })
      : selectField('company', '建造企業', companyOptions(eligible)) + companyCardChoices(eligible);
  }
  return fields;
}

function eventCardInfo(event) {
  return `<p>${escape(event.taskZh)}</p>
    <p>獎勵 · ${escape(event.rewardZh)}<br>未處理懲罰 · ${escape(event.unresolvedPenaltyZh)}</p>`;
}

function eventPanel() {
  if (!state.content?.events.length) return '';
  return `<section class="panel"><h2>國家事件</h2>${state.content.events.map(event => `<details>
    <summary>${escape(event.nameZh)}</summary>${eventCardInfo(event)}
    ${(event.form.offers?.length ?? 1) > 0 ? form('event', '處理事件', eventFields(event)) : ''}
    </details>`).join('')}</section>`;
}

function decisionPanel() {
  const { phase, role, content } = state;
  if (phase === 'market') {
    const { marketRole, marketSkillPending } = content;
    if (marketSkillPending) return `<section class="panel"><h2>新增中產技術工</h2>${role === 'middle'
      ? companyMarket(false, '可參考更新後的企業市場，選擇新工人的技能。')
        + form('market-skill', '確認技能', selectField('skill', '技術工的技能', skillOptions(products)))
      : '<p>等待中產選擇新增工人的技能。</p>'}</section>`;
    const controls = role === marketRole ? companyMarket(true, '可將企業拖到「棄置市場企業」，或勾選要棄置的牌。')
      + form('market', '更新市場', checks('companies', companyOptions(state.economy.markets[role])) + companyCardChoices(state.economy.markets[role]))
      : `<p>等待${meta.names[marketRole]}更新市場。</p>`;
    return `<section class="panel"><h2>企業市場補牌</h2>${controls}</section>`;
  }
  if (phase === 'event-penalty') {
    return `<section class="panel"><h2>未處理事件的懲罰</h2>${role === 'state' ? content.events.map(event => form('event-penalty',
      `結算 ${escape(event.nameZh)}`, `<input type="hidden" name="eventId" value="${escape(event.id)}">${eventCardInfo(event)}${checks('recipients', roleOptions(classes))}`)).join('')
      : '<p>等待國家選擇受罰階級。</p>'}</section>`;
  }
  if (phase === 'event-choice') {
    const { civil, civilPolicies } = content;
    const controls = civil.proposed ? (role === 'state' ? form('civil-confirm', '確認提案', '<label class="check"><input type="checkbox" name="immediate">立即投票</label>') : '<p>等待國家確認提案。</p>')
      : role === civil.recipient ? form('civil-bill', '提交政策', billFields(civilPolicies)) : `<p>等待${meta.names[civil.recipient]}選案。</p>`;
    return `<section class="panel"><h2>社會動盪 · 選擇法案</h2>${controls}</section>`;
  }
  if (phase === 'event-hire') {
    const { recipient, company } = content.eventHire;
    const offer = state.economy.markets[recipient].find(item => item.id === company);
    const controls = role === recipient ? form('event-hire', '確認雇用與建造', buildFields(role, [offer], { idle: true, payer: 'state' }))
      : `<p>等待${meta.names[recipient]}決定如何雇用。</p>`;
    return `<section class="panel"><h2>扶植新興產業 · ${escape(offer.name)}</h2>${controls}</section>`;
  }
  const choice = content.cardChoice;
  const pollReveal = content.pollReveal;
  let controls = pollReveal && role !== pollReveal.role
    ? `<p><strong>揭示的 5 枚方塊：</strong>${pollReveal.drawn.map(cube => meta.names[cube]).join('、')}</p>
      <p class="muted">等待${meta.names[pollReveal.role]}決定是否立即表決。</p>`
    : `<p>等待${meta.names[content.choosingRole]}完成卡牌選擇。</p>`;
  if (choice?.effect === 'fake-news') controls = form('card-choice', '確認移除（至多四枚）', checks('indices',
    choice.drawn.map((cube, index) => [index, `${meta.names[cube]}方塊 ${index + 1}`])));
  if (choice?.effect === 'poll') controls = `<p>${choice.drawn.map(cube => meta.names[cube]).join('、')}</p>`
    + form('card-choice', '確認表決時機', '<label class="check"><input type="checkbox" name="immediate">使用這五枚方塊免費即時表決</label>');
  if (choice?.effect === 'export-insight') controls = `<div class="export-choice-cards">${choice.cards.map(card => {
    const fields = exportFields(card.offers, role === 'middle' ? 2 : 1);
    const offers = card.offers.map(offer =>
      `<span>${icon(offer.resource)} ${resources[offer.resource]} ${offer.quantity} → ${offer.price}</span>`).join('');
    return form('card-choice', fields ? '採用此出口牌' : '採用此出口牌並完成',
      `<h4>出口(${Number(card.id.slice(7))})</h4><input type="hidden" name="option" value="${escape(card.id)}">
        <div class="export-choice-offers">${offers}</div>
        ${fields || '<p>目前庫存不足以進行這張牌的任何出口交易。</p>'}`);
  }).join('')}</div>`;
  if (choice?.effect === 'investment-build') {
    controls = buildFields(role, choice.cards);
    controls = choice.cards.some(item => !item.blocked)
      ? form('card-choice', '建造牌庫中的企業', controls)
      : controls + form('card-choice', '收回投資機會', '<p>目前沒有可建造的企業。</p><input type="hidden" name="option" value="cancel-investment">');
  }
  if (['shift-event', 'priority-event'].includes(choice?.effect)) {
    const active = content.events;
    const canPlace = choice.effect === 'priority-event' ? active.length < 2 : active.length > 0;
    const options = canPlace ? choice.cards : [];
    const revealed = choice.cards.map(event =>
      `<details open><summary>${escape(event.nameZh)}</summary>${eventCardInfo(event)}</details>`).join('');
    controls = revealed ? `<section><h3>翻出的事件牌</h3>${revealed}</section>` : '';
    if (choice.effect === 'shift-event' && !active.length) {
      controls += form('card-choice', '收回轉移重點', '<p>場上沒有事件可替換。收回卡牌後可重新選擇主要行動。</p><input type="hidden" name="option" value="cancel-shift-focus">');
    }
    controls += [...active, ...options].map(event => form('card-choice', `處理 ${escape(event.nameZh)}`,
      selectField('option', '翻出的新事件', [['', '維持原場面'], ...options.map(item => [item.id, item.nameZh])])
      + (choice.effect === 'shift-event' && options.length ? selectField('replaced', '換下的事件', active.map(item => [item.id, item.nameZh])) : '')
      + eventCardInfo(event) + eventFields(event))).join('');
  }
  return `<section class="panel"><h2>完成卡牌效果</h2>${controls}</section>`;
}

function policyPanel() {
  const choice = state.policyChoice;
  if (choice.role !== state.role) return `<section class="panel"><h2>政策調整</h2><p>等待${meta.names[choice.role]}確認。</p></section>`;
  let fields;
  let button = '確認，空白欄維持原值';
  if (choice.kind === 'public') {
    button = `確認${choice.opening ? '開放' : '關閉'} ${choice.count} 家公營企業`;
    fields = checks('companies', choice.companies.map(item => [item.id, `${companyActionLabel({ ...item, owner: 'state' })} · 公營格 ${item.position} · $${item.cost}`]));
  } else if (choice.kind === 'hire') {
    const choices = choice.options.map(([id, role, name, slots], option) => {
      const workers = state.economy.workers;
      const fields = `<input type="hidden" name="publicHire" value="${escape(`${id}:${role}`)}">`
        + slots.map((slot, index) => selectField('publicStaff', `工位 ${index + 1} · ${resources[slot.skill] ?? '不限技能'}`,
          [slot.preferred, ...slot.workers.filter(worker => worker !== slot.preferred)].map(id =>
            workerOption(workers.find(worker => worker.id === id))))).join('');
      const position = state.economy.publicSector.findIndex(item => item.id === id) + 1;
      return `<details ${option === 0 ? 'open' : ''}><summary>${escape(companyActionLabel({ name, owner: 'state' }))} · 公營格 ${position} · ${meta.names[role]}</summary>
        ${form('policy-choice', '確認雇用', fields)}</details>`;
    }).join('');
    return `<section class="panel"><h2>選擇公營企業雇用配置</h2>${choices}</section>`;
  } else if (choice.kind === 'wages') {
    fields = state.economy.companies.filter(item => item.owner === state.role && item.wages).map(item =>
      selectField(`wage-${item.id}`, `${companyActionLabel(item)} · 目前 L${item.wage}`, [['', '維持'], ...wageOptions(item.wages).filter(([level]) => level !== item.wage)])).join('');
  } else {
    fields = choice.resources.map(resource => {
      const current = marketQuote(state.role, resource).price;
      return selectField(`price-${resource}`, `${resources[resource]} · 目前 $${current}`, [['', '維持'],
        ...meta.domesticPriceLevels[state.role][resource].filter(price => price !== current).map(price => [price, `$${price}`])]);
    }).join('');
  }
  return `<section class="panel"><h2>政策調整</h2>${form('policy-choice', button, fields)}</section>`;
}

function demonstrationPanel() {
  const { limits, losses } = state.demonstration;
  const fields = Object.entries(limits).map(([seat, max]) => numberField(`loss-${seat}`, meta.names[seat], max)).join('');
  return `<section class="panel"><h2>示威結算 · 分配 ${losses} VP 扣分</h2>${state.role === 'working'
    ? form('demonstration-losses', '確認扣分', fields) : '<p>等待勞工分配扣分。</p>'}</section>`;
}

function actionPanel(card) {
  if (state.voteConfirmation) {
    const { confirmed } = state.voteConfirmation;
    const waiting = meta.roles.filter(role => !confirmed.includes(role)).map(role => meta.names[role]);
    return `<section class="panel"><h2>確認表決結果</h2>
      <p role="status">等待 ${waiting.join('、')} 確認表決結果。</p></section>`;
  }
  if (state.transaction) return transactionPanel();
  if (state.phase === 'complete') return state.match?.final ? finalPanel() : '<section class="panel"><h2>試玩完成</h2><p class="muted">可在右側查看 VP、表決結果及對局紀錄。</p></section>';
  if (state.phase === 'production-confirm') return productionConfirmationPanel();
  if (state.phase === 'needs') return foodPanel();
  if (state.phase === 'policy-choice') return policyPanel();
  if (state.phase === 'demonstration') return demonstrationPanel();
  if (state.phase === 'worker-arrival') return `<section class="panel"><h2>選擇替代技術工</h2>${state.workerArrival.role === state.role
    ? form('worker-arrival', '確認新增工人', selectField('skill', '技能', skillOptions(state.workerArrival.options)))
    : `<p>等待${meta.names[state.workerArrival.role]}選擇。</p>`}</section>`;
  if (['market', 'event-penalty', 'event-choice', 'event-hire', 'card-choice'].includes(state.phase)) return decisionPanel();
  if (state.phase === 'scoring') {
    const next = state.host === state.role ? form('next-round', '開始下一輪') : '<p class="muted">等待房主開始下一輪。</p>';
    return `<section class="panel"><h2>第 ${state.match.round} 輪計分完成</h2><button type="button" data-open-round-result>查看本輪結算</button>${next}</section>`;
  }
  if (state.phase === 'election') return electionPanel();
  if (state.currentRole !== state.role) return `<section class="panel"><h2>等待 ${meta.names[state.currentRole]}</h2><p class="muted">${state.mainUsed ? '主要行動已執行，等待結束回合。' : '對方正在選擇主要行動。'}</p></section>`;
  const mainActionHelp = boardHeadingHelp('主要行動',
    '輪到自己時，必須完成一項主要行動，才能結束回合。',
    '選「卡牌效果」會打出所選手牌並執行牌上的效果。選「基本行動」會棄掉所選手牌，改做所選的基本行動，例如購買商品與服務、指派工人或建造企業。可選的基本行動依階級而異。',
    '先選擇手牌及行動類型，再依畫面填寫對象、數量或拖曳指定物件。提交時會先顯示本次變更，確認後才正式執行。',
    '每回合只能執行一項主要行動。購買、建造等自願支出須有足夠資金，不能為這筆支出借款。完成後仍可執行本回合尚未使用的免費行動。');
  if (state.mainUsed) return `<section class="panel"><h2>${mainActionHelp}</h2><p class="muted">本回合的主要行動已完成。</p>${state.purchaseReceipt
    ? `<p>已購買${resources[state.purchaseReceipt.resource]}，${purchaseRows(state.purchaseReceipt).map(({ seller, quantity }) =>
      `${sellerName(seller)} ${quantity} 份`).join('、')}，共支付 $${state.purchaseReceipt.cost}。</p>` : ''}
    ${form('end', '結束回合')}</section>${freeActionPanel()}`;
  const actions = basicActions();
  const selected = actions.find(([type, , fields]) => type === selectedAction && fields !== null);
  const cardForm = playForm(card);
  const unavailable = !matchesCardPolicy(card) ? `需要政策 ${card.policyAnyOf.join(' 或 ')} 才能執行此卡牌效果。仍可棄掉這張牌執行基本行動。`
    : '目前沒有可執行的對象或條件未達成。可以選其他手牌或執行基本行動。';
  const cardDetail = card ? `<div class="hand-detail ${state.role}"><strong>${escape(card.name)}</strong><p>${escape(card.description)}</p>
    ${card.policyAnyOf?.length ? `<p class="muted">適用政策 ${escape(card.policyAnyOf.join('／'))}</p>` : ''}
    ${card.legitimacy ? `<p class="muted">合法性 · ${escape(card.legitimacy)}</p>` : ''}</div>` : '';
  const content = selectedAction === 'play'
    ? cardDetail + (cardForm || `<p class="muted">${escape(card ? unavailable : '沒有可打出的手牌。')}</p>`)
    : selected ? `<div class="basic-action-fields"><h3>${selected[1]}</h3>${selected[2]}</div>` : '';
  const market = companyMarket(acting('build'), acting('build') ? '把企業拖到中央圖板上自己階級的私營部門，再確認建造。' : '');
  return `<section class="panel action-content" id="main-action-options">
    <h2>${mainActionHelp}</h2>
    <select name="main-action" aria-label="選擇主要行動"><option value="">選擇一項行動</option>
      ${actionOption(['play', '卡牌效果', cardForm || null], selectedAction)}
      <optgroup label="基本行動">${actions.map(action => actionOption(action, selectedAction, !card)).join('')}</optgroup></select>
    ${selectedAction === 'play' ? content + market : market + content}</section>${freeActionPanel()}`;
}

function basicActions() {
  const { role } = state;
  const hasBill = state.availablePolicies.length > 0;
  const campaign = Math.min(3, state.publicServices.influence);
  const actions = [];
  if (role !== 'state') actions.push(['pressure', '施加政治壓力', form('pressure', '施加政治壓力')]);
  if (campaign && role === 'state') actions.push(['campaign', '競選', form('campaign', '競選',
    numberField('amount', '轉換影響力', campaign, 1))]);
  if (hasBill) actions.push(['propose', '提出法案', form('propose', '提出法案', billFields())]);
  actions.push(...companyActions());
  if (state.content && ['working', 'middle'].includes(role)) {
    const canBuy = ['middle', 'capitalist', 'state', 'foreign'].some(seller => products.some(resource =>
      purchaseLimit(resource, seller) > 0 && (seller === role || (marketQuote(seller, resource)?.price ?? Infinity) <= actionFunds())));
    actions.push(['buy', '購買商品與服務', canBuy ? selectedAction === 'buy' ? purchasePanel() : '' : null]);
  }
  if (role === 'capitalist' && state.content?.deals.some(deal => deal.cost <= actionFunds())) actions.push(['deal', '商業交易', form('deal', '確認交易', dealFields())]);
  if (state.content && role === 'working' && state.economy.companies.filter(item => item.strike).length < 7 && strikeOptions().length) {
    actions.push(['strike', '發起罷工', form('strike', '確認罷工', checks('companies', strikeOptions()))]);
  }
  if (role === 'working' && state.demonstration?.eligible && !state.demonstration.active) actions.push(['demonstrate', '發起示威',
    form('demonstrate', '確認示威', `<p>待業 ${state.demonstration.unemployed} 人，可用工位 ${state.demonstration.openings} 個。</p>`)]);
  if (role === 'middle' && meta.turnCommands.includes('extra-shift')) {
    const companies = state.economy.companies.filter(item => item.owner === role && item.operational && item.slots
      .filter(slot => !slot.optional).every(slot => !state.economy.workers.find(worker => worker.id === slot.worker)?.committed));
    if (companies.length) actions.push(['extra-shift', '加班', form('extra-shift', '確認加班', selectField('company', '企業', companyOptions(companies)))]);
  }
  if (role === 'capitalist' && meta.turnCommands.includes('lobby')) actions.push(['lobby', '遊說', actionFunds() >= 30 ? form('lobby', '支付 $30取得 3 影響力') : null]);
  if (role === 'state' && meta.turnCommands.includes('extra-tax')) {
    if (state.players.state.influence >= 2) actions.push(['meet-mps', '會晤政黨議員', form('meet-mps', '交付 2 影響力',
      selectField('recipient', '階級', roleOptions(classes)))]);
    const threshold = classes.map(seat => state.legitimacy[seat]).sort((a, b) => a - b)[1];
    if (Math.min(...Object.values(state.legitimacy)) > 1) actions.push(['extra-tax', '額外稅', form('extra-tax', '向每席徵收 $10',
      checks('recipients', classes.filter(seat => state.legitimacy[seat] <= threshold)
        .map(seat => [seat, `${meta.names[seat]} · 合法性 ${state.legitimacy[seat]}`])) )]);
  }
  const exports = exportFields();
  if (exports) actions.push(['export', '對外出口', form('export', '確認出口', exports)]);
  if (role === 'state' && state.content?.events.length) actions.push(['event', '處理國家事件', eventPanel()]);
  return completeActionOptions(actions, conditionalBasicActions[role]);
}

function transactionPanel() {
  const item = state.transaction;
  const titles = { buy: '確認購買', repay: '確認還款', 'food-loan': '確認食物採購與借貸' };
  if (item.role !== state.role) return `<section class="panel"><h2>${titles[item.kind]}</h2><p>等待${meta.names[item.role]}確認。</p></section>`;
  const ownFood = item.role === 'middle' && item.fromPersonal != null
    ? `使用生活資源 ${item.fromPersonal} 份、倉庫 ${item.fromWarehouse} 份` : `使用自有食物 ${item.own} 份`;
  const summary = item.kind === 'food-loan'
    ? `${ownFood}、國內購買 ${item.purchased} 份、進口 ${item.imported} 份。共支付 $${item.cost}。${newLoanSummary(item.loans)}。`
    : item.kind === 'repay' ? `支付 $${item.cost}，償還一筆貸款。`
      : `購買 ${Object.values(item.distribution).reduce((sum, count) => sum + count, 0)} 份${resources[item.resource]}，共支付 $${item.cost}。`;
  return `<section class="panel transaction-panel"><h2>${titles[item.kind]}</h2><p>${summary}</p>
    ${form('transaction-confirm', titles[item.kind])}
    ${form('transaction-cancel', item.kind === 'food-loan' ? '返回調整食物來源' : item.kind === 'buy' ? '返回修改購買' : '取消交易')}</section>`;
}

function foodPanel() {
  if (!state.match.needs) return `<section class="panel"><h2>等待${meta.names[state.match.needsRole]}結算食物</h2></section>`;
  const { required, own, shortage, sellers, importPrice, tariff } = state.match.needs;
  const personalFood = state.players[state.role].food;
  const usedPersonal = Math.min(personalFood, own);
  const rows = [];
  if (state.role === 'middle') {
    const warehouseFood = state.economy.inventory.middle.food;
    const usageInput = (name, label, stock, otherStock, value) =>
      `<input name="${name}" type="number" min="${Math.max(0, own - otherStock)}" max="${Math.min(stock, own)}"
        value="${value}" aria-label="${label}使用份數" required>`;
    rows.push(['自有(生活資源)', '-', personalFood, usageInput('personalFood', '生活資源', personalFood, warehouseFood, usedPersonal)],
      ['自有食物（倉庫）', '-', warehouseFood, usageInput('warehouseFood', '倉庫', warehouseFood, personalFood, own - usedPersonal)]);
  } else rows.push(['自有(生活資源)', '-', personalFood, usedPersonal]);
  if (shortage) {
    for (const [seller, stock] of Object.entries(sellers)) {
      if (!stock.stock) continue;
      const name = meta.names[seller];
      rows.push([coloredGameLabel(name, `var(--${seller})`), `$${stock.price}`, stock.stock,
        `<input name="food-${seller}" type="number" min="0" max="${Math.min(stock.stock, shortage)}"
          value="0" aria-label="向${escape(name)}購買的食物份數" required>`]);
    }
    rows.push(['外國市場', `$${importPrice}<br><small>含關稅 $${tariff}</small>`, '-', `<span data-food-imported>${shortage}</span>`]);
  }
  const details = settlementTable('', ['來源', '每份價格', '庫存', '使用／購買份數'], rows,
    ['合計支出', '<span data-food-cost></span>', '', required], 'food-settlement-table');
  const role = coloredGameLabel(meta.names[state.role], `var(--${state.role})`);
  return `<section class="panel"><h2>${role} · 食物結算</h2>
    <p><strong>需求${required}份食物</strong><br>人口 ${state.match.populations[state.role]} × 每人 1 份 = ${required} 份</p>
    ${form('food', '確認食物結算', details + '<p data-food-estimate aria-live="polite" hidden></p>')}</section>`;
}

function settlementTable(title, columns, rows, totalRow, tableClass = '') {
  const renderRow = ([label, ...cells]) => `<tr><th scope="row">${label}</th>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
  return `<div class="settlement-table-scroll"><table class="settlement-table ${tableClass}">
    ${title ? `<caption>${title}</caption>` : ''}<thead><tr>${columns.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(renderRow).join('')}</tbody>
    ${totalRow ? `<tfoot>${renderRow(totalRow)}</tfoot>` : ''}
    </table></div>`;
}

function settlementPanel() {
  const summary = state.match?.settlement;
  if (!summary) return '';
  const { stage, food, wages, income, tax, interest, usage, production } = summary;
  const { role } = state;
  const money = amount => amount == null ? '-' : `$${amount}`;
  const incomeRows = [
    ...(['working', 'middle'].includes(role) ? [['薪資收入', money(income.wages)]] : []),
    ...(role !== 'working' ? [['食物銷售', money(income.foodSales)]] : []),
    ...(role === 'state' ? [['進口關稅', money(income.tariffs)], ['稅收', money(income.taxes)]] : []),
    [income.salesIncomplete ? '合計（已知金額）' : '合計', money(income.total)],
  ];
  const expenseRows = [];
  if (food) {
    const detail = food.settled
      ? `已結算 · 自有 ${food.own} 份 · 補購 ${food.purchased + food.imported} 份${food.loans ? ` · 借款 ${food.loans} 筆` : ''}`
      : `${food.currentShortage == null ? '' : `目前缺 ${food.currentShortage} 份 · 生產後預估 `}需 ${food.required} 份、可用 ${food.own} 份、缺 ${food.shortage} 份`;
    expenseRows.push([coloredGameText('食物'), money(food.cost), money(food.gap), detail]);
  }
  if (role !== 'working') expenseRows.push(['應付薪資', money(wages.outgoing), money(wages.gap), '-']);
  if (role !== 'state') expenseRows.push(['應付稅款', money(tax.due), money(tax.gap), '-']);
  if (interest) expenseRows.push(['下輪利息', money(interest.due), money(interest.gap), '缺口按目前現金估算']);
  return `<section class="panel settlement-gaps ${state.role}"><h3>本輪結算試算</h3>
    <p class="muted">${stage === 'forecast' ? '按目前工位、政策及庫存試算輪末生產。'
      : stage === 'food' ? '薪資已結算，收入合計仍包含待結算的估算金額。' : '本輪生產階段的收入與支出已結算。'}</p>
    ${stage !== 'settled' ? '<p class="muted">待確認的食物缺口按進口試算。國內食物銷售在買方確認後計入賣方收入。</p>' : ''}
    ${income.salesIncomplete ? '<p class="muted">此存檔缺少部分食物銷售明細。</p>' : ''}
    ${settlementTable(stage === 'settled' ? '已入帳收入' : '預計收入', ['項目', '金額'], incomeRows)}
    ${settlementTable('支出與缺口', ['項目', '金額', '資金缺口', '說明'], expenseRows)}
    ${production ? productionDetails(production, stage === 'forecast') : ''}
    ${usage.length ? settlementTable('生活資源 · 自願使用門檻（份）',
      ['資源', '需求', '持有', '缺口', ...(role === 'middle' ? ['倉庫'] : [])],
      usage.map(item => [coloredGameLabel(resources[item.resource], `var(--industry-${item.resource})`),
        item.required, item.stock, item.shortage, ...(role === 'middle' ? [item.warehouse] : [])])) : ''}
    </section>`;
}

function updateFoodEstimate(form) {
  const { sellers, shortage, importPrice } = state.match.needs;
  let purchased = 0;
  let domesticCost = 0;
  for (const [name, value] of new FormData(form)) {
    if (!name.startsWith('food-')) continue;
    purchased += Number(value);
    domesticCost += Number(value) * sellers[name.slice(5)].price;
  }
  const remaining = shortage - purchased;
  const valid = remaining >= 0 && form.checkValidity();
  const button = form.querySelector('button');
  button.disabled = !valid;
  const estimate = form.querySelector('[data-food-estimate]');
  const imported = form.querySelector('[data-food-imported]');
  const costCell = form.querySelector('[data-food-cost]');
  if (imported) imported.textContent = valid ? remaining : '-';
  if (!valid) {
    costCell.textContent = '-';
    estimate.hidden = false;
    estimate.textContent = '請檢查自有食物的扣除量與各來源的購買量。';
    return;
  }
  const cost = domesticCost + remaining * importPrice;
  const cashGap = Math.max(0, cost - state.players[state.role].cash);
  costCell.textContent = `$${cost}`;
  estimate.hidden = !cashGap;
  estimate.textContent = cashGap ? `資金缺口 $${cashGap} · ${newLoanSummary(Math.ceil(cashGap / meta.loanPrincipal))}` : '';
}

function finalPanel() {
  const { winners, results } = state.match.final;
  const scores = meta.roles.map(role => results.find(result => result.role === role));
  const rows = [
    ['累積分數', ...scores.map(result => result.before)],
    ['政策', ...scores.map(result => `+${result.policy}`)],
    ['金錢', ...scores.map(result => `+${result.money}`)],
    ['庫存', ...scores.map(result => `+${result.inventory}`)],
    ['貸款扣分', ...scores.map(result => result.penalty ? `-${result.penalty}` : 0)],
  ];
  const total = ['最終分數', ...scores.map(result => result.total)];
  return `<section class="panel"><h2>${coloredGameText(winners.map(role => meta.names[role]).join('、'))}${winners.length > 1 ? '共同勝出' : '獲勝'}</h2>
    ${settlementTable('終局計分（VP）', ['得分項目', ...meta.roles.map(role => coloredGameText(meta.names[role]))], rows, total)}
    <details><summary>同分判定與貸款償還</summary>
      ${scores.map(result => `<p class="muted">${coloredGameText(meta.names[result.role])} · 符合政策 ${result.policyMatches} 項
        ${result.role !== 'state' ? `，袋內投票方塊 ${result.votingCubes} 枚` : ''}
        ${result.repaid ? `，貸款償還 - $${result.repaid}` : ''}</p>`).join('')}
    </details></section>`;
}

function showRoundResult(row) {
  const final = state.match.final;
  const sources = [
    ['工會', 'working', row.points.working],
    ['繁榮軌', 'middle', row.points.middle],
    ['財富軌', 'capitalist', row.points.capitalist - row.wealthBonus],
    ['突破紀錄', 'capitalist', row.wealthBonus],
    ['合法性', 'state', row.legitimacy],
    ['政治綱領', 'state', row.agendaPoints],
  ];
  const scoreRows = sources.map(([label, owner, points]) => [
    label, ...meta.roles.map(role => role === owner ? `+${points}` : '-'),
  ]);
  scoreRows.push(['輪末得分', ...meta.roles.map(role => `+${row.points[role]}`)]);
  const cumulative = ['累積分數', ...meta.roles.map(role =>
    final?.results.find(result => result.role === role)?.before ?? state.players[role].vp)];
  roundResultDialog.querySelector('h2').textContent = `第 ${row.round} 輪計分結果`;
  roundResultDialog.querySelector('[data-round-result]').innerHTML = settlementTable('輪末計分（VP）',
    ['得分項目', ...meta.roles.map(role => coloredGameText(meta.names[role]))], scoreRows, cumulative, 'round-score-table');
  if (!roundResultDialog.open) roundResultDialog.showModal();
}

function syncRoundResultDialog() {
  if (!['scoring', 'complete'].includes(state.phase)) return;
  const row = state.match?.history.at(-1);
  if (!row) return;
  const key = `${state.code}:${row.round}:${state.restoredRevision ?? 0}`;
  if (shownRoundResult === key) return;
  shownRoundResult = key;
  showRoundResult(row);
}

function transposedSettlementTable(title, columns, rows, { total = false, tableClass = '' } = {}) {
  const [corner, ...labels] = columns;
  const transposedRows = labels.map((label, index) => [label, ...rows.map(row => row[index + 1])]);
  const totalRow = total ? transposedRows.pop() : undefined;
  return settlementTable(title, [corner, ...rows.map(([label]) => label)], transposedRows, totalRow, tableClass);
}

function roundResourceTables(row) {
  const unrecorded = '未記錄';
  return meta.roles.map(role => {
    const hasMeals = role === 'working' || role === 'middle';
    const hasWarehouse = role !== 'working';
    const showsCapacity = role === 'capitalist' || role === 'state';
    const meal = row.foodSettlement?.[role] ?? row.meals.find(item => item.role === role);
    const columns = ['項目', ...(showsCapacity ? ['容量'] : []), ...(hasMeals ? ['生活資源'] : []),
      ...(hasWarehouse ? ['庫存', '生產', '丟棄', '賣出'] : []),
      ...(hasMeals ? ['購買國內', '購買國外', '使用', '資源缺額'] : []),
      '剩餘資源', ...(hasMeals ? ['支出'] : [])];
    const rows = products.map(resource => {
      const production = row.production?.filter(item => item.owner === role && item.resource === resource);
      const produced = production?.reduce((sum, item) => sum + item.produced, 0);
      const discarded = production?.every(item => item.discarded != null || item.produced === item.stored)
        ? production.reduce((sum, item) => sum + (item.discarded ?? 0), 0) : null;
      const food = resource === 'food' ? meal : null;
      const bought = food ? food.purchased + food.imported : null;
      const capacity = row.productionOpening?.capacity?.[role]?.[resource];
      const recordedFoodSales = resource === 'food' ? row.recordedFoodSales?.[role] : undefined;
      const hasWarehouseSpace = role === 'state' || resource !== 'influence';
      const sold = !hasWarehouseSpace ? '-' : row.resourceSales ? row.resourceSales[role]?.[resource] ?? 0
        : recordedFoodSales == null ? unrecorded : `至少 ${recordedFoodSales}`;
      const openingWarehouse = row.productionOpening?.warehouse?.[role];
      return [
        coloredGameLabel(resources[resource], `var(--industry-${resource})`),
        ...(showsCapacity ? [capacity === null ? '∞' : capacity ?? unrecorded] : []),
        ...(hasMeals ? [row.productionOpening?.personal?.[role]?.[resource]
          ?? (role === 'working' ? row.productionOpening?.stock?.[role]?.[resource] : undefined) ?? unrecorded] : []),
        ...(hasWarehouse ? [
          hasWarehouseSpace
            ? (openingWarehouse ? openingWarehouse[resource] ?? (role === 'state' ? 0 : unrecorded)
              : (role === 'state' ? row.productionOpening?.stock?.state?.[resource] : undefined) ?? unrecorded)
            : '-',
          produced ?? unrecorded, hasWarehouseSpace ? discarded ?? unrecorded : '-', sold,
        ] : []),
        ...(hasMeals ? (resource === 'food'
          ? [food?.purchased ?? unrecorded, food?.imported ?? unrecorded, food ? food.own + bought : unrecorded, bought ?? unrecorded]
          : ['-', '-', '-', '-']) : []),
        row.remainingResources?.[role]?.[resource] ?? unrecorded,
        ...(hasMeals ? [food ? `$${food.cost}` : resource === 'food' ? unrecorded : '-'] : []),
      ];
    });
    const title = `${coloredGameText(meta.names[role])}資源結算`;
    return `<details><summary>${title}</summary>
      ${transposedSettlementTable(null, columns, rows, { total: hasMeals, tableClass: hasMeals ? 'resource-needs-table' : 'resource-stock-table' })}
    </details>`;
  }).join('');
}

function roundTaxTable(taxes) {
  const breakdown = {
    working: [taxes.workingIncome, null, null],
    middle: [taxes.middleIncome, taxes.middleEmployment, null],
    capitalist: [null, taxes.employment, taxes.corporate],
    state: [taxes.workingIncome + taxes.middleIncome, taxes.employment + taxes.middleEmployment, taxes.corporate],
  };
  return `<p>${coloredGameLabel(`${meta.policies[1]} ${taxes.labor}`, policyColor(1))}／${coloredGameLabel(`${meta.policies[2]} ${taxes.taxation}`, policyColor(2))}
    · ${coloredGameText(`稅倍率 ${taxes.multiplier}`)}</p>`
    + transposedSettlementTable(null, ['稅目', '所得稅', '僱用稅', '公司稅', '合計'], meta.roles.map(role => {
      const amounts = breakdown[role];
      const total = role === 'state' ? taxes.total : amounts.reduce((sum, amount) => sum + (amount ?? 0), 0);
      const sign = role === 'state' ? '+' : '-';
      return [coloredGameText(meta.names[role]),
        ...[...amounts, total].map(amount => amount == null ? '-' : `${sign} $${amount}`)];
    }), { total: true });
}

function roundLoanDetails(row) {
  const count = value => value == null ? '-' : `${value} 筆`;
  const { imf } = row;
  const rows = meta.roles.map(role => {
    const loan = row.loans?.[role];
    const food = row.meals.find(meal => meal.role === role);
    const cleared = role === 'state' ? imf?.cleared ?? imf?.repaid : null;
    const paid = role === 'state' && imf?.paid != null ? `- $${imf.paid}` : '-';
    return [coloredGameText(meta.names[role]), count(loan?.wages), count(food?.loans),
      count(loan?.taxes), count(cleared), paid, count(loan?.outstanding),
      loan?.nextInterest == null ? '-' : `- $${loan.nextInterest}`];
  });
  return `<details><summary>貸款結算</summary>
    <p class="muted">食物借款只顯示你這一席的明細。下輪利息按輪末未清貸款計算，於下輪準備階段支付。- 表示不適用或無紀錄。</p>
    ${transposedSettlementTable(null, ['項目', '發薪借款', '食物借款', '繳稅借款', 'IMF 相關結清', '國庫支付', '輪末未清', '下輪利息'], rows)}
  </details>`;
}

function roundSettlementDetails(row) {
  return `${roundResourceTables(row)}
    <details><summary>稅款明細</summary>${roundTaxTable(row.taxes)}</details>
    ${row.imf?.intervened ? `<p>${coloredGameText(`取消法案 ${row.imf.canceledBills} 項，支付 $${row.imf.paid}${row.imf.closed.length ? `，關閉 ${row.imf.closed.join('、')}` : ''}。`)}</p>`
      : row.imf?.repaid ? `<p>國庫償還 ${row.imf.repaid} 筆貸款，避免 IMF 介入。</p>` : ''}`;
}

function roundHistory() {
  const history = state.match?.history ?? [];
  if (!history.length) return '';
  return `<details class="panel" open><summary>輪次結算</summary>${[...history].reverse().map(row => `<details>
    <summary>第 ${row.round} 輪 · 稅收 $${row.taxes.total} · ${row.imf?.intervened ? 'IMF 介入' : '未介入 IMF'}</summary>
    ${roundSettlementDetails(row)}
    ${roundLoanDetails(row)}
    ${companyProductionDetails(row.production)}
    <p>輪末分數 ${coloredGameText(Object.entries(row.points).map(([role, points]) => `${meta.names[role]} +${points}`).join('、'))}。</p>
    </details>`).join('')}</details>`;
}

function pendingVoters(election) {
  if (election.nextVoter) return [election.nextVoter];
  if (election.drawn.length !== 5) return [];
  return meta.roles.filter(role => election.sides[role] !== 'absent' && !election.submitted.includes(role));
}

function electionHeading(election) {
  return `${meta.policies[election.bill.policy]} ${election.bill.target} · ${election.nextVoter ? '公開表態' : '秘密投入'}`;
}

function electionDetails(election) {
  const sides = { for: '贊成', against: '反對', absent: '不參與' };
  return `<div class="stats">${meta.roles.map(role => `<span>${meta.names[role]} ${sides[election.sides[role]] ?? '待表態'}${election.submitted.includes(role) ? ' ✓' : ''}</span>`).join('')}</div>
    ${election.drawn.length ? `<p class="muted">抽出方塊：${election.drawn.map(role => meta.names[role]).join('、')}</p>` : ''}`;
}

function electionPanel() {
  const { election } = state;
  const pending = pendingVoters(election);
  const waiting = pending.length
    ? `等待 ${pending.map(role => meta.names[role]).join('、')}${election.nextVoter ? '表態' : '秘密投入影響力'}。`
    : '等待完成投票方塊抽取。';
  const controls = pending.includes(state.role)
    ? '<button type="button" data-open-election>開啟投票視窗</button>'
    : `<p role="status">${waiting}</p>`;
  return `<section class="panel election"><h2>${escape(electionHeading(election))}</h2>
    ${electionDetails(election)}${controls}</section>`;
}

function syncElectionDialog() {
  const election = state.phase === 'election' && state.election;
  if (!election || !pendingVoters(election).includes(state.role)) {
    electionPrompt = '';
    if (electionDialog.open) electionDialog.close();
    return;
  }
  const key = `${state.code}:${election.id}:${state.role}:${election.nextVoter ? 'side' : 'bid'}`;
  electionDialog.querySelector('[data-election-details]').innerHTML = electionDetails(election);
  if (electionPrompt === key) return;
  electionPrompt = key;
  electionDialog.querySelector('h2').textContent = electionHeading(election);
  const controls = electionDialog.querySelector('[data-election-controls]');
  controls.innerHTML = election.nextVoter
    ? '<form class="buttons" data-command="side"><button name="side" value="for">贊成</button><button name="side" value="against">反對</button></form>'
    : form('bid', '秘密提交', numberField('amount', '投入影響力', state.players[state.role].influence));
  if (!electionDialog.open) electionDialog.showModal();
  controls.querySelector('input, button')?.focus();
}

function showVoteResult(result) {
  const { id, bill, passed, favor, against, drawn, sides, bids } = result;
  const stance = { for: '贊成', against: '反對', absent: '不參與' };
  const cubes = Object.fromEntries(meta.roles.map(role => [role, 0]));
  for (const role of drawn) cubes[role]++;
  const losingSide = passed ? 'against' : 'for';
  const returned = result.bag?.returned ?? drawn.filter(role => sides[role] === losingSide).length;
  const removed = result.bag?.removed ?? drawn.length - returned;
  const remaining = result.bag?.remaining ?? Object.values(state.bag).reduce((sum, count) => sum + count, 0);
  pendingVoteDialogId = id;
  if (electionDialog.open) {
    electionDialog.close();
    electionPrompt = '';
  }
  voteResultDialog.querySelector('[data-vote-result]').innerHTML = `
    <h3 class="vote-result-title">${escape(meta.policies[bill.policy])} ${bill.target}．${passed ? '通過' : '未通過'}</h3>
    <p class="vote-result-totals"><span class="vote-for">贊成 <strong>${favor}</strong> 票</span> · <span class="vote-against">反對 <strong>${against}</strong> 票</span></p>
    <table class="vote-result-table"><thead><tr><th scope="col">階級</th><th scope="col">立場</th><th scope="col">抽出方塊</th><th scope="col">投入影響力</th><th scope="col">貢獻票數</th></tr></thead>
    <tbody>${meta.roles.map(role => {
      const side = sides[role];
      const color = side === 'for' ? 'vote-for' : side === 'against' ? 'vote-against' : '';
      return `<tr class="${role}"><th scope="row" class="vote-role">${meta.names[role]}</th><td class="${color}">${stance[side] ?? '—'}</td>
        <td class="vote-role">${cubes[role]}</td><td>${bids[role] ?? '—'}</td><td class="${color}">${cubes[role] + (bids[role] ?? 0)}</td></tr>`;
    }).join('')}</tbody></table>
    <div class="vote-result-notes">
      <p>抽出前袋內 <strong>${result.bag?.before ?? '—'}</strong> 枚 · 抽取中補入 <strong>${result.bag?.added ?? '—'}</strong> 枚 · 抽出 <strong>${drawn.length}</strong> 枚</p>
      <p>退回袋中 <strong>${returned}</strong> 枚 · 移回供應區 <strong>${removed}</strong> 枚 · 結算後袋內 <strong>${remaining}</strong> 枚</p>
      <p class="vote-draw">抽出方塊：${drawn.map(role => {
        const name = escape(meta.names[role]);
        return `<span class="vote-draw-cube ${role}" role="img" aria-label="${name}" title="${name}"></span>`;
      }).join('') || '—'}</p>
    </div>`;
  if (!voteResultDialog.open) voteResultDialog.showModal();
}

function syncVoteResultDialog() {
  const confirmation = state.voteConfirmation;
  if (confirmation && !confirmation.confirmed.includes(state.role)) {
    if (pendingVoteDialogId !== state.lastVote.id || !voteResultDialog.open) showVoteResult(state.lastVote);
    return true;
  }
  if (pendingVoteDialogId) {
    pendingVoteDialogId = undefined;
    voteResultDialog.close();
  }
  return voteResultDialog.open;
}

function handBoard(card) {
  return `<section class="panel hand ${state.role}"><div class="desk-heading"><h2>${boardHeadingHelp('私人手牌',
    '開局設置\n每個階級洗勻自己的行動牌庫，抽 7 張作為起始手牌。',
    '這裡顯示你目前持有的行動卡。其他玩家只看得到手牌張數。',
    '第 2 到第 5 輪的準備階段，保留還沒用掉的手牌，再抽牌補到 7 張。牌庫抽空時，將棄牌洗成新的牌庫。',
    '選好手牌後，在主要行動選單選「卡牌效果」，即可在選單下方查看牌面說明。做主要行動時，可打出這張牌執行效果，或棄掉它來做基本行動。若牌上有政策等使用條件，必須符合條件才能執行牌上效果。')}</h2>
    <div class="desk-tools"><span>${state.hand.length} 張</span><button type="button" class="pile-button" ${state.cardPiles ? '' : 'hidden'} data-card-piles
      aria-haspopup="dialog" aria-label="查看手牌庫與已使用的手牌" title="查看手牌庫與已使用的手牌">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10 12 3l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>
    </button></div></div>
    <div class="hand-rack">${state.hand.map(item => `<button type="button" class="hand-card" aria-pressed="${item.id === card?.id}"
      data-card="${escape(item.id)}" ${cardTipAttrs(item)}>
      <svg viewBox="0 0 70 86" aria-hidden="true">
        <path d="M8 22h54m-54 52h54M54 1l15 15"/><circle cx="35" cy="48" r="13"/>
      </svg>${item.serial ? `<small class="card-serial">${escape(item.serial)}</small>` : ''}<strong>${escape(item.name)}</strong></button>`).join('')}</div>
    ${state.hand.length ? '' : '<p class="muted">沒有手牌。</p>'}
    </section>`;
}

let selectedPileCard;
function cardPileTile(item, pile) {
  return `<button type="button" class="pile-card" data-pile-card="${escape(item.id)}" data-pile="${pile}"
    aria-pressed="${selectedPileCard?.pile === pile && selectedPileCard?.id === item.id}"
    ${cardTipAttrs(item)}>
    ${item.serial ? `<small class="card-serial">${escape(item.serial)}</small>` : ''}
    <strong>${escape(item.name)}</strong>${item.policyAnyOf?.length ? `<small>${escape(item.policyAnyOf.join('／'))}</small>` : ''}</button>`;
}

function cardPileSection(title, cards, pile) {
  // 檢查用途：照實際牌堆順序顯示；draw 使用 pop 抽牌，反轉後左起即為接下來依序抽出的牌。
  return `<section class="card-pile"><h3>${title} <span>${cards.length} 張</span></h3>
    ${cards.length ? `<div class="pile-grid">${[...cards].reverse().map(card => cardPileTile(card, pile)).join('')}</div>` : '<p class="muted">目前沒有牌。</p>'}</section>`;
}

function pileSwapForm() {
  if (!state.hand.length) return '<p class="muted pile-swap-empty">目前沒有手牌可交換。</p>';
  const piles = [...state.cardPiles.draw, ...state.cardPiles.discard];
  const chosen = piles.find(card => card.id === selectedPileCard?.id);
  const status = chosen ? `已選取：${chosen.serial ? `${chosen.serial} ` : ''}${chosen.name}` : '請先點選上方牌堆中的一張牌。';
  return `<form class="pile-swap" data-command="swap-card">
    <p class="pile-selection" data-pile-selection>${escape(status)}</p>
    <label>交換成手牌
      <select name="handCardId">${state.hand.map(card => `<option value="${escape(card.id)}">${escape(card.serial ? `${card.serial}　${card.name}` : card.name)}</option>`).join('')}</select>
    </label>
    <button type="submit" ${chosen ? '' : 'disabled'}>交換</button>
    <input type="hidden" name="pileCardId" value="${escape(selectedPileCard?.id ?? '')}">
    <input type="hidden" name="pile" value="${escape(selectedPileCard?.pile ?? '')}">
  </form>`;
}

function renderCardPiles() {
  cardPilesDialog.className = `action-confirmation ${state.role}`;
  if (!state.cardPiles) {
    cardPilesBody.innerHTML = '<p class="muted">目前對局沒有手牌庫資料。</p>';
    return;
  }
  if (selectedPileCard && ![...state.cardPiles.draw, ...state.cardPiles.discard].some(card => card.id === selectedPileCard.id)) {
    selectedPileCard = undefined;
  }
  cardPilesBody.innerHTML = cardPileSection('待抽牌庫', state.cardPiles.draw, 'draw')
    + cardPileSection('已使用的手牌', state.cardPiles.discard, 'discard')
    + pileSwapForm()
    + '<p class="muted pile-note">待抽牌庫左起為接下來依序抽出的牌。已使用的手牌會先進入棄牌堆；待抽牌庫抽空後，下一次補牌（第 2～5 輪準備階段）才把棄牌洗成新牌庫。此檢查檢視目前照實際牌堆順序顯示，正式版會隱藏。</p>';
}

function selectPileCard(button) {
  const id = button.dataset.pileCard;
  const pile = button.dataset.pile;
  const same = selectedPileCard?.id === id && selectedPileCard?.pile === pile;
  selectedPileCard = same ? undefined : { id, pile };
  cardPilesBody.querySelectorAll('[data-pile-card]').forEach(card => card.setAttribute('aria-pressed',
    String(Boolean(selectedPileCard) && card.dataset.pileCard === selectedPileCard.id && card.dataset.pile === selectedPileCard.pile)));
  const form = cardPilesBody.querySelector('form[data-command="swap-card"]');
  if (!form) return;
  form.querySelector('[name="pileCardId"]').value = selectedPileCard?.id ?? '';
  form.querySelector('[name="pile"]').value = selectedPileCard?.pile ?? '';
  form.querySelector('button[type="submit"]').disabled = !selectedPileCard;
  const chosen = selectedPileCard && [...state.cardPiles.draw, ...state.cardPiles.discard].find(card => card.id === selectedPileCard.id);
  form.querySelector('[data-pile-selection]').textContent = chosen
    ? `已選取：${chosen.serial ? `${chosen.serial} ` : ''}${chosen.name}`
    : '請先點選上方牌堆中的一張牌。';
}

function showCardPiles() {
  if (!state?.testMode || !state.cardPiles) return;
  renderCardPiles();
  if (!cardPilesDialog.open) cardPilesDialog.showModal();
}

const adjustRoles = ['state', 'working', 'middle', 'capitalist'];
const adjustTabs = [...adjustRoles, 'policy'];
const adjustClasses = ['working', 'middle', 'capitalist'];
const adjustRoleLabels = { state: '國家', working: '勞工', middle: '中產', capitalist: '資本家', policy: '公共政策' };
const adjustLivingLabels = { food: '食物', luxury: '奢侈品', health: '醫療', education: '教育', influence: '個人影響力' };
const adjustStoredLabels = { food: '食物', luxury: '奢侈品', health: '醫療', education: '教育' };
const adjustPublicLabels = { food: '食物', luxury: '奢侈品', health: '醫療', education: '教育', influence: '媒體影響力' };
const adjustBenefitLabels = { cash: '金錢', food: '食物', luxury: '奢侈品', health: '醫療', education: '教育', influence: '影響力', votes: '投票方塊' };

function adjustInput(label, name, value, { min = 0, max = 99999, hint = '' } = {}) {
  return `<label class="adjust-field">${escape(label)}
    <input type="number" name="${escape(name)}" value="${Number(value) || 0}" min="${min}" max="${max}" step="1" inputmode="numeric" required>
    ${hint ? `<small>${hint}</small>` : ''}</label>`;
}

function adjustSection(title, fields, note = '') {
  return `<fieldset class="adjust-section"><legend>${title}</legend>
    ${note ? `<p class="muted">${escape(note)}</p>` : ''}<div class="adjust-grid">${fields}</div></fieldset>`;
}

function adjustStorageFields(role) {
  const inventory = state.economy?.inventory?.[role] ?? {};
  const units = state.economy?.storageUnits?.[role] ?? {};
  const capacities = state.economy?.storageCapacity?.[role] ?? {};
  return adjustSection('倉庫庫存',
    Object.keys(adjustStoredLabels).map(key => adjustInput(adjustStoredLabels[key], `inventory-${key}`, inventory[key] ?? 0)).join(''))
    + adjustSection('倉庫容量（單位）',
      Object.keys(adjustStoredLabels).map(key => {
        const unit = units[key] ?? 1;
        const capacity = capacities[key] ?? 0;
        const base = Math.max(1, Math.round(capacity / unit));
        return adjustInput(adjustStoredLabels[key], `storageUnits-${key}`, unit,
          { min: 1, hint: `1 單位＝${base} 份・目前 ${capacity} 份` });
      }).join(''),
      '容量以倉庫單位表示；每種資源的 1 單位等於該階級的單一倉庫容量。');
}

function adjustSelect(label, name, options, current) {
  return `<label class="adjust-field">${escape(label)}
    <select name="${escape(name)}">${options.map(price => `<option value="${price}"${price === current ? ' selected' : ''}>$${price}</option>`).join('')}</select></label>`;
}

function adjustChoice(label, name, options, current) {
  return `<label class="adjust-field">${escape(label)}
    <select name="${escape(name)}">${options.map(value => `<option value="${escape(value)}"${value === current ? ' selected' : ''}>${escape(value)}</option>`).join('')}</select></label>`;
}

function adjustBenefitFields(role) {
  return adjustSection(`國家福利・${adjustRoleLabels[role]}`,
    Object.keys(adjustBenefitLabels).map(key => adjustInput(adjustBenefitLabels[key], `benefit-${role}-${key}`, state.content?.benefits?.[role]?.[key] ?? 0)).join(''),
    role === 'working' ? '設定各階級國家福利區的待領項目；不會自動支付國庫或扣除公共庫存。' : '');
}

function adjustPriceFields(role) {
  const levels = meta.domesticPriceLevels?.[role];
  if (!levels) return '<p class="muted adjust-note">此階級沒有可調整的國內售價。</p>';
  const prices = state.match?.prices?.[role] ?? {};
  return adjustSection('資源售價',
    Object.entries(levels).map(([resource, options]) => {
      const current = prices[resource]?.price ?? options[1] ?? options[0];
      return adjustSelect(adjustStoredLabels[resource] ?? resources[resource], `price-${resource}`, options, current);
    }).join(''),
    '選擇此階級可調整的資源售價；下拉選單只列出圖版允許的價格。');
}

function adjustLivingFields() {
  return adjustSection('生活資源',
    Object.keys(adjustLivingLabels).map(key => adjustInput(adjustLivingLabels[key], `living-${key}`, state.players[adjustTab]?.[key] ?? 0)).join(''));
}

function hostAdjustBodyMarkup() {
  if (!state?.players) return '<p class="muted">目前沒有可調整的對局。</p>';
  if (adjustTab === 'policy') {
    return adjustSection('七大政策', meta.policies.map((name, index) =>
      adjustChoice(name, `policy-${index}`, ['A', 'B', 'C'], state.policies[index])).join(''),
      '直接設定七大政策的現行區段，不會觸發政策變更的連鎖結算。')
      + adjustSection('投票袋',
        adjustClasses.map(role => adjustInput(adjustRoleLabels[role], `bag-${role}`, state.bag?.[role] ?? 0, { max: 25 })).join(''),
        '直接覆寫袋內各階級方塊數；各階級上限 25 枚，福利區保留的方塊不在此欄內。');
  }
  const economy = state.economy ?? {};
  const player = state.players[adjustTab];
  if (adjustTab === 'state') {
    return adjustSection('金錢與個人影響力',
      adjustInput('國庫', 'treasury', state.treasury)
      + adjustInput('個人影響力', 'living-influence', player?.influence ?? 0))
      + adjustSection('公共庫存',
        Object.keys(adjustPublicLabels).map(key => adjustInput(adjustPublicLabels[key], `public-${key}`, state.publicServices?.[key] ?? 0)).join(''),
        '國家持有的公共資源。')
      + adjustSection('公共容量',
        Object.keys(adjustPublicLabels).map(key => adjustInput(adjustPublicLabels[key], `publicCapacity-${key}`, economy.publicStorageCapacity?.[key] ?? 0)).join(''),
        '公共容量原本由公營企業產能決定；這裡可覆寫為指定份數。')
      + adjustClasses.map(role => adjustBenefitFields(role)).join('')
      + '<p class="muted adjust-note">國家的食物、奢侈品與媒體影響力為固定價；醫療與教育售價由福利政策決定，沒有可直接調整的國內售價。</p>';
  }
  if (adjustTab === 'working') {
    return adjustSection('金錢', adjustInput('現金', 'cash', player?.cash ?? 0)) + adjustLivingFields()
      + '<p class="muted adjust-note">勞工沒有可調整的國內售價。</p>';
  }
  if (adjustTab === 'middle') {
    return adjustSection('金錢', adjustInput('現金', 'cash', player?.cash ?? 0))
      + adjustLivingFields()
      + adjustStorageFields('middle')
      + adjustPriceFields('middle');
  }
  return adjustSection('金錢',
    adjustInput('現金', 'cash', player?.cash ?? 0)
    + adjustInput('營收', 'revenue', player?.revenue ?? 0)
    + adjustInput('資本', 'capital', player?.capital ?? 0))
    + adjustLivingFields()
    + adjustStorageFields('capitalist')
    + adjustPriceFields('capitalist');
}

function renderHostAdjust() {
  if (!state) return;
  if (!adjustTabs.includes(adjustTab)) adjustTab = 'state';
  hostAdjustDialog.className = `action-confirmation host-adjust-dialog ${state.role}`;
  hostAdjustTabs.innerHTML = adjustTabs.map(role => `<button type="button" role="tab" data-adjust-tab="${role}"
    aria-selected="${role === adjustTab}" tabindex="${role === adjustTab ? 0 : -1}">${adjustRoleLabels[role]}</button>`).join('');
  hostAdjustBody.innerHTML = hostAdjustBodyMarkup();
}

function showHostAdjust() {
  if (busy || !state?.testMode || state.role !== state.host || state.phase !== 'action' || state.transaction) return;
  renderHostAdjust();
  if (!hostAdjustDialog.open) hostAdjustDialog.showModal();
}

function hostAdjustCommand() {
  const fields = new FormData(hostAdjustDialog.querySelector('form[data-host-adjust]'));
  const command = { type: 'host-adjust', target: adjustTab };
  const number = name => Number(fields.get(name));
  const collect = (prefix, keys) => Object.fromEntries(keys.filter(key => fields.has(`${prefix}-${key}`))
    .map(key => [key, number(`${prefix}-${key}`)]));
  if (adjustTab === 'policy') {
    command.policies = meta.policies.map((_, index) => fields.get('policy-' + index));
    const bag = Object.fromEntries(adjustClasses.filter(role => fields.has(`bag-${role}`))
      .map(role => [role, number(`bag-${role}`)]));
    if (Object.keys(bag).length) command.bag = bag;
    return command;
  }
  if (fields.has('treasury')) command.treasury = number('treasury');
  if (fields.has('cash')) command.cash = number('cash');
  if (fields.has('revenue')) command.revenue = number('revenue');
  if (fields.has('capital')) command.capital = number('capital');
  const living = collect('living', Object.keys(adjustLivingLabels));
  if (Object.keys(living).length) command.living = living;
  const inventory = collect('inventory', Object.keys(adjustStoredLabels));
  if (Object.keys(inventory).length) command.inventory = inventory;
  const storageUnits = collect('storageUnits', Object.keys(adjustStoredLabels));
  if (Object.keys(storageUnits).length) command.storageUnits = storageUnits;
  const priceKeys = Object.keys(meta.domesticPriceLevels?.[adjustTab] ?? {});
  const prices = Object.fromEntries(priceKeys.filter(key => fields.has(`price-${key}`))
    .map(key => [key, number(`price-${key}`)]));
  if (Object.keys(prices).length) command.prices = prices;
  const publicStock = collect('public', Object.keys(adjustPublicLabels));
  if (Object.keys(publicStock).length) command.public = publicStock;
  const publicCapacity = collect('publicCapacity', Object.keys(adjustPublicLabels));
  if (Object.keys(publicCapacity).length) command.publicCapacity = publicCapacity;
  const benefits = {};
  for (const role of adjustClasses) {
    const values = collect(`benefit-${role}`, Object.keys(adjustBenefitLabels));
    if (Object.keys(values).length) benefits[role] = values;
  }
  if (Object.keys(benefits).length) command.benefits = benefits;
  return command;
}

function playerInfoTabs() {
  const tabs = [
    ['settlement', '結算試算', settlementPanel() || '<p class="panel muted">目前沒有結算試算。</p>'],
    ['prices', '資源價格', resourcePricePanel() || '<p class="panel muted">目前沒有資源價格。</p>'],
    ['seats', '四席摘要', `<section class="panel"><h2>四席摘要</h2><div class="seat-grid">${seatCards()}</div></section>`],
    ['log', '對局紀錄', `<section class="panel"><h2>對局紀錄</h2><ul class="log">${state.log.slice(-10).reverse().map(entry => `<li>${escape(entry)}</li>`).join('')}</ul></section>`],
  ];
  return `<section id="player-info" class="player-info">
    <div class="player-info-tabs" role="tablist" aria-label="玩家圖版資訊">${tabs.map(([id, label]) => {
      const selected = selectedBoardTab === id;
      return `<button type="button" role="tab" id="player-tab-${id}" data-board-tab="${id}" aria-controls="player-panel-${id}"
        aria-selected="${selected}" tabindex="${selected ? 0 : -1}">${label}</button>`;
    }).join('')}</div>
    ${tabs.map(([id, , content]) => `<div role="tabpanel" id="player-panel-${id}" aria-labelledby="player-tab-${id}" tabindex="0"
      ${selectedBoardTab === id ? '' : 'hidden'}>${content}</div>`).join('')}
  </section>`;
}

function openBoardTab(id) {
  selectedBoardTab = id;
  for (const tab of app.querySelectorAll('[data-board-tab]')) {
    const selected = tab.dataset.boardTab === id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    if (selected) tab.focus({ preventScroll: true });
  }
}

function transferTargets() {
  if (canBid()) return `<button type="button" class="transfer-target" ${dropAttrs('bid')}>秘密投入影響力</button>`;
  if (state.phase === 'market' && state.content.marketRole === state.role && !state.content.marketSkillPending) {
    return `<button type="button" class="transfer-target" ${dropAttrs('market')}>棄置市場企業</button>`;
  }
  if (!mainTurn()) return '';
  const targets = [];
  if (acting('deal') && state.role === 'capitalist' && state.content?.deals.length) {
    targets.push(`<button type="button" ${dropAttrs('deal', 'free-zone')}>自由貿易區</button>`,
      `<button type="button" ${dropAttrs('deal', 'warehouse')}>國內倉庫</button>`);
  }
  if (acting('export') && state.match?.exports.some(offer => offer.available)) targets.push(`<button type="button" ${dropAttrs('export')}>出口交易</button>`);
  if (acting('campaign') && state.role === 'state' && state.publicServices.influence) targets.push(`<button type="button" ${dropAttrs('campaign')}>轉為個人影響力</button>`);
  return targets.length ? `<div class="drop-toolbar panel">${targets.join('')}</div>` : '';
}

function workerDestination(workerId, companyId, preferredSlot) {
  const worker = state.economy.workers.find(item => item.id === workerId);
  const company = state.economy.companies.find(item => item.id === companyId);
  const moves = assignmentMoves();
  if (!worker || !company || worker.role !== state.role || worker.committed || worker.company === companyId
    || (moves.length >= 3 && !moves.some(move => move.worker === workerId))) return -1;
  if (company.owner !== 'middle' && company.slots.some(slot => !slotVacant(slot, moves)
    && state.economy.workers.find(occupant => occupant.id === slot.worker)?.role !== worker.role)) return -1;
  return company.slots.findIndex((slot, index) => (preferredSlot === undefined || preferredSlot === index)
    && (!slot.role || slot.role === worker.role) && (slot.skill === 'any' || slot.skill === worker.skill)
    && (!slot.optional || company.slots.every(required => required.optional || !slotVacant(required, moves)))
    && slotVacant(slot, moves) && !moves.some(move => move.company === companyId && move.slot === index));
}

function acceptsPiece(source, target) {
  if (source.type === 'influence') return target.type === 'bid' && canBid();
  if (target.type === 'market') return source.type === 'company' && state.phase === 'market'
    && state.content.marketRole === state.role && !state.content.marketSkillPending;
  switch (source.type) {
    case 'company': return acting('build') && target.type === 'sector' && target.id === state.role
      && state.economy.markets[state.role]?.some(item => item.id === source.id);
    case 'deal': return acting('deal') && target.type === 'deal';
    case 'export': return acting('export') && target.type === 'export';
    case 'media': return acting('campaign') && target.type === 'campaign' && state.role === 'state';
    case 'goods': {
      const [seller, resource] = source.id.split(':');
      return canShop() && purchaseLimit(resource, seller) > 0 && target.type === 'buy' && (!target.id || resource === target.id);
    }
    case 'worker': {
      if (target.type === 'build-slot') {
        const item = pendingBuild();
        const index = Number(target.id);
        const slot = item && buildSlots(item)[index];
        const worker = state.economy.workers.find(candidate => candidate.id === source.id);
        return Boolean(slot && !draft.staff[index] && canStaffBuild(worker, item, slot, index));
      }
      if (!acting('assign')) return false;
      if (target.type === 'unemployed') {
        const worker = state.economy.workers.find(item => item.id === source.id);
        const moves = draft?.type === 'assign' ? draft.moves : [];
        const queued = moves.find(move => move.worker === source.id);
        return worker?.role === state.role && target.id === state.role && !worker.committed
          && Boolean(queued);
      }
      if (target.type === 'company-worker') return workerDestination(source.id, target.id) >= 0;
      if (target.type !== 'slot') return false;
      const [id, slot] = target.id.split(':');
      return workerDestination(source.id, id, Number(slot)) >= 0;
    }
    default: return false;
  }
}

function announceBoard(text) {
  boardStatus = text;
  const status = document.querySelector('#board-feedback');
  if (status) status.textContent = text;
}

function placePiece(source, target) {
  if (target.type === 'company-worker') {
    target = { type: 'slot', id: `${target.id}:${workerDestination(source.id, target.id)}` };
  }
  switch (target.type) {
    case 'slot': case 'unemployed': {
      const moves = draft?.type === 'assign' ? draft.moves.filter(move => move.worker !== source.id) : [];
      if (target.type === 'slot') {
        const [company, index] = target.id.split(':');
        moves.push({ worker: source.id, company, slot: Number(index) });
      }
      const selectedUnion = draft?.type === 'assign' ? draft.fields?.unionWorker : undefined;
      const unionWorker = assignmentUnionWorkers(moves).some(worker => worker.id === selectedUnion) ? selectedUnion : '';
      draft = moves.length || unionWorker ? { type: 'assign', moves, fields: { unionWorker } } : null;
      break;
    }
    case 'sector': startBuild(source.id); break;
    case 'build-slot': draft.staff[Number(target.id)] = source.id; break;
    case 'buy': {
      const [seller, resource] = source.id.split(':');
      if (purchaseDraft?.resource !== resource && purchaseDraft?.lines.some(line => line.seller)) {
        warning('一次只能買一種商品或服務。請先在表單切換商品。');
        return;
      }
      const previous = purchaseDraft?.resource === resource ? purchaseDraft.lines : [];
      const lines = [0, 1].map(index => ({ ...previous[index] }));
      const current = lines.findIndex(line => line.seller === seller);
      const slot = current < 0 ? lines.findIndex(line => !line.seller) : current;
      if (slot < 0) {
        message('已選兩個來源，可在購買欄位中調整。');
        return;
      }
      lines[slot] = { seller, quantity: Math.min(purchaseLimit(resource, seller), current < 0 ? 1 : lines[slot].quantity + 1) };
      purchaseDraft = { resource, lines };
      message();
      announceBoard('已填入購買欄位，可直接調整來源與數量。');
      render();
      app.querySelector('[data-purchase-panel]')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    case 'deal': draft = { type: 'deal', fields: { dealId: source.id, destination: target.id } }; break;
    case 'campaign': case 'bid': {
      const limit = target.type === 'bid' ? state.players[state.role].influence : Math.min(3, state.publicServices.influence);
      const amount = draft?.type === target.type ? Number(draft.fields.amount) : 0;
      draft = { type: target.type, fields: { amount: Math.min(limit, amount + 1) } };
      break;
    }
    case 'market': case 'export': {
      const picks = draft?.type === target.type ? draft.picks : [];
      draft = { type: target.type, picks: [...new Set([...picks, source.id])] };
      break;
    }
  }
  announceBoard(draft?.type === 'assign' ? `已排入 ${draft.moves.length} 個工人，請按「確認指派」送出。`
    : draft?.type === 'build' ? `已安排 ${draft.staff.filter(Boolean).length} 名工人，可繼續拖放、確認或取消建造。`
      : '已填入行動選擇，請在操作區確認。');
  render();
  if (target.type !== 'build-slot' && !['assign', 'market'].includes(draft?.type)) document.querySelector('.action-draft')?.scrollIntoView({ block: 'nearest' });
}

function fillDraft() {
  const purchase = app.querySelector('[data-command="buy"]');
  if (purchase) {
    purchase.elements.namedItem('resource').value = purchaseDraft?.resource ?? 'food';
    for (const [index, line] of (purchaseDraft?.lines ?? []).entries()) {
      const seller = purchase.elements.namedItem(`seller${index}`);
      if ([...seller.options].some(option => option.value === line.seller)) seller.value = line.seller;
    }
  }
  if (!draft) return;
  const form = app.querySelector(`[data-command="${draft.type}"]`);
  if (!form) return;
  if (form.closest('details')) form.closest('details').open = true;
  form.classList.add('action-draft');
  for (const [key, value] of Object.entries(draft.fields ?? {})) {
    if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value;
  }
  for (const [index, worker] of (draft.staff ?? []).entries()) form.elements.namedItem(`staff-${index}`).value = worker ?? '';
  if (draft.type === 'assign') {
    const rows = draft.rows ?? draft.moves.map(move => [move.worker, `${move.company}:${move.slot}`]);
    for (const [index, [worker, slot]] of rows.entries()) {
      form.elements.namedItem(`worker${index}`).value = worker;
      form.elements.namedItem(`slot${index}`).value = slot;
    }
  }
  if (draft.picks) for (const input of form.querySelectorAll('input[type="checkbox"]')) {
    if (draft.picks.includes(input.value)) input.checked = true;
  }
}

const pieceControls = attachPieces(app, acceptsPiece, placePiece, announceBoard);

let tipAnchor;

function hideTip() {
  tipAnchor?.removeAttribute('aria-describedby');
  tipAnchor = null;
  tooltip.hidden = true;
}

function positionTip() {
  if (!tipAnchor?.isConnected) return hideTip();
  const bounds = tipAnchor.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > window.innerHeight) return hideTip();
  const { offsetWidth: width, offsetHeight: height } = tooltip;
  const left = Math.max(8, Math.min(bounds.left + (bounds.width - width) / 2, window.innerWidth - width - 8));
  const top = bounds.bottom + height + 16 <= window.innerHeight ? bounds.bottom + 8 : Math.max(8, bounds.top - height - 8);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function appendCardTipRow(list, label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  row.append(term, description);
  list.append(row);
}

function renderCardTip(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  const title = document.createElement('strong');
  title.textContent = data.name;
  tooltip.append(title);
  if (data.nameEn) {
    const english = document.createElement('span');
    english.className = 'catalog-english';
    english.textContent = data.nameEn;
    tooltip.append(english);
  }
  const details = document.createElement('dl');
  details.className = 'catalog-details';
  appendCardTipRow(details, '效果', data.effect);
  appendCardTipRow(details, '政策條件', data.policy);
  appendCardTipRow(details, '國家合法性變化', data.legitimacy);
  tooltip.append(details);
  if (data.detail) {
    const section = document.createElement('section');
    section.className = 'catalog-action-detail';
    const heading = document.createElement('h4');
    heading.textContent = '詳細說明';
    const body = document.createElement('p');
    body.textContent = data.detail;
    section.append(heading, body);
    tooltip.append(section);
  }
  tooltip.classList.add('card-tip');
  return true;
}

function renderTextTip(anchor) {
  tooltip.classList.remove('card-tip');
  const title = document.createElement('strong');
  renderHelpText(title, anchor.dataset.tipTitle);
  tooltip.append(title);
  const body = document.createElement('p');
  renderHelpText(body, anchor.dataset.tipBody);
  if (anchor.dataset.tipFooter) {
    const footer = document.createElement('span');
    footer.className = 'board-tooltip-footer';
    renderHelpText(footer, anchor.dataset.tipFooter);
    body.append(footer);
  }
  tooltip.append(body);
  return true;
}

function showTip(anchor) {
  if (!anchor || app.classList.contains('dragging')) return hideTip();
  if (tipAnchor === anchor) return;
  hideTip();
  tipAnchor = anchor;
  tooltip.replaceChildren();
  const rendered = anchor.dataset.tipCard ? renderCardTip(anchor.dataset.tipCard) : renderTextTip(anchor);
  if (!rendered) return hideTip();
  anchor.setAttribute('aria-describedby', tooltip.id);
  tooltip.hidden = false;
  positionTip();
}

const tipFor = target => target instanceof Element ? target.closest('[data-tip-title], [data-tip-card]') : null;
app.addEventListener('pointerover', event => {
  if (event.pointerType !== 'touch') showTip(tipFor(event.target));
});
app.addEventListener('pointerout', event => {
  if (event.pointerType !== 'touch' && !app.contains(event.relatedTarget)) hideTip();
});
app.addEventListener('pointerdown', hideTip);
app.addEventListener('focusin', event => showTip(tipFor(event.target)));
app.addEventListener('focusout', hideTip);
window.addEventListener('scroll', () => { if (tipAnchor) positionTip(); }, { capture: true, passive: true });
window.addEventListener('resize', () => { if (tipAnchor) positionTip(); });
window.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  hideTip();
});

function waitingRoom() {
  const { players } = state.waiting;
  const self = players.find(player => player.id === state.role);
  const canStart = meta.roles.every(role => players.some(player => player.role === role));
  const seats = meta.roles.map(role => {
    const selected = players.filter(player => player.role === role);
    const locked = selected.length === 1 && selected[0].ready;
    return `<div class="seat ${role}${selected.length > 1 ? ' seat-conflict' : ''}${locked ? ' seat-locked' : ''}">
      <strong>${escape(meta.names[role])}</strong>
      <p>${selected.map(player => escape(player.name)).join('、') || '未選擇'}</p>
      ${selected.length > 1 ? '<small>階級重複</small>' : ''}
      ${locked ? '<svg class="seat-lock" viewBox="0 0 16 16" role="img" aria-label="已確認" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7M8 9.5v2"/></svg>' : ''}
    </div>`;
  }).join('');
  return `<div class="lobby"><section class="panel"><h1>${state.testMode ? '測試房等待區' : '等待區'}</h1>
    <p>已加入 ${players.length} / 4 人 · ${players.map(player =>
      `${escape(player.name)}${player.id === state.role ? '（你）' : ''}${player.ready ? ' ✓' : ''}`).join('、')}</p>
    <div class="waiting-seats">${seats}</div>
    <label>選擇階級<select data-waiting-role ${self.ready ? 'disabled' : ''}>
      <option value="">請選擇</option>${meta.roles.map(role =>
      `<option value="${role}" ${role === self.role ? 'selected' : ''}>${escape(meta.names[role])}</option>`).join('')}
    </select></label>
    ${state.waiting.skillSelection && self.role === 'middle' ? `<label>開局技術工技能<select data-waiting-skill ${self.ready ? 'disabled' : ''}>
      <option value="">請選擇</option>${skillOptions(products).map(([skill, label, color]) =>
        `<option value="${skill}" style="color:${color}" ${self.skill === skill ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>` : ''}
    <form data-waiting-confirm>
      ${self.ready ? '<p role="status">等待其他玩家確認</p>' : ''}
      <button class="primary" ${!self.ready && (!canStart || (state.waiting.skillSelection && self.role === 'middle' && !self.skill)) ? 'disabled' : ''}>${self.ready ? '取消' : '開始'}</button>
    </form>
  </section></div>`;
}

const turnsPerSeat = 5;
const roomTurnNumber = turn => Math.min(turnsPerSeat, Math.floor(turn / meta.roles.length) + 1);

function render() {
  updateHeaderAccountName();
  cardBuildStaff = [];
  hideTip();
  pieceControls.cancel();
  headerRoomCode.textContent = state.code;
  headerRoomCode.hidden = false;
  headerRoomActions.hidden = false;
  returnLobby.hidden = !account;
  closeRoom.hidden = state.role !== state.host;
  adjustGameButton.hidden = !state.testMode || state.role !== state.host || state.phase !== 'action' || Boolean(state.transaction);
  saveRoomButton.hidden = loadRoomButton.hidden = closeRoom.hidden;
  copyInvite.hidden = state.phase !== 'lobby';
  copyInvite.textContent = '複製邀請連結';
  if (state.phase === 'lobby') {
    if (state.waiting) {
      app.innerHTML = waitingRoom();
      return;
    }
    const ready = meta.roles.every(role => state.seats[role]);
    app.innerHTML = `<div class="lobby"><section class="panel"><h1>等待四個角色入座</h1><div class="two">${seatCards()}</div>
      <p class="muted">上方為本房的起始分配。四席都就緒後由房主開始。</p>
      ${state.role === 'middle' && state.content ? form('start-skill', '儲存開局技術工技能',
        selectField('skill', '技能（請依中產市場企業選擇）', skillOptions(products))) : ''}
      ${state.host === state.role && ready ? form('start', state.content ? '開始五輪對局' : '開始試玩') : ''}</section></div>`;
    return;
  }
  const card = state.hand.find(item => item.id === selectedCard) ?? state.hand[0];
  selectedCard = card?.id;
  const turn = roomTurnNumber(state.turn);
  const actingRoles = meta.roles.map(role =>
    `<span class="turn-role ${role}"${role === state.currentRole ? ' aria-current="true"' : ''}>${escape(meta.names[role])}</span>`
  ).join('<span aria-hidden="true">．</span>');
  app.innerHTML = `<div class="table-layout">
    <div class="column table-column" id="tabletop">
      <div class="statusbar">
        <strong class="turn-summary">第 ${state.match?.round ?? 1} / 5 輪．第 ${turn} / ${turnsPerSeat} 回合．<span class="turn-roles">行動階級 - ${actingRoles}</span></strong>
        ${phaseProgress()}
      </div>
      ${tableBoard()}${productionPanel()}${roundHistory()}
    </div>
    <aside class="column action-desk" id="action-desk">${handBoard(card)}
      ${transferTargets()}<div id="action-controls" class="column">
        <p id="board-feedback" role="status">${escape(boardStatus)}</p>
        ${draft && draft.type !== 'build' ? `<button type="button" data-clear-draft>${draft.type === 'assign' ? '取消指派' : '清除待確認選擇'}</button>` : ''}
        ${actionPanel(card)}
      </div>
      <div id="player-boards">${playerDiagram(state, state.role, meta, well, resources, escape, assignmentUnionWorkers())}${playerInfoTabs()}</div>
    </aside>
  </div>`;
  fillDraft();
  if (!syncVoteResultDialog()) {
    syncElectionDialog();
    syncRoundResultDialog();
  }
  app.querySelectorAll('select[data-colored-options]').forEach(syncSelectColor);
  const food = app.querySelector('[data-command="food"]');
  if (food) updateFoodEstimate(food);
  for (const form of app.querySelectorAll('[data-command]')) scheduleActionCheck(form);
  if (cardPilesDialog.open) renderCardPiles();
}

function wasRestored(next) {
  return state?.code === next.code && next.restoredRevision > (state.restoredRevision ?? 0);
}

let lastConnectionMarkup;
function showConnection(next) {
  if (!next.presence) return;
  const players = next.waiting?.players ?? meta.roles.flatMap(role => {
    const name = next.seats[role];
    return name ? [{ id: role, role, name }] : [];
  });
  const statuses = players.map(({ id, role, name }) => {
    const online = next.presence[id];
    const classLabel = headerClassLabel(role) || '未選階級-';
    return `<span title="${online ? '在線' : '離線'}">${classLabel}<span class="connection-player${online ? ' is-online' : ''}">${escape(name)}</span>${id === next.host ? ' (房長)' : ''}</span>`;
  });
  const markup = statuses.join(' · ');
  if (connection.firstElementChild && lastConnectionMarkup === markup) return;
  connection.innerHTML = markup;
  lastConnectionMarkup = markup;
}

function update(next) {
  showConnection(next);
  if (!state || next.code !== state.code || next.revision > state.revision) {
    const restored = wasRestored(next);
    if (restored) {
      selectedCard = null;
      pendingBody = undefined;
      boardStatus = '';
      electionPrompt = '';
      pendingVoteDialogId = undefined;
      actionConfirmation.returnValue = '';
      for (const dialog of [actionConfirmation, electionDialog, voteResultDialog, roundResultDialog, roomSavesDialog, hostAdjustDialog]) if (dialog.open) dialog.close();
    }
    if (state && (restored || state.code !== next.code || state.turn !== next.turn || state.match?.round !== next.match?.round)) {
      selectedAction = null;
      selectedFreeAction = '';
      draft = null;
      purchaseDraft = null;
    }
    state = next;
    render();
  }
}

function confirmAction({ kind, changes }, label) {
  const action = kind === 'main' ? '主要行動' : '免費行動';
  actionConfirmation.querySelector('h2').textContent = `確認${action}${label ? ` · ${label}` : ''}`;
  actionConfirmation.querySelector('[data-action-changes]').replaceChildren(...changes.map(change => {
    const line = document.createElement('li');
    line.textContent = change;
    return line;
  }));
  actionConfirmation.returnValue = '';
  return new Promise(resolve => {
    actionConfirmation.addEventListener('close', () => resolve(actionConfirmation.returnValue === 'confirm'), { once: true });
    actionConfirmation.showModal();
  });
}

function leaveRoom(code) {
  delete seatRooms[code];
  sessionStorage.setItem(seatRoomsKey, JSON.stringify(seatRooms));
  sessionStorage.removeItem(storageKey);
  seat = null;
  state = undefined;
  connection.textContent = '';
  headerRoomCode.hidden = true;
  showLobby();
  if (accountToken) loadPlayerRooms().then(() => {
    if (!seat && account) showLobby();
  }).catch(error => {
    if (!seat && error.status === 401) {
      forgetPlayerAccount();
      showLobby();
    }
  });
}

let refreshingSeat;
async function refresh() {
  if (!seat || refreshingSeat === seat) return;
  const currentSeat = seat;
  refreshingSeat = currentSeat;
  try {
    const next = await request(`/api/rooms/${currentSeat.code}`, undefined, { presence: true, signal: AbortSignal.timeout(5000) });
    if (seat !== currentSeat || (state?.code === next.code && next.revision < state.revision)) return;
    if (!pieceControls.active() && (!busy || wasRestored(next))) update(next);
    else showConnection(next);
  } catch (error) {
    if (seat !== currentSeat) return;
    connection.textContent = '連線中斷 · 重試中';
    if ([401, 404].includes(error.status)) {
      leaveRoom(currentSeat.code);
      warning(error.message);
    }
  } finally {
    if (refreshingSeat === currentSeat) refreshingSeat = undefined;
  }
}

function actionFields(fields, prefix = '') {
  const input = {};
  for (const key of ['amount', 'quantity', 'wage']) if (fields.has(prefix + key)) input[key] = Number(fields.get(prefix + key));
  for (const key of ['side', 'resource', 'recipient', 'company', 'sourceCompany', 'operator', 'hire', 'skill', 'replacement', 'worker', 'unionWorker', 'eventId', 'dealId', 'destination', 'option', 'replaced']) {
    if (fields.get(prefix + key)) input[key] = fields.get(prefix + key);
  }
  const second = fields.get(prefix + 'operator2');
  if (second) input.operators = [input.operator, second].filter(Boolean);
  const staff = [...fields].filter(([name]) => name.startsWith(prefix + 'card-staff-')).map(([, value]) => value || null);
  if (staff.length) input.staff = staff;
  for (const key of ['recipients', 'workers', 'companies']) input[key] = fields.getAll(prefix + key);
  input.distribution = Object.fromEntries([...fields].filter(([key]) => key.startsWith(prefix + 'dist-'))
    .map(([key, value]) => [key.slice(prefix.length + 5), Number(value)]));
  return input;
}

function readCommand(form, fields) {
  const input = { type: form.dataset.command, revision: state.revision };
  if (input.type === 'bid') input.electionId = state.election.id;
  if (input.type === 'confirm-vote') input.electionId = state.lastVote.id;
  if (selectedCard) input.cardId = selectedCard;
  Object.assign(input, actionFields(fields));
  if (input.type === 'build' && pendingBuild()) input.staff = draft.staff;
  if (input.type === 'buy') {
    const { resource, lines } = readPurchase(fields);
    const sources = lines.filter(line => line.seller);
    if (!sources.length) throw new Error('請至少選一個購買來源。');
    if (new Set(sources.map(line => line.seller)).size !== sources.length) throw new Error('兩個來源須不同。');
    input.resource = resource;
    input.distribution = Object.fromEntries(sources.map(line => [line.seller, line.quantity]));
  }
  input.immediate = fields.has('immediate') || fields.get('vote-timing') === 'now';
  input.indices = fields.getAll('indices').map(Number);
  input.fromDeck = fields.get('source') === 'deck';
  if (fields.has('bill')) {
    const [policy, target] = fields.get('bill').split(':');
    Object.assign(input, { policy: Number(policy), target });
  }
  if (fields.has('bill0')) input.proposals = ['bill0', 'bill1'].map((key, index) => {
    const [policy, target] = fields.get(key).split(':');
    return { policy: Number(policy), target, immediate: fields.has(`immediate${index}`) };
  });
  if (fields.has('build0-company')) input.builds = ['build0-', 'build1-'].map(prefix => actionFields(fields, prefix));
  if (fields.has('event0-eventId')) input.events = ['event0-', 'event1-'].map(prefix => actionFields(fields, prefix));
  if (fields.has('worker0')) {
    input.moves = [...fields.keys()].filter(key => /^worker\d+$/.test(key)).flatMap(key => {
      const index = key.slice(6);
      const worker = fields.get(`worker${index}`);
      const target = fields.get(`slot${index}`);
      if (!worker && !target) return [];
      if (!worker || !target) throw new Error('請為每一列同時選擇工人與工位。');
      if (target === 'unemployed') return [{ worker, company: null }];
      const [company, slot] = target.split(':');
      return [{ worker, company, slot: Number(slot) }];
    });
  }
  if (['wages', 'policy-choice'].includes(input.type)) {
    input.changes = [...fields].filter(([key, value]) => key.startsWith('wage-') && value)
      .map(([key, value]) => ({ company: key.slice(5), wage: Number(value) }));
  }
  if (['adjust-prices', 'policy-choice'].includes(input.type)) input.prices = Object.fromEntries([...fields].filter(([key, value]) => key.startsWith('price-') && value)
    .map(([key, value]) => [key.slice(6), Number(value)]));
  if (input.destination === 'split') input.allocation = Object.fromEntries([...fields]
    .filter(([key]) => key.startsWith('allocation-')).map(([key, value]) => [key.slice(11), Number(value)]));
  if (input.type === 'swap-workers') input.swaps = [...fields].filter(([key]) => key.startsWith('swap-employed-')).flatMap(([key, employed]) => {
    const idle = fields.get(`swap-idle-${key.slice(14)}`);
    if (!employed && !idle) return [];
    if (!employed || !idle) throw new Error('請為每列選擇兩名交換工人。');
    return [{ employed, idle }];
  });
  if (input.type === 'policy-choice' && fields.has('publicHire')) {
    [input.company, input.hire] = fields.get('publicHire').split(':');
    input.staff = fields.getAll('publicStaff');
  }
  if (input.type === 'demonstration-losses') input.losses = Object.fromEntries([...fields]
    .filter(([key]) => key.startsWith('loss-')).map(([key, value]) => [key.slice(5), Number(value)]));
  if (input.type === 'food') {
    input.quantities = Object.fromEntries([...fields].filter(([key]) => key.startsWith('food-'))
      .map(([key, value]) => [key.slice(5), Number(value)]));
    if (fields.has('personalFood')) input.personalFood = Number(fields.get('personalFood'));
  }
  if (input.type === 'swap-card') {
    input.handCardId = fields.get('handCardId');
    input.pileCardId = fields.get('pileCardId');
    input.pile = fields.get('pile');
  }
  input.offers = [...fields.getAll('offer').map(Number), ...[...fields].filter(([key]) => key.startsWith('export-'))
    .flatMap(([key, value]) => Array.from({ length: Number(value) }, () => Number(key.slice(7))))];
  return input;
}

const pendingChecks = new WeakMap();

function scheduleActionCheck(form) {
  if (!form?.isConnected || !meta.checkedCommands.includes(form.dataset.command)) return;
  const button = form.querySelector('button:not([type="button"])');
  let check = pendingChecks.get(form);
  if (!button || (!check && button.disabled)) return;
  if (!check) {
    const status = document.createElement('p');
    status.className = 'action-check';
    status.setAttribute('role', 'status');
    button.before(status);
    check = { status, sequence: 0 };
    pendingChecks.set(form, check);
  }
  const { status } = check;
  const report = (kind, text, blocked) => {
    status.dataset.check = kind;
    status.textContent = text;
    button.disabled = blocked;
  };
  let input;
  let invalid;
  try {
    if (!form.checkValidity()) throw new Error('請補齊選項，或調整超出範圍的數值。');
    input = readCommand(form, new FormData(form));
  } catch (error) {
    invalid = error.message;
  }
  const key = input ? JSON.stringify(input) : null;
  // Numeric fields can emit both input and change for the same value when the submit button receives focus.
  if (key && key === check.key) return;
  check.key = key;
  clearTimeout(check.timer);
  const sequence = ++check.sequence;
  if (!input) {
    report('invalid', invalid, true);
    return;
  }
  report('checking', '正在檢查行動條件…', true);
  const current = () => form.isConnected && sequence === check.sequence;
  check.timer = setTimeout(async () => {
    if (!current()) return;
    try {
      await request(`/api/rooms/${seat.code}/check`, input);
      if (current()) report('valid', '條件符合，可送出。', false);
    } catch (error) {
      if (!current()) return;
      if (error.status === 400 || error.status === 403 || error.status === 409) report('invalid', error.message, true);
      else report('unavailable', '目前無法事前檢查，送出時會重新驗證。', false);
    }
  }, 180);
}

async function submitGameForm(event) {
  event.preventDefault();
  if (busy) return;
  const form = event.target;
  const fields = new FormData(form, event.submitter);
  busy = true;
  message();
  try {
    if (form.hasAttribute('data-player-login')) {
      const operation = fields.get('operation') === 'register' ? 'register' : 'login';
      const result = await request('/api/player/' + operation, { name: fields.get('name'), password: fields.get('password') }, { token: null });
      accountToken = result.token;
      sessionStorage.setItem(accountKey, accountToken);
      await loadPlayerRooms();
      const code = new URLSearchParams(location.search).get('room')?.toUpperCase();
      if (account.rooms.some(room => room.code === code)) await enterPlayerRoom(code);
      else showLobby();
      return;
    }
    if (form.hasAttribute('data-room')) {
      const code = String(fields.get('code') ?? '').trim().toUpperCase();
      if (code && !/^[A-F0-9]{8}$/.test(code)) {
        warning('房間代碼須為 8 碼，只能包含數字 0–9 和英文字母 A–F。', form.elements.code);
        return;
      }
      await enterPlayerRoom(code, fields.has('testMode'));
      return;
    }
    if (form.hasAttribute('data-waiting-confirm')) {
      const { players, selectionRevision } = state.waiting;
      const ready = players.find(player => player.id === state.role).ready;
      update(await request(`/api/rooms/${seat.code}/waiting`, { type: ready ? 'cancel' : 'ready', selectionRevision }));
      return;
    }
    const input = readCommand(form, fields);
    const singleAction = state.phase === 'action' && !state.transaction && meta.turnCommands.includes(input.type);
    if (singleAction) {
      if (!meta.actionConfirmation) throw new Error('目前伺服器仍是舊版，請重新啟動伺服器並重新整理頁面。');
      const summary = await request(`/api/rooms/${seat.code}/action-preview`, input);
      const menu = summary.kind === 'main' ? 'main-action' : 'free-action';
      const label = app.querySelector(`[name="${menu}"]`)?.selectedOptions[0]?.textContent;
      if (!await confirmAction(summary, label)) {
        if (cardBuildStaff.length && form.querySelector('[data-card-build]')) render();
        return;
      }
    }
    const body = JSON.stringify(input);
    if (body !== pendingBody) {
      pendingBody = body;
      pendingId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    const next = await request(`/api/rooms/${seat.code}/${singleAction ? 'action-confirm' : 'command'}`, { ...input, id: pendingId });
    draft = null;
    if (['buy', 'transaction-confirm'].includes(input.type)) purchaseDraft = null;
    if (input.type === 'transaction-cancel' && state.transaction?.kind === 'buy') {
      purchaseDraft = { resource: state.transaction.resource, lines: purchaseRows(state.transaction) };
      selectedAction = 'buy';
    }
    boardStatus = '';
    update(next);
    pendingBody = undefined;
  } catch (error) {
    if (form.hasAttribute('data-room') && error.status === 401) {
      forgetPlayerAccount();
      showLobby();
      warning(error.message);
    } else if (form.hasAttribute('data-room') && String(fields.get('code') ?? '').trim() && [404, 409].includes(error.status)) {
      warning(error.status === 404 ? '找不到這個房間，請確認房間代碼。' : error.message, form.elements.code);
    } else warning(error.message);
  } finally {
    busy = false;
  }
}

app.addEventListener('submit', submitGameForm);
app.addEventListener('invalid', event => {
  if (!event.target.closest('[data-player-login], [data-room]')) return;
  event.preventDefault();
  if (!warningDialog.open) warning(event.target.validationMessage, event.target);
}, true);
electionDialog.addEventListener('submit', submitGameForm);
electionDialog.querySelector('[data-close-election]').addEventListener('click', () => electionDialog.close());
cardPilesBody.addEventListener('click', event => {
  const button = event.target.closest('[data-pile-card]');
  if (button) selectPileCard(button);
});
cardPilesDialog.addEventListener('submit', event => {
  if (!event.target.matches('form[data-command]')) return;
  submitGameForm(event);
});
adjustGameButton.addEventListener('click', showHostAdjust);
hostAdjustTabs.addEventListener('click', event => {
  const tab = event.target.closest('[data-adjust-tab]');
  if (!tab || tab.dataset.adjustTab === adjustTab) return;
  adjustTab = tab.dataset.adjustTab;
  renderHostAdjust();
});
hostAdjustTabs.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = adjustTabs.indexOf(adjustTab);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? adjustTabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + adjustTabs.length) % adjustTabs.length;
  adjustTab = adjustTabs[next];
  renderHostAdjust();
  hostAdjustTabs.querySelector(`[data-adjust-tab="${adjustTab}"]`)?.focus();
});
hostAdjustDialog.querySelector('[data-close-adjust]').addEventListener('click', () => hostAdjustDialog.close());
hostAdjustDialog.querySelector('form[data-host-adjust]').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !state || state.role !== state.host) return;
  const input = hostAdjustCommand();
  busy = true;
  message();
  try {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    const next = await request(`/api/rooms/${state.code}/command`, { ...input, id, revision: state.revision });
    update(next);
    hostAdjustDialog.close();
    message('已套用房長調整。');
  } catch (error) {
    warning(error.message);
  } finally {
    busy = false;
  }
});
voteResultDialog.addEventListener('submit', submitGameForm);
voteResultDialog.addEventListener('cancel', event => {
  if (pendingVoteDialogId) event.preventDefault();
});

app.addEventListener('change', async event => {
  if (event.target.matches('[data-waiting-role], [data-waiting-skill]')) {
    if (busy || !state?.waiting) return;
    const select = event.target;
    busy = true;
    select.disabled = true;
    message();
    try {
      const input = select.hasAttribute('data-waiting-skill')
        ? { type: 'start-skill', skill: select.value } : { type: 'select', role: select.value || null };
      update(await request(`/api/rooms/${seat.code}/waiting`, input));
    } catch (error) {
      render();
      warning(error.message);
    } finally {
      busy = false;
    }
    return;
  }
  if (event.target.matches('select[data-colored-options]')) syncSelectColor(event.target);
  const { name, value, form: fields } = event.target;
  if (name === 'bill0' && fields?.querySelector('[data-second-bill]')) {
    const second = fields.querySelector('[data-second-bill]');
    const selected = fields.elements.namedItem('bill1').value;
    second.innerHTML = secondBillField(Number(value.split(':')[0]));
    const select = fields.elements.namedItem('bill1');
    if (Array.from(select.options).some(option => option.value === selected)) select.value = selected;
    syncSelectColor(select);
    return;
  }
  if (fields?.matches('[data-command="assign"]') && /^(?:worker\d+|slot\d+|unionWorker)$/.test(name)) {
    const rows = [0, 1, 2].map(index => [fields.elements.namedItem(`worker${index}`).value, fields.elements.namedItem(`slot${index}`).value]);
    const moves = rows.flatMap(([worker, destination]) => {
      if (!worker || !destination) return [];
      const [company, slot] = destination.split(':');
      return [{ worker, company, slot: Number(slot) }];
    });
    const union = fields.elements.namedItem('unionWorker')?.value;
    const unionWorker = assignmentUnionWorkers(moves).some(worker => worker.id === union) ? union : '';
    draft = rows.some(([worker, slot]) => worker || slot) || unionWorker
      ? { type: 'assign', moves, rows, fields: { unionWorker } } : null;
    render();
    app.querySelector(`[data-command="assign"] [name="${name}"]`)?.focus({ preventScroll: true });
    return;
  }
  const cardMoves = event.target.closest('[data-card-moves]');
  if (cardMoves) syncCardMoves(cardMoves);
  const nationalize = event.target.closest('[data-nationalize]');
  if (nationalize && name === 'company') syncNationalize(nationalize);
  const cardBuild = event.target.closest('[data-card-build]') ?? (['source', 'resource'].includes(name) && fields?.querySelector('[data-card-build]'));
  if (cardBuild && (['source', 'resource'].includes(name) || name.endsWith('company') || name.includes('card-staff-'))) {
    updateCardBuild(cardBuild, name);
    if (name === 'build0-company') {
      const second = fields.elements.namedItem('build1-company')?.closest('[data-card-build]');
      if (second) updateCardBuild(second, name);
    }
    filterRepeatedCardChoices(fields.querySelectorAll('select[name*="card-staff-"]:not(:disabled)'));
    previewCardBuild(fields);
    if (name.includes('card-staff-')) fields.elements.namedItem(name)?.focus({ preventScroll: true });
    scheduleActionCheck(fields);
  }
  if (name === 'resource') {
    const cardPurchase = event.target.closest('[data-card-purchase]');
    if (cardPurchase) updateCardPurchaseLimits(cardPurchase, true);
    if (event.target.closest('[data-card-import]')) updateQuantityMax(fields.elements.namedItem('quantity'), subsidizedImportLimit(value));
  }
  if (name === 'recipient' && event.target.closest('[data-card-tourism]')) {
    updateQuantityMax(fields.elements.namedItem('quantity'), tourismLimit(value));
  }
  if (name?.endsWith('recipient') && fields) {
    const prefix = name.slice(0, -'recipient'.length);
    const id = fields.elements.namedItem(prefix + 'eventId')?.value;
    const spec = state?.content?.events.find(item => item.id === id)?.form;
    if (spec?.kind === 'provide' && spec.resources.length === 2) {
      updateQuantityMax(fields.elements.namedItem(prefix + 'amount'), Math.max(0, spec.targetAmounts[value] - 1));
    }
  }
  if (name === 'dealId') {
    const goods = state.content.deals.find(deal => deal.id === value)?.goods;
    for (const resource of ['food', 'luxury']) updateQuantityMax(fields.elements.namedItem('allocation-' + resource), goods?.[resource] ?? 0);
  }
  if (event.target.name === 'free-action') {
    selectedFreeAction = event.target.value;
    const fields = app.querySelector('[data-free-action-fields]');
    fields.innerHTML = freeActions().find(([id]) => id === selectedFreeAction)?.[2] ?? '';
    scheduleActionCheck(fields.querySelector('form'));
    return;
  }
  if (event.target.name === 'main-action') {
    selectedAction = event.target.value;
    draft = null;
    purchaseDraft = null;
    boardStatus = '';
    message();
    render();
    app.querySelector('[name="main-action"]')?.focus({ preventScroll: true });
    return;
  }
  const education = event.target.closest('[data-command="use-education"]');
  const specialization = event.target.closest('[data-command="play"]')?.querySelector('[data-specialization-fields]');
  if (specialization && ['skill', 'replacement'].includes(event.target.name)) {
    const choices = new FormData(event.target.form);
    specialization.innerHTML = specializationFields(choices.get('skill'), choices.get('replacement'));
    const moves = specialization.querySelector('[data-card-moves]');
    for (const row of moves.children) {
      const [worker, slot] = row.querySelectorAll('select');
      const previousWorker = choices.get(worker.name);
      const previousSlot = choices.get(slot.name);
      if ([...worker.options].some(option => option.value === previousWorker)) {
        worker.value = previousWorker;
        if ([...slot.options].some(option => option.value === previousSlot)) slot.value = previousSlot;
      }
    }
    syncCardMoves(moves);
    return;
  }
  if (education && event.target.name === 'worker') {
    const skills = state.educationOptions.workers.find(worker => worker.id === event.target.value)?.skills ?? [];
    const skillSelect = education.elements.namedItem('skill');
    skillSelect.replaceChildren(new Option(skills.length ? '選擇新技能' : '先選擇工人', ''),
      ...skills.map(skill => {
        const option = new Option(industries[skill], skill);
        option.style.color = workerSkillColor(skill);
        return option;
      }));
    syncSelectColor(skillSelect);
    return;
  }
  if (event.target.closest('[data-command="build"]')) {
    const { name, value } = event.target;
    if (name === 'company') startBuild(value);
    else if (name === 'wage') {
      draft.fields.wage = value;
      return;
    } else if (name.startsWith('staff-')) draft.staff[Number(name.slice(6))] = value || null;
    render();
    app.querySelector(`[data-command="build"] [name="${name}"]`)?.focus({ preventScroll: true });
    return;
  }
  const purchase = event.target.closest('[data-command="buy"]');
  if (!purchase || !['resource', 'seller0', 'seller1'].includes(event.target.name)) return;
  purchaseDraft = readPurchase(new FormData(purchase));
  if (event.target.name === 'resource') purchaseDraft.lines = [];
  render();
  app.querySelector('[data-command="buy"]').elements.namedItem(event.target.name).focus({ preventScroll: true });
});

app.addEventListener('input', event => {
  const roomForm = event.target.closest('form[data-room]');
  if (roomForm && event.target.name === 'code') {
    roomForm.querySelector('[data-test-room]').hidden = Boolean(event.target.value.trim());
    roomForm.querySelector('button').textContent = event.target.value.trim() ? '加入房間' : '建立房間';
  }
  const cardPurchase = event.target.closest('[data-card-purchase="true"]');
  if (cardPurchase && event.target.name.startsWith('dist-')) updateCardPurchaseLimits(cardPurchase, false);
  const food = event.target.closest('[data-command="food"]');
  if (food) {
    const { name, valueAsNumber } = event.target;
    if (['personalFood', 'warehouseFood'].includes(name) && event.target.validity.valid) {
      const other = food.elements.namedItem(name === 'personalFood' ? 'warehouseFood' : 'personalFood');
      other.value = state.match.needs.own - valueAsNumber;
    }
    updateFoodEstimate(food);
  }
  const purchase = event.target.closest('[data-command="buy"]');
  if (purchase && ['quantity0', 'quantity1'].includes(event.target.name)) purchaseDraft = readPurchase(new FormData(purchase));
});

for (const type of ['input', 'change']) app.addEventListener(type, event => scheduleActionCheck(event.target.closest('form[data-command]')));

app.addEventListener('keydown', event => {
  const tab = event.target.closest('[data-board-tab]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...tab.parentElement.querySelectorAll('[data-board-tab]')];
  const index = tabs.indexOf(tab);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  openBoardTab(tabs[next].dataset.boardTab);
});

app.addEventListener('click', async event => {
  const resume = event.target.closest('[data-resume-room]');
  if (resume) {
    if (busy) return;
    message();
    busy = true;
    try {
      await enterPlayerRoom(resume.dataset.resumeRoom);
    } catch (error) {
      if (error.status === 401) forgetPlayerAccount();
      else if (error.status === 404 && account) account.rooms = account.rooms.filter(room => room.code !== resume.dataset.resumeRoom);
      showLobby();
      warning(error.message);
    } finally {
      busy = false;
    }
    return;
  }
  if (event.target.closest('[data-open-round-result]')) {
    const row = state.match?.history.at(-1);
    if (row) showRoundResult(row);
    return;
  }
  const matHelp = event.target.closest('[data-mat-help]');
  if (matHelp) {
    openMatHelp(matHelp.dataset.matHelp, matHelp.dataset.description);
    return;
  }
  if (event.target.closest('[data-card-piles]')) {
    showCardPiles();
    return;
  }
  if (event.target.closest('[data-open-election]')) {
    if (!electionDialog.open) electionDialog.showModal();
    return;
  }
  const tab = event.target.closest('[data-board-tab]');
  if (tab) {
    openBoardTab(tab.dataset.boardTab);
    return;
  }
  const card = event.target.closest('[data-card]');
  if (card && selectedCard !== card.dataset.card) {
    selectedCard = card.dataset.card;
    render();
    app.querySelector('[data-card][aria-pressed="true"]')?.focus({ preventScroll: true });
    return;
  }
  if (event.target.closest('[data-cancel-card-build]')) {
    render();
    return;
  }
  if (event.target.closest('[data-clear-draft]')) {
    draft = null;
    boardStatus = '';
    message();
    render();
    return;
  }
});

copyInvite.addEventListener('click', async () => {
  const url = new URL(`/?room=${state.code}`, location.href).href;
  try {
    await navigator.clipboard.writeText(url);
    copyInvite.textContent = '已複製';
  } catch {
    message(url);
  }
});

function roomSaveDate(createdAt) {
  const date = new Date(createdAt);
  return date.toLocaleDateString('sv-SE') + ' - ' + date.toLocaleTimeString('zh-TW', { hour12: false });
}

saveRoomButton.addEventListener('click', async () => {
  if (busy || !state || state.role !== state.host) return;
  const { code, revision } = state;
  if (!window.confirm(`確定儲存房間 ${code} 的目前進度？`)) return;
  busy = true;
  try {
    const saved = await request(`/api/rooms/${code}/saves`, { revision });
    message(`已儲存房間進度（${roomSaveDate(saved.createdAt)}）。`);
  } catch (error) {
    warning(error.message);
  } finally {
    busy = false;
  }
});

loadRoomButton.addEventListener('click', async () => {
  if (busy || !state || state.role !== state.host || roomSavesDialog.open) return;
  const { code, revision } = state;
  busy = true;
  try {
    const { saves } = await request(`/api/rooms/${code}/saves`);
    if (state?.code !== code) return;
    if (!saves.length) return warning('這個房間還沒有存檔。');
    const select = roomSavesDialog.querySelector('select');
    select.replaceChildren(...saves.map(({ id, createdAt, round, turn, phase }) => {
      const role = phase === 'action' ? meta.roles[turn % meta.roles.length] : null;
      const progress = phase === 'lobby' ? '等待區' : `第 ${round ?? 1} 輪 · 第 ${roomTurnNumber(turn)} 回合 · 行動階級 ${meta.names[role] ?? "無"}`;
      return new Option(`${roomSaveDate(createdAt)} · ${progress}`, id);
    }));
    roomSavesDialog.returnValue = '';
    roomSavesDialog.addEventListener('close', () => {
      if (roomSavesDialog.returnValue === 'load') restoreRoomSave(code, revision, select.value);
    }, { once: true });
    roomSavesDialog.showModal();
  } catch (error) {
    warning(error.message);
  } finally {
    busy = false;
  }
});

async function restoreRoomSave(code, revision, id) {
  if (busy || state?.code !== code || state.role !== state.host) return;
  busy = true;
  message();
  try {
    update(await request(`/api/rooms/${code}/restore`, { revision, id }));
    message('已讀取房間存檔。');
  } catch (error) {
    warning(error.message);
  } finally {
    busy = false;
  }
}

document.querySelector('#player-logout').addEventListener('click', () => {
  if (busy) return;
  forgetPlayerAccount();
  for (const code of Object.keys(seatRooms)) delete seatRooms[code];
  history.replaceState(null, '', location.pathname);
  leaveRoom(seat?.code);
  message();
});

returnLobby.addEventListener('click', () => {
  if (busy || !seat) return;
  history.replaceState(null, '', location.pathname);
  leaveRoom(seat.code);
});

closeRoom.addEventListener('click', async () => {
  if (busy || !state || state.role !== state.host) return;
  const { code } = state;
  if (!window.confirm(`確定關閉房間 ${code}？所有席位將離開，對局紀錄也會刪除。`)) return;
  busy = true;
  try {
    await request(`/api/rooms/${code}`, undefined, { method: 'DELETE' });
    history.replaceState(null, '', location.pathname);
    leaveRoom(code);
    message(`已關閉房間 ${code}。`);
  } catch (error) {
    warning(error.message);
  } finally {
    busy = false;
  }
});

try {
  meta = await request('/api/meta');
  if (accountToken) {
    try { await loadPlayerRooms(); }
    catch (error) {
      if (error.status !== 401) throw error;
      forgetPlayerAccount();
    }
  }
  showLobby();
  if (!seat && account?.rooms.some(room => room.code === invite)) await enterPlayerRoom(invite);
  else await refresh();
  setInterval(refresh, 1200);
} catch (error) {
  warning(error.message);
}

