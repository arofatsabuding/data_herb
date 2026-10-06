import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'herb.db');

// เปิดฐานข้อมูลแบบอ่านอย่างเดียวครั้งเดียว แล้วใช้ซ้ำ (กันเปิดซ้ำตอน dev hot-reload)
export function getDb() {
  if (!globalThis.__herbDb) {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`ไม่พบฐานข้อมูล ${DB_PATH} — รัน "npm run import" ก่อน`);
    }
    globalThis.__herbDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  }
  return globalThis.__herbDb;
}
