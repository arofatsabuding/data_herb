import { allowed, currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ผู้ใช้ที่ login อยู่ (ใช้กับเมนูด้านบน) — ไม่ส่งเลขบัตรออกไป
export async function GET() {
  const u = await currentUser();
  const user = u && { name: u.name, role: u.role, roleLabel: u.roleLabel, admin: allowed(u, 'admin'), dev: allowed(u, 'dev') };
  return Response.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
