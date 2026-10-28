'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '@/app/login/actions';
import { NAV } from '@/lib/nav';

const Svg = ({ children, className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);
const LockIcon = (p) => (
  <Svg {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
const ChartIcon = (p) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
const CodeIcon = (p) => (
  <Svg {...p}>
    <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
  </Svg>
);
const LogoutIcon = (p) => (
  <Svg {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
  </Svg>
);

const isActive = (pathname, n) =>
  n.href === '/' ? pathname === '/' : [n.href, ...(n.also || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

// เมนูหลัก: ไฮไลต์เมนูที่เปิดอยู่ (พื้นเขียวไล่สี + จุดใต้เมนู)
const LINK = 'relative rounded-full px-3 py-2 transition-colors duration-300';
const LINK_IDLE = 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700';
const LINK_ACTIVE =
  'bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-md shadow-emerald-500/30 after:absolute after:-bottom-1.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-emerald-300';

// เมนูที่ต้อง login (เข้าสู่ระบบ / สรุป / ผู้ดูแลระบบ) = กรอบสีทอง · ผู้พัฒนา = เส้นประสีฟ้า
const CHIP = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition-colors duration-300';
const CHIP_TONE = {
  gold: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-400 hover:text-amber-950',
  goldActive: 'border-amber-400 bg-amber-400 text-amber-950 shadow-md shadow-amber-400/30',
  dev: 'border-dashed border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-500 hover:text-white',
  devActive: 'border-dashed border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/30',
};

// เมนูในหน้าต่างแฮมเบอร์เกอร์ (จอเล็ก) — แถวเต็มความกว้าง แตะง่าย
const ROW = 'flex items-center gap-3 rounded-xl px-4 py-3 text-base transition-colors';
const ROW_TONE = {
  idle: 'text-gray-700 hover:bg-emerald-50',
  active: 'bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white',
  gold: 'border border-amber-200 bg-amber-50 font-semibold text-amber-800',
  goldActive: 'border border-amber-400 bg-amber-400 font-semibold text-amber-950',
  dev: 'border border-dashed border-sky-300 bg-sky-50 font-semibold text-sky-700',
  devActive: 'border border-dashed border-sky-500 bg-sky-500 font-semibold text-white',
};

// เมนูทั้งหมดของแถบด้านบน — จอใหญ่ (lg ขึ้นไป) แสดงเรียงแถว, จอเล็กยุบเป็นปุ่มแฮมเบอร์เกอร์
// สถานะ login อ่านจาก /api/auth/me ฝั่งเบราว์เซอร์ เพื่อให้หน้าอื่นยังเป็นหน้า static ได้
export default function SiteNav() {
  const pathname = usePathname() || '/';
  const [user, setUser] = useState(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => alive && setUser(j.user))
      .catch(() => alive && setUser(null));
    setOpen(false); // เปลี่ยนหน้าแล้วปิดเมนู
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const on = (href) => pathname === href || pathname.startsWith(`${href}/`);
  const next = pathname === '/login' ? '/' : pathname;
  const auth =
    user === undefined
      ? []
      : user
        ? [
            { href: '/stats', label: 'สรุป', icon: ChartIcon, tone: 'gold' },
            user.admin && { href: '/admin', label: 'ผู้ดูแลระบบ', icon: LockIcon, tone: 'gold' },
            user.dev && { href: '/dev', label: 'ผู้พัฒนา', icon: CodeIcon, tone: 'dev' },
          ].filter(Boolean)
        : [{ href: `/login?next=${encodeURIComponent(next)}`, match: '/login', label: 'เข้าสู่ระบบ', icon: LockIcon, tone: 'gold' }];
  const toneOf = (a, map) => map[on(a.match || a.href) ? `${a.tone}Active` : a.tone];

  return (
    <>
      {/* จอใหญ่ */}
      <nav className="hidden items-center gap-1 whitespace-nowrap text-sm lg:flex" aria-label="เมนูหลัก">
        {NAV.map((n) => {
          const active = isActive(pathname, n);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={`${LINK} ${active ? LINK_ACTIVE : LINK_IDLE}`}>
              {n.label}
            </Link>
          );
        })}
        {auth.map((a) => (
          <Link key={a.href} href={a.href} aria-current={on(a.match || a.href) ? 'page' : undefined} className={`ml-1 ${CHIP} ${toneOf(a, CHIP_TONE)}`}>
            <a.icon />
            {a.label}
          </Link>
        ))}
        {user && (
          <form action={logout} className="ml-1 inline-flex">
            <button
              type="submit"
              title={`ออกจากระบบ (${user.name || ''} · ${user.roleLabel})`}
              aria-label="ออกจากระบบ"
              className="rounded-full p-2 text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
          </form>
        )}
      </nav>

      {/* จอเล็ก: ปุ่มแฮมเบอร์เกอร์ */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors lg:hidden ${
          open ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-700 hover:bg-emerald-50'
        }`}
      >
        <Svg className="h-6 w-6">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</Svg>
      </button>

      {open && (
        <>
          <div className="absolute inset-x-0 top-full z-30 h-[100dvh] bg-gray-900/20 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav
            id="mobile-menu"
            aria-label="เมนูหลัก"
            className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-5rem)] overflow-y-auto border-b border-gray-200 bg-white px-4 pb-5 pt-3 shadow-xl lg:hidden"
          >
            <div className="mx-auto max-w-7xl space-y-1">
              {NAV.map((n) => {
                const active = isActive(pathname, n);
                return (
                  <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={`${ROW} ${active ? ROW_TONE.active : ROW_TONE.idle}`}>
                    {n.label}
                  </Link>
                );
              })}
              {auth.length > 0 && <div className="my-3 border-t border-gray-100" />}
              <div className="space-y-2">
                {auth.map((a) => (
                  <Link key={a.href} href={a.href} className={`${ROW} ${toneOf(a, ROW_TONE)}`}>
                    <a.icon className="h-5 w-5" />
                    {a.label}
                  </Link>
                ))}
              </div>
              {user && (
                <form action={logout} className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-semibold text-gray-800">{user.name || 'ไม่ระบุชื่อ'}</span>
                    <span className="text-gray-500">{user.roleLabel}</span>
                  </span>
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogoutIcon />
                    ออกจากระบบ
                  </button>
                </form>
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
