import { createGame } from './game.mjs';
import { applyRecorded } from './turns.mjs';

// 每次改動規則、牌效或隨機抽取順序而讓舊紀錄重播結果不同時，就把這個數字加 1。
// 重播時版本不符只會警告，不會阻止；真正的保障是每筆命令後的亂數計數檢查。
export const ENGINE_VERSION = 1;

// 開局時建立。種子與設定足以重建初始狀態，之後只需依序記錄成功的命令。
export function createRecord(game) {
  return {
    engineVersion: ENGINE_VERSION,
    seed: game.rng.seed,
    full: Boolean(game.content),
    testMode: game.testMode === true,
    startSkill: game.content?.startSkill ?? null,
    commands: [],
  };
}

// 命令成功套用後呼叫。id 與 revision 屬於連線層，不影響規則，不記錄。
export function recordCommand(record, game, role, command) {
  if (!record) return;
  const { id, revision, ...rest } = command;
  record.commands.push({ role, command: rest, counter: game.rng.counter });
}

// 依紀錄從初始狀態重建遊戲。遇到問題會停下並回報，不丟例外：
//   warnings 說明為何這份重播可能不可靠，applied 是成功重播的命令數。
export function replayRecord(record, { upTo = record.commands.length, onStep } = {}) {
  const warnings = [];
  if (record.engineVersion !== ENGINE_VERSION) {
    warnings.push(`此紀錄使用引擎版本 ${record.engineVersion}，目前為 ${ENGINE_VERSION}，重播結果可能與當時不同。`);
  }
  const game = createGame({ full: record.full, seed: record.seed });
  if (record.testMode) game.testMode = true;
  if (record.startSkill && game.content) game.content.startSkill = record.startSkill;
  let applied = 0;
  for (const [index, entry] of record.commands.slice(0, upTo).entries()) {
    const before = game.log.length;
    try {
      applyRecorded(game, entry.role, structuredClone(entry.command), true);
    } catch (error) {
      warnings.push(`第 ${index + 1} 筆命令無法重播（${error.message}），規則可能已改版。`);
      break;
    }
    applied++;
    if (game.rng.counter !== entry.counter) {
      warnings.push(`第 ${index + 1} 筆命令後亂數用量與原本不符，之後的重播可能已偏離。`);
      break;
    }
    onStep?.({ index, entry, game, logs: game.log.slice(before) });
  }
  return { game, applied, warnings };
}
