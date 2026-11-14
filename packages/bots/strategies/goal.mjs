import { freeActions, mainActions } from '../goals/actions.mjs';
import { planRound, scoreAction } from '../goals/goals.mjs';
import { indicatorDelta, indicators } from '../goals/indicators.mjs';

// 目標導向策略：每一輪先依盤面訂出各目標的優先順序（本輪計畫），每個回合再把所有可行的行動
// 試跑一次，看它讓各指標往好或壞的方向變多少，依「目標權重 × 指標變化」打分數，選分數最高的。
// 風格（style）只是一組參數，換一組參數就是不同個性的 AI。
export function createGoalStrategy(style) {
  const rank = (ctx, commands) => {
    const plan = ctx.plan ?? planRound(ctx.view, ctx.role, style);
    const before = indicators(ctx.view, ctx.role);
    const ranked = [];
    for (const command of commands) {
      const after = ctx.preview(command);
      if (!after) continue;
      ranked.push({ command, ...scoreAction(plan, style, indicatorDelta(before, indicators(after, ctx.role))) });
    }
    // sort 是穩定排序：分數相同時維持候選順序（施加政治壓力排在最前面）。
    return { plan, ranked: ranked.sort((a, b) => b.total - a.total) };
  };
  // 在計畫上記下最近一次的決定，方便除錯與日後顯示 AI 的想法。
  const remember = (plan, kind, best) => {
    if (!best) return;
    plan.last = { kind, action: best.command.type, score: Number(best.total.toFixed(2)),
      goals: Object.entries(best.byGoal).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([goal, value]) => [goal, Number(value.toFixed(2))]) };
  };
  return {
    id: `goal-${style.id}`,
    name: `目標・${style.name}`,
    description: `依目標排序選行動。${style.description}`,
    plan: ctx => planRound(ctx.view, ctx.role, style),
    turn(ctx) {
      const { plan, ranked } = rank(ctx, mainActions(ctx.view, ctx.role));
      remember(plan, 'main', ranked[0]);
      return ranked.map(item => item.command);
    },
    free(ctx) {
      const { plan, ranked } = rank(ctx, freeActions(ctx.view, ctx.role));
      const best = ranked.find(item => item.total > 0.05);
      remember(plan, 'free', best);
      return best ? [best.command] : [];
    },
  };
}
