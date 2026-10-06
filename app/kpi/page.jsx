import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon } from '@/components/Icons';
import {
  KPI_NAME,
  getKpiReport,
  getKpiYears,
  getOfficeTypes,
  getTopDrugGroups,
  kpiAvailable,
} from '@/lib/kpi';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ติดตามตัวชี้วัด — Data Herb' };

const baht = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const num = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const million = (n) => (Number(n || 0) / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 });

function formatDateCom(s) {
  if (!s || s.length < 8) return '-';
  const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`);
  return d.toLocaleDateString('th-TH', { dateStyle: 'long' });
}

function kpiHref(base, extra = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...extra })) if (v) sp.set(k, v);
  return `/kpi?${sp}`;
}

function StatCard({ label, value, unit, note, accent }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${accent || 'text-gray-800'}`}>
        {value} <span className="text-base font-medium text-gray-500">{unit}</span>
      </div>
      {note && <div className="mt-1 text-xs text-gray-500">{note}</div>}
    </div>
  );
}

function ShareBar({ value, max }) {
  const pct = max ? Math.max((value / max) * 100, value > 0 ? 1 : 0) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="mb-3 text-2xl font-bold text-gray-800">ยังไม่มีข้อมูลตัวชี้วัด</h1>
      <p className="text-gray-600">
        รัน <code className="mono rounded bg-gray-100 px-2 py-1">npm run import:kpi</code> เพื่อนำเข้าข้อมูล
      </p>
    </div>
  );
}

export default async function KpiPage({ searchParams }) {
  if (!kpiAvailable()) return <EmptyState />;
  const sp = await searchParams;
  const years = getKpiYears();
  if (!years.length) return <EmptyState />;

  const year = Number(sp.year) || years[0].year;
  const yearInfo = years.find((y) => y.year === year);
  if (!yearInfo) notFound();

  const scope = { zone: sp.zone, province: sp.province, district: sp.district, hosp: sp.hosp, type: sp.type };
  const report = getKpiReport({ year, ...scope });
  if (!report) notFound();
  const types = getOfficeTypes(year);
  const base = { year: String(year), type: sp.type };
  const t = report.total;
  const parent = report.crumbs.length > 1 ? report.crumbs[report.crumbs.length - 2] : null;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-teal-900/20" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-14">
          <span className="badge mb-4 border border-emerald-500/30 bg-emerald-500/20 px-4 py-1 text-sm text-emerald-300">
            ติดตามตัวชี้วัด · ปีงบประมาณ {year}
          </span>
          <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">{KPI_NAME}</h1>
          <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-300" aria-label="ระดับ">
            {report.crumbs.map((c, i) => (
              <span key={c.level} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-500">›</span>}
                {i === report.crumbs.length - 1 ? (
                  <span className="font-semibold text-emerald-300">{c.label}</span>
                ) : (
                  <Link href={kpiHref(base, c.params)} className="hover:text-white hover:underline">
                    {c.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
              {baht(t.kpi_value)}
            </span>
            <span className="pb-2 text-xl text-gray-300">บาท</span>
            <span className="pb-2 text-sm text-gray-400">({million(t.kpi_value)} ล้านบาท)</span>
          </div>

          {/* ตัวเลือกปี / ประเภทหน่วยบริการ */}
          <form action="/kpi" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
            {['zone', 'province', 'district', 'hosp'].map((k) =>
              sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null
            )}
            <select name="year" defaultValue={year} className="input sm:w-48">
              {years.map((y) => (
                <option key={y.year} value={y.year}>
                  ปีงบประมาณ {y.year}
                </option>
              ))}
            </select>
            {report.level !== 'hosp' && (
              <select name="type" defaultValue={sp.type || ''} className="input sm:w-80">
                <option value="">ทุกประเภทหน่วยบริการ</option>
                {types.map((ty) => (
                  <option key={ty.code || '-'} value={ty.code || '-'}>
                    {ty.name} ({num(ty.n)})
                  </option>
                ))}
              </select>
            )}
            <button type="submit" className="btn-primary">
              แสดงผล
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {parent && (
          <Link
            href={kpiHref(base, parent.params)}
            className="mb-6 inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            กลับไประดับ{parent.label}
          </Link>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={KPI_NAME} value={baht(t.kpi_value)} unit="บาท" accent="text-emerald-600" note="ครั้ง UC × ราคาต่อ course" />
          <StatCard
            label="จำนวนครั้งที่จ่ายยา (UC)"
            value={num(t.matched_vs_uc)}
            unit="ครั้ง"
            note={`เฉพาะกลุ่มที่คิดตัวชี้วัด · ทั้งหมด ${num(t.vs_uc)} ครั้ง`}
          />
          <StatCard
            label={report.level === 'hosp' ? 'ประเภทหน่วยบริการ' : 'หน่วยบริการที่ส่งข้อมูล'}
            value={report.level === 'hosp' ? report.hosp.type_name || 'ไม่ระบุ' : num(t.hosp_count)}
            unit={report.level === 'hosp' ? '' : 'แห่ง'}
            note={report.level === 'hosp' ? `รหัส ${report.hosp.hospcode} · อ.${report.hosp.district || '-'} จ.${report.hosp.province || '-'}` : null}
          />
          <StatCard
            label="มูลค่าตามที่หน่วยบริการรายงาน (pri_uc)"
            value={baht(t.pri_uc)}
            unit="บาท"
            note="ข้อมูลอ้างอิง ไม่ใช่ค่าตัวชี้วัด"
          />
        </div>

        {report.level === 'hosp' ? (
          <HospDrugs drugs={report.drugs} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <ChildrenTable report={report} base={base} />
            <TopGroups items={getTopDrugGroups({ year, ...scope })} />
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 text-sm text-gray-600">
          <div className="mb-1 font-semibold text-emerald-800">วิธีคำนวณ</div>
          <ul className="list-inside list-disc space-y-1">
            <li>ล้างรหัส didstd ให้เหลือแต่ตัวเลข แล้วใช้ 11 หลักแรกหากลุ่มยาใน herbal_drug_master_11</li>
            <li>มูลค่าตัวชี้วัด = จำนวนครั้ง UC (vs_uc) × ราคาต่อ course ของกลุ่มยา — รหัสที่ไม่อยู่ในกลุ่มคิดเป็น 0 บาท</li>
            <li>
              แหล่งข้อมูล: {yearInfo.file} · {num(yearInfo.rows)} แถว · ข้อมูลล่าสุด {formatDateCom(yearInfo.max_date_com)}
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

function ChildrenTable({ report, base }) {
  const max = Math.max(...report.children.map((c) => c.kpi_value), 0);
  const hospLevel = report.childLevel === 'hosp';
  return (
    <section className="card overflow-hidden lg:col-span-2">
      <h2 className="border-b border-gray-100 px-6 py-4 text-lg font-bold text-gray-800">
        แยกตาม{report.childLabel} ({report.children.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
            <tr>
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">{report.childLabel}</th>
              {!hospLevel && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">หน่วยบริการ</th>}
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ครั้ง UC</th>
              <th className="min-w-48 px-4 py-3 font-semibold">มูลค่าตัวชี้วัด (บาท)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.children.map((c, i) => {
              const crumb = report.crumbs[report.crumbs.length - 1].params;
              const params = { ...crumb, [report.childLevel]: c.key ?? '-' };
              return (
                <tr key={c.key ?? '-'} className="hover:bg-emerald-50/50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={kpiHref(base, params)} className="font-semibold text-gray-800 hover:text-emerald-600">
                      {c.label}
                    </Link>
                    {hospLevel && (
                      <div className="text-xs text-gray-500">
                        <span className="mono">{c.key}</span> · {c.type_name || 'ไม่ระบุประเภท'}
                      </div>
                    )}
                  </td>
                  {!hospLevel && <td className="px-4 py-3 text-right">{num(c.hosp_count)}</td>}
                  <td className="px-4 py-3 text-right">{num(c.matched_vs_uc)}</td>
                  <td className="px-4 py-3">
                    <div className="mb-1 font-semibold text-gray-800">{baht(c.kpi_value)}</div>
                    <ShareBar value={c.kpi_value} max={max} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TopGroups({ items }) {
  const max = Math.max(...items.map((d) => d.kpi_value), 0);
  return (
    <section className="card p-6">
      <h2 className="mb-4 text-lg font-bold text-gray-800">10 กลุ่มยามูลค่าสูงสุด</h2>
      <ol className="space-y-4">
        {items.map((d, i) => (
          <li key={d.code11}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-gray-800">
                {i + 1}. {d.full_name}
              </span>
              <span className="whitespace-nowrap text-emerald-700">{million(d.kpi_value)} ล้าน</span>
            </div>
            <ShareBar value={d.kpi_value} max={max} />
            <div className="mt-1 text-xs text-gray-500">
              <span className="mono">{d.code11}</span> · {num(d.vs_uc)} ครั้ง × {num(d.price)} บาท
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HospDrugs({ drugs }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-gray-100 px-6 py-4 text-lg font-bold text-gray-800">
        รายการยาที่จ่าย ({drugs.length} กลุ่ม)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
            <tr>
              <th className="px-4 py-3 font-semibold">กลุ่มยา (11 หลัก)</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">รายการ</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ครั้ง UC</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ราคา/course</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">มูลค่าตัวชี้วัด (บาท)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {drugs.map((d) => (
              <tr key={`${d.code11}-${d.price}`} className={d.price === null ? 'bg-gray-50 text-gray-500' : 'hover:bg-emerald-50/50'}>
                <td className="px-4 py-3">
                  <div className="font-semibold">{d.full_name || 'ไม่อยู่ในกลุ่มที่คิดตัวชี้วัด'}</div>
                  <div className="mono text-xs text-gray-500">{d.code11 || (d.dids || '').split(',')[0] || '-'}</div>
                </td>
                <td className="px-4 py-3 text-right">{num(d.items)}</td>
                <td className="px-4 py-3 text-right">{num(d.vs_uc)}</td>
                <td className="px-4 py-3 text-right">{d.price === null ? '-' : num(d.price)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{baht(d.kpi_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
