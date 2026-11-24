import Link from 'next/link';
import LoginRequired from '@/components/LoginRequired';
import TargetForm from '@/components/TargetForm';
import TargetTable from '@/components/TargetTable';
import { allowed, currentUser } from '@/lib/auth';
import { getAreaOptions, kpiAvailable } from '@/lib/kpi';
import { approvedTargets, listMyTargets, targetYear } from '@/lib/targets';
import { saveTarget } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ค่าเป้าหมาย — HERB Center' };

// กรอกค่าเป้าหมายมูลค่ายาสมุนไพรของเขตสุขภาพ / จังหวัด / อำเภอ / หน่วยบริการ (ต้องเข้าสู่ระบบด้วย ThaiD) → ผู้ดูแลอนุมัติที่หน้า /admin
export default async function TargetsPage() {
  const user = await currentUser();
  if (!allowed(user, 'targets')) return <LoginRequired next="/targets" title="กำหนดค่าเป้าหมาย (เข้าสู่ระบบด้วย ThaiD)" user={user} />;

  const year = targetYear();
  const mine = listMyTargets(user.id);
  const approved = year ? approvedTargets(year) : [];
  const { zones, provinces, districts } = kpiAvailable() ? getAreaOptions() : { zones: [], provinces: [], districts: [] };
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-gray-800">กำหนดค่าเป้าหมายมูลค่ายาสมุนไพร</h1>
        <p className="text-sm text-gray-600">
          เลือกระดับ (หน่วยบริการ / อำเภอ / จังหวัด / เขตสุขภาพ — แต่ละพื้นที่มีค่าเป้าหมายของตัวเอง ไม่ได้รวมจากระดับล่าง) แล้วกรอกเป้าหมายมูลค่ายาสมุนไพรในสิทธิ UC (บาท) แบบยอดสะสมตั้งแต่ 1 ต.ค. ของรอบ 3 / 6 / 12 เดือน
          เมื่อบันทึกแล้วคำขอจะไปรอผู้ดูแลอนุมัติที่หน้าผู้ดูแลระบบ — ค่าที่อนุมัติล่าสุดของแต่ละพื้นที่ใช้คำนวณว่าทำได้กี่ % ของเป้าหมาย
          ในหน้า{' '}
          <Link href="/kpi" className="text-emerald-700 hover:underline">
            มูลค่ายาสมุนไพร
          </Link>{' '}
          (บันทึกซ้ำ = ส่งค่าใหม่ไปขออนุมัติแทนค่าเดิม)
        </p>
      </div>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-bold text-gray-800">ฟอร์มค่าเป้าหมาย ปีงบประมาณ {year || '-'}</h2>
        {year ? <TargetForm action={saveTarget} year={year} zones={zones} provinces={provinces} districts={districts} /> : <p className="text-sm text-gray-500">ยังไม่มีข้อมูลปีงบประมาณ</p>}
      </section>

      <TargetTable id="targets-mine" title="คำขอของฉัน" sheet="คำขอของฉัน" filename="herb_targets_mine" rows={mine} reviewer />
      <TargetTable
        id="targets-approved"
        title={`ค่าเป้าหมายที่อนุมัติแล้ว ปี ${year || '-'}`}
        sheet="อนุมัติแล้ว"
        filename={`herb_targets_${year}`}
        rows={approved}
        reviewer
        empty="ยังไม่มีค่าเป้าหมายที่อนุมัติ"
      />
    </div>
  );
}
