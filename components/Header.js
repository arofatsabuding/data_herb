import Link from 'next/link';
import { LeafIcon } from './Icons';

const NAV = [
  { href: '/', label: 'หน้าหลัก' },
  { href: '/search', label: 'ค้นหายา' },
  { href: '/groups', label: 'Drug Group' },
  { href: '/stats', label: 'สรุปข้อมูล' },
];

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
        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-3 py-2 text-gray-300 transition-colors duration-300 hover:bg-white/10 hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
