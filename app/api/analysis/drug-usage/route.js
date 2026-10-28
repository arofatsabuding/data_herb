// Excel วิเคราะห์รหัสยา (ทั้งหมด) ตามพื้นที่และกลุ่มที่เลือกในหน้า /analysis (ต้อง login) — sheet สรุปกลุ่ม + รายการยา + ผู้ผลิต
import { cookies } from 'next/headers';
import { allowed, currentUser } from '@/lib/auth';
import { xlsxResponse } from '@/lib/excel';
import {
  CLAIM_GROUPS,
  FOLLOW_UP_CATS,
  NOT_IN_GROUP,
  USAGE_CATS,
  getAreaInfo,
  getDrugUsage,
  inUsageTab,
  analysisSets,
  kpiAvailable,
  parseKpiQuery,
  usageByManufacturer,
  usageTab,
} from '@/lib/kpi';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!allowed(await currentUser(), 'analysis')) return new Response('กรุณาเข้าสู่ระบบก่อน', { status: 401 });
  if (!kpiAvailable()) return new Response('ยังไม่มีข้อมูลมูลค่ายาสมุนไพร', { status: 404 });
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { q, missing } = parseKpiQuery(sp);
  if (missing) return new Response(`กรุณาเลือก${missing}`, { status: 400 });
  if (!getAreaInfo(q)) return new Response('ไม่พบข้อมูลของพื้นที่ที่เลือก', { status: 404 });

  // ปีเดียวกับหน้า /analysis (ตัดปีที่ไฟล์ยังเป็นข้อมูลของปีอื่น)
  const { sets } = analysisSets(await cookies());
  const years = sets.map((s) => s.year);
  const { items, groups, curYear } = getDrugUsage(q, sets);
  const cat = usageTab(sp.cat);
  const list = items.filter(inUsageTab(cat));

  // สรุป 3 กลุ่มการเบิกจ่าย รายปี
  const groupHeader = ['กลุ่มการเบิกจ่าย', 'คำอธิบาย'];
  for (const y of years) groupHeader.push(`รหัส ${y}`, `รายการยา ${y}`, `ครั้ง UC ${y}`, `มูลค่า ${y} (บาท)`);
  const groupRows = [groupHeader];
  const gTotal = ['รวมทั้งหมด', ''];
  for (const [k, g] of Object.entries(CLAIM_GROUPS)) {
    const row = [g.label, g.desc];
    for (const y of years) {
      const v = groups[k].byYear[y];
      row.push(v.codes, v.items, v.vs_uc, k === 'loss_unknown' ? 'ไม่รู้ยอดเงิน' : v.kpi_value);
    }
    groupRows.push(row);
  }
  years.forEach((y, i) => {
    const s = (f) => Object.keys(CLAIM_GROUPS).reduce((t, k) => t + groups[k].byYear[y][f], 0);
    gTotal[2 + i * 4] = s('codes');
    gTotal[3 + i * 4] = s('items');
    gTotal[4 + i * 4] = s('vs_uc');
    gTotal[5 + i * 4] = s('kpi_value');
  });
  groupRows.push(gTotal);

  const header = [
    'อันดับ',
    'รหัส 24 หลัก',
    'รหัสที่ส่งมา (didstd)',
    'ชื่อยา',
    'ชื่อการค้า',
    'ประเภท',
    'ผู้ผลิต',
    'เลขทะเบียน',
    'กลุ่มการเบิกจ่าย',
    'สถานะ',
    'นับมูลค่ายา',
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
      CLAIM_GROUPS[d.group].label,
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
    [
      'อันดับ',
      'ผู้ผลิต',
      'ยาที่ใช้มาก',
      'รหัสที่เบิกไม่ได้',
      ...FOLLOW_UP_CATS.map((c) => USAGE_CATS[c].label),
      `ครั้ง UC ${curYear}`,
      `มูลค่าที่เบิกไม่ได้ ${curYear} (บาท)`,
    ],
    ...makers.map((m, i) => [i + 1, m.manufacturer, m.top.join(', '), m.codes, ...FOLLOW_UP_CATS.map((c) => m[c]), m.vs_uc, m.kpi_value]),
  ];
  const mSum = (f) => makers.reduce((t, m) => t + m[f], 0);
  makerRows.push([`รวมทั้งหมด (${makers.length} ราย)`, '', '', mSum('codes'), ...FOLLOW_UP_CATS.map(mSum), mSum('vs_uc'), mSum('kpi_value')]);

  const area = String(q[q.view] || 'all').replace(/[^\w-]/g, '');
  return xlsxResponse(`drug_usage_${q.view}_${area}_${cat}.xlsx`, [
    { name: 'สรุปกลุ่ม', rows: groupRows },
    { name: 'รายการยา', rows },
    { name: 'ผู้ผลิต', rows: makerRows },
  ]);
}
