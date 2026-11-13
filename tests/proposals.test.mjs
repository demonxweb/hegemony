import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, playerView, roles } from '../packages/engine/game.mjs';
import { recordProposal } from '../packages/engine/proposals.mjs';
import { checkIMF } from '../packages/engine/rounds.mjs';
import { runBots } from '../packages/bots/index.mjs';

test('every proposal is logged with its round, proposer and result', { timeout: 60000 }, () => {
  const game = createGame({ seed: 12 });
  applyCommand(game, 'working', { type: 'start' }, true);
  runBots(game, Object.fromEntries(roles.map(role => [role, 'minimal'])));
  const { proposals, voteResults } = playerView(game, 'working');
  assert(proposals.length > 0);
  assert(proposals.every(item => roles.includes(item.role) && item.round >= 1 && item.round <= 5 && item.target && typeof item.policy === 'number'));
  assert.deepEqual(proposals.map(item => item.round), [...proposals.map(item => item.round)].sort((a, b) => a - b));
  // 每一次表決都對應一筆提案結果，通過與否一致。
  const decided = proposals.filter(item => ['passed', 'failed'].includes(item.status));
  assert.equal(decided.length, voteResults.length);
  assert.equal(decided.filter(item => item.status === 'passed').length, voteResults.filter(result => result.passed).length);
  assert(decided.every(item => Number.isInteger(item.favor) && Number.isInteger(item.against)));
  // 打完整局後不應還有待表決的提案。
  assert(proposals.every(item => item.status !== 'pending'));
});

test('bills cancelled by the IMF are marked as such', () => {
  const game = createGame({ seed: 13 });
  applyCommand(game, 'working', { type: 'start' }, true);
  const bill = { role: 'state', policy: 2, target: 'B' };
  game.bills.push(bill);
  recordProposal(game, bill, false);
  game.economy.loans.state = 99;
  game.treasury = 0;
  assert.equal(checkIMF(game, true).intervened, true);
  assert.deepEqual(game.proposals.map(item => [item.role, item.policy, item.status]), [['state', 2, 'canceled']]);
});

test('the AI State finishes the public company choice after a bill passes (human votes for everything)', { timeout: 120000 }, async () => {
  const { defaultCandidates } = await import('../packages/bots/phases.mjs');
  const game = createGame({ seed: 1 });
  applyCommand(game, 'working', { type: 'start' }, true);
  const bots = { middle: 'basic', capitalist: 'basic', state: 'minimal' };
  for (let guard = 0; guard < 3000 && game.phase !== 'complete'; guard++) {
    runBots(game, bots, { host: 'working' });
    if (game.phase === 'complete') break;
    const view = playerView(game, 'working');
    const commands = game.transaction ? [{ type: 'transaction-confirm' }]
      : game.phase === 'action' ? [game.mainUsed ? { type: 'end' } : { type: 'pressure', cardId: view.hand[0].id }]
        : game.phase === 'election' && view.election.nextVoter === 'working' ? [{ type: 'side', side: 'for' }]
          : game.phase === 'election' && !view.election.nextVoter ? [{ type: 'bid', electionId: view.election.id, amount: view.players.working.influence }]
            : defaultCandidates({ role: 'working', view, phase: game.phase });
    const command = commands.find(item => {
      try {
        applyCommand(structuredClone(game), 'working', structuredClone(item), true);
        return true;
      } catch {
        return false;
      }
    });
    assert(command, `human stuck in ${game.phase}`);
    applyCommand(game, 'working', command, true);
  }
  assert.equal(game.phase, 'complete');
  assert(game.proposals.some(item => item.status === 'passed'));
});
