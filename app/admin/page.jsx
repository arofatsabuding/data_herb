import Link from 'next/link';
import AdminFiles from '@/components/AdminFiles';
import LoginRequired from '@/components/LoginRequired';
import SystemFiles from '@/components/SystemFiles';
import TargetTable from '@/components/TargetTable';
import { downloadHref, listSystemFiles } from '@/lib/system-files';
import { currentUser, allowed } from '@/lib/auth';
import { referenceStatus } from '@/lib/scheduler';
import { listPendingTargets, listReviewedTargets } from '@/lib/targets';
import refs from '@/scripts/reference-files';
import { decideTarget, uploadReference } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ผู้ดูแลระบบ — HERB Center' };

const when = (t) =>
  new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) + ' น.';

export default async function AdminPage() {
  // ต้อง login ด้วย ThaiD ก่อน (สิทธิ์ขั้นต่ำตั้งที่ ACCESS.admin ใน lib/auth.js)
  const user = await currentUser();
  if (!allowed(user, 'admin')) return <LoginRequired next="/admin" title="เข้าสู่หน้าผู้ดูแลระบบ" user={user} />;

  const canApprove = allowed(user, 'approve');
  const status = referenceStatus();
  const files = refs.listReferences().map((f) => ({ ...f, href: f.file ? downloadHref('pub', f.file) : null }));
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ผู้ดูแลระบบ — ค่าเป้าหมาย (เขต / จังหวัด / อำเภอ / หน่วยบริการ)</h1>
          <p className="text-sm text-gray-600">
            คำขอที่ผู้ใช้กรอกในหน้า{' '}
            <Link href="/targets" className="text-emerald-700 hover:underline">
              ค่าเป้าหมาย
            </Link>{' '}
            — อนุมัติแล้วค่านี้ใช้แทนค่าที่เคยอนุมัติของพื้นที่เดียวกัน และนำไปคำนวณ % ของเป้าหมายในหน้ามูลค่ายาสมุนไพรทันที
            {!canApprove && ' · บัญชีของคุณดูรายการได้ แต่อนุมัติได้เฉพาะผู้ดูแลที่เข้าสู่ระบบด้วย ThaiD'}
          </p>
        </div>
        <TargetTable
          id="targets-pending"
          title="รออนุมัติ"
          sheet="รออนุมัติ"
          filename="herb_targets_pending"
          rows={listPendingTargets()}
          empty="ไม่มีคำขอที่รออนุมัติ"
          actions={canApprove ? (t) => <Decide id={t.id} /> : null}
        />
        <TargetTable
          id="targets-reviewed"
          title="พิจารณาแล้ว (ล่าสุด 100 รายการ)"
          sheet="พิจารณาแล้ว"
          filename="herb_targets_reviewed"
          rows={listReviewedTargets(100)}
          reviewer
        />
      </div>
      <h2 className="mb-1 text-xl font-bold text-gray-800">ไฟล์ข้อมูลอ้างอิง</h2>
      <p className="mb-6 text-sm text-gray-600">
        อัปโหลดไฟล์ฉบับล่าสุดแทนไฟล์เดิม ระบบจะตรวจรูปแบบไฟล์ก่อน (ชื่อ sheet / หัวคอลัมน์) ถ้าไม่ถูกต้องจะยังใช้ไฟล์เดิม
        — ไฟล์ที่อัปโหลดจะถูกตั้งชื่อใหม่ตามชื่อมาตรฐาน + วันเวลาที่อัปโหลดเสมอ ไม่ว่าชื่อเดิมจะเป็นอะไร
        แล้วสร้างฐานข้อมูลค้นหายาและคำนวณมูลค่ายาสมุนไพรใหม่ให้เอง (ประมาณ 15 วินาที ไม่ต้องปิดเซิร์ฟเวอร์)
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

// ปุ่มอนุมัติ / ไม่อนุมัติของคำขอ 1 รายการ — แยก form ละปุ่ม ส่งค่าด้วย hidden input
// (ไม่ใช้ name/value บนปุ่ม submit: server action ที่ส่งผ่าน JS ไม่ได้รับค่าของปุ่มที่กด → เคยทำให้อนุมัติกลายเป็นไม่อนุมัติ)
function Decide({ id }) {
  const form = (decision, label, cls) => (
    <form action={decideTarget}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <button type="submit" className={`rounded-lg px-3 py-1 text-xs font-semibold ${cls}`}>
        {label}
      </button>
    </form>
  );
  return (
    <div className="flex gap-2 whitespace-nowrap">
      {form('approve', 'อนุมัติ', 'bg-emerald-600 text-white hover:bg-emerald-700')}
      {form('reject', 'ไม่อนุมัติ', 'border border-rose-300 text-rose-700 hover:bg-rose-50')}
    </div>
  );
}
