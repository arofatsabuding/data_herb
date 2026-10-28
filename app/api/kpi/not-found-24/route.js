// Excel รหัส 24 หลักที่ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก (ทั้งหมด) ตามพื้นที่ที่เลือกในหน้า /kpi
import { cookies } from 'next/headers';
import { xlsxResponse } from '@/lib/excel';
import { NOT_IN_GROUP, getNotFound24, kpiAvailable, parseKpiQuery, setsFromCookies } from '@/lib/kpi';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!kpiAvailable()) return new Response('ยังไม่มีข้อมูลมูลค่ายาสมุนไพร', { status: 404 });
  const { q, missing } = parseKpiQuery(Object.fromEntries(request.nextUrl.searchParams));
  if (missing) return new Response(`กรุณาเลือก${missing}`, { status: 400 });

  // ใช้ไฟล์และปีตามที่ผู้ใช้คนนี้เลือกไว้ เหมือนหน้า /kpi
  const sets = setsFromCookies(await cookies());
  const years = sets.map((s) => s.year);
  const items = getNotFound24(q, sets, null);
  const header = ['รหัส 24 หลัก (หลังล้าง)', 'รหัสที่ส่งมา (didstd)', 'กลุ่มยา 11 หลัก', 'ชื่อกลุ่มยา', 'ราคา/course'];
  for (const y of years) header.push(`หน่วยบริการ ${y}`, `ครั้ง UC ${y}`);

  const rows = [header];
  for (const d of items) {
    const row = [d.code24, d.didstd || d.code24, d.code11, d.price === null ? NOT_IN_GROUP : d.full_name, d.price];
    for (const y of years) {
      const v = d.byYear[y] || {};
      row.push(v.hosp_count ?? 0, v.vs_uc ?? 0);
    }
    rows.push(row);
  }
  // แถวรวม
  const sum = (y, f) => items.reduce((t, d) => t + Number(d.byYear[y]?.[f] || 0), 0);
  const totalRow = [`รวมทั้งหมด (${items.length} รหัส)`, '', '', '', ''];
  for (const y of years) totalRow.push('', sum(y, 'vs_uc'));
  rows.push(totalRow);

  const area = String(q[q.view] || 'all').replace(/[^\w-]/g, '');
  return xlsxResponse(`not_found_24_${q.view}_${area}.xlsx`, [{ name: 'รหัส 24 หลักที่ไม่พบ', rows }]);
}
