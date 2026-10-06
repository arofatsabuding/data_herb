// รหัสเข้าหน้าผู้ดูแล (/admin) — กรอกครั้งเดียว เก็บเป็น cookie (httpOnly) 8 ชั่วโมง
// เปลี่ยนรหัสได้ด้วย ADMIN_PAGE_CODE ใน .env
import crypto from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_MAX_AGE = 8 * 60 * 60;

const pageCode = () => process.env.ADMIN_PAGE_CODE || 'admin';
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const token = () => crypto.createHash('sha256').update(`data-herb-admin:${pageCode()}`).digest('hex');

export function checkAdminPageCode(input) {
  return crypto.timingSafeEqual(hash(input || ''), hash(pageCode()));
}

export function adminToken() {
  return token();
}

export async function isAdmin() {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value || '';
  return crypto.timingSafeEqual(hash(value), hash(token()));
}
