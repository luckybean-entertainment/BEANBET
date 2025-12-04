import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------
// DATABASE INIT
// ---------------------------
const db = new Database("database.db");

// Создаём таблицу пользователей
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    balance INTEGER DEFAULT 0,
    lastBonus INTEGER DEFAULT 0
  )
`);
console.log("SQLite DB ready.");

// ---------------------------
// REGISTER
// ---------------------------
app.post("/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({ success: false, error: "Empty fields" });

  try {
    db.prepare(
      "INSERT INTO users (username, password, balance) VALUES (?, ?, ?)"
    ).run(username, password, 0);

    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: "User exists" });
  }
});

// ---------------------------
// LOGIN
// ---------------------------
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const row = db
    .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
    .get(username, password);

  if (!row) return res.json({ success: false });

  res.json({
    success: true,
    username: row.username,
    balance: row.balance,
  });
});

// ---------------------------
// GET BALANCE
// ---------------------------
app.get("/balance", (req, res) => {
  const username = req.query.username;

  if (!username)
    return res.status(400).json({ error: "Username required" });

  const row = db
    .prepare("SELECT balance FROM users WHERE username = ?")
    .get(username);

  if (!row) return res.status(404).json({ error: "User not found" });

  res.json({ balance: row.balance });
});

// ---------------------------
// GIVE 1 000 000 (3 times/day)
// ---------------------------
app.post("/give-million", (req, res) => {
  const { username } = req.body;

  if (!username)
    return res.json({ success: false, error: "No username" });

  const user = db
    .prepare("SELECT balance, lastBonus FROM users WHERE username = ?")
    .get(username);

  if (!user)
    return res.json({ success: false, error: "User not found" });

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  let bonusUses = 0;
  let lastBonus = user.lastBonus;

  // Если прошло больше суток — сбрасываем счётчик
  if (now - lastBonus > oneDay) {
    bonusUses = 0;
    lastBonus = now;
  } else {
    bonusUses = db
      .prepare("SELECT COUNT(*) AS c FROM bonuslog WHERE username = ? AND date > ?")
      .get(username, now - oneDay).c || 0;
  }

  if (bonusUses >= 3) {
    return res.json({ success: false, error: "Daily limit reached" });
  }

  // Добавляем деньги
  db.prepare("UPDATE users SET balance = balance + 1000000, lastBonus = ? WHERE username = ?")
    .run(now, username);

  // Логируем получение бонуса
  db.exec(`
    CREATE TABLE IF NOT EXISTS bonuslog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      date INTEGER
    )
  `);

  db.prepare("INSERT INTO bonuslog (username, date) VALUES (?, ?)").run(username, now);

  res.json({ success: true, newBalance: user.balance + 1000000 });
});

// ---------------------------
// LEADERBOARD
// ---------------------------
app.get("/leaders", (req, res) => {
  const leaders = db
    .prepare("SELECT username, balance FROM users ORDER BY balance DESC LIMIT 50")
    .all();

  res.json({ leaders });
});

// ---------------------------
// PING (для проверки)
// ---------------------------
app.get("/", (req, res) => {
  res.send("BEANBET server running ✔");
});

// ---------------------------
// START SERVER
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
