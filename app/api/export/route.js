import { iterateDrugs } from '@/lib/drugs';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  ['code24', 'รหัสยาแผนไทย 24 หลัก'],
  ['source_code', 'รหัสที่มาของยา'],
  ['ttmtid', 'TTMTID'],
  ['drug_group', 'Drug Group'],
  ['reimburse_amount', 'เบิกได้ต่อ course'],
  ['reimburse_unit', 'หน่วยเบิก'],
  ['drug_type', 'ประเภท'],
  ['drug_name', 'ชื่อยา'],
  ['trade_name', 'ชื่อการค้า/ชื่อเดิม'],
  ['strength', 'ขนาดความแรง'],
  ['dosage_form', 'รูปแบบยา'],
  ['pack_size', 'ขนาดบรรจุ'],
  ['manufacturer', 'ผู้ผลิต'],
  ['registration_no', 'เลขทะเบียนยา'],
  ['indication', 'สรรพคุณยา-ข้อบ่งใช้'],
  ['master_active_ingredient', 'ตัวยาสำคัญ (Master)'],
  ['master_fsn', 'FSN (Master)'],
];

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // ใส่ ="..." ให้รหัสตัวเลขยาว ๆ เพื่อไม่ให้ Excel แปลงเป็นเลขยกกำลัง
  if (/^\d{8,}$/.test(s)) return `="${s}"`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function GET(request) {
  const sp = request.nextUrl.searchParams;
  const filters = Object.fromEntries(['q', 'type', 'group', 'unit', 'name', 'mfr', 'src'].map((k) => [k, sp.get(k) || '']));

  const BOM = String.fromCharCode(0xfeff); // ให้ Excel อ่านภาษาไทยถูก
  const lines = [BOM + COLUMNS.map(([, h]) => h).join(',')];
  for (const row of iterateDrugs(filters)) {
    lines.push(
      COLUMNS.map(([k]) => (k === 'drug_group' && !row.has_drug_group ? 'ไม่มี Drug Group' : cell(row[k]))).join(',')
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="data_herb_${stamp}.csv"`,
    },
  });
}
