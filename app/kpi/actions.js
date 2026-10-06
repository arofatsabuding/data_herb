'use server';

import { cookies } from 'next/headers';
import { PREF_COOKIE, getDatasets, parsePrefs } from '@/lib/kpi';
import { ensureImported, fetchInProgress, runFetchNow } from '@/lib/scheduler';
import { checkCode } from '@/lib/confirm-code';
import kpiLib from '@/scripts/kpi-lib';

// เลือกไฟล์ข้อมูลของปีนั้น (เก็บใน cookie ของเบราว์เซอร์ — ไม่กระทบผู้ใช้คนอื่น)
// การตั้ง cookie ใน server action ทำให้หน้า /kpi แสดงผลใหม่เอง
export async function selectFile(prevState, formData) {
  const year = Number(formData.get('year'));
  const choice = String(formData.get('file') || 'latest');
  const files = kpiLib.listFiles(year);
  if (!kpiLib.listYears().includes(year)) return { error: 'ไม่พบปีที่เลือก' };
  if (choice !== 'latest' && !files.some((f) => f.name === choice)) return { error: 'ไม่พบไฟล์ที่เลือก' };

  const store = await cookies();
  const prefs = { ...parsePrefs(store.get(PREF_COOKIE)?.value), [year]: choice };
  store.set(PREF_COOKIE, JSON.stringify(prefs), { maxAge: 365 * 24 * 3600, path: '/', sameSite: 'lax', httpOnly: true });

  const target = choice === 'latest' ? files[0]?.name : choice;
  if (target && !getDatasets().some((d) => d.file === target)) {
    ensureImported(year, target);
    return { ok: true, preparing: target };
  }
  return { ok: true };
}

// ตรวจก่อนเปิดช่องกรอกรหัส: มีคนกำลังดึงอยู่ไหม
export async function checkFetch() {
  return { busy: fetchInProgress() };
}

// ดึงรายงาน ณ ปัจจุบัน โดยไม่รอ 22:00 — ต้องกรอกรหัสยืนยัน (FETCH_NOW_CODE ใน .env)
export async function fetchNow(prevState, formData) {
  const busy = fetchInProgress();
  if (busy) return { busy };
  const check = await checkCode(formData.get('code'), ['FETCH_NOW_CODE']);
  if (check.error) return { error: check.wrong ? 'รหัสยืนยันไม่ถูกต้อง — ไม่ได้ดึงข้อมูล' : check.error };
  // ตรวจซ้ำอีกครั้งตอนสั่ง เผื่อมีคนกดพร้อมกัน
  if (!runFetchNow()) return { busy: fetchInProgress() || { by: 'ผู้ใช้อื่น' } };
  return { started: true };
}
