// ไฟล์ในระบบที่ผู้ดูแลดาวน์โหลดได้จากหน้า /admin
// ดาวน์โหลดได้เฉพาะไฟล์ใต้โฟลเดอร์ที่กำหนดไว้ที่นี่เท่านั้น
import fs from 'fs';
import path from 'path';
import refs from '@/scripts/reference-files';

const DIRS = {
  pub: { dir: refs.SRC_DIR, label: 'publicfiles' },
};
// โฟลเดอร์ไฟล์อ้างอิง (publicfiles/<ชื่อไฟล์>/) → ชื่อที่แสดง
const REF_TITLE = Object.fromEntries(refs.REFERENCE_FILES.map((r) => [r.base, r.title]));

const hidden = (name) => name.startsWith('.');

function walk(root, rel = '') {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => !hidden(d.name))
    .flatMap((d) => {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) return walk(root, r);
      const st = fs.statSync(path.join(root, r));
      return [{ rel: r, name: d.name, size: st.size, mtime: st.mtimeMs }];
    });
}

// จัดกลุ่ม: ไฟล์อ้างอิงแต่ละไฟล์ (ทุกรุ่น) / ข้อมูล opendata แต่ละปี
export function listSystemFiles() {
  const groups = new Map();
  const rank = {};
  const add = (title, file, order) => {
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(file);
    rank[title] = order;
  };
  const refOrder = refs.REFERENCE_FILES.map((r) => r.base);
  for (const f of walk(DIRS.pub.dir)) {
    const folder = f.rel.includes('/') ? f.rel.split('/')[0] : '';
    const title = !folder
      ? 'ไฟล์ข้อมูลอ้างอิง (publicfiles)'
      : REF_TITLE[folder]
        ? `ไฟล์อ้างอิง: ${REF_TITLE[folder]} — ทุกรุ่น ใหม่สุดคือที่ใช้อยู่ (publicfiles/${folder})`
        : folder.startsWith('opendata-')
          ? `ข้อมูล opendata ปี ${folder.slice('opendata-'.length)} (publicfiles/${folder})`
          : `publicfiles/${folder}`;
    // ลำดับหัวข้อ: ไฟล์อ้างอิง (ตามลำดับในหน้าผู้ดูแล) → opendata ตามปี → อื่น ๆ
    const order = REF_TITLE[folder] ? refOrder.indexOf(folder) : folder.startsWith('opendata-') ? 100 + Number(folder.slice(9)) / 1e4 : 200;
    add(title, { ...f, dir: 'pub' }, order);
  }

  return [...groups].sort(([a], [b]) => rank[a] - rank[b]).map(([title, files]) => ({
    title,
    files: files.sort((a, b) => b.mtime - a.mtime || a.rel.localeCompare(b.rel)),
  }));
}

// แปลง dir + rel เป็น path จริง — คืน null ถ้าอยู่นอกโฟลเดอร์ที่อนุญาตหรือไม่ใช่ไฟล์
export function resolveSystemFile(dir, rel) {
  const base = DIRS[dir]?.dir;
  if (!base || !rel) return null;
  const root = path.resolve(base);
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) return null;
  if (path.relative(root, abs).split(path.sep).some(hidden)) return null;
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
}

export const downloadHref = (dir, rel) => `/api/admin/download?${new URLSearchParams({ dir, file: rel })}`;
