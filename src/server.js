import express from 'express';
import { getAllNotes } from './db.js';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json(getAllNotes());
});

app.listen(port, () => {
  console.log(`Server radi na http://localhost:${port}`);
});