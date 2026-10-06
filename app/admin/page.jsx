import AdminFiles from '@/components/AdminFiles';
import { referenceStatus } from '@/lib/scheduler';
import refs from '@/scripts/reference-files';
import { uploadReference } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ผู้ดูแล — Data Herb' };

const when = (t) =>
  new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) + ' น.';

export default function AdminPage() {
  const status = referenceStatus();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">ผู้ดูแล — ไฟล์ข้อมูลอ้างอิง</h1>
      <p className="mb-6 text-sm text-gray-600">
        อัปโหลดไฟล์ฉบับล่าสุดแทนไฟล์เดิม ระบบจะตรวจรูปแบบไฟล์ก่อน (ชื่อ sheet / หัวคอลัมน์) ถ้าไม่ถูกต้องจะยังใช้ไฟล์เดิม
        — ไฟล์ที่อัปโหลดจะถูกตั้งชื่อใหม่ตามชื่อมาตรฐานเสมอ ไม่ว่าชื่อเดิมจะเป็นอะไร
        แล้วสร้างฐานข้อมูลค้นหายาและคำนวณตัวชี้วัดใหม่ให้เอง (ประมาณ 15 วินาที ไม่ต้องปิดเซิร์ฟเวอร์)
        ไฟล์เดิมเก็บสำรองไว้ที่ <span className="mono">data/reference-archive/</span> 5 รุ่นล่าสุด
      </p>

      {status.busy ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          กำลังสร้างฐานข้อมูลใหม่: {status.running} — หน้านี้จะอัปเดตเอง
        </div>
      ) : (
        status.last && (
          <div
            className={`mb-6 rounded-2xl border px-5 py-3 text-sm ${
              status.last.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {status.last.ok
              ? `สร้างฐานข้อมูลใหม่จากไฟล์ล่าสุดเรียบร้อย (${when(status.last.finishedAt)})`
              : `สร้างฐานข้อมูลใหม่ไม่สำเร็จ: ${status.last.error} — ดูรายละเอียดใน ${status.last.log || 'logs/'}`}
          </div>
        )
      )}

      <AdminFiles files={refs.listReferences()} busy={status.busy} action={uploadReference} />
    </div>
  );
}
