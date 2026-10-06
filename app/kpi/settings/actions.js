'use server';

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PREF_COOKIE, getDatasets } from '@/lib/kpi';
import { ensureImported, runFetchNow } from '@/lib/scheduler';
import kpiLib from '@/scripts/kpi-lib';

// บันทึกไฟล์ที่ผู้ใช้คนนี้เลือก (เก็บใน cookie ของเบราว์เซอร์ — ไม่กระทบผู้ใช้คนอื่น)
export async function savePrefs(formData) {
  const prefs = {};
  const imported = new Set(getDatasets().map((d) => d.file));
  for (const year of kpiLib.listYears()) {
    const choice = String(formData.get(`file_${year}`) || 'latest');
    const files = kpiLib.listFiles(year);
    // รับเฉพาะ "latest" หรือชื่อไฟล์ที่มีอยู่จริงในโฟลเดอร์
    if (choice !== 'latest' && !files.some((f) => f.name === choice)) redirect('/kpi/settings?error=file');
    prefs[year] = choice;
    const target = choice === 'latest' ? files[0]?.name : choice;
    if (target && !imported.has(target)) ensureImported(year, target);
  }
  (await cookies()).set(PREF_COOKIE, JSON.stringify(prefs), {
    maxAge: 365 * 24 * 3600,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
  });
  redirect('/kpi/settings?saved=1');
}

// ดึงรายงาน ณ ปัจจุบัน โดยไม่รอ 22:00 — ต้องกรอกรหัสยืนยัน (FETCH_NOW_CODE ใน .env)
export async function fetchNow(formData) {
  const expected = process.env.FETCH_NOW_CODE;
  if (!expected) redirect('/kpi/settings?error=nocode');
  const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
  if (!crypto.timingSafeEqual(hash(formData.get('code') || ''), hash(expected))) {
    await new Promise((r) => setTimeout(r, 1500)); // หน่วงเวลา กันการเดารหัส
    redirect('/kpi/settings?error=code');
  }
  redirect(`/kpi/settings?fetch=${runFetchNow() ? 'started' : 'busy'}`);
}
