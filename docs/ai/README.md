# AI 玩家

房主可以在等待室把空席交給 AI，每個席位各自選擇一種「模式」。每種模式都有自己的說明檔：

| 模式 id | 名稱 | 說明 |
|---|---|---|
| `minimal` | 最小合法 | [minimal.md](minimal.md)：只求不犯規、不卡住 |
| `basic` | 基礎 | [basic.md](basic.md)：最小合法，再加領福利與還貸 |
| `goal-balanced` `goal-growth` `goal-frugal` `goal-political` | 目標導向（均衡、擴張、保守、政治） | [goal.md](goal.md)：依目標排序，用試跑量出每個行動對各指標的影響來選行動 |

## 共同架構

```text
packages/bots/
  index.mjs        策略註冊表：getStrategy / listStrategies / registerStrategy
  runner.mjs       runBots（持續行動到輪到真人）、runBotActor（只做完目前輪到的那一個 AI）
  context.mjs      AI 的上下文：私人視圖 + 在複本上試跑（tryCommand、preview）
  turn.mjs         pendingActors：目前輪到哪些席位
  phases.mjs       各特殊階段的共用預設（食物、投票、政策調整、市場更新…），所有模式共用
  strategies/      各模式
  goals/           目標導向模式的指標、目標、風格、候選行動
packages/engine/candidates.mjs   國家的候選行動，AI 與「國家無行動可跳過」的判定共用
scripts/bot-arena.mjs            自我對戰與強度比較
```

### 策略介面

```js
{ id, name, description,
  turn(ctx),          // 主要行動候選，依優先順序
  free?(ctx),         // 免費行動候選
  plan?(ctx),         // 每輪制定一次的計畫（目標導向用），存在 game.botPlans
  phases?: { [phase]: ctx => candidates } }   // 覆寫特殊階段的預設
```

`ctx` 只含該席位看得到的資訊（`playerView`）加上試跑功能。runner 對每個候選在遊戲複本上試跑，取第一個合法的套用；沒覆寫的階段使用 `phases.mjs` 的預設，所以新模式不會因為漏處理某個階段而卡住。

### 合法性保證

- 每個命令先在複本上試跑，連後續的強制選擇（抽牌選擇、政策調整、事件雇用…）也走得完才算合法。
- 試跑一律使用複製的命令：引擎會把命令裡的陣列留在狀態裡並在之後修改（例如公營企業雇用），共用同一份命令會弄壞之後真正送出的那一份。
- 非國家席位永遠有「施加政治壓力」可用；國家確實無行動可做時，引擎接受 `pass`（見 [AI-PLAYERS.md](../AI-PLAYERS.md)）。

## 思考時間

房主在等待室的「AI 補位」區設定「AI 最長思考時間」（0、2、5、10、20、30 秒，預設 0）。

- **0**：與過去相同，AI 在真人送出命令的同一個請求內立刻做完，畫面上看不到等待。
- **大於 0**：輪到某個 AI 時，伺服器不立刻行動，而是記下 `thinking = { role, since, delayMs }`，`delayMs` 在最長秒數的 0.2～1 倍之間隨機（讓不同 AI、不同回合有不同節奏）。時間到才讓**這一個** AI 做完它的步驟（`runBotActor`），再安排下一個 AI。
- 畫面下方會顯示「勞工（AI）思考中… 3.2 秒 / 預計約 4.5 秒 · 上一步運算 0.12 秒」，行動階段的等待訊息裡也有同一行。秒數由瀏覽器依伺服器回報的已經過時間每 0.2 秒更新。「上一步運算」是該 AI 實際運算花的時間，與刻意等待分開記錄（`botThink.stats`）。
- 思考時間只是刻意的等待，**不限制運算**：到時間後 AI 一定會做到有合法行動為止。真的找不到合法行動時（極少見的死局），顯示「找不到合法行動，持續嘗試中」，每 5 秒重試一次，不會放棄。
- 計時器存在伺服器記憶體，`thinking` 同時存進房間存檔：伺服器重啟後會從存檔接續剩餘的等待時間。真人在 AI 思考時送出的過期命令會因版本不符被拒絕，重新整理即可。

## 對戰與強度量測

```bash
node scripts/bot-arena.mjs --games 20 --seats working=basic,middle=basic,capitalist=basic,state=basic
node scripts/bot-arena.mjs --compare working=goal-balanced,basic --games 24 --seats working=basic,middle=basic,capitalist=basic,state=basic
```

`--compare` 在同一批種子下比較某席位換用 A 或 B 的平均分差與標準誤。亂數是每場遊戲獨立的（`game.rng`，同種子必得同結果），所以配對比較的雜訊很小。

## 新增一種模式

1. 在 `strategies/` 寫一個符合上面介面的模組（或用 `createGoalStrategy(style)` 只換參數）。
2. 在 `index.mjs` 登錄；等待室的下拉選單會自動列出。
3. 用 `--compare` 與現有模式對戰量化強度。
4. 補測試：至少讓四個席位都用新模式跑完一整局；新增的行動種類要有「真人亂投亂選」的壓力測試（曾經因為 AI 只投反對，法案通過後的流程完全沒被測到）。
