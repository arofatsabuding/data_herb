import Link from 'next/link';
import { LeafIcon } from './Icons';
import { AdminNavButton } from './AdminLogin';
import NavLinks from './NavLinks';

// ปุ่มผู้ดูแลระบบ — แยกให้ต่างจากเมนูอื่น (กรอบสีทอง + ไอคอนกุญแจ)
const ADMIN_BASE =
  'ml-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition-colors duration-300';
const ADMIN_ITEM = `${ADMIN_BASE} border-amber-400/60 bg-amber-400/10 text-amber-300 hover:bg-amber-400 hover:text-navy-950`;
const ADMIN_ACTIVE = `${ADMIN_BASE} border-amber-300 bg-amber-400 text-navy-950 shadow-md shadow-amber-400/30`;

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 transition-transform duration-300 group-hover:scale-110">
            <LeafIcon className="h-6 w-6 text-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold text-white">Data Herb</span>
            <span className="block text-xs text-emerald-300">ฐานข้อมูลรหัสยาสมุนไพร</span>
          </span>
        </Link>
        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap px-1 py-2 text-sm" aria-label="เมนูหลัก">
          <NavLinks />
          <AdminNavButton className={ADMIN_ITEM} activeClassName={ADMIN_ACTIVE} />
        </nav>
      </div>
    </header>
  );
}
