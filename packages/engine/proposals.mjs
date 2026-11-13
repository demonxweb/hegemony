// 提案紀錄 game.proposals：整場遊戲每一個提案、提案人與結果，供結算畫面列出。
// 結果：pending（待表決）、passed（通過）、failed（未通過）、canceled（被 IMF 取消）。
export function recordProposal(game, bill, immediate) {
  (game.proposals ??= []).push({ round: game.match?.round ?? null, role: bill.role, policy: bill.policy, target: bill.target,
    immediate: Boolean(immediate), status: 'pending' });
}

// 同一個議題同時只會有一個待決法案，所以以議題找出最近一筆待表決的紀錄。
export function resolveProposal(game, bill, status, tally = {}) {
  const entry = [...(game.proposals ?? [])].reverse().find(item => item.policy === bill.policy && item.role === bill.role && item.status === 'pending');
  if (entry) Object.assign(entry, { status }, tally);
}
