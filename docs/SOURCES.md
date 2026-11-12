# 資料來源紀錄

查詢日期：2026-11-06。此文件記錄已找到的來源及用途；不是所有資料都已匯入專案。

| 來源 | 用途 | 核對狀態 |
| --- | --- | --- |
| 本機 `D:\download\Hegemony-English-Rulebook-v1.2.pdf` | 基本版完整規則、元件、設置、稅表、計分與FAQ | 已閱讀整理；關鍵數值表已查看頁面圖像 |
| [官方 v1.2 PDF](https://hegemonicproject.com/wp-content/uploads/2023/04/Hegemony-English-Rulebook-v1.2.pdf) | 線上官方規則來源 | 已找到；未與本機檔做位元或逐頁版本比對 |
| [官方遊戲頁](https://hegemonicproject.com/games/hegemony/hegemony/) | 官方產品及規則入口 | 已瀏覽 |
| [官方FAQ](https://support.hegemonicproject.com/knowledge/article/61) | 官方支援資訊、TTS連結 | 已瀏覽；此頁不是完整卡牌資料庫 |
| [Ludex Cards & Components](https://www.ludex.dev/hegemony/cards/) | 卡面圖、效果摘要、數量、企業、事件、出口、交易、移民、綱領、圖板及輔助表 | 基本版全量索引已錄入。核對行動、企業、出口、商業交易及事件卡面主要欄位 |
| [官方TTS基本版](https://steamcommunity.com/sharedfiles/filedetails/?id=2902422467) | 作者為 Hegemonic Project Games，可交叉核對 | 已瀏覽頁面；未安裝或抽取素材，實際可用性未驗證 |
| [Hegemony SCRIPTED by tron](https://steamcommunity.com/sharedfiles/filedetails/?id=3638946806) | Ludex註明採用的卡面素材來源 | 已找到頁面；未安裝或抽取素材 |
| [BGA互動教學2240](https://zh.boardgamearena.com/tutorial?game=hegemony&tutorial=2240) | 使用者指定的遊戲布局參考 | 已在瀏覽器查看兩人教學的主畫面、公共服務、企業、政策、外貿及供應區；不是四人配置驗證 |

## 已確認的卡牌索引範圍

Ludex列出四角色各40張行動卡；不同卡面分別為勞工25、中產26、資本家28、國家28。它也有其他基本版牌組與圖板的分類，並混合收錄擴充內容。

卡面種類數源自網站索引，程式已驗證各組副本數符合官方規則書元件總數。逐筆狀態見目錄的 `verification` 欄位。

## 來源採用原則

1. 保留基本版 v1.2 的版本邊界，擴充另外分類。
2. 卡面圖用於核對精確效果、圖示、數值及副本；官方規則與FAQ用於解決流程及例外。
3. Ludex是非官方整理，文字摘要不可直接當作已驗證的原卡文字。
4. 每筆錄入記錄 `sourceUrl`、卡面參照、`checkedAt`、`verificationStatus` 及適用版本。
5. 衝突寫入裁決清單，保留兩方來源，不默默覆蓋。
6. 本專案尚未取得卡圖或素材再散布授權；公開發行時的素材來源與授權範圍需另確認。

## SVG 素材原型

2026-11-09 新增六張卡面和十種圖示。卡面欄位參考官方 v1.2 規則書第 4–5 頁。六張示例的名稱與效果摘要採自 Ludex，使用自繪向量圖形和繁體中文改寫。卡面編號用於預覽排序，正式資料仍須逐張核對。 [官方規則書](https://hegemonicproject.com/wp-content/uploads/2023/04/Hegemony-English-Rulebook-v1.2.pdf) · [Ludex 卡牌索引](https://www.ludex.dev/hegemony/cards/)

在專案根目錄執行 `python scripts/build_svg_assets.py` 可重新產生 [素材與預覽](../assets/prototype/index.html)。每張卡與圖示都是獨立的 SVG，能直接以 `<img>` 引用。

## 企業試玩資料

初始配置採本機官方 v1.2 規則書第 8–10 頁，企業成本、技能、產出及薪資參考 Ludex 的公營、資本家與中產企業索引。`packages/engine/companies.mjs` 目前收錄九家起始企業與六張市場卡。待業工人的技能與市場順序採固定試玩配置。 [Ludex 卡牌索引](https://www.ludex.dev/hegemony/cards/)

## 五輪試玩數值

`packages/engine/rounds.mjs` 依本機官方 v1.2 規則書第 11–13、17、20–21、25–33 頁實作流程與計分。試玩人口門檻參考勞工圖板，綱領、移民與出口的示例數值參考卡牌索引，國家選舉影響力表與中產繁榮軌參考角色資料。 [官方 v1.2 規則書](https://hegemonicproject.com/wp-content/uploads/2023/04/Hegemony-English-Rulebook-v1.2.pdf) · [卡牌與圖板](https://www.ludex.dev/hegemony/cards/) · [國家](https://www.ludex.dev/hegemony/state/) · [中產](https://www.ludex.dev/hegemony/middle-class/)

`packages/engine/cards.mjs` 的 26 種試玩行動卡依卡牌索引的效果摘要及副本數整理，四席分開洗牌。試玩抽牌堆用完時回收棄牌。 [Ludex 卡牌索引](https://www.ludex.dev/hegemony/cards/)

2026-11-09 完成基本版全量目錄，另對照玩家圖板與通用輔助表。規則書第 33 頁的 IMF 政策圖與通用輔助表都列移民政策 7B，因此修正此前「不變」的整理。 [卡牌與圖板索引](https://www.ludex.dev/hegemony/cards/) · [官方 v1.2 規則書](https://hegemonicproject.com/wp-content/uploads/2023/04/Hegemony-English-Rulebook-v1.2.pdf)
