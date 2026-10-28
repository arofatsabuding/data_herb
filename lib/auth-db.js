// ฐานข้อมูลผู้ใช้ที่ login ด้วย ThaiD (data/auth.db — ไม่อยู่ใน git) สร้างตารางเองครั้งแรก
// ไม่เก็บเลขบัตรประชาชนเต็ม: เก็บ sha256 (ใช้จับคู่) + เลขที่ปิดบางส่วน (ใช้แสดง)
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Database from 'better-sqlite3';

const AUTH_DB_PATH = process.env.AUTH_DB_PATH || path.join(process.cwd(), 'data', 'auth.db');

// role ที่ตั้งในฐานข้อมูลได้ — dev มาจาก THAID_DEV_CIDS ใน .env เท่านั้น (lib/auth.js)
export const DB_ROLES = ['user', 'admin'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY,
  cid_hash    TEXT NOT NULL UNIQUE,
  cid_masked  TEXT NOT NULL,
  name        TEXT,
  name_en     TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'dev')),
  first_login TEXT NOT NULL,
  last_login  TEXT NOT NULL,
  login_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS login_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  at         TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS login_log_at ON login_log(at);
`;

export function getAuthDb() {
  if (!globalThis.__authDb) {
    fs.mkdirSync(path.dirname(AUTH_DB_PATH), { recursive: true });
    const db = new Database(AUTH_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA);
    globalThis.__authDb = db;
  }
  return globalThis.__authDb;
}

export const cidHash = (cid) => crypto.createHash('sha256').update(String(cid).trim()).digest('hex');
// 1234567890123 → 1-xxxx-xxxxx-12-3
const maskCid = (cid) => {
  const s = String(cid).trim();
  return s.length === 13 ? `${s[0]}-xxxx-xxxxx-${s.slice(10, 12)}-${s[12]}` : 'x'.repeat(Math.max(0, s.length - 4)) + s.slice(-4);
};

// login สำเร็จ → เพิ่ม/อัปเดตผู้ใช้ (role เดิมไม่เปลี่ยน, คนใหม่ = user) + บันทึกประวัติเข้าใช้
export function recordLogin({ cid, name, nameEn, ip, userAgent }) {
  const db = getAuthDb();
  const now = new Date().toISOString();
  const hash = cidHash(cid);
  db.prepare(
    `INSERT INTO users (cid_hash, cid_masked, name, name_en, first_login, last_login, login_count)
     VALUES (@hash, @masked, @name, @nameEn, @now, @now, 1)
     ON CONFLICT(cid_hash) DO UPDATE SET name = @name, name_en = @nameEn, last_login = @now, login_count = login_count + 1`
  ).run({ hash, masked: maskCid(cid), name: name || null, nameEn: nameEn || null, now });
  const user = db.prepare('SELECT * FROM users WHERE cid_hash = ?').get(hash);
  db.prepare('INSERT INTO login_log (user_id, at, ip, user_agent) VALUES (?, ?, ?, ?)').run(
    user.id,
    now,
    ip || null,
    userAgent ? String(userAgent).slice(0, 300) : null
  );
  return user;
}

export const getUser = (id) => getAuthDb().prepare('SELECT * FROM users WHERE id = ?').get(id);

export const listUsers = () => getAuthDb().prepare('SELECT * FROM users ORDER BY last_login DESC').all();

export const listLogins = (limit = 300) =>
  getAuthDb()
    .prepare(
      `SELECT l.at, l.ip, l.user_agent, u.name
       FROM login_log l JOIN users u ON u.id = l.user_id ORDER BY l.at DESC LIMIT ?`
    )
    .all(limit);

export const countLogins = () => getAuthDb().prepare('SELECT COUNT(*) AS n FROM login_log').get().n;

export function setRole(id, role) {
  if (!DB_ROLES.includes(role)) throw new Error('role ไม่ถูกต้อง');
  return getAuthDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id).changes;
}
