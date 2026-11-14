import { indicators, indicatorScales, policyMatches } from './indicators.mjs';

// 目標：每個目標列出它在乎哪些指標、方向（正數＝越高越好，負數＝越低越好）與強度。
// 改這張表就能改變「某個目標到底看重什麼」；風格（styles.mjs）再決定各目標的優先程度。
export const goalDefinitions = {
  // 每筆貸款在終局會扣分（資本家每筆 5 分），所以也算在 VP 目標裡。
  vp: { label: '提升 VP', effects: { vp: 1, stock: 0.4, political: 0.1, debt: -4 } },
  production: { label: '提高生產', effects: { production: 1, income: 0.3 } },
  income: { label: '提高收入', effects: { income: 1, money: 0.4 } },
  cost: { label: '降低成本', effects: { cost: -1, debt: -0.6 } },
  needs: { label: '滿足需求', effects: { needs: 1 } },
  bills: { label: '推動法案', effects: { political: 1 } },
};

// 本輪各目標有多迫切（0 = 不急，越大越急）。依目前盤面計算，風格的 urgency 係數再放大或縮小。
export function urgencies(view, role) {
  const now = indicators(view, role);
  const round = view.match?.round ?? 1;
  const population = view.match?.populations?.[role] ?? 3;
  const idle = view.economy.workers.filter(worker => worker.role === role && !worker.company && !worker.committed).length;
  const vacancies = view.economy.companies.reduce((sum, company) => sum + company.slots.filter(slot => !slot.worker && (!slot.role || slot.role === role)).length, 0);
  const shortOnMoney = now.cost > 0 && now.money < now.cost * 1.5;
  return {
    vp: (round / 5) * 1.5,
    production: (idle > 0 && vacancies > 0 ? 1 : 0.2) + (6 - round) / 10,
    income: (shortOnMoney ? 1.2 : 0.3) + (idle > 0 ? 0.3 : 0),
    cost: now.debt > 0 ? 0.6 * now.debt : shortOnMoney ? 1 : 0.2,
    needs: -now.needs > 0 ? Math.min(2.5, (-now.needs / population) * 3 + 0.5) : 0,
    bills: policyMatches(view, role) < 5 ? 0.6 + (3 - view.bills.filter(bill => bill.role === role).length) * 0.1 : 0.1,
  };
}

// 本輪計畫：把各目標依「風格的基礎權重 × (1 + 迫切度)」排序。每一輪第一次輪到時制定一次。
export function planRound(view, role, style) {
  const urgent = urgencies(view, role);
  const priorities = Object.keys(goalDefinitions).map(goal => ({
    goal, label: goalDefinitions[goal].label,
    weight: (style.base[goal] ?? 0) * (1 + urgent[goal] * (style.urgency?.[goal] ?? 1)),
  })).sort((a, b) => b.weight - a.weight);
  return { round: view.match?.round ?? 1, style: style.id, priorities };
}

// 行動對各目標的貢獻：指標差 ×（目標對該指標的影響）× 目標本輪權重，加總。
export function scoreAction(plan, style, delta) {
  let total = 0;
  const byGoal = {};
  for (const { goal, weight } of plan.priorities) {
    const effects = { ...goalDefinitions[goal].effects, ...style.effects?.[goal] };
    let part = 0;
    for (const [indicator, influence] of Object.entries(effects)) part += influence * (delta[indicator] ?? 0) / indicatorScales[indicator];
    byGoal[goal] = part * weight;
    total += byGoal[goal];
  }
  return { total, byGoal };
}
