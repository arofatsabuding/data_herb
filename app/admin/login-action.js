'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, ADMIN_MAX_AGE, adminConfigured, adminToken, checkAdminPageCode } from '@/lib/admin-auth';
import { clientIp, failSlowly, lockedMessage } from '@/lib/attempt-limit';

// กรอกรหัสเข้าหน้าผู้ดูแล → ถูกต้องตั้ง cookie แล้วไป /admin
// ผิดหน่วงเวลา 1.5 วินาที และจำกัดจำนวนครั้งที่ผิด (lib/attempt-limit.js) กันการไล่เดารหัส
export async function adminLogin(prevState, formData) {
  if (!adminConfigured()) return { error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งรหัสผู้ดูแล (ADMIN_PAGE_CODE ใน .env)' };
  const ip = await clientIp();
  const locked = lockedMessage(ip);
  if (locked) return { error: locked };
  if (!checkAdminPageCode(formData.get('code'))) {
    await failSlowly(ip);
    return { error: 'รหัสไม่ถูกต้อง' };
  }
  (await cookies()).set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_MAX_AGE,
  });
  redirect('/admin');
}
