// Next.js เรียกฟังก์ชันนี้ครั้งเดียวตอนเซิร์ฟเวอร์เริ่มทำงาน — ใช้เริ่มตัวตั้งเวลาดึงข้อมูล opendata
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startOpendataScheduler } = await import('./lib/scheduler');
  startOpendataScheduler();
}
