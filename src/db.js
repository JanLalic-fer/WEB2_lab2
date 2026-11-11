import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(import.meta.dirname, '..', 'data');
const dbFile = path.join(dataDir, 'app.db');

fs.mkdirSync(dataDir, { recursive: true });
fs.rmSync(dbFile, { force: true });

export const db = new DatabaseSync(dbFile);

db.exec(`
  CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL
  );
`);

const insertNote = db.prepare('INSERT INTO notes (owner, title, content) VALUES (?, ?, ?)');
[
  ['ana', 'Kupovina', 'Mlijeko, kruh, jaja'],
  ['ana', 'Rođendan', 'Kupiti poklon za Marka do petka'],
  ['marko', 'PIN kartice', '4821'],
  ['marko', 'Wi-Fi lozinka', 'Kuca2026!'],
  ['admin', 'Backup', 'Backup servera svaki dan u 03:00'],
  ['admin', 'Root lozinka', 'S3cr3t-r00t'],
].forEach((note) => insertNote.run(...note));

export function getAllNotes() {
  return db.prepare('SELECT * FROM notes ORDER BY id').all();
}