import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, roles } from '../packages/engine/game.mjs';
import { createRng, randomInt, withRng } from '../packages/engine/random.mjs';
import { runBots } from '../packages/bots/index.mjs';
import { createContext } from '../packages/bots/context.mjs';
import { defaultCandidates } from '../packages/bots/phases.mjs';

const setup = game => JSON.stringify([game.decks, game.content.eventDeck, game.content.exportDeck, game.content.immigration,
  game.economy.companyDecks, game.bag]);

test('a seed fixes the opening setup and every deck order; no seed gives a fresh game', () => {
  assert.equal(setup(createGame({ seed: 11 })), setup(createGame({ seed: 11 })));
  assert.notEqual(setup(createGame({ seed: 11 })), setup(createGame({ seed: 12 })));
  assert.notEqual(setup(createGame()), setup(createGame()));
  assert.match(createGame({ seed: 11 }).rng.seed, /^[0-9a-f]{32}$/);
});

test('each game keeps its own random state even when games are created and played in between', () => {
  const alone = createGame({ seed: 1 });
  const first = createGame({ seed: 1 });
  createGame({ seed: 2 });
  const other = createGame({ seed: 3 });
  applyCommand(other, 'working', { type: 'start' }, true);
  assert.equal(setup(first), setup(alone));
  // 巢狀切換：內層用另一場遊戲的亂數，不會影響外層的計數。
  const a = createRng(1);
  const b = createRng(2);
  withRng(a, () => {
    randomInt(10);
    withRng(b, () => randomInt(10));
    randomInt(10);
  });
  assert.deepEqual([a.counter, b.counter], [2, 1]);
});

test('previews on a copy never consume the real game random state', () => {
  const game = createGame({ seed: 4 });
  applyCommand(game, 'working', { type: 'start' }, true);
  const before = structuredClone(game.rng);
  const copy = structuredClone(game);
  applyCommand(copy, 'working', { type: 'pressure', cardId: copy.players.working.hand[0].id }, true);
  assert.deepEqual(game.rng, before);
  assert(copy.rng.counter >= before.counter);
});

test('a game saved as JSON mid-way continues exactly like the original', { timeout: 60000 }, () => {
  const bots = { working: 'minimal', capitalist: 'minimal', state: 'minimal' };
  const game = createGame({ seed: 21 });
  applyCommand(game, 'working', { type: 'start' }, true);
  runBots(game, bots, { host: 'middle' });
  const restored = JSON.parse(JSON.stringify(game));
  const finish = target => {
    // 真人中產用最簡單的動作，直到終局。
    for (let guard = 0; guard < 400 && target.phase !== 'complete'; guard++) {
      if (target.phase === 'action' && roles[target.turn % 4] === 'middle') {
        const card = target.players.middle.hand[0];
        applyCommand(target, 'middle', target.mainUsed ? { type: 'end' } : { type: 'pressure', cardId: card.id }, true);
      } else if (runBots(target, bots, { host: 'middle' }) === 0) {
        // 輪到中產的非行動步驟（食物、確認、下一輪等）。
        humanStep(target);
      }
    }
    return JSON.stringify([target.log, target.match.final]);
  };
  assert.equal(finish(game), finish(restored));
});

function humanStep(game) {
  const ctx = createContext(game, 'middle');
  const command = ctx.firstValid(defaultCandidates(ctx));
  assert(command, `中產無法前進：${game.phase}`);
  applyCommand(game, 'middle', command, true);
  if (game.transaction) applyCommand(game, game.transaction.role, { type: 'transaction-confirm' }, true);
}
