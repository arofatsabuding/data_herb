'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const time = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) + ' น.' : '';

function BusyText({ busy }) {
  return (
    <>
      กำลังดึงข้อมูลอยู่{busy?.by ? ` (${busy.by}` : ''}
      {busy?.startedAt ? ` เริ่ม ${time(busy.startedAt)}` : ''}
      {busy?.by ? ')' : ''} — กดดึงซ้ำไม่ได้จนกว่าจะเสร็จ
    </>
  );
}

// dropdown เลือกไฟล์ของปีนั้น — เปลี่ยนแล้วบันทึกทันที
function YearSelect({ y, action }) {
  const formRef = useRef(null);
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form ref={formRef} action={formAction} className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-gray-600">
      <input type="hidden" name="year" value={y.year} />
      <label htmlFor={`file-${y.year}`}>
        ข้อมูลปี {y.year}
        {pending && <span className="ml-2 text-xs text-emerald-600">กำลังเปลี่ยน…</span>}
      </label>
      <select
        id={`file-${y.year}`}
        name="file"
        defaultValue={y.choice}
        onChange={() => formRef.current.requestSubmit()}
        disabled={pending}
        className="input min-w-0 text-sm"
      >
        <option value="latest">ล่าสุดเสมอ — {y.latestLabel || 'ยังไม่มีไฟล์'}</option>
        {y.files.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label}
          </option>
        ))}
      </select>
      {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}

// ปุ่มดึงรายงาน ณ ปัจจุบัน → ตรวจว่ามีคนดึงอยู่ไหม → กรอกรหัสยืนยัน → ตกลง
function FetchNow({ fetching, checkAction, fetchAction }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [checking, startCheck] = useTransition();
  const [state, formAction, pending] = useActionState(fetchAction, null);

  const running = fetching || state?.busy;

  // ระหว่างมีการดึงข้อมูล รีเฟรชหน้าทุก 20 วินาที เพื่ออัปเดตสถานะและข้อมูลใหม่
  useEffect(() => {
    if (!fetching) return;
    const t = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(t);
  }, [fetching, router]);

  useEffect(() => {
    if (state?.started || state?.busy) setOpen(false);
    if (state?.started) router.refresh(); // ให้สถานะ "กำลังดึง" แสดงทันที
  }, [state, router]);

  const onOpen = () =>
    startCheck(async () => {
      const r = await checkAction();
      setBusy(r.busy);
      setOpen(!r.busy);
    });

  return (
    <div className="flex flex-col gap-1 text-sm md:w-80">
      <span className="text-gray-600">ดึงรายงาน ณ ปัจจุบัน (ไม่ต้องรอ 22:00)</span>
      {open ? (
        <form action={formAction} className="flex gap-2">
          <input
            type="password"
            name="code"
            required
            autoFocus
            autoComplete="off"
            placeholder="รหัสยืนยัน"
            aria-label="รหัสยืนยัน"
            className="input min-w-0 flex-1 text-sm"
          />
          <button type="submit" disabled={pending} className="btn-primary px-4 text-sm disabled:opacity-50">
            {pending ? 'กำลังตรวจ…' : 'ตกลง'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-gray-200 px-3 text-gray-600 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          disabled={!!running || checking}
          className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? 'กำลังดึงข้อมูล…' : checking ? 'กำลังตรวจสอบ…' : 'ดึงรายงาน ณ ปัจจุบัน'}
        </button>
      )}
      {running && (
        <span className="text-xs text-amber-700">
          <BusyText busy={fetching || state.busy} />
        </span>
      )}
      {!running && busy && (
        <span className="text-xs text-amber-700">
          <BusyText busy={busy} />
        </span>
      )}
      {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
      {state?.started && !fetching && (
        <span className="text-xs text-emerald-700">เริ่มดึงข้อมูลแล้ว (ประมาณ 4–10 นาที) หน้านี้จะอัปเดตเอง</span>
      )}
    </div>
  );
}

export default function KpiDataBar({ years, fetching, roundText, selectAction, checkAction, fetchAction }) {
  return (
    <div className="card mb-6 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          {years.map((y) => (
            <YearSelect key={`${y.year}:${y.choice}`} y={y} action={selectAction} />
          ))}
        </div>
        <FetchNow fetching={fetching} checkAction={checkAction} fetchAction={fetchAction} />
      </div>
      {roundText && <div className="mt-3 text-xs text-gray-500">{roundText}</div>}
    </div>
  );
}
