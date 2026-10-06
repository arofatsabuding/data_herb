// นำเข้าข้อมูลตัวชี้วัดลง data/kpi.db
// ใช้งาน:
//   npm run import:kpi
//       นำเข้าตารางอ้างอิงใหม่ (หน่วยบริการ, ประเภท, กลุ่มยา 11 หลัก, รหัส 24 หลัก)
//       + ไฟล์ล่าสุดของทุกโฟลเดอร์ publicfiles/opendata-<ปี>/ + ไฟล์ที่เคยนำเข้าไว้แล้ว (คำนวณใหม่)
//   node scripts/import-kpi.js --year 2570 --file Data_2570_sttm4_....xlsx
//       นำเข้าเฉพาะไฟล์นี้ ถ้ายังไม่มีในฐานข้อมูล (หน้าเว็บเรียกใช้เมื่อผู้ใช้เลือกไฟล์)
// ไม่ต้องปิดเซิร์ฟเวอร์
const kpi = require('./kpi-lib');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};

const summary = (s) =>
  `  ${s.rows} แถว · ${s.hosp} หน่วยบริการ · อยู่ในกลุ่มที่คิดตัวชี้วัด ${s.matched} แถว · มูลค่า ${Math.round(s.kpi).toLocaleString()} บาท`;

function importOne(db, year, file) {
  console.log(`ปี ${year}: ${file}`);
  console.log(summary(kpi.importDatasetFile(db, year, file)));
}

function main() {
  const db = kpi.openKpiDb();
  const year = Number(arg('year'));
  const file = arg('file');

  if (file) {
    kpi.ensureReferences(db);
    if (db.prepare('SELECT 1 FROM datasets WHERE file = ?').get(file)) console.log(`${file} มีในฐานข้อมูลแล้ว`);
    else importOne(db, year, file);
  } else {
    console.log('นำเข้าตารางอ้างอิง...');
    const ref = kpi.importReferences(db);
    console.log(
      `  ประเภทหน่วยบริการ ${ref.types} · หน่วยบริการ ${ref.offices} · กลุ่มยา 11 หลัก ${ref.drugs} · รหัส 24 หลัก ${ref.dtam24}`
    );
    const targets = new Map();
    for (const y of kpi.listYears()) {
      const latest = kpi.listFiles(y)[0];
      if (latest) targets.set(latest.name, y);
      else console.log(`ปี ${y}: ไม่พบไฟล์ — ข้าม`);
    }
    // ไฟล์ที่เคยนำเข้าไว้ → คำนวณใหม่ด้วยตารางอ้างอิงล่าสุด
    for (const d of db.prepare('SELECT year, file FROM datasets').all()) {
      if (kpi.listFiles(d.year).some((f) => f.name === d.file)) targets.set(d.file, d.year);
    }
    for (const [name, y] of targets) importOne(db, y, name);
  }

  kpi.pruneDatasets(db);
  db.close();
}

main();
