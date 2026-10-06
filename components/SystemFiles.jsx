import { DownloadIcon } from './Icons';
import { downloadHref } from '@/lib/system-files';

const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
const when = (t) =>
  new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) + ' น.';

// รายการไฟล์ในระบบ พร้อมปุ่มดาวน์โหลดลงเครื่อง (หน้า /admin)
export default function SystemFiles({ groups }) {
  return (
    <section className="card mt-8 overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-800">ดาวน์โหลดไฟล์ในระบบ</h2>
        <p className="text-xs text-gray-500">ไฟล์อ้างอิงที่ใช้อยู่ ไฟล์ข้อมูลที่ดึงจาก opendata และไฟล์อ้างอิงเดิมที่ถูกแทนที่</p>
      </div>
      {groups.length === 0 && <p className="px-6 py-4 text-sm text-gray-500">ไม่มีไฟล์</p>}
      {groups.map((g) => (
        <div key={g.title} className="border-b border-gray-100 last:border-0">
          <h3 className="bg-gray-50 px-6 py-2 text-sm font-semibold text-gray-700">
            {g.title} · {g.files.length.toLocaleString('th-TH')} ไฟล์
          </h3>
          <ul className="divide-y divide-gray-100">
            {g.files.map((f) => (
              <li key={f.rel} className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mono break-all text-sm text-gray-800">{f.rel}</div>
                  <div className="text-xs text-gray-500">
                    {size(f.size)} · {when(f.mtime)}
                  </div>
                </div>
                <a href={downloadHref(f.dir, f.rel)} className="btn-ghost self-start whitespace-nowrap text-sm sm:self-auto">
                  <DownloadIcon className="h-4 w-4" />
                  ดาวน์โหลด
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
