import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, playerView, roles } from '../packages/engine/game.mjs';
import { applyRecorded } from '../packages/engine/turns.mjs';
import { runBots } from '../packages/bots/index.mjs';

const start = seed => {
  const game = createGame({ seed });
  applyCommand(game, 'working', { type: 'start' }, true);
  return game;
};

test('each recorded action carries its round, turn, kind, label and the confirmation details', { timeout: 60000 }, () => {
  const game = start(3);
  let rounds = 0;
  let lastRound = 1;
  const kinds = new Set();
  runBots(game, Object.fromEntries(roles.map(role => [role, 'basic'])), {
    onStep: () => {
      for (const entry of game.turnLog) {
        assert.equal(entry.role, roles[entry.turn % 4]);
        assert(['main', 'free'].includes(entry.kind) && entry.label && entry.changes.length > 0);
        assert.equal(entry.round, game.match.round);
        kinds.add(entry.kind);
      }
      assert.deepEqual(game.turnLog.map(entry => entry.turn), [...game.turnLog.map(entry => entry.turn)].sort((a, b) => a - b));
      if (game.match.round !== lastRound) {
        lastRound = game.match.round;
        rounds++;
        // 新的一輪開始時，上一輪的行動不會留下來。
        assert.equal(game.turnLog.length, 0);
      }
    },
  });
  assert.equal(rounds, 4);
  assert.deepEqual([...kinds].sort(), ['free', 'main']);
});

test('a main action lists the same lines as its confirmation, and free actions are kept apart', () => {
  const game = start(5);
  const bots = { working: 'minimal', capitalist: 'minimal', state: 'minimal' };
  runBots(game, bots, { host: 'middle' });
  const card = game.players.middle.hand[0];
  applyRecorded(game, 'middle', { type: 'pressure', cardId: card.id }, true);
  const [working, middle] = game.turnLog;
  assert.equal(working.role, 'working');
  assert.deepEqual([middle.round, middle.turn, middle.role, middle.kind, middle.type, middle.label], [1, 1, 'middle', 'main', 'pressure', '施加政治壓力']);
  assert(middle.changes.some(line => line.startsWith('棄掉手牌')));
  assert(!middle.changes.some(line => line.includes('將用完')));
  assert.deepEqual(playerView(game, 'state').turnLog, game.turnLog);
});

test('plain applyCommand (previews, AI trials) leaves the log alone', () => {
  const game = start(6);
  const before = structuredClone(game.turnLog);
  const copy = structuredClone(game);
  applyCommand(copy, 'working', { type: 'pressure', cardId: copy.players.working.hand[0].id }, true);
  assert.deepEqual(copy.turnLog, before);
});

test('rooms saved with the early line-based log still open and keep recording', () => {
  const game = start(7);
  game.turnLog = [{ turn: 0, role: 'working', lines: ['勞工施加政治壓力。'] }];
  const [entry] = playerView(game, 'middle').turnLog;
  assert.deepEqual([entry.round, entry.turn, entry.role, entry.kind, entry.changes], [1, 0, 'working', 'main', ['勞工施加政治壓力。']]);
  game.turn = 1;
  applyRecorded(game, 'middle', { type: 'pressure', cardId: game.players.middle.hand[0].id }, true);
  assert.deepEqual(game.turnLog.map(item => item.turn), [0, 1]);
  assert(game.turnLog.every(item => Array.isArray(item.changes)));
});
