// Next.js เรียกฟังก์ชันนี้ครั้งเดียวตอนเซิร์ฟเวอร์เริ่มทำงาน — ใช้เริ่มตัวตั้งเวลาดึงข้อมูล opendata
// ต้องเขียนเป็น if (=== 'nodejs') ครอบ import ตามแบบของ Next.js ไม่เช่นนั้นตอน dev จะ bundle
// lib/scheduler (ใช้ fs/path) ไปให้ edge runtime ด้วยแล้ว compile ไม่ผ่าน
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startOpendataScheduler } = await import('./lib/scheduler');
    startOpendataScheduler();
  }
}
