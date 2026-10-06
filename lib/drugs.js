// ฟังก์ชันค้นหาข้อมูลยา — ใช้ร่วมกันทั้งหน้าเว็บ, REST API และ AI chatbot
import { getDb } from './db';

export const DRUG_TYPES = ['เดี่ยว', 'ตำรับ'];
export const PAGE_SIZE = 25;
export const REIMBURSE_UNITS = ['บาท', 'point'];

// คอลัมน์ที่แสดงในตารางผลค้นหา
const LIST_COLUMNS = `id, code24, ttmtid, drug_type, drug_name, trade_name, strength, dosage_form,
  manufacturer, pack_size, in_master, has_drug_group, drug_group, reimburse_amount, reimburse_unit`;

function buildWhere({ q, type, group, unit, name, mfr } = {}) {
  const where = [];
  const params = {};

  const text = (q || '').trim();
  if (text) {
    // รหัสตัวเลขล้วน → ค้นตรงตัวในรหัส 24 หลัก / TTMTID / เลขทะเบียน
    if (/^\d+$/.test(text)) {
      where.push('(code24 LIKE @prefix OR ttmtid = @exact OR registration_no LIKE @like)');
      params.prefix = `${text}%`;
      params.exact = text;
    } else {
      where.push(`(drug_name LIKE @like OR trade_name LIKE @like OR manufacturer LIKE @like
        OR drug_group LIKE @like OR registration_no LIKE @like OR work_code LIKE @like
        OR dosage_form LIKE @like OR master_active_ingredient LIKE @like)`);
    }
    params.like = `%${text}%`;
  }

  if (DRUG_TYPES.includes(type)) {
    where.push('drug_type = @type');
    params.type = type;
  }

  if (group === 'has') where.push('has_drug_group = 1');
  else if (group === 'none') where.push('has_drug_group = 0');
  else if (group) {
    where.push('drug_group = @group');
    params.group = group;
  }

  if (REIMBURSE_UNITS.includes(unit)) {
    where.push('reimburse_unit = @unit');
    params.unit = unit;
  }

  if (name) {
    where.push('drug_name = @name');
    params.name = name;
  }

  if (mfr) {
    where.push('manufacturer = @mfr');
    params.mfr = mfr;
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function searchDrugs({ page = 1, pageSize = PAGE_SIZE, ...filters } = {}) {
  const db = getDb();
  const { sql, params } = buildWhere(filters);
  const size = Math.min(Math.max(Number(pageSize) || PAGE_SIZE, 1), 200);
  const current = Math.max(Number(page) || 1, 1);

  const total = db.prepare(`SELECT COUNT(*) n FROM drug_lookup ${sql}`).get(params).n;
  const rows = db
    .prepare(
      `SELECT ${LIST_COLUMNS} FROM drug_lookup ${sql}
       ORDER BY drug_name, manufacturer, id LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: size, offset: (current - 1) * size });

  return { total, page: current, pageSize: size, totalPages: Math.ceil(total / size), rows };
}

// ใช้ export CSV — ดึงทุกแถวที่ตรงเงื่อนไข
export function* iterateDrugs(filters = {}) {
  const { sql, params } = buildWhere(filters);
  yield* getDb()
    .prepare(`SELECT * FROM drug_lookup ${sql} ORDER BY drug_name, manufacturer, id`)
    .iterate(params);
}

// ตัวเลือกใน dropdown ชื่อยา / ผู้ผลิต — กรองตามเงื่อนไขอื่นที่เลือกอยู่ (เช่น เลือกผู้ผลิตแล้ว เหลือเฉพาะชื่อยาของผู้ผลิตนั้น)
// ค่าที่เลือกอยู่ใส่ไว้เสมอ แม้จะไม่อยู่ในผลกรอง จะได้ไม่หายไปจาก dropdown
export function listFilterOptions(filters = {}) {
  const db = getDb();
  const distinct = (col, key) => {
    const { sql, params } = buildWhere({ ...filters, [key]: '' });
    const notNull = `${col} IS NOT NULL AND ${col} <> ''`;
    const values = db
      .prepare(
        `SELECT DISTINCT ${col} v FROM drug_lookup ${sql ? `${sql} AND ${notNull}` : `WHERE ${notNull}`} ORDER BY ${col}`
      )
      .pluck()
      .all(params);
    const current = filters[key];
    return current && !values.includes(current) ? [current, ...values] : values;
  };
  return { names: distinct('drug_name', 'name'), manufacturers: distinct('manufacturer', 'mfr') };
}

export function getDrug(id) {
  return getDb().prepare('SELECT * FROM drug_lookup WHERE id = ?').get(Number(id)) || null;
}

export function getDrugsByCode24(code24) {
  return getDb().prepare('SELECT * FROM drug_lookup WHERE code24 = ? ORDER BY id').all(String(code24));
}

export function getDrugsByTtmtid(ttmtid) {
  return getDb().prepare('SELECT * FROM drug_lookup WHERE ttmtid = ? ORDER BY id').all(String(ttmtid));
}

// รหัส 24 หลักเดียวกัน แต่คนละแถว (เช่น ขนาดบรรจุต่างกัน)
export function getSiblings(drug) {
  return getDb()
    .prepare(`SELECT ${LIST_COLUMNS} FROM drug_lookup WHERE code24 = ? AND id <> ? ORDER BY id`)
    .all(drug.code24, drug.id);
}

export function listDrugGroups() {
  return getDb()
    .prepare(
      `SELECT drug_group,
              COUNT(*) total,
              SUM(drug_type = 'เดี่ยว') single,
              SUM(drug_type = 'ตำรับ') recipe,
              GROUP_CONCAT(DISTINCT master_active_ingredient) ingredients,
              MAX(reimburse_amount) reimburse_amount,
              MAX(reimburse_unit) reimburse_unit
         FROM drug_lookup
        WHERE has_drug_group = 1
        GROUP BY drug_group
        ORDER BY drug_group`
    )
    .all()
    .map((g) => ({ ...g, ingredients: g.ingredients ? g.ingredients.split(',').slice(0, 5) : [] }));
}

export function getStats() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT COUNT(*) total,
              SUM(in_master) in_master,
              SUM(has_drug_group) with_group,
              COUNT(DISTINCT drug_group) groups,
              COUNT(DISTINCT manufacturer) manufacturers
         FROM drug_lookup`
    )
    .get();
  const byType = db
    .prepare(
      `SELECT drug_type, COUNT(*) total, SUM(has_drug_group) with_group
         FROM drug_lookup GROUP BY drug_type ORDER BY drug_type DESC`
    )
    .all();
  const byUnit = db
    .prepare(
      `SELECT reimburse_unit unit, COUNT(*) total, COUNT(DISTINCT drug_group) groups
         FROM drug_lookup WHERE reimburse_unit IS NOT NULL GROUP BY reimburse_unit ORDER BY reimburse_unit DESC`
    )
    .all();
  return { ...totals, without_group: totals.total - totals.with_group, byType, byUnit, meta: getMeta() };
}

export function getMeta() {
  return Object.fromEntries(getDb().prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]));
}

// สรุปตามคอลัมน์ (รูปแบบยา / ผู้ผลิต) พร้อมจำนวนที่มี Drug Group
export function getBreakdown(column, limit = 15) {
  const allowed = { dosage_form: 'dosage_form', manufacturer: 'manufacturer' };
  const col = allowed[column];
  if (!col) throw new Error(`ไม่รองรับคอลัมน์ ${column}`);
  return getDb()
    .prepare(
      `SELECT ${col} label, COUNT(*) total, SUM(has_drug_group) with_group
         FROM drug_lookup WHERE ${col} IS NOT NULL
        GROUP BY ${col} ORDER BY total DESC LIMIT ?`
    )
    .all(limit);
}
