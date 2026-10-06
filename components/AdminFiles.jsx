'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const size = (n) => (n === null ? '-' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
const when = (t) =>
  t ? new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) + ' น.' : '-';

// ฟอร์มอัปโหลดของไฟล์ 1 รายการ — รหัสผู้ดูแลรับมาจากช่องด้านบน (กรอกครั้งเดียวใช้ได้ทุกไฟล์)
function UploadForm({ f, code, action }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="key" value={f.key} />
      <input type="hidden" name="code" value={code} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="file"
          name="file"
          required
          accept={f.exts.join(',')}
          aria-label={`ไฟล์ใหม่สำหรับ ${f.title}`}
          className="min-w-0 flex-1 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-emerald-700"
        />
        <button
          type="submit"
          disabled={pending || !code}
          className="btn-primary px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'กำลังตรวจไฟล์…' : 'อัปโหลดแทนไฟล์เดิม'}
        </button>
      </div>
      {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
      {state?.ok && <span className="text-xs text-emerald-700">{state.ok}</span>}
    </form>
  );
}

export default function AdminFiles({ files, busy, action }) {
  const router = useRouter();
  const [code, setCode] = useState('');

  // ระหว่างสร้างฐานข้อมูลใหม่ รีเฟรชทุก 5 วินาทีเพื่ออัปเดตสถานะ
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [busy, router]);

  return (
    <>
      <div className="card mb-6 flex flex-col gap-2 p-5 sm:flex-row sm:items-center">
        <label htmlFor="admin-code" className="text-sm font-semibold text-gray-700 sm:w-40">
          รหัสผู้ดูแล
        </label>
        <input
          id="admin-code"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          placeholder="กรอกก่อนอัปโหลด (ใช้ได้ทุกไฟล์ในหน้านี้)"
          className="input min-w-0 flex-1 text-sm"
        />
      </div>

      <div className="space-y-4">
        {files.map((f) => (
          <section key={f.key} className="card p-5">
            <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{f.title}</h2>
                <div className="text-xs text-gray-500">
                  ที่มา: {f.source} · ใช้กับ: {f.usedBy}
                </div>
              </div>
              <span
                className={`badge self-start whitespace-nowrap ${
                  f.target === 'herb' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {f.target === 'herb' ? 'ค้นหายา + ตัวชี้วัด' : 'ตัวชี้วัด'}
              </span>
            </div>

            <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500">ไฟล์ที่ใช้อยู่</dt>
                <dd className="mono break-all text-gray-800">
                  {f.file ? `publicfiles/${f.file}` : <span className="text-rose-600">ไม่พบไฟล์ ({f.expected})</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">ขนาด · แก้ไขล่าสุด</dt>
                <dd className="text-gray-800">
                  {size(f.size)} · {when(f.mtime)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">อัปโหลดล่าสุด</dt>
                <dd className="text-gray-800">
                  {f.history[0] ? (
                    <>
                      <span className="break-all">{f.history[0].original}</span>
                      <div className="text-xs text-gray-500">
                        {when(f.history[0].uploadedAt)} · {f.history[0].detail}
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-400">ยังไม่เคยอัปโหลดผ่านหน้านี้</span>
                  )}
                </dd>
              </div>
            </dl>

            <UploadForm f={f} code={code} action={action} />
          </section>
        ))}
      </div>
    </>
  );
}
