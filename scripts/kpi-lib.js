// ฟังก์ชันนำเข้าข้อมูล "มูลค่ายาสมุนไพรในสิทธิ UC" ลง data/kpi.db
// ใช้ร่วมกันโดย scripts/import-kpi.js, scripts/fetch-opendata.js และหน้าเว็บ
//
// สูตร: มูลค่ายาสมุนไพร = vs_uc × price (ราคาต่อ course ของกลุ่มยาใน herbal_drug_master_11.xlsx)
// กลุ่มยาหาจากรหัส didstd ที่ล้างให้เหลือแต่ตัวเลข แล้วตัด 11 หลักแรก
//
// ไฟล์ข้อมูลแต่ละปีอยู่ใน publicfiles/opendata-<ปี>/Data_<ปี>_sttm4_<แถว>_<dd-mm-yy>.xlsx
// แต่ละไฟล์นำเข้าเป็น 1 dataset ในฐานข้อมูล ผู้ใช้แต่ละคนเลือกได้ว่าจะใช้ไฟล์ไหน
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const { requireRefPath } = require('./reference-files');

// เมื่อถูก bundle โดย Next.js __dirname จะไม่ใช่โฟลเดอร์ scripts/ → ใช้โฟลเดอร์ที่รันเซิร์ฟเวอร์แทน
const ROOT = fs.existsSync(path.join(__dirname, '..', 'publicfiles')) ? path.join(__dirname, '..') : process.cwd();
const SRC_DIR = path.join(ROOT, 'publicfiles');
const KPI_DB_PATH = process.env.KPI_DB_PATH || path.join(ROOT, 'data', 'kpi.db');
const HERB_DB_PATH = path.join(ROOT, 'data', 'herb.db');
const FETCH_STATUS_PATH = path.join(ROOT, 'data', 'fetch-status.json');
const FETCH_YEAR_TARGET = 2570; // ปีที่ดึงจาก API ทุกวัน
const MAX_DATASETS = Number(process.env.KPI_MAX_DATASETS || 12); // จำนวนไฟล์ที่เก็บในฐานข้อมูลพร้อมกัน

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
-- รหัสยา 24 หลักจากไฟล์ของกรมการแพทย์แผนไทยฯ (คัดลอกจาก data/herb.db)
CREATE TABLE IF NOT EXISTS dtam24 (
  code24 TEXT PRIMARY KEY, drug_name TEXT, trade_name TEXT, source_code TEXT, ttmtid TEXT, drug_type TEXT
);
-- 1 dataset = 1 ไฟล์ Excel
CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, year INTEGER NOT NULL, file TEXT NOT NULL UNIQUE,
  rows INTEGER, max_date_com TEXT, imported_at TEXT
);
-- ข้อมูลดิบรายแถว (1 แถว = หน่วยบริการ × รหัสยา)
CREATE TABLE IF NOT EXISTS sttm4 (
  ds INTEGER NOT NULL, hospcode TEXT,
  didstd TEXT,       -- รหัสที่ส่งมา (เก็บเฉพาะเมื่อต่างจาก did_clean)
  did_clean TEXT, code11 TEXT,
  vs_all REAL, vs_uc REAL, pri_uc REAL,
  price REAL,        -- ราคาต่อ course (NULL = ไม่พบรายการยาหรือรายการยาถูกยกเลิกรหัส)
  kpi_value REAL     -- vs_uc × price
);
CREATE INDEX IF NOT EXISTS idx_sttm4_ds_hosp ON sttm4(ds, hospcode);
-- สรุประดับหน่วยบริการ (ใช้ทำรายงานระดับ อำเภอ/จังหวัด/เขต/ประเทศ)
CREATE TABLE IF NOT EXISTS kpi_hosp (
  ds INTEGER NOT NULL, hospcode TEXT NOT NULL,
  name TEXT, type_code TEXT, type_name TEXT,
  district_code TEXT, district TEXT, province_code TEXT, province TEXT, health_zone TEXT,
  rows INTEGER, matched_rows INTEGER,
  vs_all REAL, vs_uc REAL, matched_vs_uc REAL, pri_uc REAL, kpi_value REAL,
  PRIMARY KEY (ds, hospcode)
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

// ---------- ไฟล์ข้อมูลในโฟลเดอร์ opendata-<ปี> ----------

const yearDir = (year) => path.join(SRC_DIR, `opendata-${year}`);
// Data_<ปี>_sttm4_<แถว>_<dd-mm-yy>[_<HH.MM>].xlsx  (ไฟล์รุ่นแรกไม่มีเวลา)
const fileRe = (year) =>
  new RegExp(`^Data_${year}_sttm4_(\\d+)_(\\d{2})-(\\d{2})-(\\d{2})(?:_(\\d{2})\\.(\\d{2}))?\\.xlsx$`, 'i');

// ปีที่มีโฟลเดอร์ opendata-<ปี> เรียงจากน้อยไปมาก
function listYears() {
  if (!fs.existsSync(SRC_DIR)) return [];
  return fs
    .readdirSync(SRC_DIR)
    .map((d) => /^opendata-(\d{4})$/.exec(d))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

// ไฟล์ของปีนั้น เรียงจากใหม่ไปเก่า (ตามวันที่ในชื่อไฟล์ แล้วตามเวลาแก้ไข)
function listFiles(year) {
  const dir = yearDir(year);
  if (!fs.existsSync(dir)) return [];
  const manifest = readJson(path.join(dir, 'manifest.json'), {});
  const re = fileRe(year);
  return fs
    .readdirSync(dir)
    .map((name) => {
      const m = re.exec(name);
      if (!m) return null;
      const st = fs.statSync(path.join(dir, name));
      return {
        name,
        year,
        rows: Number(m[1]),
        stamp: `${m[2]}-${m[3]}-${m[4]}`,
        time: m[5] ? `${m[5]}:${m[6]}` : null,
        sortKey: `${m[4]}${m[3]}${m[2]}${m[5] || '00'}${m[6] || '00'}`,
        size: st.size,
        mtime: st.mtimeMs,
        fetchYear: manifest[name]?.fetchYear ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.mtime - a.mtime);
}

function filePath(year, name) {
  // รับเฉพาะชื่อไฟล์ที่ตรงรูปแบบ กันการอ้างถึงไฟล์นอกโฟลเดอร์
  if (!fileRe(year).test(name)) throw new Error(`ชื่อไฟล์ไม่ถูกต้อง: ${name}`);
  return path.join(yearDir(year), name);
}

// บันทึกว่าไฟล์รายวันแต่ละไฟล์ดึงมาจาก API ปีไหน
function recordManifest(year, name, info) {
  const file = path.join(yearDir(year), 'manifest.json');
  const manifest = readJson(file, {});
  manifest[name] = info;
  writeJsonAtomic(file, manifest);
}

// ---------- ฐานข้อมูล ----------

function openKpiDb() {
  fs.mkdirSync(path.dirname(KPI_DB_PATH), { recursive: true });
  const db = new Database(KPI_DB_PATH);
  // WAL: เว็บอ่านได้ระหว่างที่สคริปต์กำลังเขียน (ไม่ต้องปิดเซิร์ฟเวอร์)
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 120000'); // รอได้ถ้ามีอีก process กำลังเขียนอยู่
  // ฐานข้อมูลรุ่นเก่า (แยกตามปี) → ลบตารางข้อมูลทิ้ง แล้วสร้างใหม่แบบแยกตามไฟล์
  const cols = db.prepare("SELECT name FROM pragma_table_info('sttm4')").all().map((c) => c.name);
  if (cols.includes('year')) db.exec('DROP TABLE IF EXISTS sttm4; DROP TABLE IF EXISTS kpi_hosp; DROP TABLE IF EXISTS kpi_files;');
  db.exec(SCHEMA);
  return db;
}

// ตารางอ้างอิง: หน่วยบริการ, ประเภทหน่วยบริการ, กลุ่มยา 11 หลัก, รหัส 24 หลัก
function importReferences(db) {
  const types = readSheet(requireRefPath('health_office_type'));
  const offices = readSheet(requireRefPath('health_office'));
  const drugs = readSheet(requireRefPath('herbal_drug_master_11'));

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

// สร้างตารางอ้างอิงถ้ายังไม่มี (กรณีนำเข้าไฟล์เดี่ยว ๆ)
function ensureReferences(db) {
  const n = db.prepare('SELECT COUNT(*) n FROM health_office').get().n;
  if (!n) importReferences(db);
}

// นำเข้าแถวข้อมูลเป็น dataset ใหม่ (ไฟล์ชื่อเดิมจะถูกแทนที่) — ทำใน transaction เดียว
// เว็บจะเห็นข้อมูลเมื่อนำเข้าเสร็จทั้งหมดเท่านั้น
function importDatasetRows(db, year, rows, fileName) {
  const prices = new Map(db.prepare('SELECT code11, price FROM herbal_drug_master_11').all().map((r) => [r.code11, r.price]));
  const insert = db.prepare(`INSERT INTO sttm4 VALUES
    (@ds, @hospcode, @didstd, @did_clean, @code11, @vs_all, @vs_uc, @pri_uc, @price, @kpi_value)`);

  let ds;
  db.transaction(() => {
    const old = db.prepare('SELECT id FROM datasets WHERE file = ?').get(fileName);
    if (old) deleteDataset(db, old.id);
    ds = db
      .prepare('INSERT INTO datasets (year, file, rows, imported_at) VALUES (?, ?, ?, ?)')
      .run(year, fileName, rows.length, new Date().toISOString()).lastInsertRowid;

    let maxDate = '';
    for (const r of rows) {
      const didstd = clean(r.didstd);
      const didClean = didstd ? didstd.replace(/\D/g, '') : '';
      const code11 = didClean.length >= 11 ? didClean.slice(0, 11) : null;
      const price = code11 && prices.has(code11) ? prices.get(code11) : null;
      const vsUc = num(r.vs_uc);
      const dateCom = clean(r.date_com);
      if (dateCom && dateCom > maxDate) maxDate = dateCom;
      insert.run({
        ds,
        hospcode: clean(r.hospcode),
        didstd: didstd && didstd !== didClean ? didstd : null,
        did_clean: didClean || null,
        code11,
        vs_all: num(r.vs_all),
        vs_uc: vsUc,
        pri_uc: num(r.pri_uc),
        price,
        kpi_value: price === null ? 0 : vsUc * price,
      });
    }
    db.prepare('UPDATE datasets SET max_date_com = ? WHERE id = ?').run(maxDate || null, ds);

    buildKpiHosp(db, ds);
  })();

  const s = db
    .prepare('SELECT COUNT(*) hosp, SUM(rows) rows, SUM(matched_rows) matched, SUM(kpi_value) kpi FROM kpi_hosp WHERE ds = ?')
    .get(ds);
  return { ds, ...s };
}

// สรุประดับหน่วยบริการของ dataset นั้น (ชื่อ/พื้นที่ ตามตาราง health_office ปัจจุบัน)
function buildKpiHosp(db, ds) {
  db.prepare('DELETE FROM kpi_hosp WHERE ds = ?').run(ds);
  db.prepare(
    `INSERT INTO kpi_hosp
     SELECT s.ds, s.hospcode,
            COALESCE(h.name, 'ไม่พบรหัส ' || s.hospcode), h.type_code, t.name,
            h.district_code, h.district, h.province_code, h.province, h.health_zone,
            COUNT(*), SUM(s.price IS NOT NULL),
            SUM(s.vs_all), SUM(s.vs_uc),
            SUM(CASE WHEN s.price IS NOT NULL THEN s.vs_uc ELSE 0 END),
            SUM(s.pri_uc), SUM(s.kpi_value)
       FROM sttm4 s
       LEFT JOIN health_office h ON h.code5 = s.hospcode
       LEFT JOIN health_office_type t ON t.code = h.type_code
      WHERE s.ds = ?
      GROUP BY s.hospcode`
  ).run(ds);
}

// คำนวณทุก dataset ใหม่ด้วยตารางอ้างอิงปัจจุบัน (ราคากลุ่มยา 11 หลัก, หน่วยบริการ) โดยไม่ต้องอ่าน Excel ซ้ำ
// ใช้หลังผู้ดูแลอัปโหลดไฟล์อ้างอิงใหม่
function recomputeDatasets(db) {
  const ids = db.prepare('SELECT id FROM datasets ORDER BY id').all().map((d) => d.id);
  db.transaction(() => {
    db.exec(`UPDATE sttm4 SET price = (SELECT m.price FROM herbal_drug_master_11 m WHERE m.code11 = sttm4.code11);
             UPDATE sttm4 SET kpi_value = CASE WHEN price IS NULL THEN 0 ELSE vs_uc * price END;`);
    for (const ds of ids) buildKpiHosp(db, ds);
  })();
  return ids.length;
}

function importDatasetFile(db, year, fileName) {
  const rows = readSheet(filePath(year, fileName));
  return importDatasetRows(db, year, rows, fileName);
}

function deleteDataset(db, id) {
  db.prepare('DELETE FROM sttm4 WHERE ds = ?').run(id);
  db.prepare('DELETE FROM kpi_hosp WHERE ds = ?').run(id);
  db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
}

// เก็บไว้ไม่เกิน MAX_DATASETS ไฟล์ — ไฟล์ล่าสุดของแต่ละปีเก็บไว้เสมอ
// ไฟล์ที่ถูกลบออกจากฐานข้อมูลยังอยู่ในโฟลเดอร์ ถ้ามีคนเลือกจะนำเข้าใหม่ให้เอง
// ไฟล์ที่ไม่อยู่ในโฟลเดอร์แล้วก็ลบออกด้วย
function pruneDatasets(db, log = console.log) {
  const latest = new Set(listYears().map((y) => listFiles(y)[0]?.name).filter(Boolean));
  const onDisk = new Set(listYears().flatMap((y) => listFiles(y).map((f) => f.name)));
  const all = db.prepare('SELECT id, file FROM datasets ORDER BY imported_at DESC').all();
  let kept = 0;
  const removed = [];
  for (const d of all) {
    if (latest.has(d.file) || (onDisk.has(d.file) && kept < MAX_DATASETS - latest.size)) {
      if (!latest.has(d.file)) kept++;
      continue;
    }
    removed.push(d);
  }
  if (removed.length) {
    db.transaction(() => removed.forEach((d) => deleteDataset(db, d.id)))();
    log(`ลบข้อมูลเก่าออกจากฐานข้อมูล ${removed.length} ไฟล์: ${removed.map((d) => d.file).join(', ')}`);
  }
}

// ---------- ล็อกการดึงข้อมูล (data/fetch.lock) ----------
// ให้ดึงได้ครั้งละ 1 งานเท่านั้น ไม่ว่าจะสั่งจากหน้าเว็บ ตั้งเวลา หรือ npm run fetch:opendata

const FETCH_LOCK_PATH = path.join(ROOT, 'data', 'fetch.lock');

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

// ข้อมูลผู้ถือล็อก หรือ null ถ้าไม่มีใครกำลังดึง (ล็อกค้างจาก process ที่ตายแล้วถือว่าว่าง)
function fetchLockInfo() {
  const info = readJson(FETCH_LOCK_PATH, null);
  if (!info) return null;
  return pidAlive(info.pid) ? info : null;
}

// คืนค่า true เมื่อได้ล็อก
function acquireFetchLock(by) {
  fs.mkdirSync(path.dirname(FETCH_LOCK_PATH), { recursive: true });
  for (let i = 0; i < 2; i++) {
    try {
      const fd = fs.openSync(FETCH_LOCK_PATH, 'wx'); // สร้างไฟล์แบบ atomic — มีอยู่แล้วจะ error
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, by, startedAt: new Date().toISOString() }));
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (fetchLockInfo()) return false;
      fs.rmSync(FETCH_LOCK_PATH, { force: true }); // ล็อกค้าง → ลบแล้วลองใหม่
    }
  }
  return false;
}

function releaseFetchLock() {
  const info = readJson(FETCH_LOCK_PATH, null);
  if (info?.pid === process.pid) fs.rmSync(FETCH_LOCK_PATH, { force: true });
}

// ---------- สถานะการดึงข้อมูลรายวัน (data/fetch-status.json) ----------
// { rounds: { "2026-10-06": { attempts, status: running|ok|failed|no_report, updatedAt, file } } }

function readFetchStatus() {
  const s = readJson(FETCH_STATUS_PATH, {});
  return { rounds: s.rounds && typeof s.rounds === 'object' ? s.rounds : {} };
}

function updateFetchRound(date, patch) {
  const s = readFetchStatus();
  s.rounds[date] = { ...(s.rounds[date] || { attempts: 0 }), ...patch, updatedAt: new Date().toISOString() };
  // เก็บย้อนหลัง 30 รอบ
  const keep = Object.keys(s.rounds).sort().slice(-30);
  s.rounds = Object.fromEntries(keep.map((k) => [k, s.rounds[k]]));
  writeJsonAtomic(FETCH_STATUS_PATH, s);
  return s.rounds[date];
}

module.exports = {
  ROOT, SRC_DIR, KPI_DB_PATH, DATA_COLUMNS, FETCH_YEAR_TARGET,
  yearDir, listYears, listFiles, filePath, recordManifest,
  openKpiDb, importReferences, ensureReferences, importDatasetRows, recomputeDatasets, importDatasetFile, pruneDatasets,
  readFetchStatus, updateFetchRound, fetchLockInfo, acquireFetchLock, releaseFetchLock,
};
