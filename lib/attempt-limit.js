// จำกัดการกรอกรหัสผิด (หน้า admin, ปุ่มดึงรายงาน, อัปโหลดไฟล์) — กันการไล่เดารหัสสั้น ๆ
// ผิดได้ 10 ครั้ง/IP ต่อ 15 นาที และรวมทั้งเว็บ 100 ครั้ง/ชั่วโมง — เก็บในหน่วยความจำ รีเซ็ตเมื่อรีสตาร์ท
import { headers } from 'next/headers';

const PER_IP = 10;
const IP_WINDOW = 15 * 60 * 1000;
const GLOBAL = 100;
const GLOBAL_WINDOW = 60 * 60 * 1000;

const state = (globalThis.__attemptLimit ??= { ips: new Map(), all: [] });

export async function clientIp() {
  const h = await headers();
  return h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
}

// คืนข้อความถ้าถูกล็อกอยู่, null = ลองได้
export function lockedMessage(ip, now = Date.now()) {
  const mine = (state.ips.get(ip) || []).filter((t) => now - t < IP_WINDOW);
  state.ips.set(ip, mine);
  state.all = state.all.filter((t) => now - t < GLOBAL_WINDOW);
  if (mine.length >= PER_IP) {
    const wait = Math.ceil((IP_WINDOW - (now - mine[0])) / 60000);
    return `กรอกรหัสผิดหลายครั้งเกินไป กรุณารอประมาณ ${wait} นาที`;
  }
  if (state.all.length >= GLOBAL) return 'มีการกรอกรหัสผิดจำนวนมาก ระบบปิดการตรวจรหัสชั่วคราว กรุณาลองใหม่ภายหลัง';
  return null;
}

export function recordFailure(ip, now = Date.now()) {
  state.ips.set(ip, [...(state.ips.get(ip) || []), now]);
  state.all.push(now);
  // ล้าง IP เก่าไม่ให้ Map โตไม่หยุด
  if (state.ips.size > 5000) {
    for (const [k, v] of state.ips) if (!v.some((t) => now - t < IP_WINDOW)) state.ips.delete(k);
  }
}

// รหัสผิด → หน่วงเวลา 1.5 วินาที แล้วนับครั้ง
export async function failSlowly(ip) {
  recordFailure(ip);
  await new Promise((r) => setTimeout(r, 1500));
}
