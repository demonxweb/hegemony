import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, playerView, roles } from '../packages/engine/game.mjs';
import { provide, takeBenefits } from '../packages/engine/events.mjs';
import { runBots } from '../packages/bots/index.mjs';

test('welfare given to a class and collected by it are recorded for the round', () => {
  const game = createGame({ seed: 14 });
  applyCommand(game, 'working', { type: 'start' }, true);
  game.publicServices.health = 6;
  provide(game, 'working', 'health', 2);
  provide(game, 'middle', 'health', 3, true);
  assert.deepEqual(game.match.welfare.given, { working: { health: 2 }, middle: { health: 3 } });
  assert.deepEqual(game.match.welfare.taken, {});
  takeBenefits(game, 'working');
  assert.deepEqual(game.match.welfare.taken, { working: { health: 2 } });
  assert.deepEqual(playerView(game, 'capitalist').match.history, []);
});

test('each finished round keeps its own welfare record', { timeout: 60000 }, () => {
  const game = createGame({ seed: 15 });
  applyCommand(game, 'working', { type: 'start' }, true);
  runBots(game, Object.fromEntries(roles.map(role => [role, 'basic'])));
  const rows = playerView(game, 'working').match.history;
  assert.equal(rows.length, 5);
  assert(rows.every(row => row.welfare && typeof row.welfare.given === 'object' && typeof row.welfare.taken === 'object'));
  // 每一輪的紀錄互相獨立，不是同一個被累加的物件。
  assert.equal(new Set(rows.map(row => row.welfare)).size, 5);
});
