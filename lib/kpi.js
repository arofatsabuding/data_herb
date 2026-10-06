// ตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" — เปรียบเทียบระหว่างปีงบประมาณ
// รูปแบบการแสดงผล: ภาพรวมประเทศ / เขตสุขภาพ / จังหวัด / อำเภอ / หน่วยบริการ
import { getKpiDb } from './db';

export const KPI_NAME = 'มูลค่ายาสมุนไพรในสิทธิ UC';
export const DEFAULT_HOSPCODE = '11442';

// view → แตกย่อยเป็นอะไร, คอลัมน์ที่ใช้จัดกลุ่ม
export const VIEWS = {
  country: { label: 'ภาพรวมประเทศ', child: 'zone', childLabel: 'เขตสุขภาพ', key: 'health_zone', name: 'health_zone' },
  zone: { label: 'ภาพรวมเขต', child: 'province', childLabel: 'จังหวัด', key: 'province_code', name: 'province' },
  province: { label: 'ภาพรวมจังหวัด', child: 'district', childLabel: 'อำเภอ', key: 'district_code', name: 'district' },
  district: { label: 'ภาพรวมอำเภอ', child: 'hosp', childLabel: 'หน่วยบริการ', key: 'hospcode', name: 'name' },
  hosp: { label: 'ภาพรวมหน่วยบริการ', child: null, childLabel: 'กลุ่มยา' },
};
export const VIEW_ORDER = ['hosp', 'district', 'province', 'zone', 'country'];

const SUMS = `COUNT(*) hosp_count, SUM(rows) rows, SUM(matched_rows) matched_rows,
  SUM(vs_all) vs_all, SUM(vs_uc) vs_uc, SUM(matched_vs_uc) matched_vs_uc,
  SUM(pri_uc) pri_uc, SUM(kpi_value) kpi_value`;

const thSort = (a, b) => String(a).localeCompare(String(b), 'th');

export function kpiAvailable() {
  return getKpiDb() !== null;
}

export function getKpiYears() {
  const db = getKpiDb();
  if (!db) return [];
  return db.prepare('SELECT * FROM kpi_files ORDER BY year').all();
}

// ร้อยละการเปลี่ยนแปลง (null = ปีฐานเป็น 0 เทียบไม่ได้)
export function pctChange(prev, cur) {
  const p = Number(prev || 0);
  const c = Number(cur || 0);
  if (!p) return c ? null : 0;
  return ((c - p) / p) * 100;
}

export function getOfficeTypes() {
  return getKpiDb()
    .prepare(
      `SELECT type_code code, COALESCE(MAX(type_name), 'ไม่ระบุประเภท') name, COUNT(DISTINCT hospcode) n
         FROM kpi_hosp GROUP BY type_code ORDER BY type_code`
    )
    .all();
}

// ตัวเลือกเขต / จังหวัด / อำเภอ สำหรับฟอร์ม
export function getAreaOptions() {
  const db = getKpiDb();
  const zones = db
    .prepare('SELECT DISTINCT health_zone code FROM kpi_hosp WHERE health_zone IS NOT NULL ORDER BY health_zone')
    .all()
    .map((z) => ({ code: z.code, name: `เขตสุขภาพที่ ${Number(z.code)}` }));
  const provinces = db
    .prepare(
      `SELECT province_code code, MAX(province) name, MAX(health_zone) zone
         FROM kpi_hosp WHERE province_code IS NOT NULL GROUP BY province_code`
    )
    .all()
    .sort((a, b) => thSort(a.name, b.name));
  const districts = db
    .prepare(
      `SELECT district_code code, MAX(district) name, MAX(province_code) province
         FROM kpi_hosp WHERE district_code IS NOT NULL GROUP BY district_code`
    )
    .all()
    .sort((a, b) => thSort(a.name, b.name));
  return { zones, provinces, districts };
}

function scopeWhere({ view, zone, province, district, hosp, type }, alias = '') {
  const p = alias ? `${alias}.` : '';
  const where = [];
  const params = {};
  const add = (col, key, value) => {
    where.push(`${p}${col} = @${key}`);
    params[key] = String(value);
  };
  if (view === 'zone') add('health_zone', 'zone', zone);
  if (view === 'province') add('province_code', 'province', province);
  if (view === 'district') add('district_code', 'district', district);
  if (view === 'hosp') add('hospcode', 'hosp', hosp);
  if (type && view !== 'hosp') {
    if (type === '-') where.push(`${p}type_code IS NULL`);
    else add('type_code', 'type', type);
  }
  return { sql: where.length ? where.join(' AND ') : '1=1', params };
}

// รวมผลหลายปีให้เป็นแถวเดียวต่อ key: { key, ..., byYear: { 2569: {...}, 2570: {...} } }
function mergeByYear(rows, keyOf) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, { ...r, byYear: {} });
    const m = map.get(k);
    m.byYear[r.year] = r;
    // ใช้ชื่อจากปีล่าสุดที่มี
    for (const f of ['name', 'full_name', 'type_name']) if (r[f]) m[f] = r[f];
  }
  return [...map.values()];
}

// ชื่อพื้นที่ที่เลือก (ใช้แสดงหัวข้อ) — null = ไม่พบในข้อมูล
function describeArea(db, q) {
  if (q.view === 'country') return { title: 'ประเทศไทย', subtitle: 'ทุกเขตสุขภาพ' };
  if (q.view === 'zone') {
    const r = db.prepare('SELECT 1 FROM kpi_hosp WHERE health_zone = ? LIMIT 1').get(String(q.zone));
    return r ? { title: `เขตสุขภาพที่ ${Number(q.zone)}`, subtitle: null } : null;
  }
  if (q.view === 'province') {
    const r = db
      .prepare('SELECT MAX(province) province, MAX(health_zone) zone FROM kpi_hosp WHERE province_code = ?')
      .get(String(q.province));
    return r?.province
      ? { title: `จังหวัด${r.province}`, subtitle: `เขตสุขภาพที่ ${Number(r.zone)}`, zone: r.zone }
      : null;
  }
  if (q.view === 'district') {
    const r = db
      .prepare(
        `SELECT MAX(district) district, MAX(province) province, MAX(province_code) province_code,
                MAX(health_zone) zone FROM kpi_hosp WHERE district_code = ?`
      )
      .get(String(q.district));
    return r?.district
      ? { title: `อำเภอ${r.district}`, subtitle: `จังหวัด${r.province} · เขตสุขภาพที่ ${Number(r.zone)}`, ...r }
      : null;
  }
  const h = db.prepare('SELECT * FROM kpi_hosp WHERE hospcode = ? ORDER BY year DESC LIMIT 1').get(String(q.hosp));
  if (!h) return null;
  return {
    title: h.name || `หน่วยบริการ ${h.hospcode}`,
    subtitle: [
      `รหัส ${h.hospcode}`,
      h.type_name,
      h.district && `อ.${h.district}`,
      h.province && `จ.${h.province}`,
      h.health_zone && `เขต ${Number(h.health_zone)}`,
    ]
      .filter(Boolean)
      .join(' · '),
    hosp: h,
  };
}

/**
 * รายงานเปรียบเทียบ
 * q = { view, zone, province, district, hosp, type }, years = [ปีฐาน, ปีเปรียบเทียบ]
 */
export function getCompareReport(q, years) {
  const db = getKpiDb();
  const area = describeArea(db, q);
  if (!area) return null;

  const scope = scopeWhere(q);
  const yearIn = years.map((_, i) => `@y${i}`).join(', ');
  const params = { ...scope.params };
  years.forEach((y, i) => (params[`y${i}`] = y));
  const where = `${scope.sql} AND year IN (${yearIn})`;

  const totals = {};
  for (const r of db.prepare(`SELECT year, ${SUMS} FROM kpi_hosp WHERE ${where} GROUP BY year`).all(params)) {
    totals[r.year] = r;
  }

  const V = VIEWS[q.view];
  let children;
  if (V.child) {
    const rows = db
      .prepare(
        `SELECT year, ${V.key} key, MAX(${V.name}) name, ${SUMS}
                ${q.view === 'district' ? ', MAX(type_name) type_name' : ''}
           FROM kpi_hosp WHERE ${where}
          GROUP BY year, ${V.key}`
      )
      .all(params);
    children = mergeByYear(rows, (r) => r.key ?? '').map((c) => ({
      ...c,
      label:
        q.view === 'country'
          ? c.key
            ? `เขตสุขภาพที่ ${Number(c.key)}`
            : 'ไม่ระบุเขต'
          : c.name || (q.view === 'district' ? c.key : 'ไม่ระบุ'),
    }));
  } else {
    children = getHospDrugs(q.hosp, years);
  }

  return { area, totals, children, topGroups: V.child ? getTopDrugGroups(q, years) : [] };
}

// รายการยาของหน่วยบริการ แยกตามรหัส 11 หลัก เทียบรายปี
function getHospDrugs(hospcode, years) {
  const rows = getKpiDb()
    .prepare(
      `SELECT s.year, s.code11, m.full_name, s.price,
              COUNT(*) items, SUM(s.vs_uc) vs_uc, SUM(s.kpi_value) kpi_value,
              MIN(s.did_clean) sample_did
         FROM sttm4 s
         LEFT JOIN herbal_drug_master_11 m ON m.code11 = s.code11
        WHERE s.hospcode = ? AND s.year IN (${years.map(() => '?').join(', ')})
        GROUP BY s.year, s.code11, s.price`
    )
    .all(String(hospcode), ...years);
  return mergeByYear(rows, (r) => `${r.code11}|${r.price}`);
}

// กลุ่มยาที่มีมูลค่าสูงสุดในพื้นที่ที่เลือก (เรียงตามปีล่าสุด)
function getTopDrugGroups(q, years) {
  const scope = scopeWhere(q, 'h');
  const params = { ...scope.params };
  years.forEach((y, i) => (params[`y${i}`] = y));
  const rows = getKpiDb()
    .prepare(
      `SELECT s.year, s.code11, m.full_name, s.price, SUM(s.vs_uc) vs_uc, SUM(s.kpi_value) kpi_value
         FROM sttm4 s
         JOIN kpi_hosp h ON h.year = s.year AND h.hospcode = s.hospcode
         JOIN herbal_drug_master_11 m ON m.code11 = s.code11
        WHERE ${scope.sql} AND s.year IN (${years.map((_, i) => `@y${i}`).join(', ')})
        GROUP BY s.year, s.code11`
    )
    .all(params);
  return mergeByYear(rows, (r) => r.code11);
}
