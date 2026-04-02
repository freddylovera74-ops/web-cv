const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'cv.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      phone_number TEXT UNIQUE,
      whatsapp_step TEXT DEFAULT 'start',
      whatsapp_data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cv_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      jobs TEXT DEFAULT '[]',
      ai_suggested_jobs TEXT DEFAULT '[]',
      version INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      cv_version INTEGER,
      stripe_session_id TEXT UNIQUE,
      amount INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add new columns for web wizard flow (safe: ignored if already exist)
  ['profile', 'education', 'skills'].forEach(col => {
    try {
      db.exec(`ALTER TABLE cv_data ADD COLUMN ${col} TEXT DEFAULT '{}' `);
    } catch (_) {}
  });

  console.log('Database initialized');
}

function getUserByPhone(phone) {
  return getDb().prepare('SELECT * FROM users WHERE phone_number = ?').get(phone);
}

function getUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createUserByPhone(phone) {
  const db = getDb();
  const result = db.prepare('INSERT INTO users (phone_number) VALUES (?)').run(phone);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

function updateWhatsappStep(userId, step, data) {
  getDb()
    .prepare('UPDATE users SET whatsapp_step = ?, whatsapp_data = ? WHERE id = ?')
    .run(step, JSON.stringify(data), userId);
}

function getCvData(userId) {
  return getDb().prepare('SELECT * FROM cv_data WHERE user_id = ?').get(userId);
}

function upsertCvData(userId, jobs, aiJobs) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM cv_data WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare(
      'UPDATE cv_data SET jobs = ?, ai_suggested_jobs = ?, version = version + 1, updated_at = datetime("now") WHERE user_id = ?'
    ).run(JSON.stringify(jobs), JSON.stringify(aiJobs), userId);
  } else {
    db.prepare('INSERT INTO cv_data (user_id, jobs, ai_suggested_jobs) VALUES (?, ?, ?)')
      .run(userId, JSON.stringify(jobs), JSON.stringify(aiJobs));
  }
}

function hasPaidForVersion(userId, cvVersion) {
  return !!getDb()
    .prepare('SELECT id FROM payments WHERE user_id = ? AND cv_version = ? AND status = ?')
    .get(userId, cvVersion, 'paid');
}

module.exports = { getDb, initDb, getUserByPhone, getUserById, createUserByPhone, updateWhatsappStep, getCvData, upsertCvData, hasPaidForVersion };
