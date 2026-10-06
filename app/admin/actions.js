'use server';

import path from 'path';
import { checkCode } from '@/lib/confirm-code';
import { rebuildReferences } from '@/lib/scheduler';
import refs from '@/scripts/reference-files';

const MAX_SIZE = 50 * 1024 * 1024;

// อัปโหลดไฟล์อ้างอิงใหม่แทนไฟล์เดิม → ตรวจรูปแบบไฟล์ก่อน แล้วสร้างฐานข้อมูลใหม่เบื้องหลัง
// ต้องกรอกรหัสผู้ดูแล (ADMIN_CODE ใน .env — ถ้าไม่ได้ตั้ง ใช้ FETCH_NOW_CODE)
export async function uploadReference(prevState, formData) {
  const ref = refs.getRef(String(formData.get('key') || ''));
  if (!ref) return { error: 'ไม่รู้จักไฟล์ที่เลือก' };
  const file = formData.get('file');
  if (!file || typeof file === 'string' || !file.size) return { error: 'กรุณาเลือกไฟล์' };

  const check = await checkCode(formData.get('code'), ['ADMIN_CODE', 'FETCH_NOW_CODE']);
  if (check.error) return { error: check.wrong ? 'รหัสผู้ดูแลไม่ถูกต้อง — ไม่ได้เปลี่ยนไฟล์' : check.error };

  const ext = path.extname(file.name).toLowerCase();
  if (!ref.exts.includes(ext)) return { error: `รับเฉพาะไฟล์ ${ref.exts.join(' / ')}` };
  if (file.size > MAX_SIZE) return { error: 'ไฟล์ใหญ่เกิน 50 MB' };

  const buffer = Buffer.from(await file.arrayBuffer());
  let info;
  try {
    info = refs.validateReference(ref.key, buffer);
  } catch (err) {
    return { error: `ไฟล์ไม่ถูกรูปแบบ: ${err.message} — ยังใช้ไฟล์เดิมอยู่` };
  }
  const original = path.basename(file.name).slice(0, 200);
  const dest = refs.replaceReference(ref.key, buffer, ext, { original, rows: info.rows, detail: info.detail });
  rebuildReferences(`อัปโหลด ${path.basename(dest)}`);
  return { ok: `บันทึกเป็น ${path.basename(dest)} แล้ว (${info.detail}) — กำลังสร้างฐานข้อมูลใหม่` };
}
