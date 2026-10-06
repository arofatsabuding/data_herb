import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { isAdmin } from '@/lib/admin-auth';
import { resolveSystemFile } from '@/lib/system-files';

export const dynamic = 'force-dynamic';

const TYPES = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
};

// ดาวน์โหลดไฟล์ในระบบ — เฉพาะผู้ที่กรอกรหัสเข้าหน้าผู้ดูแลแล้ว
export async function GET(request) {
  if (!(await isAdmin())) return new Response('ต้องกรอกรหัสผู้ดูแลก่อน', { status: 401 });
  const sp = request.nextUrl.searchParams;
  const abs = resolveSystemFile(sp.get('dir'), sp.get('file'));
  if (!abs) return new Response('ไม่พบไฟล์', { status: 404 });

  const name = path.basename(abs);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return new Response(Readable.toWeb(fs.createReadStream(abs)), {
    headers: {
      'Content-Type': TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream',
      'Content-Length': String(fs.statSync(abs).size),
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
