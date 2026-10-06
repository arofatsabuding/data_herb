// ฟังก์ชันนำเข้าข้อมูลตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" ลง data/kpi.db
// ใช้ร่วมกันโดย scripts/import-kpi.js และ scripts/fetch-opendata.js
//
// สูตร: มูลค่าตัวชี้วัด = vs_uc × price (ราคาต่อ course ของกลุ่มยาใน herbal_drug_master_11.xlsx)
// กลุ่มยาหาจากรหัส didstd ที่ล้างให้เหลือแต่ตัวเลข แล้วตัด 11 หลักแรก
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

// เมื่อถูก bundle โดย Next.js __dirname จะไม่ใช่โฟลเดอร์ scripts/ → ใช้โฟลเดอร์ที่รันเซิร์ฟเวอร์แทน
const ROOT = fs.existsSync(path.join(__dirname, '..', 'publicfiles')) ? path.join(__dirname, '..') : process.cwd();
const SRC_DIR = path.join(ROOT, 'publicfiles');
const OPENDATA_DIR = path.join(SRC_DIR, 'opendata-2570');
const KPI_DB_PATH = process.env.KPI_DB_PATH || path.join(ROOT, 'data', 'kpi.db');
const HERB_DB_PATH = path.join(ROOT, 'data', 'herb.db');
const SETTINGS_PATH = path.join(ROOT, 'data', 'kpi-settings.json');
const MANIFEST_PATH = path.join(OPENDATA_DIR, 'manifest.json');
const COMPARE_YEAR = 2570; // ปีที่ดึงจาก API รายวัน
const COMPARE_FILE_RE = /^Data_2570_sttm4_(\d+)_(\d{2})-(\d{2})-(\d{2})\.xlsx$/i;

const DATA_COLUMNS = ['id', 'hospcode', 'areacode', 'flag_sent', 'date_com', 'b_year', 'didstd',
  'vs_all', 'vs_uc', 'am_all', 'am_uc', 'pri_all', 'pri_uc', 'ip'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS health_office_type (
  code TEXT PRIMARY KEY, name TEXT, organization_type TEXT
);
CREATE TABLE IF NOT EXISTS health_office (
  code5 TEXT PRIMARY KEY, name TEXT, hcode9 TEXT, type_code TEXT,
  organization TEXT, active INTEGER,
  subdistrict TEXT, district TEXT, district_code TEXT,
  province TEXT, province_code TEXT, health_zone TEXT, region TEXT
);
CREATE TABLE IF NOT EXISTS herbal_drug_master_11 (
  code11 TEXT PRIMARY KEY, full_name TEXT, short_name TEXT, type TEXT, course REAL, price REAL
);
-- ข้อมูลดิบรายแถว (1 แถว = หน่วยบริการ × รหัสยา)
CREATE TABLE IF NOT EXISTS sttm4 (
  year INTEGER NOT NULL, hospcode TEXT, areacode TEXT, date_com TEXT,
  didstd TEXT, did_clean TEXT, code11 TEXT,
  vs_all REAL, vs_uc REAL, am_all REAL, am_uc REAL, pri_all REAL, pri_uc REAL,
  price REAL,        -- ราคาต่อ course (NULL = ไม่อยู่ในกลุ่มที่คิดตัวชี้วัด)
  kpi_value REAL     -- vs_uc × price
);
CREATE INDEX IF NOT EXISTS idx_sttm4_year_hosp ON sttm4(year, hospcode);
-- สรุประดับหน่วยบริการ (ใช้ทำรายงานระดับ อำเภอ/จังหวัด/เขต/ประเทศ)
CREATE TABLE IF NOT EXISTS kpi_hosp (
  year INTEGER NOT NULL, hospcode TEXT NOT NULL,
  name TEXT, type_code TEXT, type_name TEXT,
  district_code TEXT, district TEXT, province_code TEXT, province TEXT, health_zone TEXT,
  rows INTEGER, matched_rows INTEGER,
  vs_all REAL, vs_uc REAL, matched_vs_uc REAL, pri_uc REAL, kpi_value REAL,
  PRIMARY KEY (year, hospcode)
);
-- รหัสยา 24 หลักจากไฟล์ของกรมการแพทย์แผนไทยฯ (คัดลอกจาก data/herb.db)
CREATE TABLE IF NOT EXISTS dtam24 (
  code24 TEXT PRIMARY KEY, drug_name TEXT, trade_name TEXT, source_code TEXT, ttmtid TEXT, drug_type TEXT
);
CREATE TABLE IF NOT EXISTS kpi_files (
  year INTEGER PRIMARY KEY, file TEXT, rows INTEGER, max_date_com TEXT, imported_at TEXT
);
`;

const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
};
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);

function readSheet(file) {
  const wb = XLSX.readFile(file);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
}

function openKpiDb() {
  fs.mkdirSync(path.dirname(KPI_DB_PATH), { recursive: true });
  const db = new Database(KPI_DB_PATH);
  // WAL: เว็บอ่านได้ระหว่างที่สคริปต์กำลังเขียน (ไม่ต้องปิดเซิร์ฟเวอร์)
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 120000'); // รอได้ถ้ามีอีก process กำลังเขียนอยู่
  db.exec(SCHEMA);
  return db;
}

// ตารางอ้างอิง: หน่วยบริการ, ประเภทหน่วยบริการ, กลุ่มยา 11 หลัก
function importReferences(db) {
  const types = readSheet(path.join(SRC_DIR, 'health_office_type.xlsx'));
  const offices = readSheet(path.join(SRC_DIR, 'health_office.xlsx'));
  const drugs = readSheet(path.join(SRC_DIR, 'herbal_drug_master_11.xlsx'));

  // code5 ซ้ำได้ (หน่วยเก่าที่ยกเลิกแล้ว) → เลือกแถวที่ active ก่อน
  const byCode = new Map();
  for (const o of offices) {
    const code5 = clean(o.code5);
    if (!code5) continue;
    const prev = byCode.get(code5);
    if (!prev || (prev.active !== '1' && o.active === '1')) byCode.set(code5, o);
  }

  db.transaction(() => {
    db.exec('DELETE FROM health_office_type; DELETE FROM health_office; DELETE FROM herbal_drug_master_11;');
    const t = db.prepare('INSERT INTO health_office_type VALUES (?, ?, ?)');
    for (const r of types) t.run(clean(r.code), clean(r.name), clean(r.organization_type));

    const h = db.prepare(`INSERT INTO health_office VALUES
      (@code5, @name, @hcode9, @type_code, @organization, @active,
       @subdistrict, @district, @district_code, @province, @province_code, @health_zone, @region)`);
    for (const [code5, o] of byCode) {
      h.run({
        code5,
        name: clean(o.name),
        hcode9: clean(o.hcode9),
        type_code: clean(o.health_office_type_code)?.padStart(2, '0') ?? null,
        organization: clean(o.organization),
        active: Number(o.active) || 0,
        subdistrict: clean(o.subdistrict),
        district: clean(o.district),
        district_code: clean(o.district_code),
        province: clean(o.province),
        province_code: clean(o.province_code),
        health_zone: clean(o.health_zone),
        region: clean(o.region),
      });
    }

    const d = db.prepare('INSERT INTO herbal_drug_master_11 VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of drugs) {
      const code11 = clean(r.code11);
      if (code11) d.run(code11, clean(r.full_name), clean(r.short_name), clean(r.type), num(r.course), num(r.price));
    }
  })();

  return { types: types.length, offices: byCode.size, drugs: drugs.length, dtam24: importDtam24(db) };
}

// รหัส 24 หลัก + รหัสที่มาของยา จาก data/herb.db (สร้างด้วย npm run import)
// รหัส 24 หลักบางรหัสซ้ำกัน (TTMTID ต่างกัน) → รวมเป็นแถวเดียว
function importDtam24(db) {
  if (!fs.existsSync(HERB_DB_PATH)) {
    console.warn('  ไม่พบ data/herb.db — ข้ามรหัส 24 หลัก (รัน npm run import ก่อน)');
    return 0;
  }
  const herb = new Database(HERB_DB_PATH, { readonly: true, fileMustExist: true });
  const rows = herb
    .prepare(
      `SELECT code24, MIN(drug_name) drug_name, MIN(trade_name) trade_name,
              GROUP_CONCAT(DISTINCT source_code) source_code, GROUP_CONCAT(DISTINCT ttmtid) ttmtid,
              MIN(drug_type) drug_type
         FROM drug_codes WHERE code24 IS NOT NULL GROUP BY code24`
    )
    .all();
  herb.close();
  db.transaction(() => {
    db.exec('DELETE FROM dtam24');
    const ins = db.prepare('INSERT INTO dtam24 VALUES (@code24, @drug_name, @trade_name, @source_code, @ttmtid, @drug_type)');
    for (const r of rows) ins.run(r);
  })();
  return rows.length;
}

// นำเข้าแถวข้อมูล sttm4 ของปีงบประมาณ year (แทนที่ข้อมูลปีนั้นทั้งหมด)
function importYearRows(db, year, rows, fileLabel) {
  const prices = new Map(db.prepare('SELECT code11, price FROM herbal_drug_master_11').all().map((r) => [r.code11, r.price]));
  const insert = db.prepare(`INSERT INTO sttm4 VALUES
    (@year, @hospcode, @areacode, @date_com, @didstd, @did_clean, @code11,
     @vs_all, @vs_uc, @am_all, @am_uc, @pri_all, @pri_uc, @price, @kpi_value)`);

  let maxDate = '';
  db.transaction(() => {
    db.prepare('DELETE FROM sttm4 WHERE year = ?').run(year);
    for (const r of rows) {
      const didstd = clean(r.didstd);
      const didClean = didstd ? didstd.replace(/\D/g, '') : '';
      const code11 = didClean.length >= 11 ? didClean.slice(0, 11) : null;
      const price = code11 && prices.has(code11) ? prices.get(code11) : null;
      const vsUc = num(r.vs_uc);
      const dateCom = clean(r.date_com);
      if (dateCom && dateCom > maxDate) maxDate = dateCom;
      insert.run({
        year,
        hospcode: clean(r.hospcode),
        areacode: clean(r.areacode),
        date_com: dateCom,
        didstd,
        did_clean: didClean || null,
        code11,
        vs_all: num(r.vs_all),
        vs_uc: vsUc,
        am_all: num(r.am_all),
        am_uc: num(r.am_uc),
        pri_all: num(r.pri_all),
        pri_uc: num(r.pri_uc),
        price,
        kpi_value: price === null ? 0 : vsUc * price,
      });
    }

    // สรุประดับหน่วยบริการ
    db.prepare('DELETE FROM kpi_hosp WHERE year = ?').run(year);
    db.prepare(
      `INSERT INTO kpi_hosp
       SELECT s.year, s.hospcode,
              COALESCE(h.name, 'ไม่พบรหัส ' || s.hospcode), h.type_code, t.name,
              h.district_code, h.district, h.province_code, h.province, h.health_zone,
              COUNT(*), SUM(s.price IS NOT NULL),
              SUM(s.vs_all), SUM(s.vs_uc),
              SUM(CASE WHEN s.price IS NOT NULL THEN s.vs_uc ELSE 0 END),
              SUM(s.pri_uc), SUM(s.kpi_value)
         FROM sttm4 s
         LEFT JOIN health_office h ON h.code5 = s.hospcode
         LEFT JOIN health_office_type t ON t.code = h.type_code
        WHERE s.year = ?
        GROUP BY s.hospcode`
    ).run(year);

    db.prepare('INSERT OR REPLACE INTO kpi_files VALUES (?, ?, ?, ?, ?)').run(
      year, fileLabel, rows.length, maxDate || null, new Date().toISOString()
    );
  })();

  return db.prepare(
    'SELECT COUNT(*) hosp, SUM(rows) rows, SUM(matched_rows) matched, SUM(kpi_value) kpi FROM kpi_hosp WHERE year = ?'
  ).get(year);
}

function importYearFile(db, year, file) {
  const rows = readSheet(file);
  return importYearRows(db, year, rows, path.basename(file));
}

// ไฟล์ล่าสุดในโฟลเดอร์ (เรียงตามวันที่แก้ไข)
function latestFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => pattern.test(f) && !f.startsWith('~$'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length ? path.join(dir, files[0].f) : null;
}

// ---------- ตั้งค่า: ปี 2570 ใช้ไฟล์ไหนเปรียบเทียบ ----------
// data/kpi-settings.json  { "compareFile": "latest" | "<ชื่อไฟล์ใน opendata-2570>" }

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readSettings() {
  const s = readJson(SETTINGS_PATH, {});
  return { compareFile: typeof s.compareFile === 'string' && s.compareFile ? s.compareFile : 'latest' };
}

function writeSettings(settings) {
  writeJsonAtomic(SETTINGS_PATH, { ...readSettings(), ...settings, updatedAt: new Date().toISOString() });
}

// ไฟล์รายวันของปี 2570 เรียงจากใหม่ไปเก่า (ตามวันที่ในชื่อไฟล์ แล้วตามเวลาแก้ไข)
function listCompareFiles() {
  if (!fs.existsSync(OPENDATA_DIR)) return [];
  const manifest = readJson(MANIFEST_PATH, {});
  return fs
    .readdirSync(OPENDATA_DIR)
    .map((name) => {
      const m = COMPARE_FILE_RE.exec(name);
      if (!m) return null;
      const st = fs.statSync(path.join(OPENDATA_DIR, name));
      return {
        name,
        rows: Number(m[1]),
        stamp: `${m[2]}-${m[3]}-${m[4]}`,
        sortKey: `${m[4]}${m[3]}${m[2]}`,
        size: st.size,
        mtime: st.mtimeMs,
        fetchYear: manifest[name]?.fetchYear ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.mtime - a.mtime);
}

// ไฟล์ที่ต้องใช้ตามการตั้งค่า (ไฟล์ที่เลือกถูกลบไปแล้ว → ใช้ไฟล์ล่าสุด)
function resolveCompareFile(settings = readSettings()) {
  const files = listCompareFiles();
  const picked = settings.compareFile !== 'latest' && files.find((f) => f.name === settings.compareFile);
  const f = picked || files[0];
  return f ? path.join(OPENDATA_DIR, f.name) : null;
}

// บันทึกว่าไฟล์รายวันแต่ละไฟล์ดึงมาจาก API ปีไหน
function recordManifest(name, info) {
  const manifest = readJson(MANIFEST_PATH, {});
  manifest[name] = info;
  writeJsonAtomic(MANIFEST_PATH, manifest);
}

function loadedFile(db, year) {
  return db.prepare('SELECT file FROM kpi_files WHERE year = ?').get(year)?.file ?? null;
}

// นำเข้าไฟล์ปี 2570 ตามการตั้งค่า ถ้ายังไม่ใช่ไฟล์ที่โหลดอยู่ (force = นำเข้าใหม่แม้เป็นไฟล์เดิม)
function syncCompareYear(db, { force = false, log = console.log } = {}) {
  const file = resolveCompareFile();
  if (!file) {
    log(`ปี ${COMPARE_YEAR}: ไม่พบไฟล์ใน ${path.relative(ROOT, OPENDATA_DIR)} — ข้าม`);
    return null;
  }
  const name = path.basename(file);
  if (!force && loadedFile(db, COMPARE_YEAR) === name) {
    log(`ปี ${COMPARE_YEAR}: ใช้ ${name} อยู่แล้ว`);
    return null;
  }
  log(`ปี ${COMPARE_YEAR}: นำเข้า ${name}`);
  return importYearFile(db, COMPARE_YEAR, file);
}

module.exports = {
  ROOT, SRC_DIR, OPENDATA_DIR, KPI_DB_PATH, SETTINGS_PATH, DATA_COLUMNS, COMPARE_YEAR, COMPARE_FILE_RE,
  openKpiDb, importReferences, importYearRows, importYearFile, latestFile,
  readSettings, writeSettings, listCompareFiles, resolveCompareFile, recordManifest, loadedFile, syncCompareYear,
};
