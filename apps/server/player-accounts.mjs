import { createHmac, randomBytes } from 'node:crypto';
import { GameError } from '../../packages/engine/game.mjs';
import { passwordHash, same } from './passwords.mjs';

const playerPrefix = 'player:';

function validName(value) {
  const name = typeof value === 'string' ? value.trim().normalize('NFKC') : '';
  if (!name || name.length > 24 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new GameError('請輸入 1 至 24 字的暱稱。');
  return name;
}

function validatePassword(password) {
  if (typeof password !== 'string' || !password.length) throw new GameError('請輸入密碼。');
}

export function createPlayerAccounts({ getSetting, insertSetting, listSettings, updateSetting, deleteSetting, getSaveKey, clientId }) {
  const attempts = new Map();
  const sign = value => createHmac('sha256', getSaveKey()).update('hegemony-player:' + value).digest('hex');
  const find = id => {
    const value = getSetting(playerPrefix + id);
    return value ? JSON.parse(value) : null;
  };
  const all = () => listSettings(playerPrefix).map(row => ({ ...JSON.parse(row.value), id: row.name.slice(playerPrefix.length) }));
  const findByName = name => all().find(player => player.name.toLowerCase() === name.toLowerCase());
  const issue = ({ id, version = 0 }) => {
    const payload = `${Buffer.from(id).toString('base64url')}.${Date.now() + 86_400_000}.${version}`;
    return `${payload}.${sign(payload)}`;
  };
  const throttle = request => {
    const client = clientId(request);
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    if (!attempts.has(client) && attempts.size >= 2048) throw new GameError('登入請求過多，請稍後再試。', 429);
    const attempt = attempts.get(client) ?? { count: 0, until: now + 15 * 60_000 };
    if (attempt.count >= 20) throw new GameError('嘗試次數過多，請稍後再試。', 429);
    attempt.count++;
    attempts.set(client, attempt);
  };
  return {
    // 玩家自己改密碼：要先驗證舊密碼。不更動帳號版本，所以目前已登入的畫面與座位不會被登出。
    async changePassword(request, input) {
      const { id } = this.authenticate(request);
      const { oldPassword, newPassword } = input ?? {};
      validatePassword(oldPassword);
      if (typeof newPassword !== 'string' || newPassword.length < 1) throw new GameError('請輸入新密碼。');
      if (newPassword === oldPassword) throw new GameError('新密碼不能和目前的密碼相同。');
      throttle(request);
      const current = find(id);
      if (!current) throw new GameError('請先登入玩家帳號。', 401);
      const hash = await passwordHash(oldPassword, current.salt, current.hash);
      if (!same(hash, current.hash)) throw new GameError('目前的密碼不正確。', 401);
      const salt = randomBytes(16).toString('hex');
      updateSetting(playerPrefix + id, JSON.stringify({ ...current, salt, hash: await passwordHash(newPassword, salt) }));
      return { ok: true };
    },
    invitationCandidates(excludedIds) {
      return all().filter(player => !excludedIds.has(player.id)).map(player => player.name)
        .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    },
    lookup(name) {
      const player = findByName(validName(name));
      return player && { id: player.id, name: player.name };
    },
    async login(input, register, request) {
      const name = validName(input.name);
      const { password } = input;
      validatePassword(password);
      throttle(request);
      const existing = findByName(name);
      if (register && existing) throw new GameError('這個暱稱已被使用。', 409);
      const salt = existing?.salt ?? randomBytes(16).toString('hex');
      const hash = await passwordHash(password, salt, existing?.hash);
      if (register) {
        const id = randomBytes(16).toString('hex');
        if (findByName(name) || !insertSetting(playerPrefix + id, JSON.stringify({ name, salt, hash }))) {
          throw new GameError('這個暱稱已被使用。', 409);
        }
        return { name, token: issue({ id }) };
      }
      const current = existing && find(existing.id);
      if (!current || current.name.toLowerCase() !== name.toLowerCase() || !same(hash, current.hash)) {
        throw new GameError('暱稱或密碼錯誤。', 401);
      }
      return { name: current.name, token: issue({ id: existing.id, version: current.version }) };
    },
    authenticate(request) {
      const match = /^Bearer (([A-Za-z0-9_-]{1,160})\.(\d{13})(?:\.(\d+))?)\.([a-f0-9]{64})$/.exec(request.headers.authorization ?? '');
      if (!match || Number(match[3]) <= Date.now() || !same(sign(match[1]), match[5])) {
        throw new GameError('請先登入玩家帳號。', 401);
      }
      const id = Buffer.from(match[2], 'base64url').toString('utf8');
      const player = find(id);
      if (!player || (player.version ?? 0) !== Number(match[4] ?? 0)) throw new GameError('請先登入玩家帳號。', 401);
      return { id, name: player.name };
    },
    seatToken(id, code) {
      const player = find(id);
      if (!player) return null;
      return sign(`seat:${code}:${id}${player.version ? `:${player.version}` : ''}`);
    },
    list() {
      return all().map(({ id, name }) => ({ id: Buffer.from(id).toString('base64url'), name }));
    },
    async update(encodedId, input) {
      const id = Buffer.from(encodedId, 'base64url').toString('utf8');
      const name = validName(input.name);
      const password = input.password;
      let replacement = {};
      if (password !== undefined) {
        validatePassword(password);
        const salt = randomBytes(16).toString('hex');
        replacement = { salt, hash: await passwordHash(password, salt) };
      }
      const current = find(id);
      if (!current) throw new GameError('找不到帳號。', 404);
      const duplicate = findByName(name);
      if (duplicate && duplicate.id !== id) throw new GameError('這個暱稱已被使用。', 409);
      updateSetting(playerPrefix + id, JSON.stringify({ ...current, ...replacement, name,
        version: (current.version ?? 0) + Number(password !== undefined) }));
      return { id: encodedId, name };
    },
    remove(encodedId) {
      const id = Buffer.from(encodedId, 'base64url').toString('utf8');
      if (!deleteSetting(playerPrefix + id)) throw new GameError('找不到帳號。', 404);
    },
  };
}
