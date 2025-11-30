// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Подключение к базе данных SQLite
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

// Создание таблицы пользователей (если не существует)
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    balance INTEGER DEFAULT 10000,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// Получение таблицы лидеров
app.get('/leaders', (req, res) => {
  db.all(`SELECT username, balance FROM users ORDER BY balance DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Добавление или обновление пользователя
app.post('/update', (req, res) => {
  const { username, balance } = req.body;
  if (!username || balance == null) return res.status(400).json({ error: 'username и balance обязательны' });

  db.run(
    `INSERT INTO users(username, balance) 
     VALUES(?, ?) 
     ON CONFLICT(username) DO UPDATE SET balance=excluded.balance, last_active=CURRENT_TIMESTAMP`,
    [username, balance],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
