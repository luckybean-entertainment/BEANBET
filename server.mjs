// server.mjs
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import crypto from 'crypto';

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
    password TEXT,
    balance REAL DEFAULT 1000
  )
`).run();

// Простая генерация токена
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Таблица токенов
const tokens = {};

// Регистрация
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Некорректные данные' });
  
  try {
    db.prepare('INSERT INTO users(username, password) VALUES (?, ?)').run(username, password);
    const token = generateToken();
    tokens[token] = username;
    res.json({ token, username });
  } catch (e) {
    res.status(400).json({ error: 'Имя пользователя уже занято' });
  }
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=? AND password=?').get(username, password);
  if (!user) return res.status(400).json({ error: 'Неверные имя или пароль' });
  
  const token = generateToken();
  tokens[token] = username;
  res.json({ token, username });
});

// Middleware для авторизации по токену
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Нет токена' });
  const token = authHeader.split(' ')[1];
  const username = tokens[token];
  if (!username) return res.status(401).json({ error: 'Токен недействителен' });
  req.user = username;
  next();
}

// Баланс
app.get('/balance', auth, (req, res) => {
  const row = db.prepare('SELECT balance FROM users
