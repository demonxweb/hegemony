// 行動紀錄的舊格式 { turn, role, lines }（早期版本存進房間的）轉成目前的格式，避免舊房間打不開。
export function normalizeTurnLog(game) {
  const round = game.match?.round ?? 1;
  return (game.turnLog ?? []).map(entry => Array.isArray(entry.changes) ? entry
    : { round, turn: entry.turn, role: entry.role, kind: 'main', type: 'legacy', label: '行動', changes: entry.lines ?? [] });
}
