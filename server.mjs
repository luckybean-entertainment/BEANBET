import express from 'express';
import db from './sqlite.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Пример маршрута
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Пример запроса к базе
app.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM users').all(); // таблица users должна быть создана
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
