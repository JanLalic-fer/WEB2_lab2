import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  db, getAllUsers, getUser, verifyPassword,
  recordFailed, lockUser, resetAttempts,
} from './db.js';

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views'));
app.use(express.urlencoded({ extended: false }));

// --- sesije u memoriji ---
const sessions = new Map();
function createSession(username) {
  const sid = crypto.randomBytes(16).toString('hex');
  sessions.set(sid, username);
  return sid;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > -1) out[c.slice(0, i).trim()] = c.slice(i + 1).trim();
  });
  return out;
}
function currentUser(req) {
  const sid = parseCookies(req).sid;
  return sid ? sessions.get(sid) : undefined;
}

// --- zapisnik pokušaja prijave ---
const loginLog = [];
function logAttempt(username, vulnerable, ok) {
  loginLog.unshift({
    time: new Date().toLocaleTimeString('hr-HR'),
    username, mode: vulnerable ? 'RANJIVO' : 'SIGURNO', ok,
  });
  loginLog.splice(20);
}

function renderPage(res, req, data = {}) {
  res.render('index', {
    sqli: null, login: null,
    user: currentUser(req),
    users: getAllUsers(),
    loginLog, now: Date.now(),
    ...data,
  });
}

app.get('/', (req, res) => renderPage(res, req));

// --- SQL umetanje ---
app.post('/sqli', (req, res) => {
  const owner = req.body.owner ?? '';
  const vulnerable = req.body.vulnerable === 'on';
  let sql, rows = [], error = null;

  if (vulnerable) {
    sql = `SELECT id, owner, title, content FROM notes WHERE owner = '${owner}'`;
    try { rows = db.prepare(sql).all(); } catch (e) { error = e.message; }
  } else {
    sql = 'SELECT id, owner, title, content FROM notes WHERE owner = ?';
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(owner)) {
      error = 'Neispravan unos: dopuštena su samo slova, brojke i _ (najviše 30 znakova).';
    } else {
      rows = db.prepare(sql).all(owner);
    }
  }
  renderPage(res, req, { sqli: { owner, vulnerable, sql, rows, error } });
});

// --- Loša autentifikacija ---
app.post('/login', (req, res) => {
  const username = req.body.username ?? '';
  const password = req.body.password ?? '';
  const vulnerable = req.body.vulnerable === 'on';
  const user = getUser(username);
  let ok = false, message, loggedIn;

  if (vulnerable) {
    // RANJIVO: poruka otkriva detalje, bez zaključavanja, kolačić bez HttpOnly
    if (!user) {
      message = `Korisnik "${username}" ne postoji.`;
    } else if (!verifyPassword(password, user.password_hash)) {
      message = 'Lozinka nije ispravna.';
    } else {
      res.setHeader('Set-Cookie', `sid=${createSession(username)}; Path=/`);
      ok = true; loggedIn = username; message = `Prijavljen kao ${username}.`;
    }
  } else {
    // SIGURNO: zaključavanje nakon 3 pokušaja, generička poruka, HttpOnly
    const now = Date.now();
    if (user && user.locked_until > now) {
      message = 'Previše pokušaja. Račun je privremeno zaključan (5 min).';
    } else if (!user || !verifyPassword(password, user.password_hash)) {
      if (user) {
        recordFailed(username);
        if (getUser(username).failed_attempts >= 3) lockUser(username, now + 5 * 60 * 1000);
      }
      message = 'Pogrešno korisničko ime ili lozinka.';
    } else {
      resetAttempts(username);
      res.setHeader('Set-Cookie', `sid=${createSession(username)}; Path=/; HttpOnly; SameSite=Strict`);
      ok = true; loggedIn = username; message = `Prijavljen kao ${username}.`;
    }
  }

  logAttempt(username, vulnerable, ok);
  renderPage(res, req, { login: { username, vulnerable, ok, message }, user: loggedIn ?? currentUser(req) });
});

app.post('/logout', (req, res) => {
  const sid = parseCookies(req).sid;
  if (sid) sessions.delete(sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  renderPage(res, req, { login: { message: 'Odjavljeni ste.' }, user: undefined });
});

app.listen(port, () => console.log(`Server radi na http://localhost:${port}`));