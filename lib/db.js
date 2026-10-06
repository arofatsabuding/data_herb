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

const KPI_DB_PATH = process.env.KPI_DB_PATH || path.join(process.cwd(), 'data', 'kpi.db');

// ฐานข้อมูลตัวชี้วัด (สร้างด้วย npm run import:kpi / fetch:opendata) — คืน null ถ้ายังไม่มี
export function getKpiDb() {
  if (!globalThis.__kpiDb) {
    if (!fs.existsSync(KPI_DB_PATH)) return null;
    globalThis.__kpiDb = new Database(KPI_DB_PATH, { readonly: true, fileMustExist: true });
  }
  return globalThis.__kpiDb;
}

// ใช้ฐานข้อมูลที่สร้างใหม่ (data/herb.db.tmp) แทนของเดิม — ต้องปิดไฟล์เดิมก่อน Windows จึงยอมให้เขียนทับ
// ทำแบบ synchronous ทั้งหมด จึงไม่มี request ไหนเปิดไฟล์เดิมซ้ำระหว่างสลับ
export function swapHerbDb() {
  const tmp = `${DB_PATH}.tmp`;
  if (!fs.existsSync(tmp)) throw new Error(`ไม่พบ ${tmp}`);
  globalThis.__herbDb?.close();
  globalThis.__herbDb = null;
  fs.renameSync(tmp, DB_PATH);
}
