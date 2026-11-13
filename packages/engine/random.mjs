import * as crypto from 'node:crypto';

// 每場遊戲有自己的亂數狀態 game.rng = { seed, counter }，隨遊戲一起存檔與複製。
// 亂數由 SHA-256(seed:counter) 產生：同一個種子與同一串抽取必得同一結果，
// 但由輸出（例如手牌 id）無法反推種子或預測牌庫順序。
// 只有在 withRng() 範圍內才使用遊戲的亂數；範圍外（例如預覽、單元測試直接呼叫）退回系統亂數。
let active = null;

// seed 省略時以系統亂數產生 128 位元種子；給定數字或字串時由它導出，供測試與重播使用。
// 傳入先前記錄下來的 32 位十六進位種子時原樣沿用，因此 createRng(rng.seed) 能重建同一場遊戲。
export function createRng(seed) {
  const key = seed === undefined || seed === null
    ? crypto.randomBytes(16).toString('hex')
    : typeof seed === 'string' && /^[0-9a-f]{32}$/.test(seed) ? seed
      : crypto.createHash('sha256').update(`hegemony-seed:${seed}`).digest('hex').slice(0, 32);
  return { seed: key, counter: 0 };
}

function block(rng) {
  return crypto.createHash('sha256').update(`${rng.seed}:${rng.counter++}`).digest();
}

export function withRng(rng, fn) {
  const previous = active;
  active = rng;
  try {
    return fn();
  } finally {
    active = previous;
  }
}

export function randomInt(max) {
  if (!active) return crypto.randomInt(max);
  // 拒絕取樣，避免取餘數造成偏差。
  const limit = 0x100000000 - (0x100000000 % max);
  for (;;) {
    const value = block(active).readUInt32BE(0);
    if (value < limit) return value % max;
  }
}

export function randomUUID() {
  if (!active) return crypto.randomUUID();
  const bytes = block(active).subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
