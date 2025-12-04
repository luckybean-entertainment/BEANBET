import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database("database.db");

// === Создание таблицы ===
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    balance INTEGER DEFAULT 10000,
    currency TEXT DEFAULT '₽',
    token TEXT,
    lastBankUse INTEGER DEFAULT 0,
    bankUses INTEGER DEFAULT 0
);
`);

// === хелперы ===
function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

// === регистрация ===
app.post("/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.json({ ok: false, error: "Пустые поля" });

    const exists = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (exists)
        return res.json({ ok: false, error: "Имя занято" });

    const token = generateToken();

    db.prepare(`
        INSERT INTO users (username, password, token, balance)
        VALUES (?, ?, ?, ?)
    `).run(username, password, token, 10000);

    res.json({ ok: true, token });
});

// === вход ===
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.json({ ok: false, error: "Заполните поля" });

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!user)
        return res.json({ ok: false, error: "Аккаунт не найден" });

    if (user.password !== password)
        return res.json({ ok: false, error: "Пароль неверный" });

    const newToken = generateToken();

    db.prepare("UPDATE users SET token = ? WHERE id = ?").run(newToken, user.id);

    res.json({
        ok: true,
        token: newToken
    });
});

// === автовход ===
app.post("/auto", (req, res) => {
    const { token } = req.body;

    if (!token)
        return res.json({ ok: false });

    const user = db.prepare("SELECT * FROM users WHERE token = ?").get(token);

    if (!user)
        return res.json({ ok: false });

    res.json({
        ok: true,
        username: user.username,
        balance: user.balance,
        currency: user.currency
    });
});

// === Банк: получить 1 млн ===
app.post("/bank/add", (req, res) => {
    const { token } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE token = ?").get(token);

    if (!user)
        return res.json({ ok: false });

    const now = Date.now();
    const isNewDay = now - user.lastBankUse > 86400000;

    let uses = user.bankUses;

    if (isNewDay) uses = 0;

    if (uses >= 3)
        return res.json({ ok: false, error: "Лимит 3 раза" });

    db.prepare(`
        UPDATE users
        SET balance = balance + 1000000,
            lastBankUse = ?,
            bankUses = ?
        WHERE id = ?
    `).run(now, uses + 1, user.id);

    res.json({ ok: true, newBalance: user.balance + 1000000 });
});

// === лидеры ===
app.get("/leaders", (req, res) => {
    const rows = db.prepare(`
        SELECT username, balance
        FROM users
        ORDER BY balance DESC
        LIMIT 50
    `).all();

    res.json({ ok: true, leaders: rows });
});

app.listen(3000, () => console.log("OK"));
