import minimal from './strategies/minimal.mjs';
import basic from './strategies/basic.mjs';
import { createGoalStrategy } from './strategies/goal.mjs';
import { goalStyles } from './goals/styles.mjs';

// 策略註冊表。新增能力等級只要在此登記一個符合介面的模組：
//   { id, name, description, turn(ctx), free?(ctx), phases?: { [phase]: ctx => candidates } }
const registry = new Map([minimal, basic, ...goalStyles.map(createGoalStrategy)].map(strategy => [strategy.id, strategy]));

export const defaultStrategy = 'minimal';

export function getStrategy(id) {
  // 找不到的 id（例如策略被移除後的舊房間）退回預設策略。
  return registry.get(id) ?? registry.get(defaultStrategy);
}

export function listStrategies() {
  return [...registry.values()].map(({ id, name, description }) => ({ id, name, description }));
}

export function registerStrategy(strategy) {
  registry.set(strategy.id, strategy);
}

export { BotStuckError, nextBotActor, runBotActor, runBots } from './runner.mjs';
