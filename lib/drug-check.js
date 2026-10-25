// ตรวจรายการยาที่ HIS ของโรงพยาบาลส่งมา ว่าข้อมูลครบถ้วนพอให้นับในตัวชี้วัดและเบิกได้หรือไม่
// ใช้กติกาเดียวกับการคำนวณตัวชี้วัด (scripts/kpi-lib.js): ล้างรหัสให้เหลือแต่ตัวเลข → หาในไฟล์รหัส 24 หลัก
// → 11 หลักแรกหากลุ่มยาใน herbal_drug_master_11 (ไม่พบ = 0 บาท) แล้วตรวจ TTMTID / Drug Group ต่อ
import { getDb, getKpiDb } from './db';
import { NOT_IN_GROUP } from './kpi';

export const MAX_ITEMS = 1000;

// error = ทำให้ตัวชี้วัดนับผิด (เป็นรหัสผิดพลาด หรือได้ 0 บาท) · warning = ไม่กระทบตัวชี้วัด แต่ข้อมูลยังไม่ครบ
export const ISSUES = {
  FORMAT: { level: 'error', message: 'รหัสยาไม่ใช่ตัวเลข 24 หลัก' },
  NOT_IN_DTAM24: {
    level: 'error',
    message: 'ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก (ยาเดี่ยว/ยาตำรับ) — รหัสผิดหรือถูกยกเลิกรหัส จะถูกนับเป็นรหัสยาที่ผิดพลาด',
  },
  NO_KPI_GROUP: {
    level: 'error',
    message: `11 หลักแรกไม่พบในกลุ่มยา (herbal_drug_master_11) — ${NOT_IN_GROUP} มูลค่าตัวชี้วัดเป็น 0 บาท`,
  },
  DIRTY_CODE: { level: 'warning', message: 'รหัสมีอักขระอื่นปน (เช่น ช่องว่าง ขีด) — ระบบล้างให้แล้ว แต่ควรแก้ใน HIS' },
  NO_TTMTID: { level: 'warning', message: 'รหัสนี้ยังไม่มี TTMTID ในไฟล์รหัส 24 หลัก' },
  TTMTID_MISMATCH: { level: 'warning', message: 'TTMTID ที่ส่งมาไม่ตรงกับ TTMTID ของรหัส 24 หลักนี้' },
  NOT_IN_TTMT_MASTER: { level: 'warning', message: 'TTMTID ไม่พบใน TTMT Master (สมสท.)' },
  NO_DRUG_GROUP: { level: 'warning', message: 'ไม่มี Drug Group — ยังไม่มีอัตราเบิกต่อ course' },
};

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const digits = (v) => clean(v).replace(/\D/g, '');

// รับได้ทั้ง "รหัส" หรือ { code24 | didstd, ttmtid, drug_name, local_code }
function normalize(item) {
  if (item && typeof item === 'object') {
    return {
      input: clean(item.code24 ?? item.didstd),
      ttmtid: digits(item.ttmtid) || null,
      drug_name: clean(item.drug_name) || null,
      local_code: clean(item.local_code) || null,
    };
  }
  return { input: clean(item), ttmtid: null, drug_name: null, local_code: null };
}

// แถวที่ใช้ตรวจ TTMT: ตรงกับ TTMTID ที่ส่งมาก่อน ไม่งั้นเลือกแถวที่ข้อมูลครบที่สุด
function pickRow(rows, ttmtid) {
  return (
    (ttmtid && rows.find((r) => digits(r.ttmtid) === ttmtid)) ||
    [...rows].sort((a, b) => b.has_drug_group - a.has_drug_group || b.in_master - a.in_master || !!b.ttmtid - !!a.ttmtid)[0]
  );
}

/**
 * items = [{ code24, ttmtid?, drug_name?, local_code? } | "รหัส"]
 * → { summary, results: [{ index, local_code, input_code, code24, status, issues, reference }] }
 */
export function checkDrugList(items) {
  const db = getDb();
  const kpiDb = getKpiDb();
  const byCode = db.prepare('SELECT * FROM drug_lookup WHERE code24 = ? ORDER BY id');
  const group11 = kpiDb?.prepare('SELECT code11, full_name, price FROM herbal_drug_master_11 WHERE code11 = ?');

  const results = items.map((raw, index) => {
    const it = normalize(raw);
    const code24 = digits(it.input);
    const issues = [];
    const add = (code) => issues.push({ code, ...ISSUES[code] });

    let rows = [];
    if (code24.length !== 24) add('FORMAT');
    else {
      if (code24 !== it.input) add('DIRTY_CODE');
      rows = byCode.all(code24);
      if (!rows.length) add('NOT_IN_DTAM24');
    }

    const g = group11 && code24.length >= 11 ? group11.get(code24.slice(0, 11)) : null;
    if (group11 && code24.length === 24 && !g) add('NO_KPI_GROUP');

    let row = null;
    if (rows.length) {
      row = pickRow(rows, it.ttmtid);
      if (it.ttmtid && !rows.some((r) => digits(r.ttmtid) === it.ttmtid)) add('TTMTID_MISMATCH');
      if (!row.ttmtid) add('NO_TTMTID');
      else if (!row.in_master) add('NOT_IN_TTMT_MASTER');
      else if (!row.has_drug_group) add('NO_DRUG_GROUP');
    }

    const status = issues.some((i) => i.level === 'error') ? 'error' : issues.length ? 'warning' : 'ok';
    return {
      index,
      local_code: it.local_code,
      input_code: it.input,
      code24: code24 || null,
      status,
      issues,
      reference: row
        ? {
            drug_name: row.drug_name,
            drug_type: row.drug_type,
            source_code: row.source_code,
            ttmtid: row.ttmtid,
            all_ttmtids: [...new Set(rows.map((r) => r.ttmtid).filter(Boolean))],
            drug_group: row.has_drug_group ? row.drug_group : null,
            reimburse_per_course: row.has_drug_group ? { amount: row.reimburse_amount, unit: row.reimburse_unit } : null,
            kpi_group: g ? { code11: g.code11, name: g.full_name, price_per_course: g.price } : null,
          }
        : g
          ? { kpi_group: { code11: g.code11, name: g.full_name, price_per_course: g.price } }
          : null,
      ...(it.drug_name && row && { name_sent: it.drug_name }),
    };
  });

  const count = (s) => results.filter((r) => r.status === s).length;
  const byIssue = {};
  for (const r of results) for (const i of r.issues) byIssue[i.code] = (byIssue[i.code] || 0) + 1;
  const bad24 = results.filter((r) => r.issues.some((i) => i.code === 'FORMAT' || i.code === 'NOT_IN_DTAM24')).length;

  return {
    summary: {
      total: results.length,
      ok: count('ok'),
      warning: count('warning'),
      error: count('error'),
      // นิยามเดียวกับ "อัตรารหัสยาที่ผิดพลาด" ในหน้าตัวชี้วัด (นับเป็นรายการ)
      code_error_rate_pct: results.length ? Math.round((bad24 / results.length) * 10000) / 100 : 0,
      by_issue: byIssue,
      ...(!kpiDb && { note: 'ยังไม่มีข้อมูลตัวชี้วัดบนเซิร์ฟเวอร์ — ข้ามการตรวจกลุ่มยา 11 หลัก' }),
    },
    issue_codes: Object.fromEntries(Object.entries(ISSUES).map(([k, v]) => [k, `${v.level}: ${v.message}`])),
    results,
  };
}
