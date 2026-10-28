'use server';

import { revalidatePath } from 'next/cache';
import { userFor } from '@/lib/auth';
import { setRole } from '@/lib/auth-db';

// เปลี่ยน role ของผู้ใช้ (user / admin) — เฉพาะผู้พัฒนา
export async function changeRole(formData) {
  if (!(await userFor('dev'))) return;
  setRole(Number(formData.get('id')), String(formData.get('role')));
  revalidatePath('/dev');
}
