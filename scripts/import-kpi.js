// นำเข้าข้อมูลตัวชี้วัดลง data/kpi.db
// - ตารางอ้างอิง: หน่วยบริการ, ประเภท, กลุ่มยา 11 หลัก, รหัส 24 หลัก (จาก data/herb.db)
// - ปี 2569: publicfiles/Data_2569_sttm4_*.xlsx
// - ปี 2570: ไฟล์ใน publicfiles/opendata-2570/ ตามการตั้งค่า (ค่าเริ่มต้น = ไฟล์ล่าสุด)
// ใช้งาน:
//   npm run import:kpi                     นำเข้าทั้งหมด (ไม่ต้องปิดเซิร์ฟเวอร์)
//   node scripts/import-kpi.js --compare-only   นำเข้าเฉพาะปี 2570 ตามการตั้งค่า (หน้าตั้งค่าเรียกใช้)
const path = require('path');
const kpi = require('./kpi-lib');

const summary = (s) =>
  `  ${s.rows} แถว · ${s.hosp} หน่วยบริการ · อยู่ในกลุ่มที่คิดตัวชี้วัด ${s.matched} แถว · มูลค่า ${Math.round(s.kpi).toLocaleString()} บาท`;

function main() {
  const compareOnly = process.argv.includes('--compare-only');
  const db = kpi.openKpiDb();

  if (!compareOnly) {
    console.log('นำเข้าตารางอ้างอิง...');
    const ref = kpi.importReferences(db);
    console.log(
      `  ประเภทหน่วยบริการ ${ref.types} · หน่วยบริการ ${ref.offices} · กลุ่มยา 11 หลัก ${ref.drugs} · รหัส 24 หลัก ${ref.dtam24}`
    );
    const base = kpi.latestFile(kpi.SRC_DIR, /^Data_2569_sttm4_.*\.xlsx$/i);
    if (base) {
      console.log(`ปี 2569: ${path.basename(base)}`);
      console.log(summary(kpi.importYearFile(db, 2569, base)));
    } else console.log('ปี 2569: ไม่พบไฟล์ — ข้าม');
  }

  const s = kpi.syncCompareYear(db, { force: !compareOnly });
  if (s) console.log(summary(s));
  db.close();
}

main();
