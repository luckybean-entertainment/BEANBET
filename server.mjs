// server.mjs
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "beanbet_dev_secret_change_me";

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Database (SQLite)
const db = new Database("database.db");

// Init schema
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  balance INTEGER DEFAULT 1000000,
  currency TEXT DEFAULT '₽',
  token TEXT,
  last_million_day TEXT DEFAULT '',
  million_count INTEGER DEFAULT 0
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS bonus_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  type TEXT,
  ts INTEGER
);
`);

// Helpers
function signToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: "30d" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function todayDateString() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ----------------- Endpoints -----------------

// Health
app.get("/", (req, res) => {
  res.send({ ok: true, service: "BEANBET server" });
});

// Register
app.post("/register", (req, res) => {
  const { username, password, currency } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "username and password required" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(400).json({ ok: false, error: "username_taken" });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (username, password, balance, currency) VALUES (?, ?, ?, ?)").run(username, hashed, 1000000, currency || "₽");

  const token = signToken(username);
  db.prepare("UPDATE users SET token = ? WHERE id = ?").run(token, info.lastInsertRowid);

  return res.json({ ok: true, username, token });
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "username and password required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(400).json({ ok: false, error: "invalid_credentials" });

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ ok: false, error: "invalid_credentials" });
  }

  const token = signToken(username);
  db.prepare("UPDATE users SET token = ? WHERE id = ?").run(token, user.id);

  return res.json({ ok: true, username, token });
});

// Auto-check token (autologin)
app.post("/auto", (req, res) => {
  const token = (req.headers.authorization && req.headers.authorization.split(" ")[1]) || req.body?.token || null;
  if (!token) return res.status(400).json({ ok: false });

  const payload = verifyToken(token);
  if (!payload || !payload.username) return res.status(401).json({ ok: false });

  const user = db.prepare("SELECT username, balance, currency FROM users WHERE username = ?").get(payload.username);
  if (!user) return res.status(404).json({ ok: false });

  return res.json({ ok: true, username: user.username, balance: user.balance, currency: user.currency, token });
});

// Auth middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ ok: false, error: "no_token" });
  const token = auth.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload || !payload.username) return res.status(401).json({ ok: false, error: "invalid_token" });
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(payload.username);
  if (!user) return res.status(401).json({ ok: false, error: "user_not_found" });
  req.user = user;
  req.token = token;
  next();
}

// Get balance (authenticated)
app.get("/balance", requireAuth, (req, res) => {
  const u = req.user;
  return res.json({ ok: true, username: u.username, balance: u.balance, currency: u.currency });
});

// Bet endpoint
app.post("/bet", requireAuth, (req, res) => {
  const { amount, color } = req.body || {};
  const user = req.user;
  if (!amount || !color) return res.status(400).json({ ok: false, error: "amount_and_color_required" });

  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ ok: false, error: "invalid_amount" });

  if (user.balance < amt) return res.status(400).json({ ok: false, error: "insufficient_funds" });

  // Probabilities: black 50%, red 49%, green 1%
  const rnd = Math.random() * 100;
  let rolledColor = "black";
  if (rnd < 1) rolledColor = "green";
  else if (rnd < 50) rolledColor = "red";
  else rolledColor = "black";

  const rolledNumber = Math.floor(Math.random() * 37); // 0..36 (roulette-like)

  let win = false;
  // payout: for simplicity equal stake on color wins (you can change payout ratio)
  if (color === rolledColor) win = true;

  let newBalance = user.balance + (win ? amt : -amt);

  db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(newBalance, user.id);

  return res.json({
    ok: true,
    win,
    rolledColor,
    rolledNumber,
    newBalance
  });
});

// Leaders
app.get("/leaders", (req, res) => {
  const rows = db.prepare("SELECT username, balance FROM users ORDER BY balance DESC LIMIT 50").all();
  return res.json({ ok: true, leaders: rows });
});

// Take-million (3 times per day)
app.post("/take-million", requireAuth, (req, res) => {
  const user = req.user;
  const today = todayDateString();

  // ensure fields are in DB (we have last_million_day and million_count)
  const row = db.prepare("SELECT last_million_day, million_count, balance FROM users WHERE id = ?").get(user.id);

  let lastDay = row.last_million_day || "";
  let count = typeof row.million_count === "number" ? row.million_count : 0;

  if (lastDay !== today) {
    lastDay = today;
    count = 0;
  }

  if (count >= 3) {
    return res.status(400).json({ ok: false, error: "limit_reached" });
  }

  const newBalance = row.balance + 1000000;
  db.prepare("UPDATE users SET balance = ?, last_million_day = ?, million_count = ? WHERE id = ?").run(newBalance, today, count + 1, user.id);

  // log
  db.prepare("INSERT INTO bonus_log (username, type, ts) VALUES (?, ?, ?)").run(user.username, "take-million", Date.now());

  return res.json({ ok: true, newBalance, remainingToday: 2 - count });
});

// Simple transfer endpoint (example, minimal checks)
app.post("/transfer", requireAuth, (req, res) => {
  const { to, amount } = req.body || {};
  const fromUser = req.user;
  if (!to || !amount) return res.status(400).json({ ok: false, error: "to_and_amount_required" });

  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ ok: false, error: "invalid_amount" });

  if (fromUser.balance < amt) return res.status(400).json({ ok: false, error: "insufficient_funds" });

  const toUser = db.prepare("SELECT id, balance FROM users WHERE username = ?").get(to);
  if (!toUser) return res.status(404).json({ ok: false, error: "recipient_not_found" });

  db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(fromUser.balance - amt, fromUser.id);
  db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(toUser.balance + amt, toUser.id);

  return res.json({ ok: true, newBalance: fromUser.balance - amt });
});

// Start server (Render requires binding to process.env.PORT)
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
