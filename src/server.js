import express from 'express';
import path from 'node:path';
import { db } from './db.js';

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views'));
app.use(express.urlencoded({ extended: false }));

function renderPage(res, data = {}) {
  res.render('index', { sqli: null, ...data });
}

app.get('/', (req, res) => renderPage(res));

app.post('/sqli', (req, res) => {
  const owner = req.body.owner ?? '';
  const vulnerable = req.body.vulnerable === 'on';
  let sql;
  let rows = [];
  let error = null;

  if (vulnerable) {
    // RANJIVO: korisnikov unos se izravno ugrađuje u SQL tekst
    sql = `SELECT id, owner, title, content FROM notes WHERE owner = '${owner}'`;
    try {
      rows = db.prepare(sql).all();
    } catch (e) {
      error = e.message;
    }
  } else {
    // SIGURNO: provjera unosa + parametrizirani upit
    sql = 'SELECT id, owner, title, content FROM notes WHERE owner = ?';
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(owner)) {
      error = 'Neispravan unos: dopuštena su samo slova, brojke i _ (najviše 30 znakova).';
    } else {
      rows = db.prepare(sql).all(owner);
    }
  }

  renderPage(res, { sqli: { owner, vulnerable, sql, rows, error } });
});

app.listen(port, () => {
  console.log(`Server radi na http://localhost:${port}`);
});