// จำกัดการใช้แชท AI (มีค่าใช้จ่ายต่อข้อความ) — เก็บในหน่วยความจำ รีเซ็ตเมื่อรีสตาร์ทเซิร์ฟเวอร์
// CHAT_PER_IP: ข้อความต่อ IP ต่อชั่วโมง (ค่าเริ่มต้น 20), CHAT_PER_DAY: ข้อความรวมทั้งเว็บต่อวัน (ค่าเริ่มต้น 500)
const HOUR = 60 * 60 * 1000;

export function chatEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.CHAT_ENABLED !== '0';
}

const state = (globalThis.__chatLimit ??= { ips: new Map(), day: '', dayCount: 0 });

// คืนข้อความแจ้งเตือนถ้าเกินโควตา, null = ใช้ได้
export function checkChatLimit(ip) {
  const perIp = Number(process.env.CHAT_PER_IP) || 20;
  const perDay = Number(process.env.CHAT_PER_DAY) || 500;
  const now = Date.now();

  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  if (state.day !== today) {
    state.day = today;
    state.dayCount = 0;
  }
  if (state.dayCount >= perDay) return 'วันนี้มีการใช้แชท AI ครบโควตาแล้ว กรุณาลองใหม่พรุ่งนี้';

  const recent = (state.ips.get(ip) || []).filter((t) => now - t < HOUR);
  if (recent.length >= perIp) {
    const wait = Math.ceil((HOUR - (now - recent[0])) / 60000);
    return `ถามได้สูงสุด ${perIp} ข้อความต่อชั่วโมง กรุณารออีกประมาณ ${wait} นาที`;
  }
  recent.push(now);
  state.ips.set(ip, recent);
  state.dayCount++;

  // ล้าง IP เก่าไม่ให้ Map โตไม่หยุด
  if (state.ips.size > 5000) {
    for (const [k, v] of state.ips) if (!v.some((t) => now - t < HOUR)) state.ips.delete(k);
  }
  return null;
}
