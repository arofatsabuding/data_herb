'use client';

import { useState } from 'react';
import ComboBox from './ComboBox';

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
            <ComboBox
              name="zone"
              value={zone}
              onChange={setZone}
              options={options.zones.map((z) => ({ value: z.code, label: z.name }))}
              placeholder="— เลือกเขต —"
              required
            />
          </label>
        )}

        {(view === 'province' || view === 'district') && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 md:w-64">
            จังหวัด
            <ComboBox
              name="province"
              value={province}
              onChange={(v) => {
                setProvince(v);
                setDistrict('');
              }}
              options={options.provinces.map((p) => ({ value: p.code, label: p.name }))}
              placeholder="— พิมพ์หรือเลือกจังหวัด —"
              required
            />
          </label>
        )}

        {view === 'district' && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 md:w-64">
            อำเภอ
            <ComboBox
              name="district"
              value={district}
              onChange={setDistrict}
              options={districts.map((d) => ({ value: d.code, label: d.name }))}
              placeholder={province ? '— พิมพ์หรือเลือกอำเภอ —' : 'เลือกจังหวัดก่อน'}
              required
              disabled={!province}
            />
          </label>
        )}

        {view !== 'hosp' && (
          <label className="flex flex-col gap-1 text-sm text-gray-600 md:w-72">
            ประเภทหน่วยบริการ
            <ComboBox
              name="type"
              defaultValue={initial.type || ''}
              options={types.map((t) => ({ value: t.code || '-', label: `${t.name} (${t.n.toLocaleString('th-TH')})` }))}
              allLabel="ทุกประเภท"
            />
          </label>
        )}

        <button type="submit" className="btn-primary md:mb-px">
          แสดงผล
        </button>
      </div>
    </form>
  );
}
