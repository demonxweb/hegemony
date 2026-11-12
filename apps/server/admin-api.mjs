import { createHmac, randomBytes } from 'node:crypto';
import { json, readJson } from './game-api.mjs';
import { GameError } from '../../packages/engine/game.mjs';
import { passwordHash, same } from './passwords.mjs';
import { createPlayerAccounts } from './player-accounts.mjs';

const hour = 3600_000;

export function createAdminApi({ getSetting, insertSetting, listSettings, updateSetting, deleteSetting, getSaveKey,
  listRooms, deleteRoom, canSetUp, clientId }) {
  const accounts = createPlayerAccounts({ getSetting, insertSetting, listSettings, updateSetting, deleteSetting, getSaveKey, clientId });
  const attempts = new Map();
  const sign = value => createHmac('sha256', getSaveKey()).update('hegemony-admin:' + value).digest('hex');
  const credential = () => getSetting('admin-password');
  return async (request, response, path) => {
    const { method } = request;
    if (method === 'GET' && path === '/api/admin/status') {
      return json(response, 200, { configured: Boolean(credential()) });
    }
    if (method === 'POST' && (path === '/api/admin/setup' || path === '/api/admin/login')) {
      const { password } = await readJson(request);
      const setup = path.endsWith('/setup');
      const stored = credential();
      if (setup && stored) throw new GameError('管理密碼已設定，請登入。', 409);
      if (!setup && !stored) throw new GameError('請先設定管理密碼。', 409);
      if (typeof password !== 'string' || !password.length) {
        throw new GameError('請輸入密碼。', 400);
      }
      if (setup && !canSetUp(request)) {
        throw new GameError('請從本機開啟管理介面，完成首次設定。', 403);
      }
      const client = clientId(request);
      const now = Date.now();
      for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
      if (!attempts.has(client) && attempts.size >= 2048) throw new GameError('登入請求過多，請稍後再試。', 429);
      const attempt = attempts.get(client) ?? { count: 0, until: now + 15 * 60_000 };
      if (attempt.count >= 8) throw new GameError('登入嘗試過多，請稍後再試。', 429);
      attempt.count++;
      attempts.set(client, attempt);
      const [salt, hash] = stored ? stored.split(':') : [randomBytes(16).toString('hex')];
      const computed = await passwordHash(password, salt);
      if (setup) {
        if (!insertSetting('admin-password', `${salt}:${computed}`)) throw new GameError('管理密碼已設定，請登入。', 409);
      } else if (!same(hash, computed)) {
        throw new GameError('管理密碼錯誤。', 401);
      }
      attempts.delete(client);
      const expires = String(Date.now() + 8 * hour);
      const session = `${expires}.${randomBytes(16).toString('hex')}`;
      return json(response, 200, { token: `${session}.${sign(session)}` });
    }
    const token = /^Bearer ((\d{13})\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(request.headers.authorization ?? '');
    if (!credential() || !token || Number(token[2]) <= Date.now() || !same(sign(token[1]), token[3])) {
      throw new GameError('請先登入管理介面。', 401);
    }
    if (method === 'GET' && path === '/api/admin/rooms') return json(response, 200, { rooms: listRooms().map(roomSummary) });
    if (method === 'GET' && path === '/api/admin/players') return json(response, 200, { players: accounts.list() });
    const playerId = /^\/api\/admin\/players\/([A-Za-z0-9_-]{1,160})$/.exec(path)?.[1];
    if (method === 'PATCH' && playerId) return json(response, 200, await accounts.update(playerId, await readJson(request)));
    if (method === 'DELETE' && playerId) {
      accounts.remove(playerId);
      return json(response, 200, { deleted: playerId });
    }
    const code = /^\/api\/admin\/rooms\/([A-F0-9]{8})$/.exec(path)?.[1];
    if (method === 'DELETE' && code) {
      if (!deleteRoom(code)) throw new GameError('找不到房間。', 404);
      return json(response, 200, { deleted: code });
    }
    throw new GameError('找不到頁面。', 404);
  };
}

export function roomSummary({ code, revision, seats, game, waiting }) {
  return { code, revision, phase: game.phase, round: game.match?.round,
    seats: Object.fromEntries(waiting ? waiting.players.map(({ id, name }) => [id, name])
      : Object.entries(seats).map(([role, seat]) => [role, seat.name])) };
}
