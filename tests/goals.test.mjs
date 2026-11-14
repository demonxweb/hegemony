import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, playerView, roles } from '../packages/engine/game.mjs';
import { listStrategies, registerStrategy, runBots } from '../packages/bots/index.mjs';
import { createGoalStrategy } from '../packages/bots/strategies/goal.mjs';
import { goalDefinitions, planRound } from '../packages/bots/goals/goals.mjs';
import { indicatorDelta, indicators } from '../packages/bots/goals/indicators.mjs';
import { goalStyles } from '../packages/bots/goals/styles.mjs';
import { createContext } from '../packages/bots/context.mjs';
import { mainActions } from '../packages/bots/goals/actions.mjs';

const start = seed => {
  const game = createGame({ seed });
  applyCommand(game, 'working', { type: 'start' }, true);
  return game;
};

test('the goal styles are registered as selectable strategies', () => {
  const ids = listStrategies().map(item => item.id);
  for (const style of goalStyles) assert(ids.includes(`goal-${style.id}`));
});

test('indicators move the right way: pressure raises political influence, a purchase costs money', () => {
  const game = start(3);
  runBots(game, { working: 'basic', capitalist: 'basic', state: 'basic' }, { host: 'middle' });
  const ctx = createContext(game, 'middle');
  const before = indicators(ctx.view, 'middle');
  for (const key of ['vp', 'money', 'income', 'production', 'cost', 'needs', 'political', 'stock', 'debt']) assert.equal(typeof before[key], 'number', key);
  const pressure = ctx.preview({ type: 'pressure', cardId: ctx.view.hand[0].id });
  assert(indicatorDelta(before, indicators(pressure, 'middle')).political > 0);
  const buy = mainActions(ctx.view, 'middle').find(command => command.type === 'buy' && ctx.preview(command));
  if (buy) assert(indicatorDelta(before, indicators(ctx.preview(buy), 'middle')).money < 0);
});

test('the same state gives a different round plan under different styles', () => {
  const game = start(4);
  const view = playerView(game, 'middle');
  const top = id => planRound(view, 'middle', goalStyles.find(style => style.id === id)).priorities[0].goal;
  assert.equal(top('political'), 'bills');
  const weight = (id, goal) => planRound(view, 'middle', goalStyles.find(style => style.id === id)).priorities.find(item => item.goal === goal).weight;
  assert(weight('frugal', 'cost') > weight('balanced', 'cost') * 1.5);
  assert(weight('growth', 'production') > weight('balanced', 'production'));
  const plan = planRound(view, 'middle', goalStyles[0]);
  assert.deepEqual(plan.priorities.map(item => item.goal).sort(), Object.keys(goalDefinitions).sort());
  assert.deepEqual(plan.priorities.map(item => item.weight), [...plan.priorities.map(item => item.weight)].sort((a, b) => b - a));
});

test('four goal AIs finish a game, and each seat keeps a plan for the final round', { timeout: 120000 }, () => {
  const game = start(6);
  const seats = Object.fromEntries(roles.map((role, index) => [role, `goal-${goalStyles[index].id}`]));
  runBots(game, seats);
  assert.equal(game.phase, 'complete');
  for (const [index, role] of roles.entries()) {
    const plan = game.botPlans[role];
    assert.equal(plan.round, 5);
    assert.equal(plan.style, goalStyles[index].id);
    assert(plan.priorities.length === Object.keys(goalDefinitions).length && plan.last);
  }
});

test('changing only the goal parameters changes behaviour', { timeout: 120000 }, () => {
  const only = goal => ({ id: `only-${goal}`, name: goal, description: '', base: Object.fromEntries(Object.keys(goalDefinitions).map(key => [key, key === goal ? 3 : 0.01])) });
  const proposals = style => {
    registerStrategy(createGoalStrategy(style));
    let count = 0;
    for (const seed of [11, 12, 13]) {
      const game = start(seed);
      runBots(game, { working: 'basic', capitalist: 'basic', state: 'basic', middle: `goal-${style.id}` }, {
        onStep: ({ actor, command }) => { if (actor === 'middle' && command.type === 'propose') count++; },
      });
    }
    return count;
  };
  assert(proposals(only('bills')) > proposals(only('production')));
});
