// server.mjs
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express();
const port = process.env.PORT || 3000;

// Включаем CORS для всех источников
app.use(cors({ origin: '*' }));
app.use(express.json());

// Подключаем базу
const db = new Database('database.db');

// Создаем таблицу пользователей, если нет
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    balance REAL DEFAULT 1000
  )
`).run();

// Получить баланс пользователя
app.get('/balance/:username', (req, res) => {
  const username = req.params.username;
  const row = db.prepare('SELECT balance FROM users WHERE username = ?').get(username);
  if (row) {
    res.json({ balance: row.balance });
  } else {
    // Если пользователя нет, создаем нового
    db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    res.json({ balance: 1000 });
  }
});

// Сделать ставку
app.post('/bet', (req, res) => {
  const { username, amount, color } = req.body;
  if (!username || !amount || !color) {
    return res.status(400).json({ error: 'Некорректные данные' });
  }

  let user = db.prepare('SELECT balance FROM users WHERE username = ?').get(username);
  if (!user) {
    db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    user = { balance: 1000 };
  }

  let newBalance = user.balance;
  // Простейшая логика выигрыша (пример)
  const rnd = Math.random() * 100;
  const win = (color === 'green' && rnd < 1) || 
              (color === 'red' && rnd >= 1 && rnd < 50) || 
              (color === 'black' && rnd >= 50);

  if (win) newBalance += amount;
  else newBalance -= amount;

  db.prepare('UPDATE users SET balance = ? WHERE username = ?').run(newBalance, username);
  res.json({ balance: newBalance, win });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
