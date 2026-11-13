import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, playerView, roles } from '../packages/engine/game.mjs';
import { runBots } from '../packages/bots/index.mjs';

test('each wage payment is recorded and each recipient only sees their own', { timeout: 60000 }, () => {
  const game = createGame({ seed: 9 });
  applyCommand(game, 'working', { type: 'start' }, true);
  let checked = 0;
  runBots(game, Object.fromEntries(roles.map(role => [role, 'minimal'])), {
    onStep: () => {
      const payments = game.match.wagePayments ?? [];
      if (game.phase !== 'production-confirm' || !payments.length) return;
      for (const recipient of ['working', 'middle']) {
        const mine = playerView(game, recipient).match.wagePayments;
        assert.deepEqual(mine, payments.filter(item => item.recipient === recipient));
      }
      assert.deepEqual(playerView(game, 'capitalist').match.wagePayments, []);
      assert.equal(playerView(game, 'working').match.pendingWorkingWages, game.match.pendingWorkingWages);
      assert.equal(playerView(game, 'middle').match.pendingWorkingWages, undefined);
      for (const item of payments) {
        assert(['state', 'capitalist', 'middle'].includes(item.payer) && item.payer !== item.recipient && item.wage > 0 && item.company);
      }
      checked++;
    },
  });
  assert(checked > 0);
  // 每輪發薪前清空：第 5 輪結束時只剩最後一輪的紀錄。
  const total = game.match.wagePayments.reduce((sum, item) => sum + item.wage, 0);
  assert(total > 0 && total < 1000);
});
