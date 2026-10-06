// อ่านไฟล์ Excel ในโฟลเดอร์ ไฟล์/ แล้วสร้างฐานข้อมูล SQLite ใหม่ที่ data/herb.db
// ใช้งาน: npm run import
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'ไฟล์');
const DB_PATH = path.join(ROOT, 'data', 'herb.db');

const CODES_FILE = path.join(SRC_DIR, 'รหัสยา24หลักทั้งหมด.xlsx');
const MASTER_FILE = fs.readdirSync(SRC_DIR).find((f) => /^MasterTTMT.*\.xlsx?$/i.test(f));
if (!MASTER_FILE) throw new Error('ไม่พบไฟล์ MasterTTMT*.xls ในโฟลเดอร์ ไฟล์/');

// ล้างช่องว่าง/ขึ้นบรรทัด และแปลงทุกค่าเป็นข้อความ (กันเลข 0 นำหน้าหาย)
const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
};

// sheet ที่ใช้: เดี่ยว และ ตำรับ (ไม่ใช้ sheet ยกเลิก)
const SHEETS = [
  { prefix: 'เดี่ยว', type: 'เดี่ยว' },
  { prefix: 'ตำรับ', type: 'ตำรับ' },
];

// หัวคอลัมน์ในไฟล์ DTAM → ชื่อคอลัมน์ในฐานข้อมูล
const CODE_COLUMNS = {
  'ประเภทตำรับยา': 'formula_type',
  'รหัสตัวยาสำคัญ': 'key_ingredient_code',
  'ชื่อยา': 'drug_name',
  'ชื่อการค้า/ชื่อเดิม': 'trade_name',
  'สรรพคุณยา-ข้อบ่งใช้': 'indication',
  'ขนาดความแรง': 'strength',
  'รหัสขนาดความแรงยา': 'strength_code',
  'รูปแบบยา': 'dosage_form',
  'รหัสรูปแบบยา': 'dosage_form_code',
  'ผู้ผลิต': 'manufacturer',
  'รหัสผู้ผลิต': 'manufacturer_code',
  'เลขทะเบียนยา': 'registration_no',
  'รหัสทำงาน': 'work_code',
  'รหัสยาแผนไทย 24 หลัก': 'code24',
  'รหัสที่มาของยา': 'source_code',
  'สรรพคุณยาตามทฤษฎีแพทย์แผนไทย': 'thai_theory_code',
  'หมายเหตุ': 'remark',
  'ครั้งที่กำหนด': 'assigned_round',
  'ขนาดบรรจุ': 'pack_size',
  'TTMTID': 'ttmtid',
};

function readCodes() {
  const wb = XLSX.readFile(CODES_FILE);
  const rows = [];
  for (const { prefix, type } of SHEETS) {
    const name = wb.SheetNames.find((n) => n.trim().startsWith(prefix));
    if (!name) throw new Error(`ไม่พบ sheet "${prefix}"`);
    const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
    const headerIdx = data.findIndex((r) => r.some((c) => clean(c) === 'TTMTID'));
    const header = data[headerIdx].map((h) => CODE_COLUMNS[clean(h)]);
    let count = 0;
    for (const r of data.slice(headerIdx + 1)) {
      const row = { drug_type: type };
      header.forEach((col, i) => {
        if (col) row[col] = clean(r[i]);
      });
      if (row.code24) {
        rows.push(row);
        count++;
      }
    }
    console.log(`  sheet ${name.trim()}: ${count} แถว`);
  }
  return rows;
}

function readMaster() {
  const wb = XLSX.readFile(path.join(SRC_DIR, MASTER_FILE));
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  return data
    .map((r) => ({
      ttmt_code: clean(r.TTMTCode),
      active_ingredient: clean(r.ActiveIngredient),
      strength: clean(r.Strength),
      dosage_form: clean(r.Dosageform),
      cont_value: clean(r.Contvalue),
      cont_unit: clean(r.Contunit),
      disp_unit: clean(r.DispUnit),
      trade_name: clean(r.TradeName),
      manufacturer: clean(r.Manufacturer),
      fsn: clean(r.FSN),
      status: clean(r.Status),
      ttmt_type: clean(r.TTMTType),
      change_date: clean(r.Changedate),
      ed: clean(r.ED),
      drug_group_nhso: clean(r.Drug_Group_Nhso),
    }))
    .filter((r) => r.ttmt_code);
}

function insertAll(db, table, columns, rows) {
  const stmt = db.prepare(
    `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((c) => '@' + c).join(',')})`
  );
  db.transaction(() => {
    for (const r of rows) stmt.run(Object.fromEntries(columns.map((c) => [c, r[c] ?? null])));
  })();
}

function main() {
  console.log('อ่านไฟล์รหัส 24 หลัก...');
  const codes = readCodes();
  console.log(`อ่าน ${MASTER_FILE}...`);
  const master = readMaster();
  console.log(`  master: ${master.length} แถว`);

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = DB_PATH + '.tmp';
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  const db = new Database(tmp);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  insertAll(db, 'drug_codes', ['drug_type', ...Object.values(CODE_COLUMNS)], codes);
  insertAll(db, 'ttmt_master', Object.keys(master[0]), master);
  const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
  meta.run('imported_at', new Date().toISOString());
  meta.run('codes_file', path.basename(CODES_FILE));
  meta.run('master_file', MASTER_FILE);

  const s = db
    .prepare('SELECT COUNT(*) total, SUM(in_master) in_master, SUM(has_drug_group) with_group FROM drug_lookup')
    .get();
  db.close();
  fs.renameSync(tmp, DB_PATH);

  console.log(`\nสร้าง ${path.relative(ROOT, DB_PATH)} เรียบร้อย`);
  console.log(`  รายการทั้งหมด      : ${s.total}`);
  console.log(`  พบใน Master        : ${s.in_master}`);
  console.log(`  มี Drug Group       : ${s.with_group}`);
  console.log(`  ไม่มี Drug Group     : ${s.total - s.with_group}`);
}

main();
