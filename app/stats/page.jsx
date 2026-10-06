import Link from 'next/link';
import { getBreakdown, getStats } from '@/lib/drugs';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'สรุปข้อมูล — Data Herb' };

const fmt = (n) => Number(n || 0).toLocaleString('th-TH');
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0');

function BreakdownTable({ title, rows, param = 'q' }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-gray-100 px-6 py-4 text-lg font-bold text-gray-800">{title}</h2>
      <table className="w-full text-sm">
        <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
          <tr>
            <th className="px-6 py-2 font-semibold"></th>
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

export default function StatsPage() {
  const s = getStats();
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
          title="แยกตามประเภทยา"
          param="type"
          rows={s.byType.map((t) => ({ label: t.drug_type, total: t.total, with_group: t.with_group }))}
        />
        <BreakdownTable title="รูปแบบยา (15 อันดับแรก)" rows={getBreakdown('dosage_form')} />
        <div className="lg:col-span-2">
          <BreakdownTable title="ผู้ผลิต (15 อันดับแรก)" rows={getBreakdown('manufacturer')} />
        </div>
      </div>
    </div>
  );
}
