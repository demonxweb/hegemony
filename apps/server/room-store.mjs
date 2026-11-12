import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openRoomStore(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, 'rooms.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
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
    db.exec('COMMIT');
  } catch (error) {
    db.close();
    throw error;
  }
  const select = db.prepare('SELECT snapshot FROM rooms WHERE code = ?');
  const save = db.prepare(`INSERT INTO rooms (code, snapshot) VALUES (?, ?)
    ON CONFLICT(code) DO UPDATE SET snapshot = excluded.snapshot`);
  const remove = db.prepare('DELETE FROM rooms WHERE code = ?');
  return {
    readRoom(code) {
      const row = select.get(code);
      return row ? JSON.parse(row.snapshot) : null;
    },
    saveRoom(room) {
      save.run(room.code, JSON.stringify(room));
    },
    deleteRoom(code) {
      remove.run(code);
    },
  };
}
