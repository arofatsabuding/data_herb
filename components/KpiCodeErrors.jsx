// อัตรารหัสยาที่ผิดพลาด (รหัสที่ส่งมาไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก) — ใช้ในหน้า /kpi และ /stats
import Link from 'next/link';
import ExcelButton from '@/components/ExcelButton';
import { rate, yearPairs } from '@/lib/kpi';

const num = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const pct = (v) => (v === null ? '-' : `${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

// ผลต่างของร้อยละ (แสดงเป็น %) — ลดลง = ดีขึ้น (เขียว)
export function RateDelta({ prev, cur }) {
  if (prev === null || cur === null) return <span className="text-gray-400">-</span>;
  const d = cur - prev;
  const better = d < -0.005;
  const worse = d > 0.005;
  const color = better ? 'bg-emerald-100 text-emerald-700' : worse ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {better ? '▼' : worse ? '▲' : '•'} {d > 0 ? '+' : ''}
      {d.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
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
];

export default function KpiCodeErrors({ data, years, childLabel, childHref, filename = 'code_errors', title = 'อัตรารหัสยาที่ผิดพลาด' }) {
  const T = (y) => data.totals[y] || {};
  const curYear = years[years.length - 1];
  const pairs = yearPairs(years);
  const before = (y) => years[years.indexOf(y) - 1] ?? null;
  const changeLabel = ([a, b]) => (pairs.length > 1 ? `เปลี่ยนแปลง ${a}→${b}` : 'เปลี่ยนแปลง');
  const childRate = (c, y) => rate(c.byYear[y]?.bad_rows, c.byYear[y]?.rows);
  const children = [...data.children].sort(
    (a, b) => (childRate(b, curYear) ?? -1) - (childRate(a, curYear) ?? -1) || String(a.key).localeCompare(String(b.key))
  );

  return (
    <section className="card mt-6 overflow-hidden border border-rose-200">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-red-50 px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-rose-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-sm text-white">!</span>
            {title}
          </h2>
          <p className="text-xs text-rose-800/80">
            รหัสยาที่ผิดพลาด = รหัสที่หน่วยบริการส่งมา (หลังล้างอักขระ) ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก
            รวมรหัสที่ว่างหรือไม่ครบหลัก · ร้อยละ = ผิดพลาด ÷ ทั้งหมด × 100
          </p>
        </div>
        <ExcelButton
          tone="rose"
          filename={filename}
          tables={[
            { id: 'code-errors-summary', name: 'สรุปอัตรารหัสผิด' },
            ...(children.length ? [{ id: 'code-errors-children', name: `แยกตาม${childLabel}` }] : []),
          ]}
        />
      </div>

      <div className={`grid gap-4 p-6 sm:grid-cols-2 ${years.length > 2 ? 'lg:grid-cols-3' : ''}`}>
        {years.map((y) => {
          const r = rate(T(y).bad_rows, T(y).rows);
          return (
            <div key={y} className={`rounded-2xl border p-4 ${y === curYear ? 'border-rose-300 bg-rose-50' : 'border-rose-100 bg-rose-50/30'}`}>
              <div className="text-sm text-gray-500">ปี {y} · นับตามรายการยา</div>
              <div className={`text-3xl font-bold ${y === curYear ? 'text-rose-600' : 'text-gray-700'}`}>{pct(r)}</div>
              <div className="mt-1 text-sm text-gray-600">
                ทั้งหมด {num(T(y).rows)} รายการ · ผิดพลาด {num(T(y).bad_rows)} รายการ
              </div>
              {before(y) && (
                <div className="mt-2 text-xs text-gray-500">
                  เทียบปี {before(y)}: <RateDelta prev={rate(T(before(y)).bad_rows, T(before(y)).rows)} cur={r} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto border-t border-rose-100">
        <table id="code-errors-summary" className="w-full text-sm">
          <thead className="bg-gradient-to-r from-rose-100 to-red-50 text-left text-rose-900">
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
              {pairs.map((p) => (
                <th key={p.join()} className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                  {changeLabel(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-50">
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
                {pairs.map(([a, b]) => (
                  <td key={`${a}-${b}`} className="px-4 py-3 text-right">
                    <RateDelta prev={rate(T(a)[m.bad], T(a)[m.total])} cur={rate(T(b)[m.bad], T(b)[m.total])} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {children.length > 0 && (
        <div className="max-h-[32rem] overflow-auto border-t border-rose-100">
          <table id="code-errors-children" className="w-full text-sm">
            <thead className="sticky top-0 bg-rose-50 text-left text-rose-900">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">{childLabel} (นับตามรายการยา)</th>
                {years.map((y) => (
                  <th key={y} className="min-w-36 whitespace-nowrap px-4 py-3 text-right font-semibold">
                    ปี {y}
                  </th>
                ))}
                {pairs.map((p) => (
                  <th key={p.join()} className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {changeLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50">
              {children.map((c, i) => {
                const href = childHref?.(c.key);
                return (
                  <tr key={c.key || '-'} className="hover:bg-rose-50/60">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2">
                      {href ? (
                        <Link href={href} className="font-semibold text-gray-800 hover:text-rose-600">
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
                    {pairs.map(([a, b]) => (
                      <td key={`${a}-${b}`} className="px-4 py-2 text-right">
                        <RateDelta prev={childRate(c, a)} cur={childRate(c, b)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 border-t-2 border-rose-200 bg-rose-50 font-bold text-rose-900">
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
                {pairs.map(([a, b]) => (
                  <td key={`${a}-${b}`} className="px-4 py-3 text-right">
                    <RateDelta prev={rate(T(a).bad_rows, T(a).rows)} cur={rate(T(b).bad_rows, T(b).rows)} />
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
