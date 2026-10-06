import { SearchIcon } from './Icons';

// ฟอร์มค้นหาแบบ GET ธรรมดา — ทำงานได้แม้ปิด JavaScript
export default function SearchForm({
  q = '',
  type = '',
  group = '',
  unit = '',
  name = '',
  mfr = '',
  src = '',
  options = { names: [], manufacturers: [], sources: [] },
  compact = false,
}) {
  return (
    <form action="/search" method="get" className={compact ? 'card p-4' : ''}>
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            className="input pl-12"
            placeholder="ชื่อยา, รหัส 24 หลัก, TTMTID, ผู้ผลิต, Drug Group..."
            autoComplete="off"
          />
        </div>
        {compact && (
          <>
            <select name="type" defaultValue={type} className="input md:w-40">
              <option value="">ทุกประเภท</option>
              <option value="เดี่ยว">ยาเดี่ยว</option>
              <option value="ตำรับ">ยาตำรับ</option>
            </select>
            <select name="group" defaultValue={group} className="input md:w-52">
              <option value="">ทุกสถานะ Drug Group</option>
              <option value="has">มี Drug Group</option>
              <option value="none">ไม่มี Drug Group</option>
            </select>
            <select name="unit" defaultValue={unit} className="input md:w-44">
              <option value="">ทุกหน่วยเบิก</option>
              <option value="บาท">เบิกเป็นบาท</option>
              <option value="point">เบิกเป็น point</option>
            </select>
          </>
        )}
        <button type="submit" className="btn-primary">
          <SearchIcon className="h-5 w-5" />
          ค้นหา
        </button>
      </div>
      {compact && (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_14rem]">
          <select name="name" defaultValue={name} className="input min-w-0" aria-label="ชื่อยา">
            <option value="">ทุกชื่อยา ({options.names.length.toLocaleString('th-TH')})</option>
            {options.names.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select name="mfr" defaultValue={mfr} className="input min-w-0" aria-label="ผู้ผลิต">
            <option value="">ทุกผู้ผลิต ({options.manufacturers.length.toLocaleString('th-TH')})</option>
            {options.manufacturers.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select name="src" defaultValue={src} className="input min-w-0" aria-label="รหัสที่มาของยา">
            <option value="">ทุกรหัสที่มาของยา ({options.sources.length.toLocaleString('th-TH')})</option>
            {options.sources.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}
    </form>
  );
}
