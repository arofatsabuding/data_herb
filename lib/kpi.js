// ตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" — สรุปตามระดับ ประเทศ / เขตสุขภาพ / จังหวัด / อำเภอ / หน่วยบริการ
import { getKpiDb } from './db';

export const KPI_NAME = 'มูลค่ายาสมุนไพรในสิทธิ UC';

// ระดับที่แสดง: ระดับปัจจุบัน → แตกย่อยด้วยคอลัมน์ไหน
const LEVELS = {
  country: { label: 'ประเทศ', child: 'zone', key: 'health_zone', name: 'health_zone' },
  zone: { label: 'เขตสุขภาพ', child: 'province', key: 'province_code', name: 'province' },
  province: { label: 'จังหวัด', child: 'district', key: 'district_code', name: 'district' },
  district: { label: 'อำเภอ', child: 'hosp', key: 'hospcode', name: 'name' },
};

const SUMS = `COUNT(*) hosp_count, SUM(rows) rows, SUM(matched_rows) matched_rows,
  SUM(vs_all) vs_all, SUM(vs_uc) vs_uc, SUM(matched_vs_uc) matched_vs_uc,
  SUM(pri_uc) pri_uc, SUM(kpi_value) kpi_value`;

export function kpiAvailable() {
  return getKpiDb() !== null;
}

export function getKpiYears() {
  const db = getKpiDb();
  if (!db) return [];
  return db.prepare('SELECT * FROM kpi_files ORDER BY year DESC').all();
}

export function getOfficeTypes(year) {
  return getKpiDb()
    .prepare(
      `SELECT type_code code, COALESCE(type_name, 'ไม่ระบุประเภท') name, COUNT(*) n
         FROM kpi_hosp WHERE year = ? GROUP BY type_code ORDER BY type_code`
    )
    .all(year);
}

// เงื่อนไขตามพารามิเตอร์ที่เลือก (ใช้ร่วมกันทุกระดับ)
function scopeWhere({ year, zone, province, district, type }, alias = '') {
  const p = alias ? `${alias}.` : '';
  const where = [`${p}year = @year`];
  const params = { year: Number(year) };
  const add = (col, key, value) => {
    if (value === undefined || value === null || value === '') return;
    if (value === '-') where.push(`${p}${col} IS NULL`);
    else {
      where.push(`${p}${col} = @${key}`);
      params[key] = String(value);
    }
  };
  add('health_zone', 'zone', zone);
  add('province_code', 'province', province);
  add('district_code', 'district', district);
  add('type_code', 'type', type);
  return { sql: where.join(' AND '), params };
}

function currentLevel({ zone, province, district, hosp }) {
  if (hosp) return 'hosp';
  if (district) return 'district';
  if (province) return 'province';
  if (zone) return 'zone';
  return 'country';
}

export function getKpiReport({ year, zone, province, district, hosp, type }) {
  const db = getKpiDb();
  const level = currentLevel({ zone, province, district, hosp });
  const scope = scopeWhere({ year, zone, province, district, type });

  // breadcrumb: ชื่อของแต่ละระดับที่เลือก
  const names = db
    .prepare(
      `SELECT MAX(province) province, MAX(district) district FROM kpi_hosp WHERE ${scope.sql}`
    )
    .get(scope.params);
  const crumbs = [{ level: 'country', label: 'ประเทศไทย', params: {} }];
  if (zone) crumbs.push({ level: 'zone', label: zone === '-' ? 'ไม่ระบุเขต' : `เขตสุขภาพที่ ${Number(zone)}`, params: { zone } });
  if (province) crumbs.push({ level: 'province', label: names.province ? `จ.${names.province}` : 'ไม่ระบุจังหวัด', params: { zone, province } });
  if (district) crumbs.push({ level: 'district', label: names.district ? `อ.${names.district}` : 'ไม่ระบุอำเภอ', params: { zone, province, district } });

  if (level === 'hosp') {
    const h = db.prepare('SELECT * FROM kpi_hosp WHERE year = ? AND hospcode = ?').get(Number(year), String(hosp));
    if (!h) return null;
    crumbs.push({ level: 'hosp', label: h.name, params: { zone, province, district, hosp } });
    return { level, crumbs, total: { ...h, hosp_count: 1 }, hosp: h, drugs: getHospDrugs(year, hosp) };
  }

  const total = db.prepare(`SELECT ${SUMS} FROM kpi_hosp WHERE ${scope.sql}`).get(scope.params);
  const L = LEVELS[level];
  const children = db
    .prepare(
      `SELECT ${L.key} key, MAX(${L.name}) name, ${SUMS}
         ${level === 'district' ? ', MAX(type_name) type_name' : ''}
         FROM kpi_hosp WHERE ${scope.sql}
        GROUP BY ${L.key}
        ORDER BY kpi_value DESC`
    )
    .all(scope.params)
    .map((c) => ({
      ...c,
      label:
        level === 'country'
          ? c.key
            ? `เขตสุขภาพที่ ${Number(c.key)}`
            : 'ไม่ระบุเขต'
          : c.name || (level === 'district' ? c.key : 'ไม่ระบุ'),
    }));

  return { level, childLevel: L.child, childLabel: LEVELS[L.child]?.label || 'หน่วยบริการ', crumbs, total, children };
}

// รายการยาของหน่วยบริการ จัดกลุ่มตามรหัส 11 หลัก
export function getHospDrugs(year, hospcode) {
  return getKpiDb()
    .prepare(
      `SELECT s.code11, m.full_name, s.price,
              COUNT(*) items, SUM(s.vs_all) vs_all, SUM(s.vs_uc) vs_uc,
              SUM(s.pri_uc) pri_uc, SUM(s.kpi_value) kpi_value,
              GROUP_CONCAT(s.did_clean) dids
         FROM sttm4 s
         LEFT JOIN herbal_drug_master_11 m ON m.code11 = s.code11
        WHERE s.year = ? AND s.hospcode = ?
        GROUP BY s.code11, s.price
        ORDER BY (s.price IS NULL), kpi_value DESC, vs_uc DESC`
    )
    .all(Number(year), String(hospcode));
}

// 10 กลุ่มยาที่มีมูลค่าตัวชี้วัดสูงสุดในขอบเขตที่เลือก
export function getTopDrugGroups({ year, zone, province, district, type }, limit = 10) {
  const scope = scopeWhere({ year, zone, province, district, type }, 'h');
  return getKpiDb()
    .prepare(
      `SELECT s.code11, m.full_name, s.price, SUM(s.vs_uc) vs_uc, SUM(s.kpi_value) kpi_value
         FROM sttm4 s
         JOIN kpi_hosp h ON h.year = s.year AND h.hospcode = s.hospcode
         JOIN herbal_drug_master_11 m ON m.code11 = s.code11
        WHERE ${scope.sql}
        GROUP BY s.code11
        ORDER BY kpi_value DESC
        LIMIT ${Number(limit)}`
    )
    .all(scope.params);
}
