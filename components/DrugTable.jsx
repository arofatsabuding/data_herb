import Link from 'next/link';
import { GroupBadge, TypeBadge } from './Badges';

export default function DrugTable({ rows }) {
  if (!rows.length) {
    return <div className="card p-10 text-center text-gray-500">ไม่พบรายการที่ตรงกับเงื่อนไข</div>;
  }

  return (
    <div className="card overflow-hidden">
      {/* ตาราง (จอใหญ่) */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
            <tr>
              <th className="px-4 py-3 font-semibold">ชื่อยา</th>
              <th className="px-4 py-3 font-semibold">ประเภท</th>
              <th className="px-4 py-3 font-semibold">รหัส 24 หลัก</th>
              <th className="px-4 py-3 font-semibold">TTMTID</th>
              <th className="px-4 py-3 font-semibold">Drug Group</th>
              <th className="px-4 py-3 font-semibold">ผู้ผลิต</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((d) => (
              <tr key={d.id} className="transition-colors hover:bg-emerald-50/50">
                <td className="px-4 py-3">
                  <Link href={`/drug/${d.id}`} className="font-semibold text-gray-800 hover:text-emerald-600">
                    {d.drug_name}
                  </Link>
                  <div className="text-xs text-gray-500">
                    {[d.dosage_form, d.strength !== 'ไม่ทราบความแรง' && d.strength, d.pack_size]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={d.drug_type} />
                </td>
                <td className="mono px-4 py-3 text-gray-700">{d.code24}</td>
                <td className="mono px-4 py-3 text-gray-700">{d.ttmtid}</td>
                <td className="px-4 py-3">
                  <GroupBadge drug={d} />
                </td>
                <td className="max-w-xs px-4 py-3 text-gray-600">{d.manufacturer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* การ์ด (มือถือ/แท็บเล็ต) */}
      <ul className="divide-y divide-gray-100 lg:hidden">
        {rows.map((d) => (
          <li key={d.id}>
            <Link href={`/drug/${d.id}`} className="block p-4 transition-colors hover:bg-emerald-50/50">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-800">{d.drug_name}</span>
                <TypeBadge type={d.drug_type} />
              </div>
              <div className="mb-2 text-xs text-gray-500">
                {d.dosage_form} · {d.manufacturer}
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <span className="text-gray-500">24 หลัก</span>
                <span className="mono break-all">{d.code24}</span>
                <span className="text-gray-500">TTMTID</span>
                <span className="mono">{d.ttmtid}</span>
                <span className="text-gray-500">Drug Group</span>
                <span>
                  {d.has_drug_group ? (
                    <span className="badge bg-emerald-100 text-emerald-700">{d.drug_group}</span>
                  ) : (
                    <span className="badge bg-gray-100 text-gray-500">ไม่มี Drug Group</span>
                  )}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
