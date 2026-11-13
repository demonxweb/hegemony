# 官方 v1.2 規則比對：目前引擎問題清單

初次比對：2026-11-12。複核及修正：2026-11-13。
規則來源：[Hegemony-English-Rulebook-v1.2.pdf](https://hegemonicproject.com/wp-content/uploads/2023/04/Hegemony-English-Rulebook-v1.2.pdf)（40 頁）
比對範圍：四人基本遊戲、`packages/engine` 目前實作
狀態用語：`待修` = 已確認與官方規則不符；`待確認` = 規則解讀或邊界情況仍需裁決；`已知缺口` = 已在 [DATA-GAPS.md](DATA-GAPS.md) 記錄的未解項目。

## 2026-11-13 複核結果

- **§1、§7.11 數量**：必須完成至少 1 份的支出、出售與出口，前端最小值為 1；無庫存時顯示原因。可分配給多個階級的事件，各欄可為 0，總量須符合事件。額外出售、另購等可選部分仍可為 0。
- **§2 中產開局**：四人等待區會向選了中產的玩家顯示三張起始企業及工位，玩家選技能後才可確認。開局套用所選技能。
- **§4、§7.5 競爭薪資**：前端只提供全空且有相容來源的目標，並依目標更新來源。引擎驗證工位匹配，整組移出使公營來源停業時清除其罷工。已承諾工人能否被這張牌調動，仍待卡牌裁決；暫沿用一般承諾限制。
- **§7.1 借貸**：其他玩家使國家強制付款時仍可借貸，例如小企業補助和圍標。國家主動提供現金、購貨提供福利或執行事件，須在現有財力內完成。國家自己發動公營企業加班時須付得起薪資；他人打出要求國家加班的牌時屬強制付款。
- **§7.4 國有化**：可略過指派；若指派，允許從待業區及其他企業調動未承諾工人，最多 3 人且必須補滿必要工位。1B 國家強制付款仍可借貸。
- **§7.6 機會之地**：可選供應區新工人要填入的必要工位，引擎以該工位技能判定供應與建造；建造失敗不消耗工人。
- **§7.7 海外招募**：一般資本家企業可由全勞工或全中產任職。依一般階級規則與卡面要求的相符工人，招募可選其中一個階級，且須和既有工人同階級；只補必要空位。
- **§7.12 雙提案**：第一案立即表決時，可延後選第二案；四席確認第一案結果及完成衍生政策調整後，依新局面列出不同議題。各案即時表決各花 1 影響力。職場事故按卡面向一名其他玩家收款；退場策略沿用出售企業的承諾限制。
- **待裁決**：公營擴張是否一律視為示威規則的建造，以及限制言論的媒體影響力是否直接轉成個人影響力，維持現行處理。§6 的通用前提驗證是結構改善，現行各效果各自驗證。

下文保留初次審查的問題描述，現況以本節複核結果為準。

## 摘要

| 嚴重度 | 項目 | 狀態 |
| --- | --- | --- |
| 高 | 事件可用 0 資源／0 分配結算，等於免費清掉事件 | 已修（已補測試） |
| 高 | 中產開局技術工固定為農業，玩家不能依市場選擇 | 已修（已補測試） |
| 中 | 公營企業擴張自動雇用時，不會清除已生效的示威 | 已修（已補測試） |
| 中低 | 罷工企業變成停業時，罷工標記沒有立即移除 | 已修（已補測試） |
| 低 | 生產供給上限未計入國家福利區貨物與勞工食物 | 已修（已補測試） |
| 低 | 事件卡的非政策前提沒有通用驗證 | 改善建議 |
| 高 | 國家因卡牌效果付款未強制借貸 | 已修（已補測試） |
| 中 | 中產「就業補貼」未套用 Extra Shift 規則 | 已修（已補測試） |
| 中 | 「購買私人島嶼」可用營收支付 | 已修（已補測試） |
| 中 | 國有化 1B 付款未強制借貸、指派工人未套用正常規則 | 已修（已補測試） |
| 中 | 「競爭薪資」會覆蓋目標企業既有工人 | 已修（已補測試） |
| 中低 | 「機會之地」先加工人再建造 | 已修（已補測試） |
| 中低 | 「就業倡議」「外國招募」補人會覆蓋既有員工 | 已修（已補測試） |
| 中 | 勞工「專業化」中文資料方向錯誤 | 已修（資料） |
| 低 | 民意調查未公開揭示 5 枚方塊 | 已修（已補測試） |
| 中 | 「最多 N」可送 0 | 已修（已補測試） |
| 低 | 激進改革未拒絕即時投票 | 已修 |

> 手牌（行動卡）逐張審查的其餘問題見第 7 節。

---

## 1. 事件可用 0 資源／0 分配結算（高，已修）

### 現象

以下事件目前可以用「什麼都不做」的方式結算，事件仍會從場上移除：

- 「鄰國交戰」支出 0 醫療。
- 「發展中國家求援」支出 0 教育。
- 「政治醜聞」支付 $25，但分配 0 影響力。

### 位置

- `packages/engine/events.mjs:167`
  - `spend` 分支允許 `amount >= 0`。
- `packages/engine/events.mjs:215`
  - `distribute` 的影響力分支只檢查 `count <= max`，沒有要求 `count >= 1`。
- `apps/web/app.js` 的 `numberField` 預設 `min = 0`，前端也可送出 0。

### 規則依據

> “Some Events instruct you to Provide or Spend up to a certain amount. In all these cases you cannot choose to Provide or Spend nothing at all. You must actually Provide or Spend something in order to address the issue listed in the Event.”
>
> 規則書 p.38（抽取文字 1603–1607 行）

### 影響

玩家可以跳過事件任務，同時避開回合末「未處理事件」的合法性懲罰，等於免費清掉事件。這是規則漏洞，不只是數值偏差。

### 建議修法

- `spend` 改為要求 `amount >= 1`。
- `distribute` 的影響力分支要求 `count >= 1`。
- 補一個整合測試：三種「up to」事件以 0 結算時應被拒絕。

#### 修正

`events.mjs` 的 `spend` 與 `distribute` 已要求至少 1；前端數量欄位在最大值為 0 時不再渲染可確認表單，且有值時 `min = 1`（`public-overtime`／`speech` 等卡面明載 may 的效果維持 0 合法）。`tests/cards.test.mjs` 已補 0 數量拒絕測試。

---

## 2. 中產開局技術工固定為農業（高，已修）

### 現象

中產在開局時固定獲得一名 `food`（農業）技術工，玩家無法依已翻開的中產市場企業選擇技能；目前也沒有「開局選技能」流程。

### 位置

- `packages/engine/companies.mjs:130`

```js
addWorker(economy, role, role === 'working' ? 'any' : 'food');
```

- 對照：`market-skill` 僅處理第 2 輪以後的準備階段（`packages/engine/game.mjs:1119-1124`）。

### 規則依據

> “Place a Middle Class skilled Worker of your choice in the Unemployed Workers area (taking into account the Company cards in your Market) and then draw 2 Immigration cards.”
>
> 規則書 p.10（抽取文字 553–555 行）

### 影響

- 首輪中產無法依市場牌選擇可用技能。
- 可能出現市場企業都無法由該固定技能工人經營的情況，影響開局平衡與合法性。

### 建議修法

- 在 `start` 流程加入中產開局技能選擇，可沿用 `market-skill` 的指令與畫面機制。
- 建立經濟體時先翻開中產市場，再讓玩家選技能；或允許玩家在 `start` 指令中直接帶入技能。

#### 修正

`createEconomy` 現在記錄 `economy.startingMiddleSkill`；lobby 新增 `start-skill` 指令（限中產），前端在大廳提供技能表單。房主開始時套用 `content.startSkill`；未提交時預設 `food` 以維持既有測試與存檔相容。`tests/cards.test.mjs` 已補中產開局技能測試。

---

## 3. 公營企業擴張時不會清除已生效的示威（中，已修）

### 現象

財政政策改變導致公營企業擴張時，引擎會自動把待業勞工派入新開設的公營企業，但不會在自動雇用後檢查示威條件是否已不成立。示威標記會留到生產階段才結算。

### 位置

- `packages/engine/companies.mjs:390-417`（`resizePublicSector` 以 `commitHires` 直接進人）
- 對照：`checkDemonstration` 只在以下路徑被呼叫：
  - `companies.mjs:433`（`hirePublicCompany`）
  - `companies.mjs:534`（`build`）
  - `companies.mjs:593`（`makeFarm`）
- `packages/engine/companies.mjs:188-191`（`checkDemonstration` 本體）

### 規則依據

> “After anyone builds a new Company and assigns your Workers there, if the Demonstration condition is also no longer met (all three need to occur), the token is discarded and nothing further happens.”
>
> 規則書 p.15（抽取文字 910–912 行）

### 影響

若示威已生效，之後公營企業擴張並自動雇用勞工，使示威條件不再成立，理論上標記應立即丟棄；目前會留到生產階段，勞工可能因此多扣其他玩家 VP。

### 待確認

規則字面是「anyone builds a new Company」。公營企業擴張是否視為「建造新公司」需裁決：

- 若視為建造：應在 `resizePublicSector` 的自動雇用後對每間新公司呼叫 `checkDemonstration`。
- 若只限玩家主動建造：維持現狀，但建議在文件註明此邊界。

#### 修正

已採「視為建造」的解讀：`resizePublicSector` 自動雇用後會對新開設的公營企業呼叫 `checkDemonstration`，條件不再成立時立即移除示威標記。`tests/cards.test.mjs` 及完整測試已涵蓋此路徑。

---

## 4. 罷工企業變成停業時，罷工標記沒有立即移除（中低，已修）

### 現象

一家被罷工的公司若因工人被調走而變成非營運，`strike` 屬性仍留在物件上；若同回合內又被補滿工人，生產階段會再次判定罷工而跳過生產。

### 位置

- `packages/engine/companies.mjs:689`
  - 罷工標記只在生產結束時統一 `delete item.strike`。
- `packages/engine/companies.mjs:226-241`（`finishStaffing`）
  - 公司變成非營運時未清除 `strike`。

### 規則依據

> “Also, if a Company with a Strike token becomes non-operational (the Workers get assigned elsewhere), the Strike token is removed.”
>
> 規則書 p.16（抽取文字 898–899 行）

FAQ 亦確認：

> “Since the Company is no longer operational, nothing happens and the Strike token is just removed. Note that the Working Class does not gain Influence from that token.”
>
> 抽取文字 2060–2064 行

### 影響

停業後重新開工的公司可能被錯誤視為仍在罷工，少生產一次；罷工標記的實際存在時間也與規則不符。

### 建議修法

- 在 `finishStaffing` 偵測到 `!operational(item)` 且該公司不在本次指派目的地時，`delete item.strike`。
- 或在所有會使公司停業的路徑統一清除。

#### 修正

`finishStaffing` 在企業變成非營運時已同步 `delete item.strike`，避免同一回合重新開工被誤判仍罷工。

---

## 5. 生產供給上限未計入國家福利區與勞工食物（低，已修）

### 現象

- `produce()` 對 `owner === 'working'` 直接增加 `players.working.food`，沒有套用 62 食物上限。
- `held` 只加總 `publicServices`、`tradeZone`、各階級倉庫與玩家個人資源，沒有加 `game.content.benefits` 內等待領取的貨物。

### 位置

- `packages/engine/companies.mjs:596-616`
  - `companies.mjs:599-602`：勞工食物直接累加，未檢查供給。
  - `companies.mjs:611-615`：`held` 未計入 `game.content.benefits`。

### 規則依據

> “You are always limited to the components included in the game, with the exception of money which is considered to be unlimited. This means that if you happen to place all of your Voting cubes in the bag, you cannot place any more. Similarly, if no Influence is left, players cannot buy or gain any more.”
>
> 規則書 p.34（抽取文字 1992–2002 行）

實體上限：食物 62、奢侈品／醫療／教育各 64（見 `docs/rules-and-multiplayer-spec.zh-TW.txt` 元件表）。

### 影響

放在國家福利區的貨物仍是實體指示物，應佔用總量；目前會低估已流通數量，極端情況下可生產超過實體上限。勞工食物也完全沒有供給上限。

### 建議修法

- `held` 加入 `Object.values(game.content?.benefits ?? {}).reduce(...)` 的各資源數量。
- 勞工食物比照其他資源做供給上限檢查，或明確註記為已知簡化。

#### 修正

`produce()` 的 `held` 已計入 `game.content.benefits`，勞工食物也套用 62 份供給上限。

---

## 6. 事件卡的非政策前提沒有通用驗證（低，改善建議）

### 現象

`playCard` 目前只通用檢查 `policyAnyOf`；其他前提（例如「至少 3 個待決法案」「需有工會」「需有未承諾工人」「需有指定企業」）散落在各 effect 內，容易漏掉。

### 位置

- `packages/engine/game.mjs:844-847`
- 各 effect 內各自以 `requireRule` 補檢查。

### 建議

- 把每張行動卡的完整前提結構化，並在 `playCard` 統一驗證。
- 依 `docs/DATA-GAPS.md` 的 workflow，逐張從 `transcribed` 推進到 `verified`。
- 為每張卡的前提與效果各補一個回歸測試。

---

## 7. 手牌（行動卡）逐張審查

比對素材：官方 v1.2 規則書、官方 FAQ（抽取文字 2105–2285 行）、Ludex 卡面英文效果（`https://ludex.dev/hegemony/cards/`），以及 `data/hegemony-base-catalog.json` 的 `effectZh`。以下只列與卡面或 FAQ 不一致、或缺少必要防呆的項目；已核對正確者見文末。

### 7.1 國家因卡牌效果付款不會被迫借貸（高，已修）

#### 現象

多張卡要求「國家支付」，但引擎以非強制支出呼叫，國庫不足時直接報錯，而不是依規則讓國家借貸。

#### 位置

- `packages/engine/events.mjs:64-89` `provide()`：`cash` 與向其他玩家買資源都用 `pay(game, 'state', ...)`（`mandatory = false`）。
- `packages/engine/game.mjs:785-787` `employment-support`：`transfer('state', seat, 15)`。
- `game.mjs:823-828` `state-grants`：`provide(... 'cash', ...)`。
- `game.mjs:676` `grant-build` → `build(..., { payer: 'state' })`；`companies.mjs:516` `pay(... cost)` 非強制。
- `game.mjs:804-815` `allowance`／`provide-health`／`provide-education`。
- `game.mjs:642-658` 國家版 `income`。

#### 規則依據

Bid Rigging 卡面明載：

> “The State may take a Loan if it cannot afford the purchase, but its Storage still caps how much it can buy.”

FAQ 亦確認：卡牌要求國家支付而國庫不足時，國家應被迫借貸，而不是拒絕結算。

#### 影響

在國庫見底時，這些卡會直接判定為非法操作；玩家無法打出本應可透過借貸完成的卡牌。

#### 建議修法

把「國家因卡牌效果的必要支出」統一改為 `mandatory = true`；玩家自願購買（Buy Goods、Personal Consumption、Import Subsidy 等）維持非強制。

#### 修正

`events.mjs` `provide()` 的現金與購貨支出、`allowance`／`employment-support` 等轉帳、`grant-build` 的國家付款都已改為強制（`mandatoryPay`），國庫不足時依規則借貸。`tests/cards.test.mjs` 已補「國庫 0 時國家卡付款仍成功並產生貸款」測試。

### 7.2 中產「就業補貼」沒有套用 Extra Shift 規則（中，已修）

#### 現象

卡面：「The State gives you 5 for each of your Companies with a Working Class employee; you may then Extra Shift one of them.」

`game.mjs:719-728` 直接 `produceCompany(game, company)`，未檢查該企業中產工位是否仍有未承諾工人、未處理已承諾勞工員工（應不參與、不領薪、不給員工加成），且生產後把所有工位工人一律設為 `committed`。

#### 規則依據

> “Whenever a card effect instructs a player to perform an Action, unless otherwise noted, all the normal rules regarding that Action continue to apply.”

Extra Shift 規則見規則書 p.25：只能選有未承諾中產工人的企業、承諾所有工人後生產；若勞工員工已承諾，則不參與生產、不領薪、不給加成。

#### 建議修法

改用 `extraShift()` 的邏輯（或抽出共用函式），先驗證未承諾中產工人，再以 `operatorOnly` 生產並只承諾實際參與的工人。

#### 修正

已抽出 `extraShiftCompany()` 供基本行動 `extraShift` 與 `employment-subsidy` 共用：先驗證必要工位的中產工人未承諾，已承諾的勞工員工不參與生產、不領薪、不給加成，只承諾實際參與的工人。完整測試已涵蓋額外班次承諾行為。

### 7.3 「購買私人島嶼」可用營收支付（中，已修）

#### 現象

卡面：「Pay 50 from Capital to the State for 7.」

`game.mjs:924-928` 使用 `spend(game, role, 50, true)`；`spend` → `pay(..., capitalFirst = true)` 只是「先扣 Capital、不足再扣 Revenue」（`companies.mjs:309-315`），因此資本不足時可用 Revenue 支付。

#### 規則依據

FAQ 指出資本家支出預設先 Revenue、不足才 Capital，**除非卡面另有註明**；本卡正是另有註明。

#### 建議修法

要求 `player.capital >= 50` 並只扣 Capital，或新增「只用 Capital」的付款函式。

#### 修正

私人島嶼已改為只檢查並扣除 Capital，資本不足時直接拒絕，不再以 Revenue 補足。

### 7.4 國有化：1B 付款未強制借貸、指派工人未套用正常規則（中，已修）

#### 現象

卡面：「With 1B, pay its cost to the Capitalist Class. … you may assign Workers to it.」

`game.mjs:554-569`：

- `transfer('state', 'capitalist', item.cost)` 為非強制支出 → 國庫不足直接報錯。
- `command.hire` 只用 `hireUnemployed(economy, acquired.slots, command.hire)`：只從待業區補人、一次補滿所有工位、不能從其他企業調人、也不能只派 1–2 人。

#### 規則依據

FAQ：卡牌要求執行 Action 時，套用該 Action 的正常規則。Assign Workers 一次最多 3 人、可部分指派、可從其他企業調動未承諾工人。

#### 建議修法

付款改 `mandatory = true`；改用 `assign`（或前端提供最多 3 人的指派流程），允許部分指派。

#### 修正

1B 付款已改為強制（國庫不足自動借貸）。`command.staff` 改依工位索引傳入 worker id，套用 `assign` 的正常規則：最多 3 人、可部分指派，來源限待業區或公營企業未承諾工人；前端國家卡新增各工位的工人選單。企業仍須一次補滿必要工位（`assign` 的既有規則）。`tests/cards.test.mjs` 已補國有化貸款與跨企業指派測試。

### 7.5 「競爭薪資」會覆蓋目標企業既有工人（中，已修）

#### 現象

卡面：「Set one Company to L3, then move the Workers of an operational Public Company of the same industry and size into it.」

`game.mjs:751-763` 只要求目標企業 `operational(item) === false`，未要求目標工位全空；若目標已有部分工人，`target.slots[index].worker = slot.worker` 會覆蓋原工人，留下沒有企業參照的孤兒工人。

另外 `source.slots.every(...!committed)` 是卡面沒有的額外限制（是否允許調動已承諾公營工人仍待確認）。

#### 建議修法

要求目標企業所有工位皆空，或在移動前驗證空位數與來源工人數一致；並確認已承諾公營工人是否可被移動。

#### 修正

目標企業現在必須所有工位全空才能移入，避免覆蓋既有工人；`tests/cards.test.mjs` 已補拒絕非空目標的測試。來源公營工人須未承諾的限制仍保留，是否放寬待後續裁決。

### 7.6 「機會之地」先加工人再建造（中低，已修）

#### 現象

卡面：「Build a Company, using a skilled Middle Class Worker of your choice from the supply.」

`game.mjs:677-687` 先 `addWorker`，再 `build`。若建造因任何原因失敗（資金、企業上限、市場卡不符等），新增的待業工人不會回滾；此外固定把新工人放到第 0 個工位，多工位企業不一定符合玩家選擇。

#### 建議修法

先驗證建造合法性（或先建立企業），成功後再加入工人；讓玩家可指定放入哪個必要工位。

#### 修正

改用 `structuredClone` 建立預覽經濟體，先在預覽中加人並驗證 `build`，成功後才正式加入工人並建造；`command.slot` 可指定新工人放入的必要工位。`tests/cards.test.mjs` 已補建造失敗不留孤兒工人的測試。

### 7.7 「就業倡議」「外國招募」補人會覆蓋既有員工（中低，已修）

#### 現象

- `game.mjs:730-749` 的 `fill-unemployed`（資本家／國家的就業倡議）與 `recruit`（外國招募）呼叫 `hireUnemployed`；`companies.mjs:319-343` 會對「所有工位」補人，包含可選員工位，並要求可選位也被填滿。若該位已有員工，會被新工人覆蓋。
- `recruit` 允許 `recipient` 為 `middle`，但資本家企業的工人應全為勞工階級（同一企業工人須同階級）；目前可繞過 `assign` 的階級檢查直接把中產工人放進資本家企業。

#### 規則依據

就業倡議卡面是「fill one of your non-operational Companies with unemployed Workers」，可選員工位並非必要；外國招募要求「matching Workers from the supply」。

#### 建議修法

`hireUnemployed` 只補必要工位、保留既有工人；外國招募對資本家企業強制使用勞工階級。

#### 修正

新增 `fillRequiredHires()`：只補「非選用且目前空置」的必要工位，保留既有員工、不填選用員工位。`recruit` 對資本家企業強制以勞工階級招募。`tests/cards.test.mjs` 已補必要工位補人保留既有員工的測試。

### 7.8 勞工「專業化」中文資料方向錯誤（中，已修）

#### 現象

卡面：「Put a skilled Worker of your choice from the supply in Unemployed Workers, then assign up to 3 Workers.」

`data/hegemony-base-catalog.json` 的 `action-working-specialization.effectZh` 與 `data/base-card-effects.zh-TW.txt` 都寫成「選擇一名己方技術工放入待業區」，方向相反。引擎 `game.mjs:621-634` 實際用 `addWorker(...)` 從供應區加入，與卡面及 `tests/cards.test.mjs` 一致。

#### 建議修法

修正兩份資料檔文字；不需改引擎。

#### 修正

`data/hegemony-base-catalog.json` 與 `data/base-card-effects.zh-TW.txt` 的專業化說明已改為「從供應區加入一名技術工到待業區」。手牌浮動說明也同步改為圖鑑式內容。

### 7.9 民意調查未公開揭示 5 枚方塊（低，已修）

#### 現象

卡面：「reveal 5 cubes from the bag … You decide whether to call the vote before other players declare their sides.」

`game.mjs:538-542` 抽出的方塊放在 `content.cardChoice.drawn`，而 `playerView`（`game.mjs:1369`）只把 `privateChoice` 傳給出牌者。其他玩家看不到被揭示的 5 枚方塊，只能等表決結算。

#### 建議修法

`poll` 的 `drawn` 對所有玩家公開，但仍只讓出牌者選擇是否即時表決。

#### 修正

`playerView` 對 `poll` 的已揭示方塊改為所有玩家可見，即時表決的選擇權仍限出牌者。

### 7.10 激進改革未拒絕即時投票（低，已修）

#### 現象

卡面：「no Immediate Vote on it.」

`game.mjs:586` 強制把 `immediate` 覆寫為 `false`，沒有拒絕帶 `immediate: true` 的輸入。

#### 建議修法

若 `command.immediate === true` 直接報錯，避免前端誤送時默默忽略。

#### 修正

`radical` 現在遇到 `immediate: true` 會直接報錯，不再靜默改寫。

### 7.11 「最多 N」可送 0（中，已修）

#### 現象

`numberField`（`app.js:569`）預設 `min = 0`、`value = 0`，因此所有數量欄位打開時都是 0，直接按確認就會送出「0 單位」。引擎多數效果只檢查 `amount >= 0`，於是打出卡牌後可以什麼都不做。

規則書 p.12 只說「符合需求才能打牌發揮效果」，FAQ（規則書 p.36）則明確寫道：*"you cannot perform actions that are optional if you cannot cover their cost/requirement."* 由此解讀，「up to N」是上限而非允許空效果；打出一張牌卻完成 0 單位，等於白棄一張牌，應改為棄牌執行基本行動。以下是全部同類欄位的盤點：

| 卡牌／效果 | 程式位置 | 目前送 0 的結果 | 判定 |
|---|---|---|---|
| 醫療危機、高等教育計畫（`sell-health`／`sell-education`） | `trade.mjs:49` `sellToState` | 可確認，無任何效果 | 應至少 1 |
| 圍標（`bid-rigging`） | `game.mjs:674` | **可確認，且仍得 1 點個人影響力** | 明確錯誤 |
| 全球品牌、全球糧食危機（`brand-export`／`food-export`） | `game.mjs:766` `specialExport` | 可確認，無任何效果 | 應至少 1 |
| 醫療觀光、外國學生（`export-health`／`export-education`） | `game.mjs:818` | 可確認，無任何效果 | 應至少 1 |
| 移民（`migration`） | `game.mjs:604-613` | 可不勾選任何人（仍要求待業 ≥ 4） | 應至少 1 |
| 公營企業加班（`public-overtime`） | `game.mjs:664` | 0 不向國家購買，企業仍照常增產 | 正確（卡面是 may buy） |
| 言論壓制（`speech`） | `game.mjs:795` | 0 轉換，仍得 +2 影響力並降低兩個階級影響力 | 正確（主要效果在後段） |
| 國家事件「支出」（`spend`，如 Neighbors at War、Developing Countries in Need） | `events.mjs:167` | 0 可結算，不換 VP | 待確認，傾向至少 1 |
| 國家事件「分配影響力」（Political Scandal） | `events.mjs:215` | 0 分配仍付 $25 | 玩家不會故意送 0，低風險 |

另外，前端在 `quantity()` 的最大值為 0 時仍會渲染表單（`app.js:1675-1679` 等），玩家看到「可填 0～0」還能按確認，是 0 數量最容易被觸發的路徑。

#### 建議修法

1. `sellToState`、`specialExport`、`export-health`／`export-education` 改為 `amount >= 1`。
2. `bid-rigging` 改為必須賣至少 1 份才給影響力（或直接套用第 1 點的驗證）。
3. `migration` 加上 `ids.length >= 1`。
4. 事件 `spend` 若要嚴格處理，改為 `amount >= 1`；先確認裁決。
5. 前端：最大值 < 1 時不要渲染可確認的數量表單，顯示「目前沒有可出售數量」；最大值 ≥ 1 時 `min = 1`。
6. 補測試：上述每張卡送 0 都應被拒絕，且 `bid-rigging` 送 0 不得取得影響力。

#### 修正

已確認的「up to N」效果（賣給國家、出口、移民、標案等）一律要求至少 1 單位；卡面明寫 may／另可的 `public-overtime`、`speech` 維持 0 合法。`brand-export`／`food-export` 允許「額外 0 份」，但整張牌至少要有一筆出口或 1 份額外出售。前端數量欄位在最大值為 0 時不再顯示可確認表單，最大值 ≥ 1 時 `min = 1`。`tests/cards.test.mjs` 已補 0 數量拒絕測試。

### 7.12 其他卡牌裁決

- 改革訴求／推動政治議程：官方 FAQ 確認可等第一案即時表決完成後才選第二案，已實作。
- 職場事故：官方 FAQ 所載卡面指定一名其他玩家付款，依該玩家符合條件的企業數計算。
- 退場策略：依官方卡牌通則，出售仍受已承諾工人的限制。
- 公營企業加班：國家自行發動時要能支付薪資；其他玩家迫使國家付款時適用強制借貸。
- 限制言論：媒體影響力如何轉換仍需取得明確卡面或裁決，暫保留現有行為。

---

## 已核對、目前正確的項目

以下經規則書與 FAQ 核對，**目前引擎行為正確，不建議改動**：

- 財富表每輪計分，且財富標記每前進一格 3 VP（v1.2 正確，不是舊版的 2 VP）。
- 開局售價：食物 12，其他資源 8。
- 生產階段順序：國家 → 資本家 → 中產 → 勞工。
- 食物需求、進口關稅、強制支出可借貸。
- 所得稅、就業稅、企業稅公式；企業稅營收 0–4 未列，暫以 0 處理（已知缺口）。
- 已承諾工人不能被任意解雇（FAQ 2074–2082 支持 `finishStaffing` 現行阻擋）。
- 示威空位計算排除「沒有中產經營者的中產企業勞工位」（FAQ 2066–2072）。
- IMF 門檻、介入後政策／公營企業／合法性減半、法案取消並返還影響力。
- 中產教育只能把待業技術工轉職；勞工可在非技術工位轉職。
- 公營企業縮編時，已承諾工人仍會失業。
- 工會成立條件、罷工基本限制、薪資政策調整、超時生產。
- 國家出售醫療／教育在政策 B 時 +1 VP、政策 A 時每 3 份 +1 合法性。
- 勞工／中產／國家的「額外班次」「公營企業加班」卡面只要求「國家付薪並立即生產」，未要求承諾工人；`public-overtime` 不承諾工人符合卡面，與中產基本行動 Extra Shift 不同。
- 資本家「額外班次」要求非自動化、且必須付得起薪資才可選；`private-overtime` 已正確擋下自動化與罷工企業。
- Foreign Market Insight：中產揭示下一張、每筆交易可做兩次；資本家揭示下兩張、只出口一次；實作的角色分流正確。
- 進口補貼免關稅且只限外國市場；個人消費可向多來源或單一來源加倍購買；Growing Business 免費倉庫與折 4；Industrialization 國家付半數；Technological Progress 20／45；Signing Bonus、General Strike、Cooperative Farm（3 名待業、承諾至本輪）、Fake News、Interest Groups、Proletarians、Affordable Housing、New Theme Park、Boost Domestic Tourism 的付款方向。
- State Scholarship／Healthcare Benefits 的「總價折半向上取整」與合法性 +1；Privatization 主流程（含 FAQ 允許已承諾工人）；Quantitative Easing；Higher VAT；Agenda-Setting／Foreign Financial Assistance 的議程匹配計算。

## 其他已知缺口

以下仍以 [DATA-GAPS.md](DATA-GAPS.md) 為準，本次不重複列為新 bug：

- 企業稅營收 0–4 的稅額未列。
- 終局平手時投票方塊的計數範圍。
- 全桌貸款卡用盡且無其他合法付款途徑的處理。
- 工人分色數量與部分貨幣／合法性標記的實體張數。
- 同時觸發效果的順序與多張未選事件回牌頂的順序。

## 建議處理順序

1. **第一批**：事件 0 結算、中產開局技能選擇（直接影響規則合法性與開局平衡）。— 已完成
2. **第二批**：罷工停業清除、公營擴張示威判定、供給上限。— 已完成
3. **第三批**：事件卡前提結構化與逐卡回歸測試。— 進行中（本次已補已確認的項目；剩餘疑義列於複核結果）
