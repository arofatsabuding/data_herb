'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// แถบโหลดด้านบน + ป้าย "กำลังโหลด…" — แสดงตอนคลิกลิงก์หรือส่งฟอร์ม GET (ค้นหา/กรอง)
// ซ่อนเมื่อ URL เปลี่ยนเสร็จ (client navigation) หรือเมื่อหน้าใหม่โหลดขึ้นมา (full reload)
export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => setLoading(false), [pathname, searchParams]);

  useEffect(() => {
    const isPageUrl = (url) =>
      url.origin === location.origin && !url.pathname.startsWith('/api/') && url.href.split('#')[0] !== location.href.split('#')[0];

    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      if (isPageUrl(new URL(a.href, location.href))) setLoading(true);
    };
    // ฟอร์ม server action เป็น POST มีสถานะ pending ของตัวเองอยู่แล้ว — จับเฉพาะ GET
    const onSubmit = (e) => {
      const f = e.target;
      if (e.defaultPrevented || f.method?.toLowerCase() !== 'get') return;
      if (new URL(f.action, location.href).pathname.startsWith('/api/')) return;
      setLoading(true);
    };
    const onShow = () => setLoading(false); // กลับมาด้วยปุ่ม back (bfcache)

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('pageshow', onShow);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);

  // กันค้าง ถ้าการโหลดล้มเหลวโดยไม่มีอะไรเปลี่ยน
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 60000);
    return () => clearTimeout(t);
  }, [loading]);

  if (!loading) return null;
  return (
    <>
      <div className="nav-progress" role="progressbar" aria-label="กำลังโหลด" />
      <div
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg shadow-emerald-900/10 ring-1 ring-emerald-100"
        aria-live="polite"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
        กำลังโหลด…
      </div>
    </>
  );
}
