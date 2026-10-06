'use server';

import crypto from 'crypto';
import { redirect } from 'next/navigation';
import kpiLib from '@/scripts/kpi-lib';
import { runCompareImport, runFetch } from '@/lib/scheduler';

// ถ้าตั้ง KPI_ADMIN_PASSWORD ไว้ใน .env ต้องกรอกรหัสผ่านก่อนเปลี่ยนการตั้งค่า
function passwordOk(formData) {
  const expected = process.env.KPI_ADMIN_PASSWORD;
  if (!expected) return true;
  const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(hash(formData.get('password') || ''), hash(expected));
}

export async function saveCompareFile(formData) {
  if (!passwordOk(formData)) redirect('/kpi/settings?error=password');
  const choice = String(formData.get('compareFile') || 'latest');
  // รับเฉพาะ "latest" หรือชื่อไฟล์ที่มีอยู่จริงในโฟลเดอร์
  if (choice !== 'latest' && !kpiLib.listCompareFiles().some((f) => f.name === choice)) {
    redirect('/kpi/settings?error=file');
  }
  kpiLib.writeSettings({ compareFile: choice });
  const r = runCompareImport();
  redirect(`/kpi/settings?saved=${r}`);
}

export async function fetchNow(formData) {
  if (!passwordOk(formData)) redirect('/kpi/settings?error=password');
  const started = runFetch();
  redirect(`/kpi/settings?fetch=${started ? 'started' : 'busy'}`);
}
