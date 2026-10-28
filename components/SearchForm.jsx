import ComboBox from './ComboBox';
import { SearchIcon } from './Icons';

// ฟอร์มค้นหาแบบ GET ธรรมดา — ชื่อยา/ผู้ผลิต/รหัสที่มาของยา พิมพ์เพื่อกรองรายการได้ (ComboBox)
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
      {/* แบบละเอียด (หน้าข้อมูลยา): จอกลางให้ช่องค้นหาเต็มแถว ตัวกรองขึ้นแถวใหม่ · จอใหญ่เรียงแถวเดียว */}
      <div className={`flex flex-col gap-3 md:flex-row ${compact ? 'md:flex-wrap lg:flex-nowrap' : ''}`}>
        <div className={`relative flex-1 ${compact ? 'md:basis-full lg:basis-0' : ''}`}>
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
            <select name="type" defaultValue={type} className="input md:flex-1 lg:flex-none lg:w-40">
              <option value="">ทุกประเภท</option>
              <option value="เดี่ยว">ยาเดี่ยว</option>
              <option value="ตำรับ">ยาตำรับ</option>
            </select>
            <select name="group" defaultValue={group} className="input md:flex-1 lg:flex-none lg:w-52">
              <option value="">ทุกสถานะ Drug Group</option>
              <option value="has">มี Drug Group</option>
              <option value="none">ไม่มี Drug Group</option>
            </select>
            <select name="unit" defaultValue={unit} className="input md:flex-1 lg:flex-none lg:w-44">
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
          <ComboBox
            name="name"
            defaultValue={name}
            options={options.names}
            allLabel={`ทุกชื่อยา (${options.names.length.toLocaleString('th-TH')})`}
            aria-label="ชื่อยา"
          />
          <ComboBox
            name="mfr"
            defaultValue={mfr}
            options={options.manufacturers}
            allLabel={`ทุกผู้ผลิต (${options.manufacturers.length.toLocaleString('th-TH')})`}
            aria-label="ผู้ผลิต"
          />
          <ComboBox
            name="src"
            defaultValue={src}
            options={options.sources}
            allLabel={`ทุกรหัสที่มาของยา (${options.sources.length.toLocaleString('th-TH')})`}
            aria-label="รหัสที่มาของยา"
          />
        </div>
      )}
    </form>
  );
}
