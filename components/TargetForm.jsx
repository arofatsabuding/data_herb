'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

const FIELDS = [
  { name: 'target_3m', label: 'เป้าหมาย 3 เดือน (บาท)', hint: '1 ต.ค. – 31 ธ.ค.' },
  { name: 'target_6m', label: 'เป้าหมาย 6 เดือน (บาท)', hint: '1 ต.ค. – 31 มี.ค.' },
  { name: 'target_12m', label: 'เป้าหมาย 12 เดือน (บาท)', hint: '1 ต.ค. – 30 ก.ย.' },
];

const LEVELS = [
  { key: 'hosp', label: 'หน่วยบริการ' },
  { key: 'district', label: 'อำเภอ' },
  { key: 'province', label: 'จังหวัด' },
  { key: 'zone', label: 'เขตสุขภาพ' },
];

// ฟอร์มกรอกค่าเป้าหมายของเขตสุขภาพ / จังหวัด / หน่วยบริการ (ตรวจค่าและสิทธิ์ที่ server อีกครั้ง)
// zones / provinces / districts = ตัวเลือกจาก getAreaOptions() [{ code, name, province? }] — อำเภอ: เลือกจังหวัดก่อน
export default function TargetForm({ action, year, zones, provinces, districts }) {
  const formRef = useRef(null);
  const [level, setLevel] = useState('hosp');
  const [prov, setProv] = useState('');
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setProv('');
    }
  }, [state]);

  const options = level === 'zone' ? zones : level === 'district' ? districts.filter((d) => d.province === prov) : provinces;
  const LABEL = { hosp: 'รหัสหน่วยบริการ (5 หลัก)', district: 'อำเภอ', province: 'จังหวัด', zone: 'เขตสุขภาพ' };
  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <fieldset className="flex flex-wrap items-center gap-2 text-sm">
        <legend className="mb-2 font-semibold text-gray-700">ระดับของค่าเป้าหมาย (ปีงบประมาณ {year})</legend>
        {LEVELS.map((l) => (
          <label
            key={l.key}
            className={`cursor-pointer rounded-xl border px-4 py-1.5 ${
              level === l.key ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <input type="radio" name="level" value={l.key} checked={level === l.key} onChange={() => setLevel(l.key)} className="sr-only" />
            {l.label}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-gray-700">{LABEL[level]}</span>
          {level === 'district' && (
            <select value={prov} onChange={(e) => setProv(e.target.value)} aria-label="จังหวัดของอำเภอ" className="input">
              <option value="">— เลือกจังหวัดก่อน —</option>
              {provinces.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          {level === 'hosp' ? (
            <input key="hosp" name="code" required inputMode="numeric" pattern="\d{5}" maxLength={5} placeholder="เช่น 11442" className="input mono" />
          ) : (
            <select key={`${level}-${prov}`} name="code" required defaultValue="" disabled={level === 'district' && !prov} className="input">
              <option value="" disabled>
                — เลือก{LABEL[level]} —
              </option>
              {options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </label>
        {FIELDS.map((f) => (
          <label key={f.name} className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-gray-700">{f.label}</span>
            <input name={f.name} required type="number" min="0" step="0.01" inputMode="decimal" className="input text-right" />
            <span className="text-xs text-gray-500">ยอดสะสม {f.hint}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary px-6 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? 'กำลังบันทึก…' : 'บันทึกค่าเป้าหมาย'}
        </button>
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      </div>
    </form>
  );
}
