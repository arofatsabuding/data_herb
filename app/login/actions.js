'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_MAX_AGE, clientIp, cookieOptions, guestCodeOk, safeNext, sessionValue } from '@/lib/auth';
import { recordGuestLogin } from '@/lib/auth-db';

// ออกจากระบบ → ลบ session แล้วกลับหน้าหลัก
export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/');
}

// ใส่รหัสผิดได้ 5 ครั้งต่อ IP ใน 10 นาที (นับในหน่วยความจำ — รีสตาร์ตเซิร์ฟเวอร์แล้วเริ่มนับใหม่)
const MAX_TRIES = 5;
const WINDOW = 10 * 60 * 1000;
const tries = (globalThis.__guestTries ??= new Map());

// เข้าสู่ระบบด้วยบัญชีทดสอบ (ไม่ใช้ ThaiD) — ต้องใส่รหัส GUEST_LOGIN_CODE ก่อน
export async function guestLogin(_prev, formData) {
  const ip = await clientIp();
  const now = Date.now();
  const t = tries.get(ip);
  const fails = t && now - t.since < WINDOW ? t.n : 0;
  if (fails >= MAX_TRIES) return { error: 'ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่' };
  if (!guestCodeOk(formData.get('code'))) {
    tries.set(ip, { n: fails + 1, since: fails ? t.since : now });
    return { error: 'รหัสไม่ถูกต้อง' };
  }
  tries.delete(ip);
  const user = recordGuestLogin({ ip, userAgent: (await headers()).get('user-agent') });
  (await cookies()).set(SESSION_COOKIE, sessionValue(user.id), cookieOptions(SESSION_MAX_AGE));
  redirect(safeNext(formData.get('next')));
}
