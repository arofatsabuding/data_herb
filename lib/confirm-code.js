import crypto from 'crypto';

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();

// ตรวจรหัสยืนยันกับค่าใน .env → { ok } | { error, wrong? }
// รหัสผิดจะหน่วงเวลา 1.5 วินาที กันการเดารหัส
export async function checkCode(input, envNames) {
  const name = envNames.find((n) => process.env[n]);
  if (!name) return { error: `เซิร์ฟเวอร์ยังไม่ได้ตั้งรหัสยืนยัน (${envNames[0]} ใน .env)` };
  if (crypto.timingSafeEqual(hash(input || ''), hash(process.env[name]))) return { ok: true };
  await new Promise((r) => setTimeout(r, 1500));
  return { error: 'รหัสยืนยันไม่ถูกต้อง', wrong: true };
}
