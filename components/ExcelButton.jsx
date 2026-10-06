'use client';

import { useState } from 'react';
import { DownloadIcon } from './Icons';

// ปุ่ม "ดาวน์โหลด Excel" — ใช้ได้ 3 แบบ
//   href   = ไฟล์จากเซิร์ฟเวอร์ (ข้อมูลทั้งหมด เกินที่แสดงบนหน้า)
//   tables = [{ id, name }] ดึงจากตารางที่แสดงอยู่บนหน้า (แต่ละตาราง = 1 sheet)
//   sheets = [{ name, rows: [[...], ...] }] ข้อมูลที่ส่งมาจากเซิร์ฟเวอร์โดยตรง
const BASE =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50';
const TONES = {
  emerald: 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
  rose: 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100',
  amber: 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100',
};

// ข้อความในเซลล์ → ตัวเลขจริงใน Excel (รหัสที่ขึ้นต้นด้วย 0 หรือยาว ๆ ให้เป็นข้อความเหมือนเดิม)
function toCell(raw) {
  const text = raw.replace(/ /g, ' ').replace(/\s*\n\s*/g, ' · ').trim();
  const s = text.replace(/^[▲▼•]\s*/, '').replace(/\s*(บาท|จุด)$/, '');
  if (/^\d+$/.test(s) && (s.length >= 8 || (s.length > 1 && s.startsWith('0')))) return { v: text, t: 's' };
  const pct = s.match(/^([+-]?[\d,]*\.?\d+)%$/);
  if (pct) return { v: Math.round(Number(pct[1].replace(/,/g, '')) * 1e4) / 1e6, t: 'n', z: '0.00%' };
  if (/^[+-]?\d{1,3}(,\d{3})*(\.\d+)?$|^[+-]?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ''));
    return { v: n, t: 'n', z: Number.isInteger(n) ? '#,##0' : '#,##0.00' };
  }
  return { v: text, t: 's' };
}

function tableToRows(table) {
  const rows = [];
  for (const tr of table.rows) {
    if (tr.dataset.excelSkip !== undefined) continue;
    const row = [];
    for (const td of tr.cells) {
      if (td.dataset.excelSkip !== undefined) continue;
      const raw = td.dataset.excel ?? (td.innerText || td.textContent || '');
      row.push(toCell(raw));
      for (let i = 1; i < td.colSpan; i++) row.push({ v: '', t: 's' });
    }
    rows.push(row);
  }
  return rows;
}

const plain = (v) =>
  v === null || v === undefined ? { v: '', t: 's' } : typeof v === 'number' ? { v, t: 'n', z: Number.isInteger(v) ? '#,##0' : '#,##0.00' } : { v: String(v), t: 's' };

export default function ExcelButton({
  href,
  tables,
  sheets,
  sheetsFirst = false,
  filename = 'herb_center',
  label = 'ดาวน์โหลด Excel',
  tone = 'emerald',
  className = '',
}) {
  const [busy, setBusy] = useState(false);
  const cls = `${BASE} ${TONES[tone] || TONES.emerald} ${className}`;

  if (href) {
    return (
      <a href={href} className={cls}>
        <DownloadIcon className="h-4 w-4" />
        {label}
      </a>
    );
  }

  async function download() {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const fromTables = (tables || []).map((t) => {
        const el = document.getElementById(t.id);
        return { name: t.name, rows: el ? tableToRows(el) : [] };
      });
      const fromSheets = (sheets || []).map((s) => ({ name: s.name, rows: s.rows.map((r) => r.map(plain)) }));
      const parts = (sheetsFirst ? [...fromSheets, ...fromTables] : [...fromTables, ...fromSheets]).filter((p) => p.rows.length);
      for (const p of parts) {
        const ws = XLSX.utils.aoa_to_sheet(p.rows);
        const width = [];
        p.rows.forEach((r) => r.forEach((c, i) => (width[i] = Math.min(Math.max(width[i] || 6, String(c.v).length + 2), 60))));
        ws['!cols'] = width.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(wb, ws, p.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1');
      }
      if (wb.SheetNames.length) XLSX.writeFile(wb, `${filename}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={download} disabled={busy} className={cls}>
      <DownloadIcon className="h-4 w-4" />
      {busy ? 'กำลังสร้างไฟล์…' : label}
    </button>
  );
}
