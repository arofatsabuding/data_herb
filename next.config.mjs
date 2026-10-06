/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'node-cron'],
  // หน้าผู้ดูแลอัปโหลดไฟล์ Excel ผ่าน server action (ค่าเริ่มต้นรับได้แค่ 1 MB)
  experimental: { serverActions: { bodySizeLimit: '55mb' } },
};

export default nextConfig;
