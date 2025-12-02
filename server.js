const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { setRating, getRating, getTop } = require("./sqlite");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---------------- ROUTES ----------------

// здоровье сервера
app.get("/", (req, res) => {
  res.send("BEANBET server is running");
});

// записать рейтинг
app.post("/rate", (req, res) => {
  const { username, score } = req.body;

  if (!username || score === undefined) {
    return res.json({ ok: false, error: "Missing fields" });
  }

  setRating(username, score);
  res.json({ ok: true });
});

// получить рейтинг игрока
app.get("/rating/:username", (req, res) => {
  const data = getRating(req.params.username);
  res.json(data || { error: "User not found" });
});

// топ игроков
app.get("/top", (req, res) => {
  const data = getTop(10);
  res.json(data);
});

// -----------------------------------------

// порт Render автоматически задаёт в process.env.PORT
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
