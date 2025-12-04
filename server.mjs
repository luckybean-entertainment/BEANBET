// server.mjs
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_with_secure_secret";

// middlewares
app.use(cors({ origin: "*" }));
app.use(express.json());

// DB
const db = new Database("database.db");

// create users table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    passwordHash TEXT,
    balance REAL DEFAULT 10000,
    created_at TEXT DEFAULT (datetime('now'))
  );
`).run();

// helper: create token
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

// auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "NO_TOKEN" });
  const token = auth.slice(7);
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data; // { id, username }
    next();
  } catch (e) {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

/* ====== API ====== */

// регистрация
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "MISSING_FIELDS" });
  const u = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (u) return res.status(400).json({ error: "USERNAME_TAKEN" });

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  const info = db.prepare("INSERT INTO users (username, passwordHash, balance) VALUES (?, ?, ?)").run(username, hash, 10000);
  const id = info.lastInsertRowid;
  const token = createToken({ id, username });

  res.json({ ok: true, token, username, balance: 10000 });
});

// логин
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "MISSING_FIELDS" });
  const row = db.prepare("SELECT id, passwordHash, balance FROM users WHERE username = ?").get(username);
  if (!row) return res.status(400).json({ error: "INVALID_CREDENTIALS" });

  const valid = bcrypt.compareSync(password, row.passwordHash);
  if (!valid) return res.status(400).json({ error: "INVALID_CREDENTIALS" });

  const token = createToken({ id: row.id, username });
  res.json({ ok: true, token, username, balance: row.balance });
});

// получить баланс (только авторизованный)
app.get("/balance", authMiddleware, (req, res) => {
  const { username } = req.user;
  const row = db.prepare("SELECT balance FROM users WHERE username = ?").get(username);
  res.json({ balance: row ? row.balance : 0, username });
});

// ставка (только авторизованный)
app.post("/bet", authMiddleware, (req, res) => {
  const { amount, color } = req.body;
  const username = req.user.username;
  if (!amount || !color) return res.status(400).json({ error: "MISSING_FIELDS" });

  const user = db.prepare("SELECT balance FROM users WHERE username = ?").get(username);
  if (!user) return res.status(400).json({ error: "USER_NOT_FOUND" });
  if (amount > user.balance) return res.status(400).json({ error: "NOT_ENOUGH_MONEY" });

  // вероятности: black 50%, red 49%, green 1%
  const rnd = Math.random() * 100;
  let rolledColor;
  if (rnd < 50) rolledColor = "black";
  else if (rnd < 99) rolledColor = "red";
  else rolledColor = "green";
  const rolledNumber = Math.floor(Math.random()*100)+1;

  const win = (color === rolledColor);
  let newBalance = user.balance + (win ? amount : -amount);

  db.prepare("UPDATE users SET balance = ? WHERE username = ?").run(newBalance, username);

  res.json({
    ok: true,
    win,
    rolledColor,
    rolledNumber,
    newBalance
  });
});

// получения информации о текущем юзере (optional)
app.get("/me", authMiddleware, (req, res) => {
  const username = req.user.username;
  const row = db.prepare("SELECT id, username, balance FROM users WHERE username = ?").get(username);
  res.json({ user: row });
});

// простой health-check
app.get("/", (req, res) => res.send({ ok: true, server: "BEANBET", timestamp: Date.now() }));

// запуск
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
