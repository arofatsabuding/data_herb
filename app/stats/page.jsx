import { cookies } from 'next/headers';
import Link from 'next/link';
import ExcelButton from '@/components/ExcelButton';
import KpiSummary from '@/components/KpiSummary';
import { getBreakdown, getStats } from '@/lib/drugs';
import { PREF_COOKIE, kpiAvailable, parsePrefs, resolveSets } from '@/lib/kpi';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'สรุปข้อมูล — Data Herb' };

const fmt = (n) => Number(n || 0).toLocaleString('th-TH');
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0');

function BreakdownTable({ id, title, rows, param = 'q' }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <ExcelButton tables={[{ id, name: title }]} filename={`stats_${id}`} />
      </div>
      <table id={id} className="w-full text-sm">
        <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
          <tr>
            <th className="px-6 py-2 font-semibold" data-excel={title}></th>
            <th className="px-3 py-2 text-right font-semibold">ทั้งหมด</th>
            <th className="px-6 py-2 font-semibold">มี Drug Group</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.label} className="hover:bg-emerald-50/50">
              <td className="px-6 py-2">
                <Link href={`/search?${param}=${encodeURIComponent(r.label)}`} className="hover:text-emerald-600">
                  {r.label}
                </Link>
              </td>
              <td className="px-3 py-2 text-right">{fmt(r.total)}</td>
              <td className="px-6 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                      style={{ width: `${pct(r.with_group, r.total)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">
                    {fmt(r.with_group)} ({pct(r.with_group, r.total)}%)
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function StatsPage() {
  const s = getStats();
  // ตัวชี้วัดใช้ไฟล์ตามที่ผู้ใช้คนนี้เลือกไว้ในหน้า /kpi (ไฟล์ที่ยังไม่ได้นำเข้า → ใช้ไฟล์ที่มี)
  const sets = kpiAvailable() ? resolveSets(parsePrefs((await cookies()).get(PREF_COOKIE)?.value)) : [];
  const rows = [
    ['รายการทั้งหมด', s.total],
    ['พบ TTMTID ใน Master', s.in_master],
    ['มี Drug Group', s.with_group],
    ['ไม่มี Drug Group', s.without_group],
    ...s.byUnit.map((u) => [`เบิกเป็น ${u.unit} (${u.groups} กลุ่ม)`, u.total]),
    ['จำนวน Drug Group', s.groups],
    ['จำนวนผู้ผลิต', s.manufacturers],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">สรุปข้อมูล</h1>

      {sets.length > 0 && <KpiSummary sets={sets} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-gray-800">ข้อมูลรหัสยาแผนไทย 24 หลัก</h2>
        <ExcelButton
          sheets={[{ name: 'สรุปข้อมูลยา', rows: [['รายการ', 'จำนวน', 'ร้อยละของทั้งหมด'], ...rows.map(([l, v]) => [l, v, l.startsWith('จำนวน') ? '' : Number(pct(v, s.total))])] }]}
          tables={[
            { id: 'by_type', name: 'แยกตามประเภทยา' },
            { id: 'dosage_form', name: 'รูปแบบยา' },
            { id: 'manufacturer', name: 'ผู้ผลิต' },
          ]}
          filename="stats_drugs"
          sheetsFirst
          label="ดาวน์โหลด Excel ทั้งหมด"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="card p-5">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-gray-800">{fmt(value)}</div>
            {label !== 'รายการทั้งหมด' && !label.startsWith('จำนวน') && (
              <div className="text-xs text-emerald-600">{pct(value, s.total)}% ของทั้งหมด</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownTable
          id="by_type"
          title="แยกตามประเภทยา"
          param="type"
          rows={s.byType.map((t) => ({ label: t.drug_type, total: t.total, with_group: t.with_group }))}
        />
        <BreakdownTable id="dosage_form" title="รูปแบบยา (15 อันดับแรก)" rows={getBreakdown('dosage_form')} />
        <div className="lg:col-span-2">
          <BreakdownTable id="manufacturer" title="ผู้ผลิต (15 อันดับแรก)" rows={getBreakdown('manufacturer')} />
        </div>
      </div>
    </div>
  );
}
