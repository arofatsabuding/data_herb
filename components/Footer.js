import { getMeta } from '@/lib/drugs';

export default function Footer() {
  let meta = {};
  try {
    meta = getMeta();
  } catch {
    // ยังไม่ได้ import ข้อมูล
  }
  const imported = meta.imported_at
    ? new Date(meta.imported_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })
    : '-';

  return (
    <footer className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-gray-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-lg font-bold text-white">Data Herb</h3>
          <p className="text-sm text-gray-400">
            รวมรหัสยาแผนไทย 24 หลัก และรหัส TTMT เพื่อดูว่ายาสมุนไพรแต่ละรายการอยู่ใน Drug Group ใด
          </p>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-emerald-400">แหล่งข้อมูล</h3>
          <ul className="space-y-1 text-sm text-gray-400">
            <li>รหัสยาแผนไทย 24 หลัก — กรมการแพทย์แผนไทยและการแพทย์ทางเลือก</li>
            <li>TTMT Master — สำนักพัฒนามาตรฐานระบบข้อมูลสุขภาพไทย (สมสท.)</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-emerald-400">ข้อมูลปัจจุบัน</h3>
          <ul className="space-y-1 text-sm text-gray-400">
            <li>ไฟล์รหัส 24 หลัก: {meta.codes_file || '-'}</li>
            <li>ไฟล์ Master: {meta.master_file || '-'}</li>
            <li>นำเข้าเมื่อ: {imported}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Data Herb
      </div>
    </footer>
  );
}
