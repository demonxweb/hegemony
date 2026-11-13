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

// 讓 AI 席位持續行動，直到輪到真人或遊戲結束。
//   seats: { [role]: strategyId }，只列出由 AI 控制的席位。
//   host:  負責按「開始下一輪」的席位；若房長是真人，會停在計分階段等待。
export function runBots(game, seats, { host = roles[0], maxSteps = 20000, onStep, allowPass = true } = {}) {
  let steps = 0;
  while (steps < maxSteps) {
    const actor = pendingActors(game, host).find(role => seats[role]);
    if (!actor) return steps;
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
    steps++;
  }
  throw new BotStuckError('超過最大步數，可能陷入無限迴圈。', { steps });
}
