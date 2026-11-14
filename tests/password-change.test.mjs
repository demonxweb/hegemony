import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('a player can change their own password after confirming the old one', { timeout: 30000 }, async () => {
  const store = await mkdtemp(join(tmpdir(), 'hegemony-password-'));
  const child = spawn(process.execPath, ['apps/server/server.mjs'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', HEGEMONY_STORE: store },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  try {
    const [data] = await once(child.stdout, 'data');
    const origin = data.toString().trim().split(' ').at(-1);
    const call = async (path, body, token, status = 200) => {
      const response = await fetch(origin + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify(result));
      return result;
    };
    const account = await call('/api/player/register', { name: 'Ann', password: 'old-pass' });
    await call('/api/player/password', { oldPassword: 'old-pass', newPassword: 'x' }, undefined, 401);
    await call('/api/player/password', { oldPassword: 'wrong', newPassword: 'new-pass' }, account.token, 401);
    await call('/api/player/password', { oldPassword: 'old-pass', newPassword: 'old-pass' }, account.token, 400);
    await call('/api/player/password', { oldPassword: 'old-pass', newPassword: '' }, account.token, 400);
    await call('/api/player/password', { oldPassword: 'old-pass', newPassword: 'new-pass' }, account.token);
    await call('/api/player/login', { name: 'Ann', password: 'old-pass' }, undefined, 401);
    const login = await call('/api/player/login', { name: 'Ann', password: 'new-pass' });
    assert.equal(login.name, 'Ann');
    // 目前的登入不會因為改密碼而失效。
    const rooms = await fetch(origin + '/api/player/rooms', { headers: { Authorization: `Bearer ${account.token}` } });
    assert.equal(rooms.status, 200);
  } finally {
    const done = once(child, 'exit');
    child.kill();
    await done;
    for (const file of await readdir(store)) await rm(join(store, file));
    await rmdir(store);
  }
});
