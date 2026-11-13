import { summarizeAction } from './action-summary.mjs';
import { cardDefinition } from './cards.mjs';
import { applyCommand, roles } from './game.mjs';
import { normalizeTurnLog } from './turn-log.mjs';

// 行動紀錄 game.turnLog：本輪每個回合（四席輪流）各席做了哪些行動，供所有玩家查看。
// 每筆是一個行動：{ round, turn, role, kind: 'main' | 'free', type, label, changes }，
// changes 就是該行動「確認執行」視窗裡列出的內容。每輪開始時清空。
const turnsPerRound = 20;
const turnPhases = ['action', 'card-choice', 'event-choice', 'event-hire', 'policy-choice', 'election', 'vote-confirmation'];
const freeTypes = ['wages', 'repay', 'benefits', 'buy-storage', 'use-education', 'use-health', 'use-luxury', 'swap-workers', 'adjust-prices', 'give-bonus'];
const mainTypes = ['play', 'assign', 'build', 'sell', 'buy', 'deal', 'export', 'strike', 'event', 'campaign', 'propose', 'pressure',
  'demonstrate', 'extra-shift', 'lobby', 'meet-mps', 'extra-tax', 'pass'];
const ignored = ['end', 'start', 'next-round', 'host-adjust', 'swap-card', 'transaction-cancel'];

export const actionLabels = {
  assign: '指派工人', build: '建造企業', sell: '出售企業', buy: '購買商品與服務', deal: '商業交易', export: '對外出口', strike: '發起罷工',
  event: '處理國家事件', campaign: '競選', propose: '提出法案', pressure: '施加政治壓力', demonstrate: '發起示威', 'extra-shift': '加班',
  lobby: '遊說', 'meet-mps': '會晤政黨議員', 'extra-tax': '額外稅', pass: '跳過主要行動',
  wages: '調整薪資', repay: '償還貸款', benefits: '領取福利', 'buy-storage': '購買倉庫', 'use-education': '使用教育', 'use-health': '使用醫療',
  'use-luxury': '使用奢侈品', 'swap-workers': '交換工人', 'adjust-prices': '調整售價', 'give-bonus': '發放獎金',
};

// 與 applyCommand 相同，但會把行動記進 game.turnLog。真實的對局（伺服器、AI、重播）都用這個；
// AI 試跑與預覽用的複本直接呼叫 applyCommand，不需要紀錄也省掉複製。
export function applyRecorded(game, role, command, allSeated) {
  game.turnLog = normalizeTurnLog(game);
  const turnBefore = game.turn;
  const before = recordable(game, command) ? structuredClone(game) : null;
  applyCommand(game, role, command, allSeated);
  if (game.turn < turnBefore || command.type === 'start') game.turnLog = [];
  game.turnLog ??= [];
  if (before) appendRecord(before, game, role, command);
}

function recordable(game, command) {
  return turnPhases.includes(game.phase) && game.turn < turnsPerRound && !ignored.includes(command.type);
}

// 購買與還款要等「確認／取消待處理交易」才真正發生，記錄時換回原本的行動。
function effectiveCommand(before, command) {
  if (command.type !== 'transaction-confirm') return command;
  const transaction = before.transaction;
  if (transaction?.kind === 'buy') {
    return { type: 'buy', cardId: transaction.cardId, resource: transaction.resource, distribution: transaction.distribution };
  }
  return transaction?.kind === 'repay' ? { type: 'repay' } : null;
}

function appendRecord(before, after, role, command) {
  const { turn } = before;
  const log = after.turnLog;
  const effective = effectiveCommand(before, command);
  if (!effective) return;
  const newLines = after.log.slice(before.log.length);
  const isAction = before.phase === 'action' && (mainTypes.includes(effective.type) || freeTypes.includes(effective.type));
  if (isAction) {
    // 購買等行動先進入待確認交易，確認後才算完成。
    if (after.transaction && command.type !== 'transaction-confirm') return;
    const free = freeTypes.includes(effective.type);
    // 「本回合的主要／免費行動將用完」只是確認前的提醒，紀錄裡不需要。
    const changes = summarizeAction(before, after, role, effective).changes.filter(line => !/^本回合的(主要|免費)行動將用完$/.test(line));
    log.push({
      round: before.match.round, turn, role: roles[turn % roles.length], kind: free ? 'free' : 'main', type: effective.type,
      label: actionLabel(before, role, effective), changes: changes.length ? changes : newLines,
    });
    return;
  }
  // 後續的選擇與表決併入同一回合最近的行動。抽牌與選牌的細節只有出牌者看得到，
  // 所以只收錄公開的日誌；其餘後續步驟沿用確認視窗的說明。
  const last = [...log].reverse().find(entry => entry.turn === turn);
  if (!last) return;
  const lines = command.type === 'card-choice' ? newLines : summarizeAction(before, after, role, command).changes;
  for (const line of lines.length ? lines : newLines) if (!last.changes.includes(line)) last.changes.push(line);
}

function actionLabel(before, role, command) {
  if (command.type !== 'play') return actionLabels[command.type] ?? command.type;
  const card = before.players[role].hand.find(item => item.id === command.cardId);
  return card ? `卡牌效果 · ${cardDefinition(role, card).name}` : '卡牌效果';
}
