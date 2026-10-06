// สรุปตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" ภาพรวมประเทศ — ใช้ในหน้า /stats
import Link from 'next/link';
import ExcelButton from '@/components/ExcelButton';
import Change from '@/components/KpiChange';
import { RateDelta } from '@/components/KpiCodeErrors';
import { EXCLUDED_ZONES, KPI_NAME, NOT_IN_GROUP, getCodeErrors, getCompareReport, rate } from '@/lib/kpi';

const num = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const pct = (v) => (v === null ? '-' : `${v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

function Card({ label, value, unit, sub }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-800">
        {value} {unit && <span className="text-base font-medium text-gray-500">{unit}</span>}
      </div>
      {sub && <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export default function KpiSummary({ sets }) {
  const q = { view: 'country', type: '' };
  const report = getCompareReport(q, sets);
  if (!report) return null;
  const errors = getCodeErrors(q, sets);
  const years = sets.map((s) => s.year);
  const [prevYear, curYear] = years.length === 2 ? years : [null, years[0]];
  const T = (y) => report.totals[y] || {};
  const E = (y) => errors.totals[y] || {};
  const errRate = (y) => rate(E(y).bad_rows, E(y).rows);
  const val = (c, y) => c.byYear[y]?.kpi_value || 0;
  const zoneErr = new Map(errors.children.map((c) => [c.key, c]));
  const zones = [...report.children].sort((a, b) => Number(a.key) - Number(b.key));
  const top = [...report.topGroups].sort((a, b) => val(b, curYear) - val(a, curYear)).slice(0, 5);
  const notFoundValue = (y) => (T(y).vs_uc || 0) - (T(y).matched_vs_uc || 0);
  const years2 = [prevYear, curYear].filter(Boolean);
  const groupSheet = [
    ['อันดับ', 'กลุ่มยา 11 หลัก', 'ชื่อกลุ่มยา', ...years2.map((y) => `มูลค่า ${y} (บาท)`)],
    ...[...report.topGroups]
      .sort((a, b) => val(b, curYear) - val(a, curYear))
      .map((d, i) => [i + 1, d.code11, d.full_name, ...years2.map((y) => val(d, y))]),
  ];

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">ตัวชี้วัด: {KPI_NAME}</h2>
          <p className="text-sm text-gray-500">
            ภาพรวมประเทศ {prevYear ? `เทียบปีงบประมาณ ${prevYear} กับ ${curYear}` : `ปีงบประมาณ ${curYear}`} · ไม่รวมเขตสุขภาพที่{' '}
            {EXCLUDED_ZONES.join(', ')} และหน่วยบริการที่ไม่พบเขตสุขภาพ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelButton
            tables={[{ id: 'kpi-summary-zones', name: 'แยกตามเขตสุขภาพ' }]}
            sheets={[{ name: 'กลุ่มยา', rows: groupSheet }]}
            filename="kpi_summary_country"
          />
          <Link href="/kpi" className="btn-ghost">
            ดูรายละเอียดตัวชี้วัด →
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prevYear && <Card label={`มูลค่าตัวชี้วัด ปี ${prevYear}`} value={num(T(prevYear).kpi_value)} unit="บาท" />}
        <Card
          label={`มูลค่าตัวชี้วัด ปี ${curYear}`}
          value={num(T(curYear).kpi_value)}
          unit="บาท"
          sub={prevYear && <Change prev={T(prevYear).kpi_value} cur={T(curYear).kpi_value} />}
        />
        <Card
          label={`หน่วยบริการที่จ่ายยาสมุนไพร ปี ${curYear}`}
          value={num(T(curYear).hosp_count)}
          unit="แห่ง"
          sub={
            prevYear && (
              <>
                ปี {prevYear}: {num(T(prevYear).hosp_count)} <Change prev={T(prevYear).hosp_count} cur={T(curYear).hosp_count} />
              </>
            )
          }
        />
        <Card
          label={`ครั้งที่จ่ายยา UC (กลุ่มที่คิดตัวชี้วัด) ปี ${curYear}`}
          value={num(T(curYear).matched_vs_uc)}
          unit="ครั้ง"
          sub={
            prevYear && (
              <>
                ปี {prevYear}: {num(T(prevYear).matched_vs_uc)}{' '}
                <Change prev={T(prevYear).matched_vs_uc} cur={T(curYear).matched_vs_uc} />
              </>
            )
          }
        />
        <Card
          label={`ครั้ง UC ที่${NOT_IN_GROUP} ปี ${curYear}`}
          value={num(notFoundValue(curYear))}
          unit="ครั้ง"
          sub={`ไม่นำมาคิดมูลค่า · ${pct(rate(notFoundValue(curYear), T(curYear).vs_uc))} ของครั้ง UC ทั้งหมด`}
        />
        <Card
          label={`อัตรารหัสยาที่ผิดพลาด ปี ${curYear}`}
          value={pct(errRate(curYear))}
          sub={
            <>
              ผิดพลาด {num(E(curYear).bad_rows)} จาก {num(E(curYear).rows)} รายการ
              {prevYear && (
                <>
                  {' '}
                  · ปี {prevYear}: {pct(errRate(prevYear))} <RateDelta prev={errRate(prevYear)} cur={errRate(curYear)} />
                </>
              )}
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <h3 className="border-b border-gray-100 px-6 py-4 text-lg font-bold text-gray-800">แยกตามเขตสุขภาพ</h3>
          <div className="overflow-x-auto">
            <table id="kpi-summary-zones" className="w-full text-sm">
              <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
                <tr>
                  <th className="px-4 py-3 font-semibold">เขตสุขภาพ</th>
                  {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ปี {prevYear} (บาท)</th>}
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ปี {curYear} (บาท)</th>
                  {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">เปลี่ยนแปลง</th>}
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">รหัสผิดพลาด {curYear}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zones.map((z) => {
                  const e = zoneErr.get(z.key)?.byYear[curYear];
                  return (
                    <tr key={z.key} className="hover:bg-emerald-50/50">
                      <td className="px-4 py-2">
                        <Link href={`/kpi?view=zone&zone=${z.key}`} className="font-semibold text-gray-800 hover:text-emerald-600">
                          {z.label}
                        </Link>
                      </td>
                      {prevYear && <td className="px-4 py-2 text-right text-gray-600">{num(val(z, prevYear))}</td>}
                      <td className="px-4 py-2 text-right font-semibold text-gray-800">{num(val(z, curYear))}</td>
                      {prevYear && (
                        <td className="px-4 py-2 text-right">
                          <Change prev={val(z, prevYear)} cur={val(z, curYear)} />
                        </td>
                      )}
                      <td className="px-4 py-2 text-right text-gray-700">{pct(rate(e?.bad_rows, e?.rows))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-emerald-200 bg-emerald-50/70 font-bold text-gray-800">
                <tr>
                  <td className="px-4 py-3">รวมทั้งหมด</td>
                  {prevYear && <td className="px-4 py-3 text-right">{num(T(prevYear).kpi_value)}</td>}
                  <td className="px-4 py-3 text-right text-emerald-700">{num(T(curYear).kpi_value)}</td>
                  {prevYear && (
                    <td className="px-4 py-3 text-right">
                      <Change prev={T(prevYear).kpi_value} cur={T(curYear).kpi_value} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">{pct(errRate(curYear))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="mb-4 text-lg font-bold text-gray-800">5 กลุ่มยามูลค่าสูงสุด ปี {curYear}</h3>
          <ol className="space-y-3 text-sm">
            {top.map((d, i) => (
              <li key={d.code11}>
                <div className="font-semibold text-gray-800">
                  {i + 1}. {d.full_name}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="text-emerald-700">{num(val(d, curYear))} บาท</span>
                  {prevYear && <Change prev={val(d, prevYear)} cur={val(d, curYear)} />}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        ไฟล์ข้อมูลที่ใช้ (ตามที่เลือกไว้ในหน้าตัวชี้วัด):{' '}
        {sets.map((s) => `ปี ${s.year}: ${s.file}`).join(' · ')}
      </p>
    </section>
  );
}
