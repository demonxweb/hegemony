import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openRoomStore(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, 'rooms.sqlite'));
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
    if (db.prepare('PRAGMA user_version').get().user_version === 0) {
      db.exec('CREATE TABLE rooms (code TEXT PRIMARY KEY, snapshot TEXT NOT NULL) STRICT');
      const insert = db.prepare('INSERT INTO rooms (code, snapshot) VALUES (?, ?)');
      for (const file of readdirSync(directory, { withFileTypes: true })) {
        if (!file.isFile() || !/^[A-F0-9]{8}\.json$/.test(file.name)) continue;
        const code = file.name.slice(0, -5);
        try {
          const room = JSON.parse(readFileSync(join(directory, file.name), 'utf8'));
          if (room?.code !== code || !room.game || !room.seats || !room.processed) {
            throw new Error('Invalid room snapshot');
          }
          insert.run(code, JSON.stringify(room));
        } catch (cause) {
          throw new Error(`Unable to migrate room ${file.name}`, { cause });
        }
      }
      db.exec('PRAGMA user_version = 1');
    }
    db.exec(`CREATE TABLE IF NOT EXISTS room_saves (
    code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    PRIMARY KEY (code, id)
  ) STRICT`);
    db.exec('COMMIT');
  } catch (error) {
    db.close();
    throw error;
  }
  const select = db.prepare('SELECT snapshot FROM rooms WHERE code = ?');
  const save = db.prepare(`INSERT INTO rooms (code, snapshot) VALUES (?, ?)
    ON CONFLICT(code) DO UPDATE SET snapshot = excluded.snapshot`);
  const remove = db.prepare('DELETE FROM rooms WHERE code = ?');
  db.exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT');
  const getSetting = db.prepare('SELECT value FROM settings WHERE name = ?');
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings VALUES (?, ?)');
  const listSettings = db.prepare('SELECT name, value FROM settings WHERE name GLOB ?');
  const updateSetting = db.prepare('UPDATE settings SET value = ? WHERE name = ?');
  const deleteSetting = db.prepare('DELETE FROM settings WHERE name = ?');
  const list = db.prepare('SELECT snapshot FROM rooms ORDER BY code');
  const insertSave = db.prepare('INSERT INTO room_saves (code, id, created_at, snapshot) VALUES (?, ?, ?, ?)');
  const listSaves = db.prepare(`SELECT id, created_at AS createdAt,
      json_extract(snapshot, '$.game.match.round') AS round,
      json_extract(snapshot, '$.game.turn') AS turn,
      json_extract(snapshot, '$.game.phase') AS phase
      FROM room_saves WHERE code = ? ORDER BY created_at DESC, id DESC`);
  const selectSave = db.prepare('SELECT snapshot FROM room_saves WHERE code = ? AND id = ?');
  return {
    addRoomSave(room, { id, createdAt }) {
      insertSave.run(room.code, id, createdAt, JSON.stringify(room));
    },
    listRoomSaves(code) {
      return listSaves.all(code);
    },
    readRoomSave(code, id) {
      const row = selectSave.get(code, id);
      return row ? JSON.parse(row.snapshot) : null;
    },
    readRoom(code) {
      const row = select.get(code);
      return row ? JSON.parse(row.snapshot) : null;
    },
    saveRoom(room) {
      save.run(room.code, JSON.stringify(room));
    },
    deleteRoom(code) {
      return remove.run(code).changes > 0;
    },
    listRooms() {
      return list.all().map(row => JSON.parse(row.snapshot));
    },
    getSetting(name) {
      return getSetting.get(name)?.value;
    },
    insertSetting(name, value) {
      return insertSetting.run(name, value).changes > 0;
    },
    listSettings(prefix) {
      return listSettings.all(prefix + '*');
    },
    updateSetting(name, value) {
      return updateSetting.run(value, name).changes > 0;
    },
    deleteSetting(name) {
      return deleteSetting.run(name).changes > 0;
    },
  };
}
