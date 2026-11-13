import { roles } from '../engine/game.mjs';

// 目前正在等待哪些席位行動。回傳空陣列代表遊戲尚未開始、已結束或無人可動。
export function pendingActors(game, host = roles[0]) {
  if (game.transaction) return [game.transaction.role];
  switch (game.phase) {
    case 'action': return [roles[game.turn % roles.length]];
    case 'vote-confirmation': return roles.filter(role => !game.voteConfirmation.confirmed.includes(role));
    case 'policy-choice': return [game.policyChoice.steps[0].role];
    case 'worker-arrival': return [game.workerArrival.role];
    case 'market': return [game.content.marketRole];
    case 'event-penalty': return ['state'];
    case 'production-confirm': return [game.match.productionStep.role];
    case 'demonstration': return ['working'];
    case 'event-hire': return [game.content.eventHire.recipient];
    case 'card-choice': return [game.content.cardChoice.role];
    case 'event-choice': return [game.content.civil.proposed ? 'state' : game.content.civil.recipient];
    case 'needs': return [game.match.needs.role];
    case 'election': {
      const { sides, bids } = game.election;
      const voter = roles.find(role => !(role in sides));
      if (voter) return [voter];
      return roles.filter(role => sides[role] !== 'absent' && !(role in bids));
    }
    case 'scoring': return game.match.round < 5 ? [host] : [];
    default: return [];
  }
}
