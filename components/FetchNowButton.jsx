'use client';

import { useState } from 'react';

// ปุ่มดึงรายงาน ณ ปัจจุบัน → ต้องกรอกรหัสยืนยันแล้วกดตกลง
export default function FetchNowButton({ action, disabled }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="btn-primary w-full text-sm disabled:opacity-50">
        ดึงรายงาน ณ ปัจจุบัน
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm text-gray-600">
        กรอกรหัสยืนยันเพื่อดึงข้อมูล
        <input type="password" name="code" required autoFocus autoComplete="off" className="input" />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 text-sm">
          ตกลง
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-gray-200 px-4 text-sm text-gray-600 hover:bg-gray-50"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
