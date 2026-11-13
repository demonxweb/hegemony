import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand, createGame, roles } from '../packages/engine/game.mjs';
import { createRecord, ENGINE_VERSION, recordCommand, replayRecord } from '../packages/engine/replay.mjs';
import { runBots } from '../packages/bots/index.mjs';

const allMinimal = Object.fromEntries(roles.map(role => [role, 'minimal']));

// 與伺服器相同的做法：開局時建立紀錄，之後每筆成功的命令都記下來，並保存幾個中途快照供比對。
function recordedGame(seed, checkpoints = []) {
  const game = createGame({ seed });
  const record = createRecord(game);
  applyCommand(game, 'working', { type: 'start' }, true);
  recordCommand(record, game, 'working', { type: 'start' });
  runBots(game, allMinimal, {
    onStep: ({ actor, command }) => {
      recordCommand(record, game, actor, command);
      if (checkpoints.includes(record.commands.length)) checkpoints[checkpoints.indexOf(record.commands.length)] = { step: record.commands.length, state: JSON.stringify(game) };
    },
  });
  return { game, record };
}

test('replaying the recorded commands rebuilds the finished game exactly', { timeout: 60000 }, () => {
  const { game, record } = recordedGame(31);
  assert(record.commands.length > 200);
  assert.equal(record.engineVersion, ENGINE_VERSION);
  const { game: replayed, applied, warnings } = replayRecord(record);
  assert.deepEqual(warnings, []);
  assert.equal(applied, record.commands.length);
  assert.equal(JSON.stringify(replayed), JSON.stringify(game));
  assert.equal(replayed.phase, 'complete');
});

test('replaying only the first N commands gives the state as it was after command N', { timeout: 60000 }, () => {
  const checkpoints = [2, 40, 137];
  const { record } = recordedGame(32, checkpoints);
  for (const { step, state } of checkpoints) {
    assert.equal(typeof step, 'number', '快照應已取得');
    const { game, applied } = replayRecord(record, { upTo: step });
    assert.equal(applied, step);
    assert.equal(JSON.stringify(game), state);
  }
});

test('replay warns instead of throwing when the record no longer matches the engine', { timeout: 60000 }, () => {
  const { record } = recordedGame(33);
  // 版本不符：照常重播，但附上警告。
  const older = { ...record, engineVersion: ENGINE_VERSION - 1 };
  const versioned = replayRecord(older);
  assert.equal(versioned.applied, record.commands.length);
  assert.match(versioned.warnings[0], /引擎版本/);
  // 某筆命令在目前規則下不合法：停在那一筆並說明。
  const broken = structuredClone(record);
  broken.commands[50].command = { type: 'next-round' };
  const stopped = replayRecord(broken);
  assert.equal(stopped.applied, 50);
  assert.match(stopped.warnings.at(-1), /第 51 筆命令無法重播/);
  // 亂數用量與記錄不同（例如抽牌順序改版）：偵測到偏離就停下。
  const drifted = structuredClone(record);
  drifted.commands[80].counter += 1;
  const diverged = replayRecord(drifted);
  // 第 81 筆已執行但結果偏離，之後不再重播。
  assert.equal(diverged.applied, 81);
  assert.match(diverged.warnings.at(-1), /第 81 筆命令後亂數用量/);
});

test('a different seed gives a different game, and the record keeps its seed key', () => {
  const first = recordedGame(34).record;
  const second = recordedGame(35).record;
  assert.match(first.seed, /^[0-9a-f]{32}$/);
  assert.notEqual(first.seed, second.seed);
  assert.equal(createGame({ seed: first.seed }).rng.seed, first.seed);
});
