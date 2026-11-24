// ค่าเป้าหมายมูลค่ายาสมุนไพรของเขตสุขภาพ / จังหวัด / อำเภอ / หน่วยบริการ (รอบ 3 / 6 / 12 เดือน ของปีงบประมาณ) — เก็บใน data/auth.db ตาราง area_targets
// ผู้ใช้ ThaiD กรอกคำขอ → ผู้ดูแลอนุมัติ / ไม่อนุมัติที่หน้า /admin → ค่าที่อนุมัติล่าสุดของแต่ละพื้นที่ใช้คำนวณ % ในหน้า /kpi
import { getAuthDb } from './auth-db';
import { getKpiDb } from './db';
import { EXCLUDED_ZONES, availableYears } from './kpi';

// ปีงบประมาณที่กำหนดค่าเป้าหมาย = ปีล่าสุดที่มีข้อมูล (ตอนนี้ 2570)
export const targetYear = () => Math.max(...availableYears(), 0) || null;

export const TARGET_STATUS = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติ',
  rejected: 'ไม่อนุมัติ',
  replaced: 'ถูกแทนด้วยค่าใหม่',
};

// รอบของเป้าหมาย: นับเดือนจาก 1 ต.ค. (3 เดือน = ถึง 31 ธ.ค., 6 เดือน = ถึง 31 มี.ค., 12 เดือน = ถึง 30 ก.ย.)
export const TARGET_PERIODS = [
  { key: 'target_3m', months: 3, label: '3 เดือน', until: '31 ธ.ค.' },
  { key: 'target_6m', months: 6, label: '6 เดือน', until: '31 มี.ค.' },
  { key: 'target_12m', months: 12, label: '12 เดือน', until: '30 ก.ย.' },
];

// รอบที่กำลังนับอยู่ตามจำนวนวันที่ผ่านไปของปีงบประมาณ (ต.ค.–ธ.ค. = 92 วัน, ต.ค.–มี.ค. = 182 วัน)
export const currentPeriod = (days) => (days <= 92 ? 'target_3m' : days <= 182 ? 'target_6m' : 'target_12m');

// ระดับของค่าเป้าหมาย — แต่ละเขต / จังหวัด / อำเภอ / หน่วยบริการ มีค่าเป้าหมายของตัวเอง (ไม่ได้รวมจากระดับล่าง)
export const TARGET_LEVELS = {
  zone: { label: 'เขตสุขภาพ', col: 'health_zone' },
  province: { label: 'จังหวัด', col: 'province_code' },
  district: { label: 'อำเภอ', col: 'district_code' },
  hosp: { label: 'หน่วยบริการ', col: 'hospcode' },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS area_targets (
  id           INTEGER PRIMARY KEY,
  year         INTEGER NOT NULL,
  level        TEXT NOT NULL DEFAULT 'hosp' CHECK (level IN ('zone', 'province', 'district', 'hosp')),
  code         TEXT NOT NULL,
  area_name    TEXT,
  target_3m    REAL NOT NULL,
  target_6m    REAL NOT NULL,
  target_12m   REAL NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'replaced')),
  submitted_by INTEGER NOT NULL REFERENCES users(id),
  submitted_at TEXT NOT NULL,
  reviewed_by  INTEGER REFERENCES users(id),
  reviewed_at  TEXT
);
CREATE INDEX IF NOT EXISTS area_targets_code ON area_targets(year, level, code, status);
`;

// รุ่นแรก (23 พ.ย. 2569) มีเฉพาะหน่วยบริการ: ตาราง hosp_targets (hospcode, hosp_name) → ย้ายเข้า area_targets เป็น level = hosp
function migrate(d) {
  if (!d.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'hosp_targets'`).get()) return;
  d.transaction(() => {
    d.exec(SCHEMA);
    d.exec(`INSERT INTO area_targets (id, year, level, code, area_name, target_3m, target_6m, target_12m,
              status, submitted_by, submitted_at, reviewed_by, reviewed_at)
            SELECT id, year, 'hosp', hospcode, hosp_name, target_3m, target_6m, target_12m,
              status, submitted_by, submitted_at, reviewed_by, reviewed_at FROM hosp_targets;
            DROP TABLE hosp_targets;`);
  })();
}

// รุ่นที่ 2 (24 พ.ย. 2569) ยังไม่มีระดับอำเภอ — CHECK ของ SQLite แก้ไม่ได้ จึงสร้างตารางใหม่แล้วย้ายข้อมูล
function addDistrictLevel(d) {
  const t = d.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'area_targets'`).get();
  if (!t || t.sql.includes("'district'")) return;
  d.transaction(() => {
    d.exec(`ALTER TABLE area_targets RENAME TO area_targets_old; DROP INDEX IF EXISTS area_targets_code;`);
    d.exec(SCHEMA);
    d.exec(`INSERT INTO area_targets SELECT * FROM area_targets_old; DROP TABLE area_targets_old;`);
  })();
}

function db() {
  const d = getAuthDb();
  if (!globalThis.__targetsReady) {
    migrate(d);
    addDistrictLevel(d);
    d.exec(SCHEMA);
    globalThis.__targetsReady = true;
  }
  return d;
}

const SELECT = `SELECT t.*, s.name submitted_name, r.name reviewed_name
  FROM area_targets t JOIN users s ON s.id = t.submitted_by LEFT JOIN users r ON r.id = t.reviewed_by`;

// ชื่อพื้นที่จากรหัส — null = ไม่พบ (ไม่รับเขตสุขภาพที่ 13 และพื้นที่ที่ไม่ได้นับในรายงาน)
export function findArea(level, code) {
  const k = getKpiDb();
  if (!k) return null;
  const excluded = EXCLUDED_ZONES.includes(code);
  if (level === 'zone') {
    const z = !excluded && k.prepare('SELECT 1 FROM kpi_hosp WHERE health_zone = ? LIMIT 1').get(code);
    return z ? `เขตสุขภาพที่ ${Number(code)}` : null;
  }
  if (level === 'province') {
    const p = k.prepare('SELECT MAX(province) name, MAX(health_zone) zone FROM kpi_hosp WHERE province_code = ?').get(code);
    return p?.name && !EXCLUDED_ZONES.includes(p.zone) ? `จังหวัด${p.name}` : null;
  }
  if (level === 'district') {
    const a = k
      .prepare('SELECT MAX(district) name, MAX(province) province, MAX(health_zone) zone FROM kpi_hosp WHERE district_code = ?')
      .get(code);
    return a?.name && !EXCLUDED_ZONES.includes(a.zone) ? `อำเภอ${a.name} จ.${a.province}` : null;
  }
  const o = k.prepare('SELECT name FROM health_office WHERE code5 = ?').get(code);
  if (o) return o.name || `หน่วยบริการ ${code}`;
  const h = k.prepare('SELECT name FROM kpi_hosp WHERE hospcode = ? ORDER BY ds DESC LIMIT 1').get(code);
  return h ? h.name || `หน่วยบริการ ${code}` : null;
}

const CODE_RULE = {
  zone: [/^\d{1,2}$/, 'กรุณาเลือกเขตสุขภาพ'],
  province: [/^\d{2}$/, 'กรุณาเลือกจังหวัด'],
  district: [/^\d{4}$/, 'กรุณาเลือกอำเภอ'],
  hosp: [/^\d{5}$/, 'รหัสหน่วยบริการต้องเป็นตัวเลข 5 หลัก'],
};

// ตรวจค่าที่กรอก → { value } หรือ { error }
export function parseTargetForm(formData) {
  const level = String(formData.get('level') || 'hosp');
  if (!TARGET_LEVELS[level]) return { error: 'ไม่รู้จักระดับของค่าเป้าหมาย' };
  let code = String(formData.get('code') || '').trim();
  const [re, msg] = CODE_RULE[level];
  if (!re.test(code)) return { error: msg };
  if (level === 'zone') code = code.padStart(2, '0');
  const areaName = findArea(level, code);
  if (!areaName) return { error: `ไม่พบ${TARGET_LEVELS[level].label}รหัส ${code}` };
  const value = { level, code, areaName };
  for (const p of TARGET_PERIODS) {
    const raw = String(formData.get(p.key) || '').replace(/,/g, '').trim();
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0) return { error: `กรุณากรอกเป้าหมาย ${p.label} เป็นตัวเลขตั้งแต่ 0 ขึ้นไป` };
    if (n > 1e12) return { error: `เป้าหมาย ${p.label} มากเกินไป` };
    value[p.key] = Math.round(n * 100) / 100;
  }
  // เป้าหมายเป็นยอดสะสมตั้งแต่ 1 ต.ค. → รอบหลังต้องไม่น้อยกว่ารอบก่อน
  if (value.target_3m > value.target_6m || value.target_6m > value.target_12m)
    return { error: 'เป้าหมายเป็นยอดสะสม: 3 เดือน ≤ 6 เดือน ≤ 12 เดือน' };
  return { value };
}

export function submitTarget({ year, level, code, areaName, target_3m, target_6m, target_12m, userId }) {
  return db()
    .prepare(
      `INSERT INTO area_targets (year, level, code, area_name, target_3m, target_6m, target_12m, submitted_by, submitted_at)
       VALUES (@year, @level, @code, @areaName, @target_3m, @target_6m, @target_12m, @userId, @now)`
    )
    .run({ year, level, code, areaName, target_3m, target_6m, target_12m, userId, now: new Date().toISOString() })
    .lastInsertRowid;
}

// อนุมัติ = ค่านี้ใช้แทนค่าที่เคยอนุมัติของพื้นที่เดียวกัน (ระดับ + รหัส) ในปีเดียวกัน · ทำได้เฉพาะคำขอที่รออนุมัติ
export function reviewTarget(id, approve, userId) {
  const d = db();
  const now = new Date().toISOString();
  return d.transaction(() => {
    const t = d.prepare(`SELECT * FROM area_targets WHERE id = ? AND status = 'pending'`).get(id);
    if (!t) return false;
    if (approve)
      d.prepare(
        `UPDATE area_targets SET status = 'replaced' WHERE year = ? AND level = ? AND code = ? AND status = 'approved'`
      ).run(t.year, t.level, t.code);
    d.prepare('UPDATE area_targets SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
      approve ? 'approved' : 'rejected',
      userId,
      now,
      id
    );
    return true;
  })();
}

export const listPendingTargets = () => db().prepare(`${SELECT} WHERE t.status = 'pending' ORDER BY t.submitted_at`).all();

export const listReviewedTargets = (limit = 100) =>
  db().prepare(`${SELECT} WHERE t.status != 'pending' ORDER BY t.reviewed_at DESC LIMIT ?`).all(limit);

export const listMyTargets = (userId, limit = 100) =>
  db().prepare(`${SELECT} WHERE t.submitted_by = ? ORDER BY t.submitted_at DESC LIMIT ?`).all(userId, limit);

// ค่าเป้าหมายที่อนุมัติแล้วของปีนั้น (1 แถวต่อพื้นที่) — level ไม่ระบุ = ทุกระดับ
export const approvedTargets = (year, level = null) =>
  db()
    .prepare(`${SELECT} WHERE t.year = @year AND t.status = 'approved' AND (@level IS NULL OR t.level = @level) ORDER BY t.level, t.code`)
    .all({ year, level });
