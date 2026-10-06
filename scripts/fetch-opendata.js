// ดึงข้อมูล s_ttm4 จาก opendata.moph.go.th ทุกจังหวัด แล้วบันทึกเป็น Excel รายวันใน publicfiles/opendata-2570/
// ชื่อไฟล์: Data_<ปีที่บันทึก>_sttm4_<จำนวนแถว>_<dd-mm-yy พ.ศ.>.xlsx  (รูปแบบเดียวกับ Data_2569_sttm4_195692_08-09-69.xlsx)
// จากนั้นนำเข้า data/kpi.db ทันที
//
// ใช้งาน: npm run fetch:opendata
// ตั้งค่า (env):
//   OPENDATA_FETCH_YEAR  ปีที่ส่งให้ API          (ค่าเริ่มต้น 2569 — ระหว่างรอข้อมูลปี 2570)
//   OPENDATA_SAVE_YEAR   ปีที่ใช้ตั้งชื่อไฟล์/รายงาน (ค่าเริ่มต้น 2570)
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const kpi = require('./kpi-lib');

const API_URL = 'https://opendata.moph.go.th/api/report_data';
const FETCH_YEAR = process.env.OPENDATA_FETCH_YEAR || '2569';
const SAVE_YEAR = Number(process.env.OPENDATA_SAVE_YEAR || 2570);

const PROVINCES = [
  '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '20', '21', '22', '23', '24', '25', '26', '27',
  '30', '31', '32', '33', '34', '35', '36', '37', '38', '39',
  '40', '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '50', '51', '52', '53', '54', '55', '56', '57', '58',
  '60', '61', '62', '63', '64', '65', '66', '67',
  '70', '71', '72', '73', '74', '75', '76', '77',
  '80', '81', '82', '83', '84', '85', '86',
  '90', '91', '92', '93', '94', '95', '96',
];

const MAX_RETRIES = 3; // ลองใหม่ต่อ 1 หน้า ก่อนถือว่าจังหวัดนี้ล้มเหลว
const CONCURRENCY = 5; // จำนวนจังหวัดที่ดึงพร้อมกัน
const PAGE_LIMIT = 1000; // แถวต่อหน้า (ตาม limit ของ API)
const MAX_RETRY_ROUNDS = 2; // รอบเก็บตกจังหวัดที่ล้มเหลว
const RETRY_ROUND_DELAY_MS = 60000;
const RATE_LIMIT_DELAY_MS = 45000;
const PAGE_DELAY_MS = 300;
const PROVINCE_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 120000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}] ${msg}`);

function parseResponseData(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of ['data', 'result', 'rows', 'report']) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
}

async function postJson(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // ไม่ใช่ JSON
  }
  return { status: res.status, data };
}

// ดึงทุกหน้าของจังหวัดเดียว (วน offset ทีละ PAGE_LIMIT)
async function fetchProvinceAll(province) {
  const rows = [];
  let offset = 0;

  for (;;) {
    let attempt = 0;
    let page = null;
    let lastErr = null;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        const { status, data } = await postJson({
          tableName: 's_ttm4',
          year: FETCH_YEAR,
          province,
          type: 'json',
          limit: PAGE_LIMIT,
          offset,
        });
        if (status === 429) {
          attempt--; // ถูกจำกัดความถี่ ไม่นับเป็นความล้มเหลว
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }
        if (status < 200 || status >= 300) throw new Error(`HTTP ${status} (province ${province}, offset ${offset})`);
        page = parseResponseData(data);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt >= MAX_RETRIES) break;
        await sleep(2000 * attempt);
      }
    }

    if (lastErr) return { province, rows, ok: false, error: lastErr.message };
    if (!page || page.length === 0) break;
    rows.push(...page);
    if (page.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
    await sleep(PAGE_DELAY_MS);
  }

  return { province, rows, ok: true, error: null };
}

async function fetchProvincesBatched(provinceList) {
  const byProvince = {};
  const failed = [];
  const errors = {};

  for (let i = 0; i < provinceList.length; i += CONCURRENCY) {
    const batch = provinceList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(fetchProvinceAll));
    for (const r of results) {
      if (r.ok) byProvince[r.province] = r.rows;
      else {
        failed.push(r.province);
        errors[r.province] = r.error;
      }
    }
    log(`  ${Math.min(i + CONCURRENCY, provinceList.length)}/${provinceList.length} จังหวัด`);
    await sleep(PROVINCE_DELAY_MS);
  }
  return { byProvince, failed, errors };
}

async function fetchAllProvinces() {
  log(`รอบที่ 1: ดึงข้อมูลปี ${FETCH_YEAR} ทั้งหมด ${PROVINCES.length} จังหวัด`);
  const round1 = await fetchProvincesBatched(PROVINCES);
  // เก็บตามจังหวัด: จังหวัดที่ล้มเหลวแล้วเก็บตกได้จะไม่มีแถวซ้ำ
  const byProvince = round1.byProvince;
  let stillFailed = round1.failed;
  let errors = round1.errors;
  log(`รอบที่ 1: สำเร็จ ${PROVINCES.length - stillFailed.length}/${PROVINCES.length} จังหวัด, ล้มเหลว: [${stillFailed.join(', ')}]`);

  for (let round = 2; stillFailed.length > 0 && round <= MAX_RETRY_ROUNDS + 1; round++) {
    log(`พัก ${RETRY_ROUND_DELAY_MS / 1000} วินาที แล้วเก็บตก ${stillFailed.length} จังหวัด (รอบที่ ${round})`);
    await sleep(RETRY_ROUND_DELAY_MS);
    const retry = await fetchProvincesBatched(stillFailed);
    Object.assign(byProvince, retry.byProvince);
    stillFailed = retry.failed;
    errors = retry.errors;
    log(`รอบที่ ${round}: ยังไม่สำเร็จ [${stillFailed.join(', ')}]`);
  }

  const rows = PROVINCES.flatMap((p) => byProvince[p] || []);
  return { rows, failed: stillFailed, errors };
}

// วันที่แบบ dd-mm-yy (พ.ศ.) ตามเวลาไทย เช่น 08-09-69
function thaiDateStamp(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const be = (Number(parts.year) + 543) % 100;
  return `${parts.day}-${parts.month}-${String(be).padStart(2, '0')}`;
}

function writeExcel(rows) {
  fs.mkdirSync(kpi.OPENDATA_DIR, { recursive: true });
  const stamp = thaiDateStamp();
  // ลบไฟล์ของวันเดียวกันที่ดึงไว้ก่อนหน้า (ถ้ารันซ้ำในวันเดียวกัน)
  for (const f of fs.readdirSync(kpi.OPENDATA_DIR)) {
    if (new RegExp(`^Data_${SAVE_YEAR}_sttm4_\\d+_${stamp}\\.xlsx$`).test(f)) fs.unlinkSync(path.join(kpi.OPENDATA_DIR, f));
  }
  const file = path.join(kpi.OPENDATA_DIR, `Data_${SAVE_YEAR}_sttm4_${rows.length}_${stamp}.xlsx`);
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r) => Object.fromEntries(kpi.DATA_COLUMNS.map((c) => [c, r[c] ?? null]))),
    { header: kpi.DATA_COLUMNS }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  // เขียนลงไฟล์ชั่วคราวก่อน แล้วค่อยเปลี่ยนชื่อ กันไฟล์ครึ่ง ๆ กลาง ๆ
  const tmp = `${file}.tmp`;
  XLSX.writeFile(wb, tmp, { bookType: 'xlsx', compression: true });
  fs.renameSync(tmp, file);
  return file;
}

async function main() {
  const started = Date.now();
  log(`เริ่มดึงข้อมูล s_ttm4 ปี ${FETCH_YEAR} → บันทึกเป็นปี ${SAVE_YEAR}`);
  const { rows, failed, errors } = await fetchAllProvinces();

  if (rows.length === 0) {
    log('ไม่ได้ข้อมูลจาก API เลย — ยกเลิก');
    process.exit(1);
  }
  // ต้องได้ครบทุกจังหวัดเท่านั้นถึงจะบันทึก กันข้อมูลไม่ครบไปทับของเดิม
  if (failed.length > 0) {
    log(`ดึงไม่ครบ ${PROVINCES.length} จังหวัด (ล้มเหลว ${failed.length}: ${failed.join(', ')}) — ไม่บันทึกไฟล์`);
    log(JSON.stringify(errors));
    process.exit(1);
  }

  const file = writeExcel(rows);
  log(`บันทึก ${path.relative(kpi.ROOT, file)} (${rows.length} แถว)`);

  const db = kpi.openKpiDb();
  kpi.importReferences(db);
  const s = kpi.importYearRows(db, SAVE_YEAR, rows, path.basename(file));
  db.close();
  log(
    `นำเข้า kpi.db ปี ${SAVE_YEAR}: ${s.hosp} หน่วยบริการ · มูลค่า ${Math.round(s.kpi).toLocaleString()} บาท ` +
      `(ใช้เวลา ${Math.round((Date.now() - started) / 1000)} วินาที)`
  );
}

main().catch((err) => {
  log(`ผิดพลาด: ${err.stack || err.message}`);
  process.exit(1);
});
