import { SearchIcon } from './Icons';

// ฟอร์มค้นหาแบบ GET ธรรมดา — ทำงานได้แม้ปิด JavaScript
export default function SearchForm({ q = '', type = '', group = '', unit = '', compact = false }) {
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
    </form>
  );
}
