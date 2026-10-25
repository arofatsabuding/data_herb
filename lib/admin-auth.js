// รหัสเข้าหน้าผู้ดูแล (/admin) — กรอกครั้งเดียว เก็บเป็น cookie (httpOnly) 8 ชั่วโมง
// รหัสตั้งด้วย ADMIN_PAGE_CODE ใน .env — ไม่ตั้ง: npm run dev ใช้ "admin", เซิร์ฟเวอร์จริง (npm start) ปิดหน้าผู้ดูแล
// cookie = HMAC(secret, รหัส) — secret สุ่มเก็บที่ data/admin-secret (หรือ ADMIN_SESSION_SECRET) จึงสร้าง cookie เองจากรหัสไม่ได้
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_MAX_AGE = 8 * 60 * 60;

const DEV_CODE = 'admin';
const SECRET_PATH = path.join(process.cwd(), 'data', 'admin-secret');

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PAGE_CODE) || process.env.NODE_ENV !== 'production';
}

const pageCode = () => process.env.ADMIN_PAGE_CODE || (process.env.NODE_ENV !== 'production' ? DEV_CODE : null);

// secret ของ cookie — สร้างครั้งแรกแล้วเก็บไว้ (เปลี่ยน secret = ทุกคนต้องกรอกรหัสใหม่)
function secret() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (!globalThis.__adminSecret) {
    try {
      globalThis.__adminSecret = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    } catch {
      globalThis.__adminSecret = crypto.randomBytes(32).toString('hex');
      fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
      fs.writeFileSync(SECRET_PATH, globalThis.__adminSecret, { mode: 0o600 });
    }
  }
  return globalThis.__adminSecret;
}

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const token = () => crypto.createHmac('sha256', secret()).update(`data-herb-admin:${pageCode()}`).digest('hex');

export function checkAdminPageCode(input) {
  const code = pageCode();
  if (!code) return false;
  return crypto.timingSafeEqual(hash(input || ''), hash(code));
}

export function adminToken() {
  return token();
}

export async function isAdmin() {
  if (!pageCode()) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value || '';
  return crypto.timingSafeEqual(hash(value), hash(token()));
}
