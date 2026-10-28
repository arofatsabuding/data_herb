// ตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" — เปรียบเทียบระหว่างปีงบประมาณ
// รูปแบบการแสดงผล: ภาพรวมประเทศ / เขตสุขภาพ / จังหวัด / อำเภอ / หน่วยบริการ
// แต่ละปีใช้ไฟล์ (dataset) ตามที่ผู้ใช้แต่ละคนเลือก (เก็บใน cookie ของเบราว์เซอร์)
import kpiLib from '@/scripts/kpi-lib';
import { getDb, getKpiDb } from './db';

export const KPI_NAME = 'มูลค่ายาสมุนไพรในสิทธิ UC';
export const DEFAULT_HOSPCODE = '11442';
export const NOT_IN_GROUP = 'ไม่พบรายการยาหรือรายการยาถูกยกเลิกรหัส';
export const PREF_COOKIE = 'kpi_files';
// ปีที่ผู้ใช้เลือกเทียบ (cookie) เช่น [2568, 2570] — ไม่ได้เลือก = COMPARE_YEARS ปีล่าสุด
export const YEARS_COOKIE = 'kpi_years';
// จำนวนปีงบประมาณล่าสุดที่เทียบกันเมื่อผู้ใช้ยังไม่ได้เลือกปีเอง (KPI_COMPARE_YEARS ใน .env)
export const COMPARE_YEARS = Math.max(Number(process.env.KPI_COMPARE_YEARS) || 2, 1);

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

// ค่าใน cookie / query: "2568,2570" หรือ [2568, 2570] → [2568, 2570] (เรียง ไม่ซ้ำ)
export function parseYears(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(',');
  return [...new Set(list.map((y) => Number(String(y).trim())).filter((y) => Number.isInteger(y) && y > 2500))].sort(
    (a, b) => a - b
  );
}

// ปีที่มีข้อมูล (โฟลเดอร์ opendata-<ปี> หรือ dataset ในฐานข้อมูล) เรียงจากน้อยไปมาก
export function availableYears() {
  const datasets = getDatasets();
  return [...new Set([...kpiLib.listYears(), ...datasets.map((d) => d.year)])].sort((a, b) => a - b);
}

// ปีที่จะเทียบจริง: ปีที่เลือก (ที่มีข้อมูล) ถ้าเลือกไว้ไม่ถึง 2 ปี ใช้ COMPARE_YEARS ปีล่าสุด
export function compareYears(chosen = []) {
  const all = availableYears();
  const picked = parseYears(chosen).filter((y) => all.includes(y));
  return picked.length >= 2 ? picked : all.slice(-COMPARE_YEARS);
}

/**
 * ไฟล์ของปีที่จะเทียบ (compareYears) ตามที่ผู้ใช้เลือก (เรียงจากปีเก่าไปใหม่)
 * → [{ year, ds, file, dataset, choice, pending }]  (pending = ไฟล์ที่เลือกแต่ยังไม่ได้นำเข้า)
 * ไฟล์ที่เลือกยังไม่พร้อม → ใช้ไฟล์ล่าสุดที่มีในฐานข้อมูลไปก่อน
 */
export function resolveSets(prefs = {}, chosenYears = []) {
  const db = getKpiDb();
  if (!db) return [];
  const datasets = db.prepare('SELECT * FROM datasets').all();
  const years = compareYears(chosenYears);
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

// ไฟล์และปีตามที่ผู้ใช้คนนี้เลือกไว้ (store = await cookies())
export function setsFromCookies(store) {
  return resolveSets(parsePrefs(store.get(PREF_COOKIE)?.value), parseYears(store.get(YEARS_COOKIE)?.value));
}

// คู่ปีที่ติดกันสำหรับคอลัมน์ "เปลี่ยนแปลง" เช่น [2568, 2569, 2570] → [[2568, 2569], [2569, 2570]]
export const yearPairs = (years) => years.slice(1).map((y, i) => [years[i], y]);

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

// ชื่อพื้นที่ที่เลือกอย่างเดียว (ไม่คำนวณรายงาน) — null = ไม่พบในข้อมูล
export const getAreaInfo = (q) => describeArea(getKpiDb(), q);

// ชื่อแถวย่อย (เขต / จังหวัด / อำเภอ / หน่วยบริการ)
const childLabel = (q, c) =>
  q.view === 'country' ? `เขตสุขภาพที่ ${Number(c.key)}` : c.name || (q.view === 'district' ? c.key : 'ไม่ระบุ');

/**
 * รายงานเปรียบเทียบ
 * q = { view, zone, province, district, hosp, type }, sets = resolveSets(...) เรียงจากปีเก่าไปใหม่
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

// ---------- วิเคราะห์รหัสยา: ยาที่ใช้มาก × เข้าเกณฑ์ตัวชี้วัด × มี Drug Group ----------

// เข้าเกณฑ์ตัวชี้วัด = 11 หลักแรกพบในกลุ่มยา (herbal_drug_master_11) · มี Drug Group = TTMTID ของรหัสนี้มี Drug_Group_Nhso
export const USAGE_CATS = {
  kpi_nodg: { label: 'เข้าเกณฑ์ตัวชี้วัด แต่ไม่มี Drug Group', short: 'ตัวชี้วัด ✓ · Drug Group ✗', tone: 'amber' },
  dg_nokpi: { label: 'มี Drug Group แต่ไม่เข้าเกณฑ์ตัวชี้วัด', short: 'ตัวชี้วัด ✗ · Drug Group ✓', tone: 'violet' },
  none: { label: 'ไม่เข้าเกณฑ์ตัวชี้วัด และไม่มี Drug Group', short: 'ตัวชี้วัด ✗ · Drug Group ✗', tone: 'rose' },
  ok: { label: 'เข้าเกณฑ์ตัวชี้วัด และมี Drug Group', short: 'ตัวชี้วัด ✓ · Drug Group ✓', tone: 'emerald' },
  not24: { label: 'ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก', short: 'รหัส 24 หลักไม่พบ', tone: 'gray' },
};
// กลุ่มที่ส่วนกลางควรติดตามกับผู้ผลิต (รหัสอยู่ในไฟล์ 24 หลักแล้ว แต่ข้อมูลยังไม่ครบ)
export const FOLLOW_UP_CATS = ['kpi_nodg', 'dg_nokpi', 'none'];

const uniq = (list) => [...new Set(list.filter(Boolean))];

// ข้อมูลจากไฟล์รหัส 24 หลัก + TTMT Master ของรหัสหนึ่ง (รหัสเดียวมีได้หลายแถว — TTMTID ต่างกัน)
function drugInfo(rows) {
  const best = rows.find((r) => r.has_drug_group) || rows.find((r) => r.in_master) || rows[0];
  const dgReason = rows.some((r) => r.has_drug_group)
    ? null
    : !rows.some((r) => r.ttmtid)
      ? 'ยังไม่มี TTMTID'
      : !rows.some((r) => r.in_master)
        ? 'TTMTID ไม่พบใน TTMT Master'
        : 'TTMT Master ยังไม่ระบุ Drug Group';
  return {
    drug_name: best.drug_name,
    trade_name: best.trade_name,
    drug_type: best.drug_type,
    source_code: best.source_code,
    manufacturer: uniq(rows.map((r) => r.manufacturer)).join(' / ') || null,
    registration_no: uniq(rows.map((r) => r.registration_no)).join(', ') || null,
    ttmtids: uniq(rows.map((r) => r.ttmtid)),
    drug_groups: uniq(rows.map((r) => r.drug_group)),
    dg_reason: dgReason,
  };
}

/**
 * รหัสยาทั้งหมดที่จ่ายในพื้นที่ที่เลือก เรียงตามครั้ง UC ปีล่าสุด พร้อมสถานะตัวชี้วัด / Drug Group และผู้ผลิต
 * → { items: [{ code24, cat, kpi, ..., byYear }], cats: { <cat>: { codes, vs_uc, kpi_value } }, curYear }
 */
export function getDrugUsage(q, sets) {
  // ผลเดิมใช้ซ้ำได้จนกว่าไฟล์ข้อมูล (dataset) หรือ herb.db (อัปโหลดไฟล์อ้างอิงใหม่) จะเปลี่ยน — ระดับประเทศใช้เวลา ~2 วินาที
  const herb = getDb();
  const cache = globalThis.__drugUsage?.herb === herb ? globalThis.__drugUsage : (globalThis.__drugUsage = { herb, map: new Map() });
  const key = JSON.stringify([q.view, q.zone, q.province, q.district, q.hosp, q.type, sets.map((s) => s.ds)]);
  if (!cache.map.has(key)) {
    if (cache.map.size >= 20) cache.map.delete(cache.map.keys().next().value);
    cache.map.set(key, buildDrugUsage(q, sets, herb));
  }
  return cache.map.get(key);
}

function buildDrugUsage(q, sets, herb) {
  const scope = scopeWhere(q, 'h');
  const dsw = dsWhere(sets, 's.ds');
  const rows = getKpiDb()
    .prepare(
      `SELECT s.ds, COALESCE(s.did_clean, '') code24, MAX(s.didstd) didstd, s.code11, m.full_name, s.price,
              COUNT(DISTINCT s.hospcode) hosp_count, SUM(s.vs_all) vs_all, SUM(s.vs_uc) vs_uc, SUM(s.kpi_value) kpi_value
         FROM sttm4 s
         JOIN kpi_hosp h ON h.ds = s.ds AND h.hospcode = s.hospcode
         LEFT JOIN herbal_drug_master_11 m ON m.code11 = s.code11
        WHERE ${scope.sql} AND ${dsw.sql}
        GROUP BY s.ds, s.did_clean`
    )
    .all({ ...scope.params, ...dsw.params });

  const lookup = herb.prepare(
    `SELECT drug_type, drug_name, trade_name, source_code, manufacturer, registration_no, ttmtid,
            in_master, has_drug_group, drug_group
       FROM drug_lookup WHERE code24 = ? ORDER BY id`
  );
  const curYear = sets[sets.length - 1]?.year;
  const items = mergeByYear(rows, (r) => r.code24, sets)
    .map((d) => {
      const ref = d.code24.length === 24 ? lookup.all(d.code24) : [];
      const kpi = d.price !== null;
      const info = ref.length ? drugInfo(ref) : null;
      const dg = Boolean(info?.drug_groups.length);
      const cat = !info ? 'not24' : kpi ? (dg ? 'ok' : 'kpi_nodg') : dg ? 'dg_nokpi' : 'none';
      return { ...d, ...info, in24: Boolean(info), kpi, dg, cat };
    })
    .sort(
      (a, b) =>
        (b.byYear[curYear]?.vs_uc || 0) - (a.byYear[curYear]?.vs_uc || 0) ||
        (b.byYear[curYear]?.hosp_count || 0) - (a.byYear[curYear]?.hosp_count || 0) ||
        a.code24.localeCompare(b.code24)
    );

  const cats = Object.fromEntries(Object.keys(USAGE_CATS).map((c) => [c, { codes: 0, vs_uc: 0, kpi_value: 0 }]));
  for (const d of items) {
    const c = cats[d.cat];
    const v = d.byYear[curYear] || {};
    c.codes += 1;
    c.vs_uc += Number(v.vs_uc || 0);
    c.kpi_value += Number(v.kpi_value || 0);
  }
  return { items, cats, curYear };
}

// สรุปรายผู้ผลิต เฉพาะรหัสที่ต้องติดตาม (FOLLOW_UP_CATS) เรียงตามครั้ง UC ปีล่าสุด
export function usageByManufacturer(items, curYear) {
  const map = new Map();
  for (const d of items) {
    if (!FOLLOW_UP_CATS.includes(d.cat)) continue;
    const name = d.manufacturer || 'ไม่ระบุผู้ผลิต';
    if (!map.has(name)) map.set(name, { manufacturer: name, codes: 0, vs_uc: 0, top: [], ...Object.fromEntries(FOLLOW_UP_CATS.map((c) => [c, 0])) });
    const m = map.get(name);
    m.codes += 1;
    m[d.cat] += 1;
    m.vs_uc += Number(d.byYear[curYear]?.vs_uc || 0);
    if (m.top.length < 3) m.top.push(d.drug_name || d.code24);
  }
  return [...map.values()].sort((a, b) => b.vs_uc - a.vs_uc || b.codes - a.codes);
}
