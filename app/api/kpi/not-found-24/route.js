// CSV รหัส 24 หลักที่ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก (ทั้งหมด) ตามพื้นที่ที่เลือกในหน้า /kpi
import { cookies } from 'next/headers';
import { NOT_IN_GROUP, PREF_COOKIE, getNotFound24, kpiAvailable, parseKpiQuery, parsePrefs, resolveSets } from '@/lib/kpi';

export const dynamic = 'force-dynamic';

const cell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // ใส่ ="..." ให้รหัสตัวเลขยาว ๆ เพื่อไม่ให้ Excel แปลงเป็นเลขยกกำลัง
  if (/^\d{8,}$/.test(s)) return `="${s}"`;
  // กันข้อความที่ Excel จะตีความเป็นสูตร (ข้อมูลรหัสมาจากภายนอก)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request) {
  if (!kpiAvailable()) return new Response('ยังไม่มีข้อมูลตัวชี้วัด', { status: 404 });
  const { q, missing } = parseKpiQuery(Object.fromEntries(request.nextUrl.searchParams));
  if (missing) return new Response(`กรุณาเลือก${missing}`, { status: 400 });

  // ใช้ไฟล์ตามที่ผู้ใช้คนนี้เลือกไว้ เหมือนหน้า /kpi
  const sets = resolveSets(parsePrefs((await cookies()).get(PREF_COOKIE)?.value));
  const years = sets.map((s) => s.year);
  const items = getNotFound24(q, sets, null);
  const header = ['รหัส 24 หลัก (หลังล้าง)', 'รหัสที่ส่งมา (didstd)', 'กลุ่มยา 11 หลัก', 'ชื่อกลุ่มยา', 'ราคา/course'];
  for (const y of years) header.push(`หน่วยบริการ ${y}`, `ครั้ง UC ${y}`, `มูลค่า ${y}`);

  const BOM = String.fromCharCode(0xfeff); // ให้ Excel อ่านภาษาไทยถูก
  const lines = [BOM + header.join(',')];
  for (const d of items) {
    const row = [d.code24, d.didstd || d.code24, d.code11, d.price === null ? NOT_IN_GROUP : d.full_name, d.price];
    for (const y of years) {
      const v = d.byYear[y] || {};
      row.push(v.hosp_count ?? 0, v.vs_uc ?? 0, v.kpi_value ?? 0);
    }
    lines.push(row.map(cell).join(','));
  }
  // แถวรวม
  const sum = (y, f) => items.reduce((t, d) => t + Number(d.byYear[y]?.[f] || 0), 0);
  const totalRow = [`รวมทั้งหมด (${items.length} รหัส)`, '', '', '', ''];
  for (const y of years) totalRow.push('', sum(y, 'vs_uc'), sum(y, 'kpi_value'));
  lines.push(totalRow.map(cell).join(','));

  const area = String(q[q.view] || 'all').replace(/[^\w-]/g, '');
  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="not_found_24_${q.view}_${area}.csv"`,
    },
  });
}
