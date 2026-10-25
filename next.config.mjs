import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    // npm run dev ใช้โฟลเดอร์ .next-dev แยกจาก npm run build/start (.next)
    // รัน dev บนเครื่องเดียวกับเซิร์ฟเวอร์จริงได้โดยไม่ทับไฟล์ที่ next start ใช้อยู่
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    serverExternalPackages: ['better-sqlite3', 'node-cron'],
    // หน้าผู้ดูแลอัปโหลดไฟล์ Excel ผ่าน server action (ค่าเริ่มต้นรับได้แค่ 1 MB)
    experimental: { serverActions: { bodySizeLimit: '55mb' } },
  };
}
