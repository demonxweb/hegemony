# AI 補位玩家評估與實作計劃

> 狀態：最小合法補位已實作（`claude` 分支），以下第 4 節之後仍為原規劃  
> 依據：官方《Crisis & Control》v1.2 Automas 章節（p.3–13）  
> 關聯文件：[PLAN.md](PLAN.md)、[RULES-REVIEW.md](RULES-REVIEW.md)

## 0. 目前實作

```text
packages/bots/
  index.mjs        策略註冊表：getStrategy / listStrategies / registerStrategy
  runner.mjs       runBots(game, seats, { host })：輪到 AI 就代打，直到輪到真人
  context.mjs      AI 的上下文：私人視圖 + 在複本上試跑（tryCommand）
  turn.mjs         pendingActors：目前輪到哪些席位
  phases.mjs       各特殊階段的共用預設（所有策略共用，策略只需覆寫想變聰明的部分）
  candidates.mjs   事件與出牌的參數候選
  strategies/      minimal（最小合法）、basic（再加領福利與還貸）
packages/engine/random.mjs   每場遊戲獨立的亂數（game.rng = { seed, counter }）：雜湊計數器產生，同種子必得同結果，
                             但由手牌 id 等輸出無法反推種子；預覽用的複本帶自己的狀態，不會消耗真實遊戲的亂數
scripts/bot-arena.mjs        自我對戰與強度比較
```

- **每席獨立選策略**：席位資料記為 `room.seats[role] = { bot: true, strategy }`，策略 id 不存在時退回 `minimal`。房主在等待室用「AI 補位」加入或移除。
- **新增一種強度**：寫一個 `{ id, name, description, turn(ctx), free?(ctx), phases? }` 模組並在 `index.mjs` 登記。`turn` 與 `phases` 回傳依優先順序的候選命令，runner 取第一個通過試跑的；沒覆寫的階段自動用共用預設，不會漏處理而卡住。
- **強度可證**：同一批種子下比較同一席位換策略的平均分差：

```bash
node scripts/bot-arena.mjs --compare working=basic,minimal --games 100
node scripts/bot-arena.mjs --games 20 --seats working=basic,middle=basic,capitalist=basic
```

  目前結果（60 局、同種子配對）：勞工 `basic` 比 `minimal` 多 13.6 分（標準誤 0.7），中產多 1.4 分（標準誤 0.14）。
- **各 AI 模式的詳細說明**：每種模式都有獨立的說明檔，見 [ai/README.md](ai/README.md)（共同架構、思考時間、新增模式）、[ai/minimal.md](ai/minimal.md)、[ai/basic.md](ai/basic.md)、[ai/goal.md](ai/goal.md)（目標導向的指標、目標、迫切度、評分演算法與風格參數）。
- **國家無行動可做**：國家在少數盤面（約 3%）沒有任何合法的主要行動。引擎的 `hasLegalMainAction` 會試遍國家所有候選（找到一個合法的就停），確實沒有時才接受 `pass` 命令，視圖會帶 `noLegalAction: true`（依房間版本快取，房主調整後自動重算）。AI 遇到時自動跳過。候選列舉在 `packages/engine/candidates.mjs`，AI 與跳過驗證共用；`tests/pass.test.mjs` 用獨立的暴力搜尋確認這些盤面真的沒有合法行動。
- **優先議題收回**：打出「優先議題」後若沒有任何事件能處理，原本會永遠卡在選擇畫面（只有「轉移重點」有收回選項）。已比照加入 `cancel-priority`。打出但只能收回的牌，不算「有行動可做」。

## 1. 目標

讓房長可以在等待室把空缺席位補為 AI，使 1 至 3 位真人也能開始並完成一局，而不必等滿四位真人。

優先順序：

1. **能合法補位**：AI 能依規則完成整局，不卡住、不產生非法命令。
2. **行為合理**：AI 會領福利、還貸、補倉儲、買必要資源、投票與提案。
3. **可調整強度**：先做官方 Simple Mode 風格，再視需要加入 Advanced Mode 式優先序。

非目標（第一版不做）：

- 聊天語意理解、自然語言談判。
- 針對對手弱點的長期規劃或搜尋式 AI。
- 完整重現官方 90 張 AI 卡與所有 Instruction 卡內容。

## 2. 官方 Automa 規則摘要

官方 Automa 屬於 **Crisis & Control 擴充**，不是基本版 v1.2 規則書內容。

### 2.1 組成

- 勞工、中產、資本家各一套 Automa。
- **沒有國家 Automa**。官方情境下國家必須由真人操作。
- 每套包含：
  - 30 張 AI 卡
  - 6 張行動優先序卡
  - 7 張政策優先序卡
  - 8 個優先序列標記、24 個列標記
  - 多張 Instruction 卡（行動條件、選擇偏好、投票傾向）

### 2.2 Simple Mode 回合流程

1. 執行必要的 Free Actions。
2. 翻開最上面一張 AI 卡。
3. 從左到右檢查卡片上的 4 個行動。
   - 第一個可行的行動即執行。
   - 檢查可行性時，要把卡片對第一個行動的獎勵一併計入。
4. 四個行動都不可行時，執行卡片底部的 Special Action。
5. Special Action 也不可行時，執行「政治施壓」：投入 3 個投票方塊。
6. 行動完成後，再補做需要的 Free Actions。

### 2.3 Advanced Mode 回合流程

1. 執行 Free Actions。
2. 翻開 AI 卡，卡片上 4 個符號是 4 項「檢查」，不是行動。
3. 由左至右執行全部 4 項檢查。
4. 每項符合的條件，把對應行動／政策優先序卡往上移動指定列數。
5. 執行優先序最高的行動；同列時取最靠近標記者。
6. 最高優先序行動不可行時，只退而執行第二高；再不行就政治施壓，不再往下找。
7. 執行後，該行動的優先序卡往下移 2 列。

### 2.4 Free Actions 自動化

| Free Action | 官方自動化方式 |
|---|---|
| Receive Benefits | 回合開始自動領取 |
| Pay Off Loan | 回合開始有錢就自動還貸 |
| Buy Storage | 資源超出容量時自動購買；生產階段也會觸發 |
| Use Luxury / Education / Health | 回合結束時，資源達到人口數就自動使用；順序為奢華→教育→醫療 |
| Swap Workers | 指派工人前自動執行 |
| Adjust Prices | 回合開始自動調到中間價位；特定政策下調到最高價 |
| Adjust Wages | 平常不調；被罷工才調到 L3，下回合降回最低 |
| Give Bonus | 官方資本家 Automa 永遠不給 |

### 2.5 提案、投票與影響力

- **提案**
  - Simple Mode：使用 AI 卡上第一個可提的政策。
  - Advanced Mode：使用政策優先序最高的政策。
- **投票**
  - 法案符合自己的 Desired Policy，或讓政策更接近，就贊成；否則反對。
- **即時表決**
  - 依人數與影響力判斷是否花 1 點影響力發動。
  - 2 人局：需在扣除發動成本後仍比對手有影響力，且投票方塊數不低於對手。
  - 3–4 人局：先依 Desired Policy 估算雙方陣營，再判斷是否發動。
- **選舉投入影響力**
  - 只會在「花得起、且花了能改變結果」時投入。
  - 分成不花、全花、花最小必要額三種策略。
- **最終選舉**：所有 Automa 花光影響力。
- **最後一輪**
  - 不提案移民政策。
  - 對外貿易政策只有在能發動即時表決時才提。

### 2.6 決策不確定時

Instruction 卡本質是「優先條件清單」：從第一條開始逐條縮小候選選項，直到只剩一個。這是確定性啟發式，適合直接轉成程式與測試。

## 3. 與本專案引擎的對應

本專案所有行動都經由 `applyCommand(game, role, command)`，回合順序固定為勞工→中產→資本家→國家，具備實作 AI 的良好基礎。

| 官方行動 | 本專案命令 |
|---|---|
| Assign Workers | `assign` |
| Build Company | `build` |
| Buy Goods & Services | `buy` |
| Sell to Foreign Market | `export`／`sell` |
| Propose Bill | `propose` |
| Apply Political Pressure | `pressure` |
| Strike | `strike` |
| Demonstration | `demonstrate` |
| Business Deal | `deal` |
| Receive Benefits | `benefits` |
| Pay Off Loan | `repay` |
| Buy Storage | `buy-storage` |
| Use Education / Health / Luxury | `use-education`／`use-health`／`use-luxury` |
| Swap Workers | `swap-workers` |
| Adjust Prices | `adjust-prices` |
| Adjust Wages | `wages` |

### 3.1 現有可用基礎

- `packages/engine/game.mjs`
  - `applyCommand`：唯一命令入口，可統一驗證與記錄。
  - `playerView`：只暴露該席位資訊，AI 不會看到他人手牌。
  - `currentRole`：可判斷目前輪到哪個席位。
- `apps/server/game-api.mjs`
  - 房間、席位、命令去重與快照流程已存在。
- `apps/server/cloudflare.mjs`
  - Durable Object 與本機伺服器共用同一套遊戲 API，適合在 server 端同步執行 AI。

### 3.2 主要落差

1. **沒有國家 Automa**
   - 官方只有三種 Automa；本專案四席都必須有人。
   - 若真人不足四人且國家空著，必須自行設計國家 AI。

2. **官方 AI 卡與 Instruction 卡內容不在規則書**
   - 規則書只有流程與範例，沒有 30×3 張 AI 卡的行動順序、獎勵與政策。
   - 無法直接從 PDF 重建官方牌表。
   - 建議自行設計 AI 卡表，沿用官方優先序邏輯，而不是逐張轉錄實體卡。

3. **沒有共用的合法行動列舉**
   - 官方 Automa 的前提是「檢查行動是否可行」。
   - 目前命令由前端依畫面組合。
   - 需要新增 `availableActions(game, role)` 之類的共用查詢。

4. **特殊階段需要預設決策**
   - `policy-choice`、`worker-arrival`、`production-confirm`、`election`、`needs`、`card-choice`、`event-choice`、`demonstration`、`event-hire`、`event-penalty` 等，都必須有 AI 的安全選項。

## 4. 建議架構

### 4.1 AI 席位

- `room.seats[role]` 增加 `bot: true`，不需要帳號或 token。
- 只有房長能在等待室加入／移除 AI。
- 遊戲開始後不可再加入 AI。
- 大廳、遊戲畫面與日誌顯示「AI」標記。

### 4.2 Server 端機器人迴圈

- 每次人類送出命令、開始遊戲、進入新階段後，伺服器呼叫 `runBots(room)`。
- 迴圈持續處理 AI 回合，直到「輪到真人」或「等待真人選擇」為止。
- 不使用背景計時器，Cloudflare Durable Object 也能同步執行。
- 加入最大步數保護，避免 AI 邏輯錯誤造成無限迴圈。
- 每一步仍需通過 `applyCommand` 驗證，AI 不得繞過規則。

### 4.3 AI 決策模組

建議放在 `packages/engine/bots/` 或 `packages/ai/`，只依賴 `playerView`：

```text
chooseBotCommand(view, role, context)
```

輸入：AI 可見的私人視圖、目前階段、可用命令。  
輸出：一個合法命令，或 `null` 表示無法行動。

內部模組：

- `availableActions(view, role)`：列出目前合法的主要／免費行動。
- `evaluateAction(...)`：依優先序與資源狀況評分。
- `chooseTieBreak(...)`：對多個目標使用 Instruction 式條件清單。
- `botFreeActions(...)`：處理領福利、還貸、補倉儲、使用生活資源等。
- `botElection(...)`：處理投票、即時表決與影響力投入。

### 4.4 模式策略

- **Simple Mode（第一版）**
  - 每回合用固定 AI 卡表產生 4 個候選行動。
  - 依序找第一個合法行動。
  - 都不行就政治施壓。
  - 成本低、行為穩定、容易測試。
- **Advanced Mode（後續）**
  - 建立行動優先序列與政策優先序列。
  - 依盤面檢查條件移動優先序卡。
  - 需要較完整的盤面評估函式。

## 5. 實作階段

### 第一階段：基礎建設

- [ ] 新增 `availableActions(game, role)` 合法行動列舉。
- [ ] 新增 AI 席位資料結構與房長加入／移除 API。
- [ ] 新增 `runBots(room)` 回合迴圈與最大步數保護。
- [ ] 等待室與遊戲畫面顯示 AI 標記。

完成條件：房長可以在等待室補 AI，AI 回合能自動前進。

### 第二階段：Simple Mode 行為

- [ ] 勞工／中產／資本家 AI 卡表與候選行動。
- [ ] 主要行動選擇與目標 tie-break。
- [ ] Free Actions 自動化。
- [ ] 食物需求、稅金、貸款與倉儲的預設處理。
- [ ] 投票與影響力投入策略。
- [ ] 特殊階段安全預設值。

完成條件：AI 能在無真人介入下完成自己的回合，不出現非法命令或卡住。

### 第三階段：國家 AI

- [ ] 國家回合的主要行動與免費行動。
- [ ] 稅收、福利、公共服務、發債與 IMF 的預設策略。
- [ ] 事件懲罰與政策調整的預設選擇。

完成條件：可以補滿任意席位，包含全 AI 對局。

### 第四階段：Advanced Mode

- [ ] 行動優先序卡與政策優先序卡資料。
- [ ] 4 項檢查與優先序移動規則。
- [ ] 依盤面評估的 tie-break。
- [ ] 與 Simple Mode 切換的房間設定。

完成條件：AI 能依盤面調整優先順序，行為明顯不同於固定順序。

### 第五階段：測試與平衡

- [ ] 1 真人＋3 AI 完成五輪。
- [ ] 4 AI 完成五輪。
- [ ] 人類與 AI 混桌、重連與存檔恢復。
- [ ] 非法命令、無限迴圈、資源負數等防呆測試。
- [ ] 難度與節奏調整。

## 6. 驗收案例

最低驗收門檻：

1. `1 真人（國家）＋3 AI` 能完成五輪並產生終局分數。
2. `4 AI` 能完成五輪，過程中沒有非法命令。
3. AI 在以下情境都能自行處理：
   - 食物不足
   - 手牌無法支付
   - 資源超出倉儲
   - 被罷工
   - 政策變更導致的即時調整
   - 事件選擇與懲罰
   - 選舉與即時表決
4. 人類重新整理或重連後，AI 回合不會重複執行。
5. 同一隨機種子下重播能得到相同結果。

## 7. 風險與對策

| 風險 | 影響 | 對策 |
|---|---|---|
| 行動種類多、參數細 | AI 容易漏掉合法組合 | 先建立集中式 `availableActions` |
| 官方 AI 卡資料缺失 | 無法完整重現官方強度 | 自行設計卡表，保留官方優先序邏輯 |
| 沒有國家 Automa | 無法任意補滿四席 | 自製國家 AI，先用保守策略 |
| 特殊階段多 | 容易卡住 | 每個階段都要有預設值與測試 |
| 交易與談判 | AI 難以擬人化 | 第一版只做接受／拒絕與固定條件 |
| Cloudflare 執行時間 | AI 迴圈可能逾時 | 限制每步運算量與最大步數 |

## 8. 工作量估計

| 範圍 | 估計 |
|---|---|
| AI 席位＋回合迴圈＋合法行動列舉 | 4–6 天 |
| Simple Mode 決策＋Free Actions＋特殊階段 | 1–2 週 |
| 國家 AI | 3–5 天 |
| 測試與除錯 | 3–5 天 |
| **可補位的完整 Simple Mode AI** | **約 3–4 週** |
| Advanced Mode 優先序 AI | 再加 1–2 週 |

## 9. 待確認事項

1. AI 席位是否只允許房長新增，或真人退出時可自動替換？
2. 是否需要在遊戲中顯示 AI 的決策摘要，方便除錯與觀戰？
3. 第一版是否需要「全 AI 對局」，或只要求「至少一位真人」？
4. AI 強度是否需要難度選項，或先固定一種？
5. 是否允許 AI 使用測試模式的換牌與手牌庫功能？建議正式對局禁止。

## 10. 建議第一步

先實作第一階段與第二階段的勞工 AI：

1. `availableActions(game, role)`
2. AI 席位與 `runBots()`
3. 勞工 Simple Mode AI
4. 「1 真人＋3 AI」完成五輪的回歸測試

這個範圍價值最高、風險最低，也能先驗證整體架構是否成立。
