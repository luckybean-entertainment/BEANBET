import fs from 'fs';
import Database from 'better-sqlite3';

// Папка для базы
const dbDir = './data';
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created directory: ${dbDir}`);
}

// Открываем или создаем базу
const db = new Database(`${dbDir}/database.db`, { verbose: console.log });

export default db;
