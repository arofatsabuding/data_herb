// สร้างไฟล์ Excel (.xlsx) ฝั่งเซิร์ฟเวอร์ — ใช้กับปุ่ม "ดาวน์โหลด Excel" ที่ต้องดึงข้อมูลทั้งหมด (เกินที่แสดงบนหน้า)
import * as XLSX from 'xlsx';

// ความกว้างคอลัมน์ตามข้อความที่ยาวที่สุด (สูงสุด 60 ตัวอักษร)
function autoWidth(rows) {
  const widths = [];
  for (const r of rows) {
    r.forEach((v, i) => {
      const len = v === null || v === undefined ? 0 : String(v).length;
      widths[i] = Math.min(Math.max(widths[i] || 6, len + 2), 60);
    });
  }
  return widths.map((wch) => ({ wch }));
}

// sheets = [{ name, rows: [[หัวคอลัมน์...], [ค่า...], ...] }]
export function buildXlsx(sheets) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = autoWidth(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function xlsxResponse(filename, sheets) {
  const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const ascii = name.replace(/[^\w.-]/g, '_');
  return new Response(buildXlsx(sheets), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  });
}
