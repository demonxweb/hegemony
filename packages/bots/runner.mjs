import { GameError, roles } from '../engine/game.mjs';
import { applyRecorded } from '../engine/turns.mjs';
import { createContext } from './context.mjs';
import { defaultCandidates } from './phases.mjs';
import { getStrategy } from './index.mjs';
import { pendingActors } from './turn.mjs';

export class BotStuckError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'BotStuckError';
    this.detail = detail;
  }
}

function candidatesFor(strategy, ctx, game, allowPass) {
  if (ctx.phase === 'action') {
    // 策略可以每一輪制定一次計畫（例如目標排序），存在遊戲狀態裡，重新整理或伺服器重啟後仍在。
    if (strategy.plan) {
      const plans = game.botPlans ??= {};
      const stored = plans[ctx.role];
      if (stored?.round !== ctx.view.match?.round || stored?.style !== strategy.id.replace(/^goal-/, '')) plans[ctx.role] = strategy.plan(ctx);
      ctx.plan = plans[ctx.role];
    }
    // 國家確實無行動可做時，引擎才會接受 pass；其他情況下它不合法，runner 會略過。
    if (!game.mainUsed) return [...strategy.turn(ctx), ...(allowPass && ctx.role === 'state' ? [{ type: 'pass' }] : [])];
    if (!game.freeUsed) {
      const free = strategy.free?.(ctx) ?? [];
      const valid = ctx.firstValid(free);
      if (valid) return [valid];
    }
    return [{ type: 'end' }];
  }
  const custom = strategy.phases?.[ctx.phase]?.(ctx);
  return [...(custom ?? []), ...defaultCandidates(ctx)];
}

// 目前輪到的 AI 席位（第一個）；沒有則回傳 undefined（輪到真人、遊戲未開始或已結束）。
export function nextBotActor(game, seats, host = roles[0]) {
  return pendingActors(game, host).find(role => seats[role]);
}

// 讓指定的 AI 席位做一步：找出合法命令並套用。找不到合法命令時丟出 BotStuckError。
function stepBot(game, seats, actor, { onStep, allowPass = true } = {}) {
  const strategy = getStrategy(seats[actor]);
  const ctx = createContext(game, actor);
  const command = game.transaction ? { type: 'transaction-confirm' }
    : ctx.firstValid(candidatesFor(strategy, ctx, game, allowPass));
  if (!command) {
    throw new BotStuckError(`${actor} 在「${game.phase}」階段找不到合法命令。`,
      { actor, phase: game.phase, turn: game.turn, log: game.log.slice(-5) });
  }
  try {
    applyRecorded(game, actor, command, true);
  } catch (error) {
    if (error instanceof GameError) throw new BotStuckError(`${actor} 的命令被引擎拒絕：${error.message}`, { actor, command });
    throw error;
  }
  onStep?.({ actor, command, phase: game.phase });
}

// 讓 AI 席位持續行動，直到輪到真人或遊戲結束。
//   seats: { [role]: strategyId }，只列出由 AI 控制的席位。
//   host:  負責按「開始下一輪」的席位；若房長是真人，會停在計分階段等待。
export function runBots(game, seats, { host = roles[0], maxSteps = 20000, onStep, allowPass = true } = {}) {
  let steps = 0;
  while (steps < maxSteps) {
    const actor = nextBotActor(game, seats, host);
    if (!actor) return steps;
    stepBot(game, seats, actor, { onStep, allowPass });
    steps++;
  }
  throw new BotStuckError('超過最大步數，可能陷入無限迴圈。', { steps });
}

// 只讓「目前輪到的那一個 AI 席位」連續做完它的步驟（例如一整個回合的主要行動與結束回合），
// 輪到別的席位就停。伺服器用它一次處理一個 AI，讓玩家看得到每個 AI 各自思考的時間。
// 回傳 { actor, steps }；沒有輪到 AI 則回傳 null。
export function runBotActor(game, seats, { host = roles[0], maxSteps = 2000, onStep, allowPass = true } = {}) {
  const actor = nextBotActor(game, seats, host);
  if (!actor) return null;
  let steps = 0;
  while (steps < maxSteps && nextBotActor(game, seats, host) === actor) {
    stepBot(game, seats, actor, { onStep, allowPass });
    steps++;
  }
  return { actor, steps };
}
