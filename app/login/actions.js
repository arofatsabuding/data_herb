'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth';

// ออกจากระบบ → ลบ session แล้วกลับหน้าหลัก
export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/');
}
