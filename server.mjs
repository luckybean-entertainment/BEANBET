import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const db = new Database('database.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    balance REAL DEFAULT 1000
  )
`).run();

const dailyLimits = new Map(); // key=username, value={count, lastDate}

// Эндпоинт для получения миллиона
app.post('/get-million', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Нет токена' });
  const username = auth.split(' ')[1]; // токен = username для простоты

  const today = new Date().toDateString();
  let userLimit = dailyLimits.get(username);
  if (!userLimit || userLimit.lastDate !== today) {
    userLimit = { count: 0, lastDate: today };
  }

  if (userLimit.count >= 3) return res.status(400).json({ error: 'Вы уже брали миллион 3 раза сегодня' });

  let user = db.prepare('SELECT balance FROM users WHERE username=?').get(username);
  if (!user) db.prepare('INSERT INTO users(username) VALUES (?)').run(username);
  const newBalance = (user?.balance || 0) + 1_000_000;
  db.prepare('UPDATE users SET balance=? WHERE username=?').run(newBalance, username);

  userLimit.count++;
  dailyLimits.set(username, userLimit);

  res.json({ balance: newBalance });
});

// Эндпоинт баланса
app.get('/balance', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Нет токена' });
  const username = auth.split(' ')[1];

  let user = db.prepare('SELECT balance FROM users WHERE username=?').get(username);
  if (!user) {
    db.prepare('INSERT INTO users(username) VALUES (?)').run(username);
    user = { balance: 1000 };
  }
  res.json({ balance: user.balance });
});

app.listen(port, ()=>console.log(`Server running on port ${port}`));
