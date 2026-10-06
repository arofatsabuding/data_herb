// นำเข้าข้อมูลตัวชี้วัดทั้งหมดลง data/kpi.db
// - ปี 2569: publicfiles/Data_2569_sttm4_*.xlsx
// - ปี 2570: ไฟล์ล่าสุดใน publicfiles/opendata-2570/
// ใช้งาน: npm run import:kpi   (ไม่ต้องปิดเซิร์ฟเวอร์)
const path = require('path');
const kpi = require('./kpi-lib');

function main() {
  const db = kpi.openKpiDb();
  console.log('นำเข้าตารางอ้างอิง...');
  const ref = kpi.importReferences(db);
  console.log(`  ประเภทหน่วยบริการ ${ref.types} · หน่วยบริการ ${ref.offices} · กลุ่มยา 11 หลัก ${ref.drugs}`);

  const sources = [
    [2569, kpi.latestFile(kpi.SRC_DIR, /^Data_2569_sttm4_.*\.xlsx$/i)],
    [2570, kpi.latestFile(kpi.OPENDATA_DIR, /^Data_2570_sttm4_.*\.xlsx$/i)],
  ];
  for (const [year, file] of sources) {
    if (!file) {
      console.log(`ปี ${year}: ไม่พบไฟล์ — ข้าม`);
      continue;
    }
    console.log(`ปี ${year}: ${path.basename(file)}`);
    const s = kpi.importYearFile(db, year, file);
    console.log(
      `  ${s.rows} แถว · ${s.hosp} หน่วยบริการ · อยู่ในกลุ่มที่คิดตัวชี้วัด ${s.matched} แถว · มูลค่า ${Math.round(s.kpi).toLocaleString()} บาท`
    );
  }
  db.close();
}

main();
