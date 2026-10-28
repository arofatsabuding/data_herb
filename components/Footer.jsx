import Link from 'next/link';
import Image from 'next/image';
import logo from '@/public/herbcenter.png';
import { getMeta } from '@/lib/drugs';
import { NAV } from '@/lib/nav';

const HEADING = 'mb-4 text-xs font-semibold uppercase tracking-wider text-emerald-600';

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
  const files = [
    ['ไฟล์รหัส 24 หลัก', meta.codes_file],
    ['ไฟล์ TTMT Master', meta.master_file],
  ];

  return (
    <footer className="mt-8 border-t border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-teal-50/60 text-gray-600">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-12">
        {/* แบรนด์ */}
        <div className="sm:col-span-2 lg:col-span-4">
          <Link href="/" className="mb-4 inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-100">
              <Image src={logo} alt="" className="h-full w-full object-contain" />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-bold text-gray-800">HERB Center</span>
              <span className="block text-xs text-emerald-600">ฐานข้อมูลรหัสยาสมุนไพร</span>
            </span>
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-gray-600">
            รวมรหัสยาแผนไทย 24 หลักกับรหัส TTMT เพื่อดูว่ายาสมุนไพรแต่ละรายการอยู่ใน Drug Group ใด
            พร้อมติดตามมูลค่ายาสมุนไพรในสิทธิ UC
          </p>
        </div>

        {/* เมนู */}
        <nav className="lg:col-span-2" aria-label="เมนูท้ายหน้า">
          <h3 className={HEADING}>เมนู</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:block sm:space-y-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-gray-600 transition-colors hover:text-emerald-700">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <a href="/api-docs" className="text-gray-600 transition-colors hover:text-emerald-700">
                API / MCP สำหรับ AI
              </a>
            </li>
          </ul>
        </nav>

        {/* แหล่งข้อมูล */}
        <div className="lg:col-span-3">
          <h3 className={HEADING}>แหล่งข้อมูล</h3>
          <ul className="space-y-3 text-sm">
            <li>
              <div className="font-medium text-gray-800">รหัสยาแผนไทย 24 หลัก</div>
              <div className="text-gray-500">กรมการแพทย์แผนไทยและการแพทย์ทางเลือก</div>
            </li>
            <li>
              <div className="font-medium text-gray-800">TTMT Master</div>
              <div className="text-gray-500">สำนักพัฒนามาตรฐานระบบข้อมูลสุขภาพไทย (สมสท.)</div>
            </li>
            <li>
              <div className="font-medium text-gray-800">ข้อมูลการจ่ายยา (มูลค่ายาสมุนไพร)</div>
              <div className="text-gray-500">opendata.moph.go.th</div>
            </li>
          </ul>
        </div>

        {/* สถานะข้อมูล */}
        <div className="lg:col-span-3">
          <h3 className={HEADING}>ข้อมูลปัจจุบัน</h3>
          <div className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm">
            {files.map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-gray-500">{label}</div>
                <div className="break-all text-gray-800">{value || '-'}</div>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              นำเข้าเมื่อ {imported}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-emerald-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-gray-500 sm:flex-row">
          <span>© {new Date().getFullYear()} HERB Center · ข้อมูลเพื่อการอ้างอิง ควรตรวจสอบกับหน่วยงานต้นทางก่อนใช้งานจริง</span>
          <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/privacy" className="transition-colors hover:text-emerald-700">
              นโยบายความเป็นส่วนตัว
            </Link>
            <Link href="/terms" className="transition-colors hover:text-emerald-700">
              ข้อกำหนดการใช้งาน
            </Link>
            <a href="/api-docs" className="text-emerald-700 transition-colors hover:text-emerald-600">
              API / MCP สำหรับ AI →
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
