'use client';

import { useState } from 'react';

const VIEW_BUTTONS = [
  { value: 'hosp', label: 'หน่วยบริการ' },
  { value: 'district', label: 'อำเภอ' },
  { value: 'province', label: 'จังหวัด' },
  { value: 'zone', label: 'เขตสุขภาพ' },
  { value: 'country', label: 'ประเทศ' },
];

// ฟอร์มเลือกรูปแบบการแสดงผล — ส่งค่าเป็น GET ไปที่ /kpi
export default function KpiFilter({ initial, options, types, defaultHosp }) {
  const [view, setView] = useState(initial.view);
  const [zone, setZone] = useState(initial.zone || '');
  const [province, setProvince] = useState(initial.province || '');
  const [district, setDistrict] = useState(initial.district || '');

  const districts = options.districts.filter((d) => d.province === province);

  return (
    <form action="/kpi" method="get" className="card p-5">
      <input type="hidden" name="view" value={view} />
      <div className="mb-2 text-sm font-semibold text-gray-700">รูปแบบการแสดงผล</div>
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="รูปแบบการแสดงผล">
        {VIEW_BUTTONS.map((b) => (
          <button
            key={b.value}
            type="button"
            role="radio"
            aria-checked={view === b.value}
            onClick={() => setView(b.value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              view === b.value
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            ภาพรวม{b.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        {view === 'hosp' && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 md:w-64">
            รหัสหน่วยบริการ 5 หลัก
            <input
              name="hosp"
              defaultValue={initial.hosp || defaultHosp}
              required
              maxLength={5}
              inputMode="numeric"
              pattern="[0-9A-Za-z]{5}"
              title="กรอกรหัสหน่วยบริการ 5 หลัก"
              className="input mono"
              placeholder={defaultHosp}
            />
          </label>
        )}

        {view === 'zone' && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 md:w-64">
            เขตสุขภาพ
            <select name="zone" value={zone} onChange={(e) => setZone(e.target.value)} required className="input">
              <option value="">— เลือกเขต —</option>
              {options.zones.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {(view === 'province' || view === 'district') && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 md:w-64">
            จังหวัด
            <select
              name="province"
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setDistrict('');
              }}
              required
              className="input"
            >
              <option value="">— เลือกจังหวัด —</option>
              {options.provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {view === 'district' && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 md:w-64">
            อำเภอ
            <select
              name="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              required
              disabled={!province}
              className="input disabled:bg-gray-100"
            >
              <option value="">{province ? '— เลือกอำเภอ —' : 'เลือกจังหวัดก่อน'}</option>
              {districts.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {view !== 'hosp' && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 md:w-72">
            ประเภทหน่วยบริการ
            <select name="type" defaultValue={initial.type || ''} className="input">
              <option value="">ทุกประเภท</option>
              {types.map((t) => (
                <option key={t.code || '-'} value={t.code || '-'}>
                  {t.name} ({t.n.toLocaleString('th-TH')})
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="submit" className="btn-primary md:mb-px">
          แสดงผล
        </button>
      </div>
    </form>
  );
}
