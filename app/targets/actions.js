'use server';

import { revalidatePath } from 'next/cache';
import { userFor } from '@/lib/auth';
import { parseTargetForm, submitTarget, targetYear } from '@/lib/targets';

// ส่งคำขอกำหนดค่าเป้าหมาย (เขตสุขภาพ / จังหวัด / อำเภอ / หน่วยบริการ) → รอผู้ดูแลอนุมัติที่หน้า /admin · ต้องเข้าสู่ระบบด้วย ThaiD (ACCESS.targets)
export async function saveTarget(prevState, formData) {
  const user = await userFor('targets');
  if (!user) return { error: 'หมดเวลาเข้าสู่ระบบ — กรุณารีเฟรชหน้าแล้วเข้าสู่ระบบด้วย ThaiD ใหม่' };
  const year = targetYear();
  if (!year) return { error: 'ยังไม่มีข้อมูลปีงบประมาณ' };
  const { value, error } = parseTargetForm(formData);
  if (error) return { error };
  submitTarget({ ...value, year, userId: user.id });
  revalidatePath('/targets');
  revalidatePath('/admin');
  return { ok: `บันทึกค่าเป้าหมายของ ${value.areaName} (${value.code}) แล้ว — รอผู้ดูแลอนุมัติ` };
}
