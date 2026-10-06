// ตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" — เปรียบเทียบระหว่างปีงบประมาณ
// รูปแบบการแสดงผล: ภาพรวมประเทศ / เขตสุขภาพ / จังหวัด / อำเภอ / หน่วยบริการ
// แต่ละปีใช้ไฟล์ (dataset) ตามที่ผู้ใช้แต่ละคนเลือก (เก็บใน cookie ของเบราว์เซอร์)
import kpiLib from '@/scripts/kpi-lib';
import { getKpiDb } from './db';

export const KPI_NAME = 'มูลค่ายาสมุนไพรในสิทธิ UC';
export const DEFAULT_HOSPCODE = '11442';
export const NOT_IN_GROUP = 'ไม่พบรายการยาหรือรายการยาถูกยกเลิกรหัส';
export const PREF_COOKIE = 'kpi_files';

// view → แตกย่อยเป็นอะไร, คอลัมน์ที่ใช้จัดกลุ่ม
export const VIEWS = {
  country: { label: 'ภาพรวมประเทศ', child: 'zone', childLabel: 'เขตสุขภาพ', key: 'health_zone', name: 'health_zone' },
  zone: { label: 'ภาพรวมเขต', child: 'province', childLabel: 'จังหวัด', key: 'province_code', name: 'province' },
  province: { label: 'ภาพรวมจังหวัด', child: 'district', childLabel: 'อำเภอ', key: 'district_code', name: 'district' },
  district: { label: 'ภาพรวมอำเภอ', child: 'hosp', childLabel: 'หน่วยบริการ', key: 'hospcode', name: 'name' },
  hosp: { label: 'ภาพรวมหน่วยบริการ', child: null, childLabel: 'กลุ่มยา' },
};

// ไม่นำมาคำนวณ: เขตสุขภาพที่ 13 (กรุงเทพฯ) และหน่วยบริการที่ไม่พบเขตสุขภาพ
export const EXCLUDED_ZONES = ['13'];
const inReport = (p = '') =>
  `${p}health_zone IS NOT NULL AND ${p}health_zone NOT IN (${EXCLUDED_ZONES.map((z) => `'${z}'`).join(', ')})`;

// อ่านพารามิเตอร์จาก URL → ค่าที่ใช้ได้จริง (missing = ยังเลือกไม่ครบ)
export function parseKpiQuery(sp) {
  const view = VIEWS[sp.view] ? sp.view : 'country';
  const q = { view, type: view === 'hosp' ? '' : sp.type || '' };
  if (view === 'hosp') q.hosp = String(sp.hosp || DEFAULT_HOSPCODE).trim();
  if (view === 'zone') q.zone = sp.zone || '';
  if (view === 'province' || view === 'district') q.province = sp.province || '';
  if (view === 'district') q.district = sp.district || '';
  const missing =
    (view === 'zone' && !q.zone && 'เขตสุขภาพ') ||
    (view === 'province' && !q.province && 'จังหวัด') ||
    (view === 'district' && (!q.province ? 'จังหวัดและอำเภอ' : !q.district && 'อำเภอ')) ||
    null;
  return { q, missing };
}

const SUMS = `COUNT(*) hosp_count, SUM(rows) rows, SUM(matched_rows) matched_rows,
  SUM(vs_all) vs_all, SUM(vs_uc) vs_uc, SUM(matched_vs_uc) matched_vs_uc,
  SUM(pri_uc) pri_uc, SUM(kpi_value) kpi_value`;

const thSort = (a, b) => String(a).localeCompare(String(b), 'th');

export function kpiAvailable() {
  return getKpiDb() !== null;
}

// ---------- ไฟล์ที่ผู้ใช้เลือก ----------

// ค่าใน cookie: {"2569": "latest" | "<ชื่อไฟล์>", "2570": ...}
export function parsePrefs(raw) {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/**
 * ไฟล์ของ 2 ปีล่าสุดตามที่ผู้ใช้เลือก
 * → [{ year, ds, file, dataset, choice, pending }]  (pending = ไฟล์ที่เลือกแต่ยังไม่ได้นำเข้า)
 * ไฟล์ที่เลือกยังไม่พร้อม → ใช้ไฟล์ล่าสุดที่มีในฐานข้อมูลไปก่อน
 */
export function resolveSets(prefs = {}) {
  const db = getKpiDb();
  if (!db) return [];
  const datasets = db.prepare('SELECT * FROM datasets').all();
  const years = [...new Set([...kpiLib.listYears(), ...datasets.map((d) => d.year)])].sort((a, b) => a - b).slice(-2);
  return years
    .map((year) => {
      const files = kpiLib.listFiles(year);
      const choice = prefs[year] || 'latest';
      const wanted = (choice !== 'latest' && files.find((f) => f.name === choice)?.name) || files[0]?.name || null;
      const order = (name) => {
        const i = files.findIndex((f) => f.name === name);
        return i < 0 ? Infinity : i;
      };
      const dataset =
        datasets.find((d) => d.file === wanted) ||
        datasets.filter((d) => d.year === year).sort((a, b) => order(a.file) - order(b.file))[0];
      if (!dataset) return null;
      return { year, ds: dataset.id, file: dataset.file, dataset, choice, pending: dataset.file !== wanted ? wanted : null };
    })
    .filter(Boolean);
}

export function getDatasets() {
  return getKpiDb()?.prepare('SELECT * FROM datasets').all() ?? [];
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
         FROM kpi_hosp WHERE ${inReport()} GROUP BY type_code ORDER BY type_code`
    )
    .all();
}

// ตัวเลือกเขต / จังหวัด / อำเภอ สำหรับฟอร์ม
export function getAreaOptions() {
  const db = getKpiDb();
  const zones = db
    .prepare(`SELECT DISTINCT health_zone code FROM kpi_hosp WHERE ${inReport()} ORDER BY health_zone`)
    .all()
    .map((z) => ({ code: z.code, name: `เขตสุขภาพที่ ${Number(z.code)}` }));
  const provinces = db
    .prepare(
      `SELECT province_code code, MAX(province) name, MAX(health_zone) zone
         FROM kpi_hosp WHERE province_code IS NOT NULL AND ${inReport()} GROUP BY province_code`
    )
    .all()
    .sort((a, b) => thSort(a.name, b.name));
  const districts = db
    .prepare(
      `SELECT district_code code, MAX(district) name, MAX(province_code) province
         FROM kpi_hosp WHERE district_code IS NOT NULL AND ${inReport()} GROUP BY district_code`
    )
    .all()
    .sort((a, b) => thSort(a.name, b.name));
  return { zones, provinces, districts };
}

function scopeWhere({ view, zone, province, district, hosp, type }, alias = '') {
  const p = alias ? `${alias}.` : '';
  const where = [inReport(p)];
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
  return { sql: where.join(' AND '), params };
}

// เงื่อนไข dataset ที่เลือก: ds IN (@d0, @d1)
function dsWhere(sets, col) {
  const params = {};
  sets.forEach((s, i) => (params[`d${i}`] = s.ds));
  return { sql: `${col} IN (${sets.map((_, i) => `@d${i}`).join(', ')})`, params };
}

// รวมผลหลาย dataset ให้เป็นแถวเดียวต่อ key: { key, ..., byYear: { 2569: {...}, 2570: {...} } }
function mergeByYear(rows, keyOf, sets) {
  const yearOf = Object.fromEntries(sets.map((s) => [s.ds, s.year]));
  const order = sets.map((s) => s.ds);
  const map = new Map();
  for (const r of [...rows].sort((a, b) => order.indexOf(a.ds) - order.indexOf(b.ds))) {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, { ...r, byYear: {} });
    const m = map.get(k);
    m.byYear[yearOf[r.ds]] = r;
    // ใช้ชื่อจากปีล่าสุดที่มี
    for (const f of ['name', 'full_name', 'type_name', 'didstd', 'drug_name', 'source_code', 'ttmtid']) if (r[f]) m[f] = r[f];
  }
  return [...map.values()];
}

// ผลรวมรายปีของแถวทั้งหมด (ใช้ทำแถวรวมท้ายตาราง)
export function sumByYear(items, fields) {
  const out = {};
  for (const it of items) {
    for (const [y, v] of Object.entries(it.byYear)) {
      out[y] ??= Object.fromEntries(fields.map((f) => [f, 0]));
      for (const f of fields) out[y][f] += Number(v[f] || 0);
    }
  }
  return out;
}

// ชื่อพื้นที่ที่เลือก (ใช้แสดงหัวข้อ) — null = ไม่พบในข้อมูล
function describeArea(db, q) {
  if (q.view === 'country') return { title: 'ประเทศไทย', subtitle: 'ทุกเขตสุขภาพ' };
  if (q.view === 'zone') {
    const r = db.prepare(`SELECT 1 FROM kpi_hosp WHERE health_zone = ? AND ${inReport()} LIMIT 1`).get(String(q.zone));
    return r ? { title: `เขตสุขภาพที่ ${Number(q.zone)}`, subtitle: null } : null;
  }
  if (q.view === 'province') {
    const r = db
      .prepare(`SELECT MAX(province) province, MAX(health_zone) zone FROM kpi_hosp WHERE province_code = ? AND ${inReport()}`)
      .get(String(q.province));
    return r?.province
      ? { title: `จังหวัด${r.province}`, subtitle: `เขตสุขภาพที่ ${Number(r.zone)}`, zone: r.zone }
      : null;
  }
  if (q.view === 'district') {
    const r = db
      .prepare(
        `SELECT MAX(district) district, MAX(province) province, MAX(province_code) province_code,
                MAX(health_zone) zone FROM kpi_hosp WHERE district_code = ? AND ${inReport()}`
      )
      .get(String(q.district));
    return r?.district
      ? { title: `อำเภอ${r.district}`, subtitle: `จังหวัด${r.province} · เขตสุขภาพที่ ${Number(r.zone)}`, ...r }
      : null;
  }
  const h = db
    .prepare(`SELECT * FROM kpi_hosp WHERE hospcode = ? AND ${inReport()} ORDER BY ds DESC LIMIT 1`)
    .get(String(q.hosp));
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

// ชื่อแถวย่อย (เขต / จังหวัด / อำเภอ / หน่วยบริการ)
const childLabel = (q, c) =>
  q.view === 'country' ? `เขตสุขภาพที่ ${Number(c.key)}` : c.name || (q.view === 'district' ? c.key : 'ไม่ระบุ');

/**
 * รายงานเปรียบเทียบ
 * q = { view, zone, province, district, hosp, type }, sets = resolveSets(...) [ปีฐาน, ปีเปรียบเทียบ]
 */
export function getCompareReport(q, sets) {
  const db = getKpiDb();
  const area = describeArea(db, q);
  if (!area) return null;

  const scope = scopeWhere(q);
  const dsw = dsWhere(sets, 'ds');
  const params = { ...scope.params, ...dsw.params };
  const where = `${scope.sql} AND ${dsw.sql}`;
  const yearOf = Object.fromEntries(sets.map((s) => [s.ds, s.year]));

  const totals = {};
  for (const r of db.prepare(`SELECT ds, ${SUMS} FROM kpi_hosp WHERE ${where} GROUP BY ds`).all(params)) {
    totals[yearOf[r.ds]] = r;
  }

  const V = VIEWS[q.view];
  let children;
  if (V.child) {
    const rows = db
      .prepare(
        `SELECT ds, ${V.key} key, MAX(${V.name}) name, ${SUMS}
                ${q.view === 'district' ? ', MAX(type_name) type_name' : ''}
           FROM kpi_hosp WHERE ${where}
          GROUP BY ds, ${V.key}`
      )
      .all(params);
    children = mergeByYear(rows, (r) => r.key ?? '', sets).map((c) => ({ ...c, label: childLabel(q, c) }));
  } else {
    children = getHospDrugs(q.hosp, sets);
  }

  return {
    area,
    totals,
    children,
    topGroups: V.child ? getTopDrugGroups(q, sets) : [],
    notFound24: V.child ? getNotFound24(q, sets) : withTotals(children.filter((d) => !d.in24), null),
  };
}

// เติมข้อมูลจากไฟล์รหัส 24 หลัก (ชื่อยา, รหัสที่มาของยา) — d = dtam24
const DTAM_COLS = `d.code24 IS NOT NULL in24, d.drug_name, d.source_code, d.ttmtid`;

// รายการยาของหน่วยบริการ แยกตามรหัส 24 หลัก เทียบรายปี
function getHospDrugs(hospcode, sets) {
  const dsw = dsWhere(sets, 's.ds');
  const rows = getKpiDb()
    .prepare(
      `SELECT s.ds, COALESCE(s.did_clean, '') code24, MAX(s.didstd) didstd, s.code11, m.full_name, s.price, ${DTAM_COLS},
              COUNT(*) items, SUM(s.vs_uc) vs_uc, SUM(s.kpi_value) kpi_value
         FROM sttm4 s
         LEFT JOIN herbal_drug_master_11 m ON m.code11 = s.code11
         LEFT JOIN dtam24 d ON d.code24 = s.did_clean
        WHERE s.hospcode = @hosp AND ${dsw.sql}
        GROUP BY s.ds, s.did_clean`
    )
    .all({ hosp: String(hospcode), ...dsw.params });
  return mergeByYear(rows, (r) => r.code24, sets);
}

// แนบผลรวมของทุกแถว (ก่อนตัดให้เหลือ limit แถว)
function withTotals(all, limit) {
  const shown = limit ? all.slice(0, limit) : all;
  return Object.assign(shown, { total: all.length, sums: sumByYear(all, ['vs_uc', 'kpi_value']) });
}

// รหัส 24 หลักที่ไม่พบในไฟล์รหัสยาของกรมการแพทย์แผนไทยฯ ในพื้นที่ที่เลือก
// limit = null → ทั้งหมด (ใช้ตอนดาวน์โหลด Excel)
export function getNotFound24(q, sets, limit = 300) {
  const scope = scopeWhere(q, 'h');
  const dsw = dsWhere(sets, 's.ds');
  const rows = getKpiDb()
    .prepare(
      `SELECT s.ds, COALESCE(s.did_clean, '') code24, MAX(s.didstd) didstd, s.code11, m.full_name, s.price,
              COUNT(DISTINCT s.hospcode) hosp_count, SUM(s.vs_uc) vs_uc, SUM(s.kpi_value) kpi_value
         FROM sttm4 s
         JOIN kpi_hosp h ON h.ds = s.ds AND h.hospcode = s.hospcode
         LEFT JOIN dtam24 d ON d.code24 = s.did_clean
         LEFT JOIN herbal_drug_master_11 m ON m.code11 = s.code11
        WHERE d.code24 IS NULL AND ${scope.sql} AND ${dsw.sql}
        GROUP BY s.ds, s.did_clean`
    )
    .all({ ...scope.params, ...dsw.params });
  const last = sets[sets.length - 1]?.year;
  const all = mergeByYear(rows, (r) => r.code24, sets).sort(
    (a, b) => (b.byYear[last]?.vs_uc || 0) - (a.byYear[last]?.vs_uc || 0) || a.code24.localeCompare(b.code24)
  );
  return withTotals(all, limit);
}

// กลุ่มยาที่มีมูลค่าสูงสุดในพื้นที่ที่เลือก (เรียงตามปีล่าสุด)
function getTopDrugGroups(q, sets) {
  const scope = scopeWhere(q, 'h');
  const dsw = dsWhere(sets, 's.ds');
  const rows = getKpiDb()
    .prepare(
      `SELECT s.ds, s.code11, m.full_name, s.price, SUM(s.vs_uc) vs_uc, SUM(s.kpi_value) kpi_value
         FROM sttm4 s
         JOIN kpi_hosp h ON h.ds = s.ds AND h.hospcode = s.hospcode
         JOIN herbal_drug_master_11 m ON m.code11 = s.code11
        WHERE ${scope.sql} AND ${dsw.sql}
        GROUP BY s.ds, s.code11`
    )
    .all({ ...scope.params, ...dsw.params });
  return mergeByYear(rows, (r) => r.code11, sets);
}

// อัตรารหัสยาที่ผิดพลาด = รหัสที่ส่งมา (หลังล้าง) ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก — รวมรหัสว่าง/ไม่ครบหลัก
// นับ 3 แบบ: รายการ (หน่วยบริการ × รหัสยา), รหัสยาไม่ซ้ำ, ครั้งที่จ่ายยา UC
// → { totals: { <ปี>: { rows, bad_rows, codes, bad_codes, vs_uc, bad_vs_uc } }, children: [{ key, byYear }] }
export function getCodeErrors(q, sets) {
  const db = getKpiDb();
  const scope = scopeWhere(q, 'h');
  const dsw = dsWhere(sets, 's.ds');
  const params = { ...scope.params, ...dsw.params };
  const from = `FROM sttm4 s
         JOIN kpi_hosp h ON h.ds = s.ds AND h.hospcode = s.hospcode
         LEFT JOIN dtam24 d ON d.code24 = s.did_clean
        WHERE ${scope.sql} AND ${dsw.sql}`;
  const yearOf = Object.fromEntries(sets.map((s) => [s.ds, s.year]));

  const totals = {};
  for (const r of db
    .prepare(
      `SELECT s.ds, COUNT(*) rows, SUM(d.code24 IS NULL) bad_rows,
              COUNT(DISTINCT COALESCE(s.did_clean, '')) codes,
              COUNT(DISTINCT CASE WHEN d.code24 IS NULL THEN COALESCE(s.did_clean, '') END) bad_codes,
              SUM(s.vs_uc) vs_uc, SUM(CASE WHEN d.code24 IS NULL THEN s.vs_uc ELSE 0 END) bad_vs_uc
         ${from} GROUP BY s.ds`
    )
    .all(params)) {
    totals[yearOf[r.ds]] = r;
  }

  const V = VIEWS[q.view];
  const children = V.child
    ? mergeByYear(
        db
          .prepare(
            `SELECT s.ds, h.${V.key} key, MAX(h.${V.name}) name, COUNT(*) rows, SUM(d.code24 IS NULL) bad_rows
               ${from} GROUP BY s.ds, h.${V.key}`
          )
          .all(params),
        (r) => r.key ?? '',
        sets
      ).map((c) => ({ ...c, label: childLabel(q, c) }))
    : [];
  return { totals, children };
}

// ร้อยละ (null = ตัวหารเป็น 0)
export const rate = (part, whole) => (Number(whole) ? (Number(part || 0) / Number(whole)) * 100 : null);
