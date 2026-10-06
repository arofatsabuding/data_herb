'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';

const isActive = (pathname, n) =>
  n.href === '/' ? pathname === '/' : [n.href, ...(n.also || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

const BASE = 'relative rounded-full px-3 py-2 transition-colors duration-300';
const IDLE = 'text-gray-300 hover:bg-white/10 hover:text-white';
// เมนูที่เปิดอยู่: พื้นเขียวไล่สี + ตัวหนา + จุดใต้เมนู
const ACTIVE =
  'bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-md shadow-emerald-500/30 after:absolute after:-bottom-1.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-emerald-300';

// เมนูด้านบน — ไฮไลต์เมนูของหน้าที่กำลังเปิด (รวมหน้าย่อย เช่น /drug/… อยู่ใต้ "ข้อมูลยา")
export default function NavLinks() {
  const pathname = usePathname() || '/';
  return NAV.map((n) => {
    const active = isActive(pathname, n);
    return (
      <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={`${BASE} ${active ? ACTIVE : IDLE}`}>
        {n.label}
      </Link>
    );
  });
}
