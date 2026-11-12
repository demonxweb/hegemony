import { randomBytes } from 'node:crypto';
import { DurableObject } from 'cloudflare:workers';
import { createGameApi, json } from './game-api.mjs';
import { GameError } from '../../packages/engine/game.mjs';

export class GameRooms extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, snapshot TEXT NOT NULL) STRICT');
    sql.exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT');
    this.route = createGameApi({
      instance: randomBytes(8).toString('hex'),
      allowDelete: () => true,
      readRoom(code) {
        const [room] = sql.exec('SELECT snapshot FROM rooms WHERE code = ?', code).toArray();
        return room ? JSON.parse(room.snapshot) : null;
      },
      saveRoom(room) {
        sql.exec('INSERT INTO rooms VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET snapshot = excluded.snapshot',
          room.code, JSON.stringify(room));
      },
      deleteRoom(code) {
        sql.exec('DELETE FROM rooms WHERE code = ?', code);
      },
      getSaveKey() {
        const [key] = sql.exec("SELECT value FROM settings WHERE name = 'save-key'").toArray();
        if (key) return Buffer.from(key.value, 'hex');
        const value = randomBytes(32);
        sql.exec("INSERT INTO settings VALUES ('save-key', ?)", value.toString('hex'));
        return value;
      },
    });
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
      await this.route(input, response, new URL(request.url).pathname);
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
    if (new URL(request.url).pathname === '/quick') return Response.redirect(new URL('/', request.url), 302);
    return env.GAME_ROOMS.getByName('rooms').fetch(request);
  },
};
