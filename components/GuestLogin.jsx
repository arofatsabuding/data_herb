'use client';

import { useActionState, useState } from 'react';
import { guestLogin } from '@/app/login/actions';

// ปุ่มเข้าใช้ด้วยบัญชีทดสอบ (สำหรับคณะกรรมการ/ผู้ทดสอบที่ไม่สะดวกใช้ ThaiD) — กดแล้วต้องใส่รหัสก่อน
export default function GuestLogin({ next }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(guestLogin, null);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
      >
        เข้าใช้ด้วยบัญชีทดสอบ (ไม่ใช้ ThaiD)
      </button>
    );

  return (
    <form action={action} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="guest-code" className="mb-1 block text-sm font-semibold text-amber-800">
        รหัสบัญชีทดสอบ
      </label>
      <div className="flex gap-2">
        <input
          id="guest-code"
          name="code"
          type="password"
          autoComplete="off"
          autoFocus
          required
          className="input min-w-0 flex-1 bg-white"
          placeholder="ใส่รหัสที่ได้รับจากทีม"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'กำลังตรวจ…' : 'เข้าใช้'}
        </button>
      </div>
      {state?.error && <p className="mt-2 text-sm text-rose-600">{state.error}</p>}
      <p className="mt-2 text-xs text-amber-700">ดูได้เฉพาะหน้าสรุปและวิเคราะห์รหัสยา · ระบบบันทึกเวลาเข้าใช้และ IP</p>
    </form>
  );
}
