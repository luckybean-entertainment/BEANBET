const path = require("path");
const Database = require("better-sqlite3");

// Render использует /var/data — это permanent storage
const dbPath = process.env.RENDER
  ? "/var/data/db.sqlite"
  : path.join(__dirname, "db.sqlite");

// подключение к базе
const db = new Database(dbPath);

// создаём таблицу
db.exec(`
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    score INTEGER,
    updated_at TEXT
  );
`);

// Добавить/обновить рейтинг
function setRating(username, score) {
  const stmt = db.prepare(`
    INSERT INTO ratings (username, score, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(username) DO UPDATE SET
      score = excluded.score,
      updated_at = datetime('now')
  `);
  stmt.run(username, score);
}

// Получить рейтинг игрока
function getRating(username) {
  const stmt = db.prepare("SELECT * FROM ratings WHERE username = ?");
  return stmt.get(username);
}

// Топ игроков
function getTop(count = 10) {
  const stmt = db.prepare(`
    SELECT * FROM ratings
    ORDER BY score DESC
    LIMIT ?
  `);
  return stmt.all(count);
}

module.exports = { setRating, getRating, getTop };
