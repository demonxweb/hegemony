import { randomBytes } from 'node:crypto';
import { DurableObject } from 'cloudflare:workers';
import { createGameApi, json } from './game-api.mjs';
import { createAdminApi } from './admin-api.mjs';
import { GameError } from '../../packages/engine/game.mjs';

export class GameRooms extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, snapshot TEXT NOT NULL) STRICT');
    sql.exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT');
    sql.exec(`CREATE TABLE IF NOT EXISTS room_saves (
    code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    PRIMARY KEY (code, id)
  ) STRICT`);
    const store = {
      clientId: request => request.headers['cf-connecting-ip'] ?? 'unknown',
      readRoom(code) {
        const [room] = sql.exec('SELECT snapshot FROM rooms WHERE code = ?', code).toArray();
        return room ? JSON.parse(room.snapshot) : null;
      },
      saveRoom(room) {
        sql.exec('INSERT INTO rooms VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET snapshot = excluded.snapshot',
          room.code, JSON.stringify(room));
      },
      addRoomSave(room, { id, createdAt }) {
        sql.exec('INSERT INTO room_saves (code, id, created_at, snapshot) VALUES (?, ?, ?, ?)',
          room.code, id, createdAt, JSON.stringify(room));
      },
      listRoomSaves(code) {
        return sql.exec(`SELECT id, created_at AS createdAt,
          json_extract(snapshot, '$.game.match.round') AS round,
          json_extract(snapshot, '$.game.turn') AS turn,
          json_extract(snapshot, '$.game.phase') AS phase
          FROM room_saves WHERE code = ? ORDER BY created_at DESC, id DESC`, code).toArray();
      },
      readRoomSave(code, id) {
        const [row] = sql.exec('SELECT snapshot FROM room_saves WHERE code = ? AND id = ?', code, id).toArray();
        return row ? JSON.parse(row.snapshot) : null;
      },
      deleteRoom(code) {
        return ctx.storage.transactionSync(() => {
          sql.exec('DELETE FROM room_saves WHERE code = ?', code);
          return sql.exec('DELETE FROM rooms WHERE code = ?', code).rowsWritten > 0;
        });
      },
      listRooms() {
        return sql.exec('SELECT snapshot FROM rooms ORDER BY code').toArray().map(row => JSON.parse(row.snapshot));
      },
      getSetting(name) {
        return sql.exec('SELECT value FROM settings WHERE name = ?', name).toArray()[0]?.value;
      },
      insertSetting(name, value) {
        return sql.exec('INSERT OR IGNORE INTO settings VALUES (?, ?)', name, value).rowsWritten > 0;
      },
      listSettings(prefix) {
        return sql.exec('SELECT name, value FROM settings WHERE name GLOB ?', prefix + '*').toArray();
      },
      updateSetting(name, value) {
        return sql.exec('UPDATE settings SET value = ? WHERE name = ?', value, name).rowsWritten > 0;
      },
      deleteSetting(name) {
        return sql.exec('DELETE FROM settings WHERE name = ?', name).rowsWritten > 0;
      },
      getSaveKey() {
        const [key] = sql.exec("SELECT value FROM settings WHERE name = 'save-key'").toArray();
        if (key) return Buffer.from(key.value, 'hex');
        const value = randomBytes(32);
        sql.exec("INSERT INTO settings VALUES ('save-key', ?)", value.toString('hex'));
        return value;
      },
    };
    this.gameApi = createGameApi(store);
    this.adminApi = createAdminApi({ ...store,
      canSetUp: () => true,
      clientId: request => request.headers['cf-connecting-ip'] ?? 'unknown' });
  }

  async fetch(request) {
    const headers = new Headers();
    let status;
    let body;
    const response = {
      setHeader: (name, value) => headers.set(name, value),
      writeHead(code, values) {
        status = code;
        for (const [name, value] of Object.entries(values)) headers.set(name, value);
      },
      end(value) {
        body = value;
      },
    };
    const input = {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      async *[Symbol.asyncIterator]() {
        if (request.body) yield* request.body;
      },
    };
    try {
      const path = new URL(request.url).pathname;
      const route = path.startsWith('/api/admin/') ? this.adminApi : this.gameApi;
      await route(input, response, path);
    } catch (error) {
      if (error instanceof GameError) json(response, error.status, { error: error.message });
      else {
        console.error(error);
        json(response, 500, { error: '伺服器暫時無法處理此請求。' });
      }
    }
    return new Response(body, { status, headers });
  }
}

export default {
  fetch(request, env) {
    return env.GAME_ROOMS.getByName('rooms').fetch(request);
  },
};
