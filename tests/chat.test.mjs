import assert from 'node:assert/strict';
import test from 'node:test';
import { appendChat } from '../apps/server/game-api.mjs';

test('room chat keeps only the latest 50 messages', () => {
  let chat = [];
  for (let index = 1; index <= 60; index++) {
    chat = appendChat(chat, { role: 'working', name: '勞工', text: `訊息 ${index}` });
  }
  assert.equal(chat.length, 50);
  assert.equal(chat[0].text, '訊息 11');
  assert.equal(chat[0].id, 11);
  assert.equal(typeof chat[0].at, 'number');
  assert.equal(chat.at(-1).text, '訊息 60');
  assert.equal(chat.at(-1).id, 60);
  assert.equal(appendChat(chat, { role: 'middle', name: '中產', text: '下一則' }).length, 50);
});
