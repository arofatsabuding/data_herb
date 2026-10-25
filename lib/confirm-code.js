import crypto from 'crypto';
import { clientIp, failSlowly, lockedMessage } from './attempt-limit';

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();

// ตรวจรหัสยืนยันกับค่าใน .env → { ok } | { error, wrong? }
// รหัสผิดจะหน่วงเวลา 1.5 วินาที และจำกัดจำนวนครั้งที่ผิด (lib/attempt-limit.js) กันการไล่เดารหัส
export async function checkCode(input, envNames) {
  const name = envNames.find((n) => process.env[n]);
  if (!name) return { error: `เซิร์ฟเวอร์ยังไม่ได้ตั้งรหัสยืนยัน (${envNames[0]} ใน .env)` };
  const ip = await clientIp();
  const locked = lockedMessage(ip);
  if (locked) return { error: locked };
  if (crypto.timingSafeEqual(hash(input || ''), hash(process.env[name]))) return { ok: true };
  await failSlowly(ip);
  return { error: 'รหัสยืนยันไม่ถูกต้อง', wrong: true };
}
