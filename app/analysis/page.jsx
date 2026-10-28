import { cookies } from 'next/headers';
import Link from 'next/link';
import Change from '@/components/KpiChange';
import ExcelButton from '@/components/ExcelButton';
import LoginRequired from '@/components/LoginRequired';
import { allowed, currentUser } from '@/lib/auth';
import {
  EXCLUDED_ZONES,
  FOLLOW_UP_CATS,
  NOT_IN_GROUP,
  USAGE_CATS,
  getAreaInfo,
  getDrugUsage,
  kpiAvailable,
  parseKpiQuery,
  setsFromCookies,
  sumByYear,
  usageByManufacturer,
} from '@/lib/kpi';
import kpiLib from '@/scripts/kpi-lib';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'วิเคราะห์รหัสยา — HERB Center' };

const num = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const pct = (part, whole) =>
  whole ? `${((Number(part || 0) / whole) * 100).toLocaleString('th-TH', { maximumFractionDigits: 1 })}%` : '-';

// แสดงบนหน้าไม่เกินนี้ — ทั้งหมดอยู่ใน Excel
const LIMIT = 200;
const MAKER_LIMIT = 50;

const TONE = {
  amber: { card: 'border-amber-300 bg-amber-50', on: 'ring-2 ring-amber-400', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800' },
  violet: { card: 'border-violet-300 bg-violet-50', on: 'ring-2 ring-violet-400', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-800' },
  rose: { card: 'border-rose-300 bg-rose-50', on: 'ring-2 ring-rose-400', text: 'text-rose-800', badge: 'bg-rose-100 text-rose-700' },
  emerald: { card: 'border-emerald-300 bg-emerald-50', on: 'ring-2 ring-emerald-400', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
  gray: { card: 'border-gray-300 bg-gray-50', on: 'ring-2 ring-gray-400', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-600' },
};

// แท็บ: ต้องติดตาม (ค่าเริ่มต้น) / ทั้งหมด / แต่ละกลุ่ม
const TABS = { follow: 'ต้องติดตาม (ทุกกลุ่มที่ข้อมูลไม่ครบ)', all: 'ทั้งหมด', ...Object.fromEntries(Object.entries(USAGE_CATS).map(([k, c]) => [k, c.label])) };
const inTab = (tab) => (d) => (tab === 'all' ? true : tab === 'follow' ? FOLLOW_UP_CATS.includes(d.cat) : d.cat === tab);

// พารามิเตอร์พื้นที่เดียวกับหน้า /kpi (ค่าเริ่มต้น = ทั้งประเทศ)
const areaParams = (q) => Object.fromEntries(Object.entries(q).filter(([k, v]) => v && k !== 'cat'));
const href = (q, extra = {}) => `?${new URLSearchParams({ ...areaParams(q), ...extra })}`;

export default async function DrugUsagePage({ searchParams }) {
  // เมนูวิเคราะห์รหัสยา — ต้อง login
  const user = await currentUser();
  if (!allowed(user, 'analysis')) return <LoginRequired next="/analysis" title="วิเคราะห์รหัสยา" user={user} />;
  const sp = await searchParams;
  const sets = kpiAvailable() ? setsFromCookies(await cookies()) : [];
  if (!sets.length) {
    return <div className="mx-auto max-w-xl px-4 py-24 text-center text-gray-600">ยังไม่มีข้อมูลตัวชี้วัด</div>;
  }
  const { q, missing } = parseKpiQuery(sp);
  const area = missing ? null : getAreaInfo(q);
  const tab = TABS[sp.cat] ? sp.cat : 'follow';
  const years = sets.map((s) => s.year);
  const curYear = years[years.length - 1];
  const prevYear = years.length > 1 ? years[years.length - 2] : null;

  // ไฟล์ปีไหนยังเป็นข้อมูลของปีอื่น (opendata ยังไม่มีปีนั้น)
  const stale = sets
    .map((s) => ({ year: s.year, fetchYear: kpiLib.listFiles(s.year).find((f) => f.name === s.file)?.fetchYear }))
    .filter((s) => s.fetchYear && s.fetchYear !== s.year);

  const usage = area ? getDrugUsage(q, sets) : null;
  const rows = usage ? usage.items.filter(inTab(tab)) : [];
  const makers = usage ? usageByManufacturer(usage.items, curYear) : [];
  const totalUc = usage ? Object.values(usage.cats).reduce((t, c) => t + c.vs_uc, 0) : 0;
  const xlsx = `/api/analysis/drug-usage?${new URLSearchParams({ ...areaParams(q), cat: tab })}`;

  return (
    <>
      <section className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-12">
          <div className="mb-3">
            <span className="badge border border-emerald-200 bg-emerald-100 px-4 py-1 text-sm text-emerald-700">
              วิเคราะห์รหัสยา · ปีงบประมาณ {years.join(' · ')}
            </span>
          </div>
          <h1 className="mb-1 text-3xl font-bold text-gray-800 md:text-4xl">วิเคราะห์รหัสยา</h1>
          <p className="max-w-3xl text-gray-600">
            ยาที่มีการจ่ายมากที่สุด แยกตามว่า <b>เข้าเกณฑ์ตัวชี้วัด</b> และ <b>มี Drug Group</b> หรือไม่ พร้อมชื่อผู้ผลิต —
            ให้ส่วนกลางติดต่อผู้ผลิตปรับปรุงข้อมูล (TTMTID / Drug Group / กลุ่มยา 11 หลัก) ของยาที่ใช้มากได้ก่อน
          </p>
          {area && (
            <p className="mt-3 text-lg">
              <span className="font-semibold text-emerald-700">{area.title}</span>
              {area.subtitle && <span className="text-gray-500"> · {area.subtitle}</span>}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {stale.map((s) => (
          <div key={s.year} className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            ไฟล์ปี {s.year} ยังเป็นข้อมูลปี {s.fetchYear} จาก opendata (ยังไม่มีข้อมูลปี {s.year}) — ตัวเลขปี {s.year} จึงยังไม่ใช่ผลงานจริงของปี {s.year}
          </div>
        ))}
        {missing && <div className="card p-8 text-center text-gray-600">กรุณาเลือก{missing}</div>}
        {!missing && !area && <div className="card p-8 text-center text-gray-600">ไม่พบข้อมูลของพื้นที่ที่เลือก</div>}

        {usage && (
          <>
            {/* 4 ช่อง: ตัวชี้วัด × Drug Group + รหัสที่ไม่พบในไฟล์ 24 หลัก */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(USAGE_CATS).map(([k, c]) => {
                const t = TONE[c.tone];
                const v = usage.cats[k];
                return (
                  <Link
                    key={k}
                    href={href(q, { cat: k })}
                    className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${t.card} ${tab === k ? t.on : ''}`}
                  >
                    <div className={`text-xs font-semibold ${t.text}`}>{c.short}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-800">{c.label}</div>
                    <div className="mt-2 text-2xl font-bold text-gray-800">
                      {num(v.codes)} <span className="text-sm font-medium text-gray-500">รหัส</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      ครั้ง UC ปี {curYear}: {num(v.vs_uc)} ({pct(v.vs_uc, totalUc)})
                    </div>
                  </Link>
                );
              })}
            </div>

            <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="กลุ่มรหัสยา">
              {Object.entries(TABS).map(([k, label]) => (
                <Link
                  key={k}
                  href={href(q, { cat: k })}
                  aria-current={tab === k ? 'page' : undefined}
                  className={`rounded-full border px-3 py-1.5 transition-colors ${
                    tab === k
                      ? 'border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-emerald-50'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <DrugTable rows={rows} years={years} curYear={curYear} prevYear={prevYear} tab={tab} xlsx={xlsx} />

            <MakerTable makers={makers} curYear={curYear} xlsx={xlsx} />

            <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 text-sm text-gray-600">
              <div className="mb-1 font-semibold text-emerald-800">เกณฑ์ที่ใช้</div>
              <ul className="list-inside list-disc space-y-1">
                <li>นับตามรหัส 24 หลัก (หลังล้างอักขระ) ที่หน่วยบริการจ่ายในพื้นที่ที่เลือก เรียงตามจำนวนครั้งที่จ่ายยา UC ปี {curYear}</li>
                <li>
                  เข้าเกณฑ์ตัวชี้วัด = 11 หลักแรกพบในกลุ่มยา (herbal_drug_master_11) จึงคิดมูลค่าได้ — ไม่พบ = {NOT_IN_GROUP} (0 บาท)
                </li>
                <li>มี Drug Group = TTMTID ของรหัสนี้ในไฟล์รหัส 24 หลัก พบใน TTMT Master (สมสท.) และมี Drug_Group_Nhso (เบิก สปสช. ตามอัตรา course ได้)</li>
                <li>รหัสเดียวกันมีหลาย TTMTID ได้ — ถ้า TTMTID ใดมี Drug Group ถือว่ามี Drug Group</li>
                <li>“ต้องติดตาม” = รหัสที่อยู่ในไฟล์รหัส 24 หลักแล้ว แต่ไม่เข้าเกณฑ์ตัวชี้วัด หรือไม่มี Drug Group — รหัสที่ไม่พบในไฟล์ 24 หลักดูได้ที่หน้าตัวชี้วัด</li>
                <li>ไม่นับหน่วยบริการในเขตสุขภาพที่ {EXCLUDED_ZONES.join(', ')} และหน่วยบริการที่ไม่พบเขตสุขภาพ</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatusBadges({ d }) {
  if (!d.in24) return <span className={`badge ${TONE.gray.badge}`}>ไม่พบในไฟล์ 24 หลัก</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`badge ${d.kpi ? TONE.emerald.badge : TONE.rose.badge}`}>ตัวชี้วัด {d.kpi ? '✓' : '✗'}</span>
      <span className={`badge ${d.dg ? TONE.emerald.badge : TONE.amber.badge}`}>Drug Group {d.dg ? '✓' : '✗'}</span>
    </div>
  );
}

function DrugTable({ rows, years, curYear, prevYear, tab, xlsx }) {
  const shown = rows.slice(0, LIMIT);
  const get = (d, y, f) => d.byYear[y]?.[f] || 0;
  const sums = sumByYear(rows, ['vs_uc', 'kpi_value']);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            รายการยาที่ใช้มากที่สุด — {TABS[tab]} ({num(rows.length)} รหัส)
          </h2>
          <p className="text-xs text-gray-500">
            เรียงตามครั้งที่จ่ายยา UC ปี {curYear}
            {rows.length > LIMIT && ` · แสดง ${num(LIMIT)} รหัสแรก — ทั้งหมดอยู่ใน Excel`}
          </p>
        </div>
        <ExcelButton href={xlsx} label="ดาวน์โหลด Excel ทั้งหมด" />
      </div>
      {rows.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-gray-500">ไม่มีรหัสยาในกลุ่มนี้</div>
      ) : (
        <div className="max-h-[42rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
              <tr>
                <th className="px-3 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">รหัส 24 หลัก / ชื่อยา</th>
                <th className="px-3 py-3 font-semibold">ผู้ผลิต</th>
                <th className="px-3 py-3 font-semibold">สถานะ</th>
                <th className="px-3 py-3 font-semibold">TTMTID / Drug Group</th>
                <th className="px-3 py-3 font-semibold">กลุ่มยา (11 หลัก)</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">หน่วยบริการ {curYear}</th>
                {years.map((y) => (
                  <th key={y} className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                    ครั้ง UC {y}
                  </th>
                ))}
                {prevYear && <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">เปลี่ยนแปลง</th>}
                <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">มูลค่า {curYear}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((d, i) => (
                <tr key={d.code24} className="align-top hover:bg-emerald-50/40">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="min-w-[14rem] px-3 py-2">
                    {d.in24 ? (
                      <Link href={`/search?q=${d.code24}`} className="mono text-emerald-700 hover:underline">
                        {d.code24}
                      </Link>
                    ) : (
                      <span className="mono text-gray-700">{d.code24 || '(ว่าง)'}</span>
                    )}
                    <div className="font-semibold text-gray-800">{d.drug_name || '-'}</div>
                    {d.trade_name && d.trade_name !== d.drug_name && <div className="text-xs text-gray-500">{d.trade_name}</div>}
                  </td>
                  <td className="min-w-[10rem] px-3 py-2">
                    <div className="text-gray-800">{d.manufacturer || '-'}</div>
                    {d.registration_no && <div className="text-xs text-gray-500">ทะเบียน {d.registration_no}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadges d={d} />
                  </td>
                  <td className="min-w-[9rem] px-3 py-2">
                    <div className="mono text-xs text-gray-700">{d.ttmtids?.join(', ') || '-'}</div>
                    {d.in24 &&
                      (d.dg ? (
                        <div className="font-semibold text-emerald-700">{d.drug_groups.join(', ')}</div>
                      ) : (
                        <div className="text-xs font-semibold text-amber-700">{d.dg_reason}</div>
                      ))}
                  </td>
                  <td className="min-w-[10rem] px-3 py-2">
                    <div className={d.kpi ? 'text-gray-800' : 'text-xs font-semibold text-rose-600'}>{d.kpi ? d.full_name : NOT_IN_GROUP}</div>
                    <div className="text-xs text-gray-500">
                      <span className="mono">{d.code11 || '-'}</span>
                      {d.kpi && ` · ${num(d.price)} บาท/course`}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{num(get(d, curYear, 'hosp_count'))}</td>
                  {years.map((y) => (
                    <td key={y} className={`px-3 py-2 text-right ${y === curYear ? 'font-semibold' : ''}`}>
                      {num(get(d, y, 'vs_uc'))}
                    </td>
                  ))}
                  {prevYear && (
                    <td className="px-3 py-2 text-right">
                      <Change prev={get(d, prevYear, 'vs_uc')} cur={get(d, curYear, 'vs_uc')} />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 text-right">{num(get(d, curYear, 'kpi_value'))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t-2 border-emerald-200 bg-emerald-50 font-bold text-gray-800">
              <tr>
                <td className="px-3 py-3" colSpan={7}>
                  รวมทั้งหมด ({num(rows.length)} รหัส)
                </td>
                {years.map((y) => (
                  <td key={y} className="px-3 py-3 text-right">
                    {num(sums[y]?.vs_uc)}
                  </td>
                ))}
                {prevYear && (
                  <td className="px-3 py-3 text-right">
                    <Change prev={sums[prevYear]?.vs_uc} cur={sums[curYear]?.vs_uc} />
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700">{num(sums[curYear]?.kpi_value)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

// ผู้ผลิตที่มีรหัสยาต้องติดตามมากที่สุด — ใช้เป็นรายชื่อสำหรับติดต่อ
function MakerTable({ makers, curYear, xlsx }) {
  const shown = makers.slice(0, MAKER_LIMIT);
  const total = (f) => makers.reduce((t, m) => t + m[f], 0);
  return (
    <section className="card mt-6 overflow-hidden border border-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/60 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-amber-900">ผู้ผลิตที่ควรติดต่อปรับปรุงข้อมูล ({num(makers.length)} ราย)</h2>
          <p className="text-xs text-amber-800">
            นับเฉพาะรหัสที่ต้องติดตาม เรียงตามครั้งที่จ่ายยา UC ปี {curYear} · รหัสที่ไม่เข้าเกณฑ์ทั้ง 2 อย่างนับในทั้ง 2 คอลัมน์
            {makers.length > MAKER_LIMIT && ` · แสดง ${MAKER_LIMIT} รายแรก — ทั้งหมดอยู่ใน Excel (sheet ผู้ผลิต)`}
          </p>
        </div>
        <ExcelButton href={xlsx} tone="amber" label="ดาวน์โหลด Excel ทั้งหมด" />
      </div>
      <div className="max-h-[36rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-amber-50 text-left text-amber-900">
            <tr>
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">ผู้ผลิต</th>
              <th className="px-4 py-3 font-semibold">ยาที่ใช้มาก</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">รหัสที่ต้องติดตาม</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ไม่มี Drug Group</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ไม่เข้าเกณฑ์ตัวชี้วัด</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ครั้ง UC {curYear}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((m, i) => (
              <tr key={m.manufacturer} className="hover:bg-amber-50/40">
                <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2 font-semibold text-gray-800">{m.manufacturer}</td>
                <td className="px-4 py-2 text-gray-600">{m.top.join(', ')}</td>
                <td className="px-4 py-2 text-right">{num(m.codes)}</td>
                <td className="px-4 py-2 text-right">{num(m.kpi_nodg + m.none)}</td>
                <td className="px-4 py-2 text-right">{num(m.dg_nokpi + m.none)}</td>
                <td className="px-4 py-2 text-right font-semibold">{num(m.vs_uc)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 border-t-2 border-amber-200 bg-amber-50 font-bold text-gray-800">
            <tr>
              <td className="px-4 py-3" colSpan={3}>
                รวมทั้งหมด ({num(makers.length)} ราย)
              </td>
              <td className="px-4 py-3 text-right">{num(total('codes'))}</td>
              <td className="px-4 py-3 text-right">{num(total('kpi_nodg') + total('none'))}</td>
              <td className="px-4 py-3 text-right">{num(total('dg_nokpi') + total('none'))}</td>
              <td className="px-4 py-3 text-right">{num(total('vs_uc'))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
