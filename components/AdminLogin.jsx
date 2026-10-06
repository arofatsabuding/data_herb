'use client';

import { useActionState, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminLogin } from '@/app/admin/login-action';

// ฟอร์มกรอกรหัสเข้าหน้าผู้ดูแล
export function AdminLoginForm({ onCancel }) {
  const [state, formAction, pending] = useActionState(adminLogin, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="password"
        name="code"
        required
        autoFocus
        autoComplete="off"
        placeholder="รหัสผู้ดูแล"
        aria-label="รหัสผู้ดูแล"
        className="input"
      />
      {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-4 py-2 text-gray-600 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
        )}
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? 'กำลังตรวจ…' : 'เข้าสู่หน้าผู้ดูแล'}
        </button>
      </div>
    </form>
  );
}

// เมนู "ผู้ดูแลระบบ" ในแถบด้านบน — กดแล้วเด้งหน้าต่างให้กรอกรหัสก่อน
// (portal ไปที่ body เพราะ header ใช้ backdrop-blur ทำให้ fixed ไม่เต็มจอ)
export function AdminNavButton({ className }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        ผู้ดูแลระบบ
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div role="dialog" aria-modal="true" className="card w-full max-w-sm p-6 whitespace-normal">
              <h2 className="mb-1 text-lg font-bold text-gray-800">เข้าสู่หน้าผู้ดูแลระบบ</h2>
              <p className="mb-4 text-sm text-gray-600">กรุณากรอกรหัสผู้ดูแล</p>
              <AdminLoginForm onCancel={() => setOpen(false)} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
