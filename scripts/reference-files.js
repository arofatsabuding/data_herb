// ไฟล์อ้างอิงใน publicfiles/ — ชื่อไฟล์คงที่ (ภาษาอังกฤษ) ผู้ดูแลอัปโหลดไฟล์ใหม่แทนที่ได้จากหน้า /admin
// ใช้ร่วมกันโดย scripts/import.js, scripts/kpi-lib.js และหน้าผู้ดูแล
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const ROOT = fs.existsSync(path.join(__dirname, '..', 'publicfiles')) ? path.join(__dirname, '..') : process.cwd();
const SRC_DIR = path.join(ROOT, 'publicfiles');
const ARCHIVE_DIR = path.join(ROOT, 'data', 'reference-archive'); // ไฟล์เดิมที่ถูกแทนที่
const HISTORY_PATH = path.join(ROOT, 'data', 'reference-history.json');
const KEEP_ARCHIVE = 5; // เก็บไฟล์เดิมไว้กี่รุ่นต่อไฟล์

const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
};

// คอลัมน์ในแถวแรกของ sheet แรก
function firstSheetHeader(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  return { header: (rows[0] || []).map(clean).filter(Boolean), rows: Math.max(rows.length - 1, 0) };
}

function requireColumns(wb, cols) {
  const { header, rows } = firstSheetHeader(wb);
  const missing = cols.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`ไม่พบคอลัมน์ ${missing.join(', ')} ในแถวแรกของ sheet "${wb.SheetNames[0]}"`);
  if (!rows) throw new Error('ไม่มีข้อมูลในไฟล์');
  return { rows, detail: `sheet "${wb.SheetNames[0]}" ${rows.toLocaleString()} แถว` };
}

// target: herb = ใช้สร้าง data/herb.db (ค้นหายา), kpi = ใช้ในตัวชี้วัด (data/kpi.db)
// ทุกไฟล์มีผลกับตัวชี้วัด เพราะรหัส 24 หลักในตัวชี้วัดคัดลอกมาจาก herb.db
const REFERENCE_FILES = [
  {
    key: 'dtam_codes',
    base: 'dtam_drug_codes_24',
    exts: ['.xlsx'],
    title: 'รหัสยาแผนไทย 24 หลัก (ทั้งหมด)',
    source: 'กรมการแพทย์แผนไทยและการแพทย์ทางเลือก',
    usedBy: 'ค้นหายา, Drug Group, ตรวจรหัส 24 หลักในตัวชี้วัด',
    target: 'herb',
    validate(wb) {
      const parts = [];
      let total = 0;
      for (const prefix of ['เดี่ยว', 'ตำรับ']) {
        const name = wb.SheetNames.find((n) => n.trim().startsWith(prefix));
        if (!name) throw new Error(`ไม่พบ sheet ที่ชื่อขึ้นต้นด้วย "${prefix}"`);
        const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, blankrows: false });
        const h = data.findIndex((r) => r.some((c) => clean(c) === 'TTMTID'));
        if (h < 0) throw new Error(`sheet "${name.trim()}" ไม่มีหัวคอลัมน์ TTMTID`);
        const col = data[h].findIndex((c) => clean(c) === 'รหัสยาแผนไทย 24 หลัก');
        if (col < 0) throw new Error(`sheet "${name.trim()}" ไม่มีหัวคอลัมน์ "รหัสยาแผนไทย 24 หลัก"`);
        const n = data.slice(h + 1).filter((r) => clean(r[col])).length;
        if (!n) throw new Error(`sheet "${name.trim()}" ไม่มีรหัส 24 หลัก`);
        total += n;
        parts.push(`${name.trim()} ${n.toLocaleString()} แถว`);
      }
      return { rows: total, detail: parts.join(' · ') };
    },
  },
  {
    key: 'ttmt_master',
    base: 'ttmt_master',
    exts: ['.xls', '.xlsx'],
    title: 'TTMT Master',
    source: 'สมสท.',
    usedBy: 'เชื่อม TTMTID → Drug Group',
    target: 'herb',
    validate: (wb) => requireColumns(wb, ['TTMTCode', 'Drug_Group_Nhso']),
  },
  {
    key: 'drug_group_rates',
    base: 'ttmt_drug_group_rates',
    exts: ['.xlsx'],
    title: 'อัตราเบิกต่อ Drug Group',
    source: 'ttmt_drug_group',
    usedBy: 'อัตราเบิกต่อ course (บาท / point)',
    target: 'herb',
    validate: (wb) => requireColumns(wb, ['drug_group', 'course', 'unit']),
  },
  {
    key: 'herbal_drug_master_11',
    base: 'herbal_drug_master_11',
    exts: ['.xlsx'],
    title: 'กลุ่มยาสมุนไพร 11 หลัก + ราคาต่อ course',
    source: 'herbal_drug_master_11',
    usedBy: 'คำนวณมูลค่าตัวชี้วัด',
    target: 'kpi',
    validate: (wb) => requireColumns(wb, ['code11', 'full_name', 'course', 'price']),
  },
  {
    key: 'health_office',
    base: 'health_office',
    exts: ['.xlsx'],
    title: 'หน่วยบริการสาธารณสุข',
    source: 'health_office',
    usedBy: 'ชื่อหน่วยบริการ, อำเภอ, จังหวัด, เขตสุขภาพ ในตัวชี้วัด',
    target: 'kpi',
    validate: (wb) =>
      requireColumns(wb, ['code5', 'name', 'health_office_type_code', 'district_code', 'province_code', 'health_zone']),
  },
  {
    key: 'health_office_type',
    base: 'health_office_type',
    exts: ['.xlsx'],
    title: 'ประเภทหน่วยบริการ',
    source: 'health_office_type',
    usedBy: 'ประเภทหน่วยบริการในตัวชี้วัด',
    target: 'kpi',
    validate: (wb) => requireColumns(wb, ['code', 'name']),
  },
];

const getRef = (key) => REFERENCE_FILES.find((r) => r.key === key) || null;

// path ของไฟล์ที่ใช้อยู่ (ลองทุกนามสกุลที่รับ) — null ถ้าไม่มี
function refPath(key) {
  const ref = getRef(key);
  if (!ref) throw new Error(`ไม่รู้จักไฟล์อ้างอิง ${key}`);
  for (const ext of ref.exts) {
    const p = path.join(SRC_DIR, ref.base + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function requireRefPath(key) {
  const p = refPath(key);
  if (!p) {
    const ref = getRef(key);
    throw new Error(`ไม่พบไฟล์ publicfiles/${ref.base}${ref.exts[0]} (${ref.title})`);
  }
  return p;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// ประวัติการเปลี่ยนไฟล์: { <key>: [{ original, uploadedAt, rows, detail, archived }] } ใหม่สุดอยู่หน้า
function readHistory() {
  const h = readJson(HISTORY_PATH, {});
  return h && typeof h === 'object' ? h : {};
}

function addHistory(key, entry) {
  const h = readHistory();
  h[key] = [entry, ...(h[key] || [])].slice(0, 20);
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(`${HISTORY_PATH}.tmp`, JSON.stringify(h, null, 2));
  fs.renameSync(`${HISTORY_PATH}.tmp`, HISTORY_PATH);
}

// ตรวจไฟล์ก่อนใช้แทนของเดิม → { rows, detail } หรือ throw พร้อมเหตุผล
function validateReference(key, buffer) {
  const ref = getRef(key);
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new Error('เปิดไฟล์ไม่ได้ — ต้องเป็นไฟล์ Excel (.xls / .xlsx)');
  }
  return ref.validate(wb);
}

// แทนที่ไฟล์อ้างอิง: ไฟล์เดิมย้ายไปเก็บที่ data/reference-archive/ (เก็บ KEEP_ARCHIVE รุ่นล่าสุด)
function replaceReference(key, buffer, ext, info) {
  const ref = getRef(key);
  if (!ref.exts.includes(ext)) throw new Error(`รับเฉพาะไฟล์ ${ref.exts.join(' / ')}`);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  const dest = path.join(SRC_DIR, ref.base + ext);
  const tmp = `${dest}.uploading`;
  fs.writeFileSync(tmp, buffer);

  let archived = null;
  const current = refPath(key);
  if (current) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    archived = `${ref.base}_${stamp}${path.extname(current)}`;
    fs.renameSync(current, path.join(ARCHIVE_DIR, archived));
  }
  fs.renameSync(tmp, dest);

  // ลบไฟล์เก่าเกินจำนวนที่เก็บ
  const old = fs
    .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.startsWith(`${ref.base}_`) && /_\d{8}_\d{6}\.\w+$/.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const name of old.slice(KEEP_ARCHIVE)) fs.rmSync(path.join(ARCHIVE_DIR, name), { force: true });

  addHistory(key, { ...info, file: path.basename(dest), archived, uploadedAt: new Date().toISOString() });
  return dest;
}

// ข้อมูลไฟล์ทั้งหมดสำหรับหน้าผู้ดูแล
function listReferences() {
  const history = readHistory();
  return REFERENCE_FILES.map((ref) => {
    const p = refPath(ref.key);
    const st = p ? fs.statSync(p) : null;
    return {
      key: ref.key,
      title: ref.title,
      source: ref.source,
      usedBy: ref.usedBy,
      target: ref.target,
      exts: ref.exts,
      file: p ? path.basename(p) : null,
      expected: ref.base + ref.exts[0],
      size: st?.size ?? null,
      mtime: st?.mtimeMs ?? null,
      history: history[ref.key] || [],
    };
  });
}

module.exports = {
  REFERENCE_FILES, SRC_DIR, ARCHIVE_DIR,
  getRef, refPath, requireRefPath, validateReference, replaceReference, listReferences, readHistory, addHistory,
};
