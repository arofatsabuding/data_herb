// อัตรารหัสยาที่ผิดพลาด (รหัสที่ส่งมาไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก) — ใช้ในหน้า /kpi และ /stats
import Link from 'next/link';
import { rate } from '@/lib/kpi';

const num = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const pct = (v) => (v === null ? '-' : `${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

// ผลต่างร้อยละ (จุด) — ลดลง = ดีขึ้น (เขียว)
export function RateDelta({ prev, cur }) {
  if (prev === null || cur === null) return <span className="text-gray-400">-</span>;
  const d = cur - prev;
  const better = d < -0.005;
  const worse = d > 0.005;
  const color = better ? 'bg-emerald-100 text-emerald-700' : worse ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {better ? '▼' : worse ? '▲' : '•'} {d > 0 ? '+' : ''}
      {d.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} จุด
    </span>
  );
}

// แถบสีตามระดับความผิดพลาด
function RateBar({ value }) {
  const v = value ?? 0;
  const color = v >= 10 ? 'bg-rose-500' : v >= 5 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(v, 100)}%` }} />
    </div>
  );
}

const MEASURES = [
  { label: 'รายการยา (หน่วยบริการ × รหัสยา)', total: 'rows', bad: 'bad_rows', unit: 'รายการ' },
  { label: 'รหัสยา (ไม่นับซ้ำ)', total: 'codes', bad: 'bad_codes', unit: 'รหัส' },
  { label: 'ครั้งที่จ่ายยา UC', total: 'vs_uc', bad: 'bad_vs_uc', unit: 'ครั้ง' },
];

export default function KpiCodeErrors({ data, prevYear, curYear, childLabel, childHref, title = 'อัตรารหัสยาที่ผิดพลาด' }) {
  const T = (y) => data.totals[y] || {};
  const years = [prevYear, curYear].filter(Boolean);
  const childRate = (c, y) => rate(c.byYear[y]?.bad_rows, c.byYear[y]?.rows);
  const children = [...data.children].sort(
    (a, b) => (childRate(b, curYear) ?? -1) - (childRate(a, curYear) ?? -1) || String(a.key).localeCompare(String(b.key))
  );

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-500">
          รหัสยาที่ผิดพลาด = รหัสที่หน่วยบริการส่งมา (หลังล้างอักขระ) ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก
          รวมรหัสที่ว่างหรือไม่ครบหลัก · ร้อยละ = ผิดพลาด ÷ ทั้งหมด × 100
        </p>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2">
        {years.map((y) => {
          const r = rate(T(y).bad_rows, T(y).rows);
          return (
            <div key={y} className={`rounded-2xl border p-4 ${y === curYear ? 'border-rose-200 bg-rose-50/50' : 'border-gray-100 bg-gray-50'}`}>
              <div className="text-sm text-gray-500">ปี {y} · นับตามรายการยา</div>
              <div className={`text-3xl font-bold ${y === curYear ? 'text-rose-600' : 'text-gray-700'}`}>{pct(r)}</div>
              <div className="mt-1 text-sm text-gray-600">
                ทั้งหมด {num(T(y).rows)} รายการ · ผิดพลาด {num(T(y).bad_rows)} รายการ
              </div>
              {y === curYear && prevYear && (
                <div className="mt-2 text-xs text-gray-500">
                  เทียบปี {prevYear}: <RateDelta prev={rate(T(prevYear).bad_rows, T(prevYear).rows)} cur={r} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto border-t border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
            <tr>
              <th className="px-4 py-3 font-semibold">นับตาม</th>
              {years.map((y) => (
                <th key={y} className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                  ปี {y}: ผิดพลาด / ทั้งหมด
                </th>
              ))}
              {years.map((y) => (
                <th key={y} className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                  ร้อยละ {y}
                </th>
              ))}
              {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">เปลี่ยนแปลง</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MEASURES.map((m) => (
              <tr key={m.total}>
                <td className="px-4 py-3 font-semibold text-gray-700">{m.label}</td>
                {years.map((y) => (
                  <td key={y} className="whitespace-nowrap px-4 py-3 text-right text-gray-700">
                    {num(T(y)[m.bad])} / {num(T(y)[m.total])} {m.unit}
                  </td>
                ))}
                {years.map((y) => (
                  <td key={y} className={`px-4 py-3 text-right font-semibold ${y === curYear ? 'text-rose-600' : 'text-gray-700'}`}>
                    {pct(rate(T(y)[m.bad], T(y)[m.total]))}
                  </td>
                ))}
                {prevYear && (
                  <td className="px-4 py-3 text-right">
                    <RateDelta prev={rate(T(prevYear)[m.bad], T(prevYear)[m.total])} cur={rate(T(curYear)[m.bad], T(curYear)[m.total])} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {children.length > 0 && (
        <div className="max-h-[32rem] overflow-auto border-t border-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-gray-700">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">{childLabel} (นับตามรายการยา)</th>
                {years.map((y) => (
                  <th key={y} className="min-w-36 whitespace-nowrap px-4 py-3 text-right font-semibold">
                    ปี {y}
                  </th>
                ))}
                {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">เปลี่ยนแปลง</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {children.map((c, i) => {
                const href = childHref?.(c.key);
                return (
                  <tr key={c.key || '-'} className="hover:bg-emerald-50/40">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2">
                      {href ? (
                        <Link href={href} className="font-semibold text-gray-800 hover:text-emerald-600">
                          {c.label}
                        </Link>
                      ) : (
                        <span className="font-semibold text-gray-700">{c.label}</span>
                      )}
                    </td>
                    {years.map((y) => (
                      <td key={y} className="px-4 py-2 text-right">
                        <div className={y === curYear ? 'font-semibold text-gray-800' : 'text-gray-600'}>{pct(childRate(c, y))}</div>
                        <div className="text-xs text-gray-500">
                          {num(c.byYear[y]?.bad_rows)} / {num(c.byYear[y]?.rows)}
                        </div>
                        <RateBar value={childRate(c, y)} />
                      </td>
                    ))}
                    {prevYear && (
                      <td className="px-4 py-2 text-right">
                        <RateDelta prev={childRate(c, prevYear)} cur={childRate(c, curYear)} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 border-t-2 border-emerald-200 bg-emerald-50 font-bold text-gray-800">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  รวมทั้งหมด
                </td>
                {years.map((y) => (
                  <td key={y} className="px-4 py-3 text-right">
                    {pct(rate(T(y).bad_rows, T(y).rows))}
                    <div className="text-xs font-normal text-gray-500">
                      {num(T(y).bad_rows)} / {num(T(y).rows)}
                    </div>
                  </td>
                ))}
                {prevYear && (
                  <td className="px-4 py-3 text-right">
                    <RateDelta prev={rate(T(prevYear).bad_rows, T(prevYear).rows)} cur={rate(T(curYear).bad_rows, T(curYear).rows)} />
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
