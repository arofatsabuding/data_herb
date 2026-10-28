import AdminFiles from '@/components/AdminFiles';
import LoginRequired from '@/components/LoginRequired';
import SystemFiles from '@/components/SystemFiles';
import { downloadHref, listSystemFiles } from '@/lib/system-files';
import { currentUser, allowed } from '@/lib/auth';
import { referenceStatus } from '@/lib/scheduler';
import refs from '@/scripts/reference-files';
import { uploadReference } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ผู้ดูแลระบบ — HERB Center' };

const when = (t) =>
  new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) + ' น.';

export default async function AdminPage() {
  // ต้อง login ด้วย ThaiD ก่อน (สิทธิ์ขั้นต่ำตั้งที่ ACCESS.admin ใน lib/auth.js)
  const user = await currentUser();
  if (!allowed(user, 'admin')) return <LoginRequired next="/admin" title="เข้าสู่หน้าผู้ดูแลระบบ" user={user} />;

  const status = referenceStatus();
  const files = refs.listReferences().map((f) => ({ ...f, href: f.file ? downloadHref('pub', f.file) : null }));
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">ผู้ดูแลระบบ — ไฟล์ข้อมูลอ้างอิง</h1>
      <p className="mb-6 text-sm text-gray-600">
        อัปโหลดไฟล์ฉบับล่าสุดแทนไฟล์เดิม ระบบจะตรวจรูปแบบไฟล์ก่อน (ชื่อ sheet / หัวคอลัมน์) ถ้าไม่ถูกต้องจะยังใช้ไฟล์เดิม
        — ไฟล์ที่อัปโหลดจะถูกตั้งชื่อใหม่ตามชื่อมาตรฐาน + วันเวลาที่อัปโหลดเสมอ ไม่ว่าชื่อเดิมจะเป็นอะไร
        แล้วสร้างฐานข้อมูลค้นหายาและคำนวณตัวชี้วัดใหม่ให้เอง (ประมาณ 15 วินาที ไม่ต้องปิดเซิร์ฟเวอร์)
        ทุกรุ่นเก็บไว้ในโฟลเดอร์ของแต่ละไฟล์ <span className="mono">publicfiles/&lt;ชื่อไฟล์&gt;/</span> (เหมือนโฟลเดอร์ opendata-ปี)
        ไฟล์ที่เพิ่งอัปโหลดจะเป็นรุ่นล่าสุดที่ระบบใช้ ส่วนรุ่นเดิมยังเก็บไว้และดาวน์โหลดได้ในหัวข้อไฟล์ในระบบด้านล่าง
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

      <AdminFiles files={files} busy={status.busy} action={uploadReference} />
      <SystemFiles groups={listSystemFiles()} />
    </div>
  );
}
