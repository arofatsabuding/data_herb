'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, ADMIN_MAX_AGE, adminToken, checkAdminPageCode } from '@/lib/admin-auth';

// กรอกรหัสเข้าหน้าผู้ดูแล → ถูกต้องตั้ง cookie แล้วไป /admin, ผิดหน่วงเวลา 1.5 วินาที กันการเดารหัส
export async function adminLogin(prevState, formData) {
  if (!checkAdminPageCode(formData.get('code'))) {
    await new Promise((r) => setTimeout(r, 1500));
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
