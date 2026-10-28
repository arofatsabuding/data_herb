import Link from 'next/link';
import Image from 'next/image';
import logo from '@/public/herbcenter.png';
import SiteNav from './SiteNav';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
      <div className="relative z-40 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-100 transition-transform duration-300 group-hover:scale-110">
            <Image src={logo} alt="" className="h-full w-full object-contain" priority />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold text-gray-800">HERB Center</span>
            <span className="block text-xs text-emerald-600">ฐานข้อมูลรหัสยาสมุนไพร</span>
          </span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
