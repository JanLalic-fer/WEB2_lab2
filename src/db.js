import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return test === hash;
}

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0
  );
`);

const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
[
  ['ana', 'ana123'],
  ['marko', 'qwerty'],
  ['admin', 'fer2026'],
].forEach(([u, p]) => insertUser.run(u, hashPassword(p)));

export function getUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getAllUsers() {
  return db.prepare('SELECT * FROM users ORDER BY id').all();
}

export function recordFailed(username) {
  db.prepare('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE username = ?').run(username);
}

export function lockUser(username, until) {
  db.prepare('UPDATE users SET locked_until = ? WHERE username = ?').run(until, username);
}

export function resetAttempts(username) {
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE username = ?').run(username);
}