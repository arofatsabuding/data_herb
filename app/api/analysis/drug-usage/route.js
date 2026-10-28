// Excel วิเคราะห์รหัสยา (ทั้งหมด) ตามพื้นที่และกลุ่มที่เลือกในหน้า /analysis (ต้อง login) — sheet รายการยา + sheet ผู้ผลิต
import { cookies } from 'next/headers';
import { allowed, currentUser } from '@/lib/auth';
import { xlsxResponse } from '@/lib/excel';
import {
  FOLLOW_UP_CATS,
  NOT_IN_GROUP,
  USAGE_CATS,
  getAreaInfo,
  getDrugUsage,
  kpiAvailable,
  parseKpiQuery,
  setsFromCookies,
  usageByManufacturer,
} from '@/lib/kpi';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!allowed(await currentUser(), 'analysis')) return new Response('กรุณาเข้าสู่ระบบก่อน', { status: 401 });
  if (!kpiAvailable()) return new Response('ยังไม่มีข้อมูลตัวชี้วัด', { status: 404 });
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { q, missing } = parseKpiQuery(sp);
  if (missing) return new Response(`กรุณาเลือก${missing}`, { status: 400 });
  if (!getAreaInfo(q)) return new Response('ไม่พบข้อมูลของพื้นที่ที่เลือก', { status: 404 });

  // ใช้ไฟล์และปีตามที่ผู้ใช้คนนี้เลือกไว้ เหมือนหน้า /kpi
  const sets = setsFromCookies(await cookies());
  const years = sets.map((s) => s.year);
  const { items, curYear } = getDrugUsage(q, sets);
  const cat = USAGE_CATS[sp.cat] || sp.cat === 'all' ? sp.cat : 'follow';
  const list = items.filter((d) => (cat === 'all' ? true : cat === 'follow' ? FOLLOW_UP_CATS.includes(d.cat) : d.cat === cat));

  const header = [
    'อันดับ',
    'รหัส 24 หลัก',
    'รหัสที่ส่งมา (didstd)',
    'ชื่อยา',
    'ชื่อการค้า',
    'ประเภท',
    'ผู้ผลิต',
    'เลขทะเบียน',
    'สถานะ',
    'เข้าเกณฑ์ตัวชี้วัด',
    'มี Drug Group',
    'TTMTID',
    'Drug Group',
    'เหตุที่ไม่มี Drug Group',
    'กลุ่มยา 11 หลัก',
    'ชื่อกลุ่มยา',
    'ราคา/course',
  ];
  for (const y of years) header.push(`หน่วยบริการ ${y}`, `ครั้ง UC ${y}`, `ครั้งทุกสิทธิ ${y}`, `มูลค่า ${y} (บาท)`);
  const rows = [header];
  list.forEach((d, i) => {
    const row = [
      i + 1,
      d.code24,
      d.didstd || d.code24,
      d.drug_name,
      d.trade_name,
      d.drug_type,
      d.manufacturer,
      d.registration_no,
      USAGE_CATS[d.cat].label,
      d.kpi ? 'ใช่' : 'ไม่',
      d.in24 ? (d.dg ? 'ใช่' : 'ไม่') : '-',
      d.ttmtids?.join(', '),
      d.drug_groups?.join(', '),
      d.dg_reason,
      d.code11,
      d.kpi ? d.full_name : NOT_IN_GROUP,
      d.price,
    ];
    for (const y of years) {
      const v = d.byYear[y] || {};
      row.push(v.hosp_count ?? 0, v.vs_uc ?? 0, v.vs_all ?? 0, v.kpi_value ?? 0);
    }
    rows.push(row);
  });
  // แถวรวม
  const sum = (y, f) => list.reduce((t, d) => t + Number(d.byYear[y]?.[f] || 0), 0);
  const totalRow = [`รวมทั้งหมด (${list.length} รหัส)`, ...Array(header.length - 1 - years.length * 4).fill('')];
  for (const y of years) totalRow.push('', sum(y, 'vs_uc'), sum(y, 'vs_all'), sum(y, 'kpi_value'));
  rows.push(totalRow);

  const makers = usageByManufacturer(items, curYear);
  const makerRows = [
    ['อันดับ', 'ผู้ผลิต', 'ยาที่ใช้มาก', 'รหัสที่ต้องติดตาม', ...FOLLOW_UP_CATS.map((c) => USAGE_CATS[c].label), `ครั้ง UC ${curYear}`],
    ...makers.map((m, i) => [i + 1, m.manufacturer, m.top.join(', '), m.codes, ...FOLLOW_UP_CATS.map((c) => m[c]), m.vs_uc]),
  ];
  const mSum = (f) => makers.reduce((t, m) => t + m[f], 0);
  makerRows.push([`รวมทั้งหมด (${makers.length} ราย)`, '', '', mSum('codes'), ...FOLLOW_UP_CATS.map(mSum), mSum('vs_uc')]);

  const area = String(q[q.view] || 'all').replace(/[^\w-]/g, '');
  return xlsxResponse(`drug_usage_${q.view}_${area}_${cat}.xlsx`, [
    { name: 'รายการยา', rows },
    { name: 'ผู้ผลิต', rows: makerRows },
  ]);
}
