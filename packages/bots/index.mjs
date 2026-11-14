import minimal from './strategies/minimal.mjs';
import basic from './strategies/basic.mjs';
import { createGoalStrategy } from './strategies/goal.mjs';
import { goalStyles } from './goals/styles.mjs';

// 策略註冊表。新增能力等級只要在此登記一個符合介面的模組：
//   { id, name, description, turn(ctx), free?(ctx), phases?: { [phase]: ctx => candidates } }
// 順序就是等待室下拉選單的順序：目標導向在前（第一個是預設），最小合法與基礎放最後。
const registry = new Map([...goalStyles.map(createGoalStrategy), minimal, basic].map(strategy => [strategy.id, strategy]));

// 新加入的 AI 預設用均衡；找不到策略 id 時（例如策略被移除後的舊房間）退回最簡單、最不耗時的最小合法。
export const defaultStrategy = 'goal-balanced';
const fallbackStrategy = 'minimal';

export function getStrategy(id) {
  // 找不到的 id（例如策略被移除後的舊房間）退回預設策略。
  return registry.get(id) ?? registry.get(fallbackStrategy);
}

export function listStrategies() {
  return [...registry.values()].map(({ id, name, description }) => ({ id, name, description }));
}

export function registerStrategy(strategy) {
  registry.set(strategy.id, strategy);
}

export { BotStuckError, nextBotActor, runBotActor, runBots } from './runner.mjs';
