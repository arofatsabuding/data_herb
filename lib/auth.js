// เข้าสู่ระบบด้วย ThaiD (บัตรประชาชนดิจิทัล) — วิธีเดียวของเว็บนี้
// ค่าเชื่อมต่อ ThaiD อยู่ใน .env: THAID_CLIENT_ID, THAID_CLIENT_SECRET, THAID_REDIRECT_URI (+ THAID_URL, THAID_SCOPE)
// session = cookie httpOnly "<id ผู้ใช้>.<หมดอายุ>.<HMAC>" — secret สุ่มเก็บที่ data/session-secret (หรือ SESSION_SECRET)
// role อ่านจากฐานข้อมูลทุก request (เปลี่ยน role ในหน้า /dev มีผลทันที) · dev = เลขบัตรใน THAID_DEV_CIDS
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cookies, headers } from 'next/headers';
import { cidHash, getUser } from './auth-db';

export const SESSION_COOKIE = 'herb_session';
export const SESSION_MAX_AGE = 8 * 60 * 60;
export const STATE_COOKIE = 'thaid_state';

const SECRET_PATH = path.join(process.cwd(), 'data', 'session-secret');

// สิทธิ์ขั้นต่ำของแต่ละส่วน — ตอนนี้ทุกคนที่ยืนยันตัวตนผ่าน ThaiD เข้าหน้าสรุป/ผู้ดูแล/ดึงรายงานได้
// (เจ้าของโปรเจกต์ตัดสินใจ 27 ต.ค. 2569) จะจำกัดเฉพาะผู้ดูแล → เปลี่ยน 'user' เป็น 'admin'
export const ACCESS = { stats: 'user', admin: 'user', fetch: 'user', dev: 'dev' };

export const ROLE_LABEL = { user: 'ผู้ใช้', admin: 'ผู้ดูแล', dev: 'ผู้พัฒนา' };
const RANK = { user: 1, admin: 2, dev: 3 };

export const thaidUrl = () => (process.env.THAID_URL || 'https://imauth.bora.dopa.go.th').replace(/\/+$/, '');

export function thaidConfigured() {
  return Boolean(process.env.THAID_CLIENT_ID && process.env.THAID_CLIENT_SECRET && process.env.THAID_REDIRECT_URI);
}

// เลขบัตรของผู้พัฒนา (คั่นด้วย , หรือช่องว่าง) → เก็บเป็น hash เพื่อเทียบกับฐานข้อมูล
function devHashes() {
  const raw = process.env.THAID_DEV_CIDS || '';
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.replace(/\D/g, ''))
      .filter(Boolean)
      .map(cidHash)
  );
}

export const isDevHash = (hash) => devHashes().has(hash);

// secret ของ cookie — สร้างครั้งแรกแล้วเก็บไว้ (เปลี่ยน secret = ทุกคนต้อง login ใหม่)
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!globalThis.__sessionSecret) {
    try {
      globalThis.__sessionSecret = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    } catch {
      globalThis.__sessionSecret = crypto.randomBytes(32).toString('hex');
      fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
      fs.writeFileSync(SECRET_PATH, globalThis.__sessionSecret, { mode: 0o600 });
    }
  }
  return globalThis.__sessionSecret;
}

const sign = (s) => crypto.createHmac('sha256', secret()).update(`herb-session:${s}`).digest('hex');
const sameText = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

export function sessionValue(userId) {
  const body = `${userId}.${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${body}.${sign(body)}`;
}

export const cookieOptions = (maxAge) => ({
  httpOnly: true,
  sameSite: 'lax',
  // callback ของ ThaiD เป็น https (ผ่าน Cloudflare) → cookie แบบ secure · ทดสอบบนเครื่องด้วย http ได้
  secure: (process.env.THAID_REDIRECT_URI || '').startsWith('https://'),
  path: '/',
  maxAge,
});

// ผู้ใช้ที่ login อยู่ → { id, name, role, roleLabel, dev } | null
export async function currentUser() {
  const value = (await cookies()).get(SESSION_COOKIE)?.value || '';
  const [id, exp, mac] = value.split('.');
  if (!id || !exp || !mac || !sameText(mac, sign(`${id}.${exp}`)) || Number(exp) < Date.now()) return null;
  const u = getUser(Number(id));
  if (!u) return null;
  const dev = isDevHash(u.cid_hash);
  const role = dev ? 'dev' : u.role === 'dev' ? 'user' : u.role;
  return { id: u.id, name: u.name, role, roleLabel: ROLE_LABEL[role], dev };
}

export const allowed = (user, area) => Boolean(user) && RANK[user.role] >= RANK[ACCESS[area]];

// ใช้ใน server action / route: คืนผู้ใช้ถ้ามีสิทธิ์ ไม่งั้น null
export async function userFor(area) {
  const user = await currentUser();
  return allowed(user, area) ? user : null;
}

export async function clientIp() {
  const h = await headers();
  return h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
}

// ปลายทางหลัง login — รับเฉพาะ path ในเว็บนี้ (กันการพาไปเว็บอื่น)
export const safeNext = (p) => (typeof p === 'string' && /^\/(?![/\\])/.test(p) && !p.startsWith('/api/') ? p : '/');
