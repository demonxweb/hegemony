import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, roles } from '../packages/engine/game.mjs';
import { getStrategy, listStrategies, registerStrategy, runBots } from '../packages/bots/index.mjs';
import minimal from '../packages/bots/strategies/minimal.mjs';
import { playGame } from '../scripts/bot-arena.mjs';

const allMinimal = Object.fromEntries(roles.map(role => [role, 'minimal']));

test('registry lists strategies and falls back to the default for unknown ids', () => {
  const ids = listStrategies().map(item => item.id);
  assert(ids.includes('minimal') && ids.includes('basic'));
  assert.equal(getStrategy('does-not-exist').id, 'minimal');
  assert.equal(getStrategy(undefined).id, 'minimal');
});

test('the same seed replays the same game', { timeout: 60000 }, () => {
  const run = () => {
    const { game } = playGame({ seed: 7, seats: allMinimal });
    return JSON.stringify([game.match.final, game.log]);
  };
  assert.equal(run(), run());
  const different = playGame({ seed: 8, seats: allMinimal }).game;
  assert.notEqual(JSON.stringify(different.log), JSON.stringify(playGame({ seed: 7, seats: allMinimal }).game.log));
});

test('four minimal bots finish five rounds without an illegal command', { timeout: 120000 }, () => {
  for (const seed of [1, 2, 3, 4]) {
    const { game, steps } = playGame({ seed, seats: allMinimal });
    assert.equal(game.phase, 'complete', `seed ${seed}`);
    assert.equal(game.match.round, 5);
    assert.equal(game.match.final.results.length, 4);
    assert(steps > 100);
  }
});

test('each seat uses its own strategy', { timeout: 60000 }, () => {
  const calls = { working: 0, middle: 0, capitalist: 0, state: 0 };
  const spy = role => ({ ...minimal, id: `spy-${role}`, turn(ctx) { calls[role]++; return minimal.turn(ctx); } });
  for (const role of roles) registerStrategy(spy(role));
  const seats = Object.fromEntries(roles.map(role => [role, `spy-${role}`]));
  playGame({ seed: 3, seats });
  // 每席每輪有 5 次主要行動，共 5 輪。
  for (const role of roles) assert(calls[role] >= 25, `${role} ${calls[role]}`);
});

test('bots stop and wait when a human seat is up, then continue after the human acts', () => {
  const game = createGame({ seed: 5 });
  applyCommand(game, 'working', { type: 'start' }, true);
  const bots = { working: 'minimal', capitalist: 'minimal', state: 'minimal' };
  runBots(game, bots, { host: 'middle' });
  assert.equal(game.phase, 'action');
  assert.equal(roles[game.turn % 4], 'middle');
  assert.equal(game.turn, 1);
  const card = game.players.middle.hand[0];
  applyCommand(game, 'middle', { type: 'pressure', cardId: card.id }, true);
  applyCommand(game, 'middle', { type: 'end' }, true);
  runBots(game, bots, { host: 'middle' });
  assert.equal(game.turn, 5);
  assert.equal(roles[game.turn % 4], 'middle');
});

test('a stronger strategy scores measurably higher than the baseline over the same seeds', { timeout: 180000 }, () => {
  const seeds = Array.from({ length: 12 }, (_, index) => 100 + index);
  const score = strategy => seeds.map(seed => {
    const { game } = playGame({ seed, seats: { ...allMinimal, working: strategy } });
    return game.match.final.results.find(item => item.role === 'working');
  }).map(item => item.total ?? item.vp);
  const basic = score('basic');
  const base = score('minimal');
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert(mean(basic) > mean(base) + 5, `basic ${mean(basic)} vs minimal ${mean(base)}`);
});
