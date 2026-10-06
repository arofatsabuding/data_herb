import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatRate, GroupBadge, TypeBadge } from '@/components/Badges';
import DrugTable from '@/components/DrugTable';
import ExcelButton from '@/components/ExcelButton';
import { ArrowLeftIcon } from '@/components/Icons';
import { drugExportHeader, drugExportRow, getDrug, getDrugsByCode24, getSiblings } from '@/lib/drugs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const drug = getDrug((await params).id);
  return { title: drug ? `${drug.drug_name} — HERB Center` : 'ไม่พบรายการ — HERB Center' };
}

function Field({ label, value, mono }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`break-words text-gray-800 ${mono ? 'mono' : ''}`}>{value || <span className="text-gray-400">-</span>}</dd>
    </div>
  );
}

export default async function DrugPage({ params }) {
  const drug = getDrug((await params).id);
  if (!drug) notFound();
  const siblings = getSiblings(drug);
  // Excel: ยานี้ + รายการอื่นที่ใช้รหัส 24 หลักเดียวกัน (ข้อมูลครบทุกคอลัมน์)
  const sameCode = [drug, ...getDrugsByCode24(drug.code24).filter((d) => d.id !== drug.id)];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/search" className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline">
          <ArrowLeftIcon className="h-4 w-4" />
          กลับไปหน้าข้อมูลยา
        </Link>
        <ExcelButton
          filename={`drug_${drug.code24}`}
          sheets={[{ name: 'ข้อมูลยา', rows: [drugExportHeader(), ...sameCode.map(drugExportRow)] }]}
          label={sameCode.length > 1 ? `ดาวน์โหลด Excel (${sameCode.length} รายการ)` : 'ดาวน์โหลด Excel'}
        />
      </div>

      {/* หัวเรื่อง + รหัสสำคัญ */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-6 text-white shadow-lg md:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={drug.drug_type} />
            <GroupBadge drug={drug} />
          </div>
          <h1 className="mb-1 text-3xl font-bold">{drug.drug_name}</h1>
          <p className="mb-6 text-gray-300">{drug.manufacturer}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['รหัสยาแผนไทย 24 หลัก', drug.code24],
              ['TTMTID', drug.ttmtid],
              ['Drug Group (สปสช.)', drug.has_drug_group ? drug.drug_group : 'ไม่มี Drug Group'],
              ['เบิกได้ / course', formatRate(drug.reimburse_amount, drug.reimburse_unit) || 'ไม่มีอัตราเบิก'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-emerald-300">{label}</div>
                <div className={`break-all text-lg font-semibold ${/^[0-9A-Z]+$/.test(value) ? 'mono' : ''}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-2 text-lg font-bold text-emerald-800">ข้อมูลจากกรมการแพทย์แผนไทยฯ</h2>
          <dl className="divide-y divide-gray-100">
            <Field label="ชื่อยา" value={drug.drug_name} />
            <Field label="ชื่อการค้า/ชื่อเดิม" value={drug.trade_name} />
            <Field label="ประเภท" value={`ยา${drug.drug_type} (${drug.formula_type || '-'})`} />
            <Field label="รหัสตัวยาสำคัญ" value={drug.key_ingredient_code} mono />
            <Field label="ขนาดความแรง" value={drug.strength} />
            <Field label="รูปแบบยา" value={drug.dosage_form && `${drug.dosage_form} (${drug.dosage_form_code})`} />
            <Field label="ขนาดบรรจุ" value={drug.pack_size} />
            <Field label="ผู้ผลิต" value={drug.manufacturer && `${drug.manufacturer} (${drug.manufacturer_code})`} />
            <Field label="เลขทะเบียนยา" value={drug.registration_no} />
            <Field label="รหัสทำงาน" value={drug.work_code} mono />
            <Field label="รหัสที่มาของยา" value={drug.source_code} mono />
            <Field label="สรรพคุณ / ข้อบ่งใช้" value={drug.indication} />
            <Field label="สรรพคุณตามทฤษฎีแพทย์แผนไทย" value={drug.thai_theory_code} mono />
            <Field label="ครั้งที่กำหนด" value={drug.assigned_round} />
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="mb-2 text-lg font-bold text-emerald-800">ข้อมูลจาก TTMT Master (สมสท.)</h2>
          {drug.in_master ? (
            <dl className="divide-y divide-gray-100">
              <Field label="TTMTCode" value={drug.ttmtid} mono />
              <Field label="Drug Group สปสช." value={drug.drug_group || 'ไม่ระบุ'} mono />
              <Field label="อัตราเบิก / course" value={formatRate(drug.reimburse_amount, drug.reimburse_unit)} />
              <Field label="ตัวยาสำคัญ" value={drug.master_active_ingredient} />
              <Field label="ความแรง" value={drug.master_strength} />
              <Field label="รูปแบบยา" value={drug.master_dosage_form} />
              <Field label="ชื่อการค้า" value={drug.master_trade_name} />
              <Field label="ผู้ผลิต" value={drug.master_manufacturer} />
              <Field label="FSN" value={drug.master_fsn} />
              <Field label="TTMTType" value={drug.master_ttmt_type} />
              <Field label="ED" value={drug.master_ed} />
              <Field label="วันที่ปรับปรุง" value={drug.master_change_date} mono />
            </dl>
          ) : (
            <div className="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
              ไม่พบ TTMTID <span className="mono">{drug.ttmtid}</span> ใน TTMT Master
              <br />
              จึงไม่มี Drug Group
            </div>
          )}
        </section>
      </div>

      {siblings.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-gray-800">
            รายการอื่นที่ใช้รหัส 24 หลักเดียวกัน ({siblings.length})
          </h2>
          <DrugTable rows={siblings} />
        </section>
      )}
    </div>
  );
}
