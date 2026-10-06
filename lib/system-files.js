// ไฟล์ในระบบที่ผู้ดูแลดาวน์โหลดได้จากหน้า /admin
// ดาวน์โหลดได้เฉพาะไฟล์ใต้โฟลเดอร์ที่กำหนดไว้ที่นี่เท่านั้น
import fs from 'fs';
import path from 'path';
import refs from '@/scripts/reference-files';

const DIRS = {
  pub: { dir: refs.SRC_DIR, label: 'publicfiles' },
  archive: { dir: refs.ARCHIVE_DIR, label: 'data/reference-archive' },
};

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

// จัดกลุ่ม: ไฟล์อ้างอิง / ข้อมูล opendata แต่ละปี / ไฟล์อ้างอิงเดิมที่ถูกแทนที่
export function listSystemFiles() {
  const groups = new Map();
  const add = (title, file) => {
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(file);
  };
  for (const f of walk(DIRS.pub.dir)) {
    const folder = f.rel.includes('/') ? f.rel.split('/')[0] : '';
    const title = !folder
      ? 'ไฟล์ข้อมูลอ้างอิง (publicfiles)'
      : folder.startsWith('opendata-')
        ? `ข้อมูล opendata ปี ${folder.slice('opendata-'.length)} (publicfiles/${folder})`
        : `publicfiles/${folder}`;
    add(title, { ...f, dir: 'pub' });
  }
  for (const f of walk(DIRS.archive.dir)) add('ไฟล์อ้างอิงเดิมที่ถูกแทนที่ (data/reference-archive)', { ...f, dir: 'archive' });

  return [...groups].map(([title, files]) => ({
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
