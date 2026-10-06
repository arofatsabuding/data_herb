import { cookies } from 'next/headers';
import Link from 'next/link';
import Change from '@/components/KpiChange';
import ExcelButton from '@/components/ExcelButton';
import KpiCodeErrors from '@/components/KpiCodeErrors';
import KpiDataBar from '@/components/KpiDataBar';
import KpiFilter from '@/components/KpiFilter';
import {
  DEFAULT_HOSPCODE,
  EXCLUDED_ZONES,
  KPI_NAME,
  NOT_IN_GROUP,
  PREF_COOKIE,
  VIEWS,
  getAreaOptions,
  getCodeErrors,
  getCompareReport,
  getDatasets,
  getOfficeTypes,
  kpiAvailable,
  parseKpiQuery,
  parsePrefs,
  resolveSets,
  sumByYear,
} from '@/lib/kpi';
import { MAX_RETRIES, cronEnabled, ensureImported, fetchInProgress } from '@/lib/scheduler';
import kpiLib from '@/scripts/kpi-lib';
import { checkFetch, fetchNow, selectFile } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ตัวชี้วัด — HERB Center' };

const num = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const million = (n) => (Number(n || 0) / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 });

function formatDateCom(s) {
  if (!s || s.length < 8) return '-';
  const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`);
  return d.toLocaleDateString('th-TH', { dateStyle: 'long' });
}

// ชื่อไฟล์ Excel ตามพื้นที่ที่เลือก เช่น kpi_province_50
const kpiFile = (q, part) => `kpi_${q.view}_${q.hosp || q.district || q.province || q.zone || 'all'}_${part}`;

function kpiHref(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return `/kpi?${sp}`;
}

function ShareBar({ value, max, tone = 'emerald' }) {
  const pct = max ? Math.max((value / max) * 100, value > 0 ? 1 : 0) : 0;
  const color = tone === 'gray' ? 'bg-gray-300' : 'bg-gradient-to-r from-emerald-500 to-teal-600';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, unit, note, accent, children }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${accent || 'text-gray-800'}`}>
        {value} {unit && <span className="text-base font-medium text-gray-500">{unit}</span>}
      </div>
      {children}
      {note && <div className="mt-1 text-xs text-gray-500">{note}</div>}
    </div>
  );
}

// ตัวเลือกไฟล์ของแต่ละปี สำหรับ dropdown
function fileLabel(f, year, imported) {
  const parts = [`${f.stamp.replace(/-/g, '/')}${f.time ? ` ${f.time} น.` : ''}`, `${num(f.rows)} แถว`];
  if (f.fetchYear && f.fetchYear !== year) parts.push(`ข้อมูลปี ${f.fetchYear} แทน`);
  if (!imported.has(f.name)) parts.push('ต้องเตรียม ~1 นาที');
  return parts.join(' · ');
}

function dataOptions(sets, prefs) {
  const imported = new Set(getDatasets().map((d) => d.file));
  return sets.map(({ year }) => {
    const files = kpiLib.listFiles(year);
    const choice = prefs[year] && files.some((f) => f.name === prefs[year]) ? prefs[year] : 'latest';
    return {
      year,
      choice,
      latestLabel: files[0] ? fileLabel(files[0], year, imported) : null,
      files: files.map((f) => ({ name: f.name, label: fileLabel(f, year, imported) })),
    };
  });
}

// สถานะการดึงอัตโนมัติรอบล่าสุด
const ROUND_STATUS = { ok: 'สำเร็จ', running: 'กำลังดึง', failed: 'ไม่สำเร็จ — รอดึงใหม่', no_report: 'ไม่มีรายงาน' };
function roundText() {
  if (!cronEnabled()) return 'ดึงข้อมูลอัตโนมัติ: ปิด (OPENDATA_CRON=off)';
  const [date, r] = Object.entries(kpiLib.readFetchStatus().rounds).sort(([a], [b]) => b.localeCompare(a))[0] || [];
  const last = date
    ? ` · รอบล่าสุด ${new Date(`${date}T12:00:00+07:00`).toLocaleDateString('th-TH', { dateStyle: 'medium' })}: ${
        ROUND_STATUS[r.status] || r.status
      } (ดึง ${r.attempts}/${MAX_RETRIES + 1} ครั้ง)`
    : '';
  return `ดึงข้อมูลอัตโนมัติทุกวัน 22:00 น. ไม่สำเร็จจะดึงใหม่อีก ${MAX_RETRIES} ครั้ง${last}`;
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
  // ไฟล์ของแต่ละปีตามที่ผู้ใช้คนนี้เลือกไว้ (cookie) — ค่าเริ่มต้น = ไฟล์ล่าสุด
  const prefs = parsePrefs((await cookies()).get(PREF_COOKIE)?.value);
  const sets = resolveSets(prefs);
  if (!sets.length) return <EmptyState />;
  // ไฟล์ที่เลือกแต่ยังไม่ได้นำเข้า → สั่งนำเข้าเบื้องหลัง ระหว่างนี้ใช้ไฟล์ล่าสุดที่มี
  for (const s of sets) if (s.pending) ensureImported(s.year, s.pending);

  // เทียบ 2 ปีล่าสุดที่มีข้อมูล (เช่น 2569 → 2570)
  const years = sets.map((s) => s.year);
  const [prevYear, curYear] = years.length === 2 ? years : [null, years[0]];

  const { q, missing } = parseKpiQuery(sp);
  const report = missing ? null : getCompareReport(q, sets);
  const codeErrors = report ? getCodeErrors(q, sets) : null;
  const options = getAreaOptions();
  const types = getOfficeTypes();

  const T = (y) => report?.totals[y] || {};
  const prev = T(prevYear);
  const cur = T(curYear);
  const diff = (cur.kpi_value || 0) - (prev.kpi_value || 0);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-teal-900/20" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-14">
          <span className="badge mb-4 border border-emerald-500/30 bg-emerald-500/20 px-4 py-1 text-sm text-emerald-300">
            ตัวชี้วัด · {VIEWS[q.view].label}
            {prevYear ? ` · เทียบปีงบประมาณ ${prevYear} กับ ${curYear}` : ` · ปีงบประมาณ ${curYear}`}
          </span>
          <h1 className="mb-1 text-3xl font-bold text-white md:text-4xl">{KPI_NAME}</h1>
          {report && (
            <p className="mb-6 text-lg text-gray-300">
              <span className="font-semibold text-emerald-300">{report.area.title}</span>
              {report.area.subtitle && <span className="text-gray-400"> · {report.area.subtitle}</span>}
            </p>
          )}

          {report && (
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
              {prevYear && (
                <>
                  <div>
                    <div className="text-sm text-gray-400">ปี {prevYear}</div>
                    <div className="text-3xl font-bold text-gray-200 md:text-4xl">
                      {num(prev.kpi_value)} <span className="text-base font-normal text-gray-400">บาท</span>
                    </div>
                  </div>
                  <div className="hidden text-3xl text-gray-500 md:block">→</div>
                </>
              )}
              <div>
                <div className="text-sm text-gray-400">ปี {curYear}</div>
                <div className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
                  {num(cur.kpi_value)} <span className="text-base font-normal text-gray-300">บาท</span>
                </div>
              </div>
              {prevYear && (
                <div>
                  <Change prev={prev.kpi_value} cur={cur.kpi_value} size="lg" />
                  <div className="mt-1 text-sm text-gray-400">
                    {diff >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} {num(Math.abs(diff))} บาท
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <KpiDataBar
          years={dataOptions(sets, prefs)}
          fetching={fetchInProgress()}
          roundText={roundText()}
          selectAction={selectFile}
          checkAction={checkFetch}
          fetchAction={fetchNow}
        />
        {sets.some((s) => s.pending) && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            กำลังเตรียมไฟล์ที่เลือก ({sets.filter((s) => s.pending).map((s) => s.pending).join(', ')}) ประมาณ 1 นาที —
            ระหว่างนี้แสดงผลจาก {sets.filter((s) => s.pending).map((s) => s.file).join(', ')} ไปก่อน รีเฟรชหน้านี้ภายหลัง
          </div>
        )}
        <div className="mb-8">
          <KpiFilter
            key={JSON.stringify(q)}
            initial={q}
            options={options}
            types={types}
            defaultHosp={DEFAULT_HOSPCODE}
          />
        </div>

        {missing && (
          <div className="card p-8 text-center text-gray-600">กรุณาเลือก{missing} แล้วกด “แสดงผล”</div>
        )}
        {!missing && !report && (
          <div className="card p-8 text-center text-gray-600">
            ไม่พบข้อมูลของ
            {q.view === 'hosp' ? (
              <>
                หน่วยบริการรหัส <span className="mono font-semibold">{q.hosp}</span>
              </>
            ) : (
              'พื้นที่ที่เลือก'
            )}{' '}
            ในปีงบประมาณ {years.join(' / ')}
            <div className="mt-1 text-sm text-gray-500">
              (หน่วยบริการในเขตสุขภาพที่ {EXCLUDED_ZONES.join(', ')} และที่ไม่พบเขตสุขภาพ ไม่นำมาคำนวณ)
            </div>
          </div>
        )}

        {report && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {prevYear && (
                <StatCard label={`มูลค่าตัวชี้วัด ปี ${prevYear}`} value={num(prev.kpi_value)} unit="บาท" note={`${million(prev.kpi_value)} ล้านบาท`} />
              )}
              <StatCard
                label={`มูลค่าตัวชี้วัด ปี ${curYear}`}
                value={num(cur.kpi_value)}
                unit="บาท"
                accent="text-emerald-600"
                note={`${million(cur.kpi_value)} ล้านบาท`}
              />
              {prevYear && (
                <StatCard
                  label="การเปลี่ยนแปลง"
                  value={`${diff >= 0 ? '+' : '−'}${num(Math.abs(diff))}`}
                  unit="บาท"
                  accent={diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                >
                  <div className="mt-1">
                    <Change prev={prev.kpi_value} cur={cur.kpi_value} />
                  </div>
                </StatCard>
              )}
              <StatCard
                label="จำนวนครั้งที่จ่ายยา UC (กลุ่มที่คิดตัวชี้วัด)"
                value={num(cur.matched_vs_uc)}
                unit="ครั้ง"
                note={
                  q.view === 'hosp'
                    ? `ปี ${curYear}`
                    : `ปี ${curYear} · หน่วยบริการ ${num(cur.hosp_count)} แห่ง`
                }
              >
                {prevYear && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    ปี {prevYear}: {num(prev.matched_vs_uc)} <Change prev={prev.matched_vs_uc} cur={cur.matched_vs_uc} />
                  </div>
                )}
              </StatCard>
            </div>

            {q.view === 'hosp' ? (
              <HospDrugs drugs={report.children.filter((d) => d.in24)} q={q} prevYear={prevYear} curYear={curYear} />
            ) : (
              <div className="grid gap-6 lg:grid-cols-3">
                <ChildrenTable report={report} q={q} prevYear={prevYear} curYear={curYear} />
                <TopGroups items={report.topGroups} q={q} prevYear={prevYear} curYear={curYear} />
              </div>
            )}

            <KpiCodeErrors
              data={codeErrors}
              prevYear={prevYear}
              curYear={curYear}
              childLabel={VIEWS[q.view].childLabel}
              childHref={(key) => childHref(q, VIEWS[q.view].child, key)}
              filename={kpiFile(q, 'code_errors')}
            />

            <NotFound24 items={report.notFound24} q={q} prevYear={prevYear} curYear={curYear} />

            {q.view === 'hosp' && report.area.hosp && <HospLinks h={report.area.hosp} />}
          </>
        )}

        <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 text-sm text-gray-600">
          <div className="mb-1 font-semibold text-emerald-800">วิธีคำนวณ</div>
          <ul className="list-inside list-disc space-y-1">
            <li>ล้างรหัส didstd ให้เหลือแต่ตัวเลข แล้วใช้ 11 หลักแรกหากลุ่มยาใน herbal_drug_master_11</li>
            <li>มูลค่าตัวชี้วัด = จำนวนครั้ง UC (vs_uc) × ราคาต่อ course ของกลุ่มยา — {NOT_IN_GROUP} คิดเป็น 0 บาท</li>
            <li>ร้อยละการเปลี่ยนแปลง = (ปีหลัง − ปีก่อน) ÷ ปีก่อน × 100</li>
            <li>
              ไม่นำมาคำนวณ: หน่วยบริการในเขตสุขภาพที่ {EXCLUDED_ZONES.join(', ')} และหน่วยบริการที่ไม่พบเขตสุขภาพ
            </li>
            <li>
              รหัส 24 หลักและรหัสที่มาของยา ตรวจกับไฟล์รหัสยาแผนไทย 24 หลัก (กรมการแพทย์แผนไทยฯ) —
              รหัสที่ไม่พบยังคิดมูลค่าตามกลุ่ม 11 หลักตามปกติ
            </li>
            <li>อัตรารหัสยาที่ผิดพลาด = จำนวนที่รหัสไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก ÷ จำนวนทั้งหมด × 100 (นับตามรายการยา รหัสยา และครั้งที่จ่าย UC)</li>
            {sets.map(({ year, dataset: f }) => (
              <li key={year}>
                ปี {year}: {f.file} · {num(f.rows)} แถว · ข้อมูลล่าสุด {formatDateCom(f.max_date_com)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

// ลิงก์ไปดูภาพรวมพื้นที่ของหน่วยบริการ
function HospLinks({ h }) {
  const links = [
    h.district_code && { label: `ภาพรวมอำเภอ${h.district}`, href: kpiHref({ view: 'district', province: h.province_code, district: h.district_code }) },
    h.province_code && { label: `ภาพรวมจังหวัด${h.province}`, href: kpiHref({ view: 'province', province: h.province_code }) },
    h.health_zone && { label: `ภาพรวมเขตสุขภาพที่ ${Number(h.health_zone)}`, href: kpiHref({ view: 'zone', zone: h.health_zone }) },
  ].filter(Boolean);
  return (
    <div className="mt-6 flex flex-wrap gap-2 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="rounded-xl border border-emerald-200 px-3 py-1.5 text-emerald-700 hover:bg-emerald-50">
          {l.label} →
        </Link>
      ))}
    </div>
  );
}

// ลิงก์เมื่อกดแถวย่อย → เปลี่ยนรูปแบบการแสดงผลเป็นระดับถัดไป
function childHref(q, child, key) {
  const type = q.type;
  if (child === 'zone') return key ? kpiHref({ view: 'zone', zone: key, type }) : null;
  if (child === 'province') return key ? kpiHref({ view: 'province', province: key, type }) : null;
  if (child === 'district') return key ? kpiHref({ view: 'district', province: q.province, district: key, type }) : null;
  return kpiHref({ view: 'hosp', hosp: key });
}

function ChildrenTable({ report, q, prevYear, curYear }) {
  const V = VIEWS[q.view];
  const val = (c, y) => c.byYear[y]?.kpi_value || 0;
  const rows = [...report.children].sort((a, b) => val(b, curYear) - val(a, curYear) || val(b, prevYear) - val(a, prevYear));
  const max = Math.max(...rows.flatMap((c) => [val(c, curYear), val(c, prevYear)]), 0);
  const hospLevel = V.child === 'hosp';
  const total = (y) => report.totals[y] || {};
  return (
    <section className="card overflow-hidden lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-800">
          แยกตาม{V.childLabel} ({rows.length})
        </h2>
        <ExcelButton tables={[{ id: 'kpi-children', name: `แยกตาม${V.childLabel}` }]} filename={kpiFile(q, 'children')} />
      </div>
      <div className="overflow-x-auto">
        <table id="kpi-children" className="w-full text-sm">
          <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
            <tr>
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">{V.childLabel}</th>
              {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ปี {prevYear} (บาท)</th>}
              <th className="min-w-40 whitespace-nowrap px-4 py-3 text-right font-semibold">ปี {curYear} (บาท)</th>
              {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">เปลี่ยนแปลง</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c, i) => {
              const href = childHref(q, V.child, c.key);
              return (
                <tr key={c.key || '-'} className="hover:bg-emerald-50/50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    {href ? (
                      <Link href={href} className="font-semibold text-gray-800 hover:text-emerald-600">
                        {c.label}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-500">{c.label}</span>
                    )}
                    <div className="text-xs text-gray-500">
                      {hospLevel ? (
                        <>
                          <span className="mono">{c.key}</span> · {c.type_name || 'ไม่ระบุประเภท'}
                        </>
                      ) : (
                        `${num(c.byYear[curYear]?.hosp_count ?? c.byYear[prevYear]?.hosp_count)} หน่วยบริการ`
                      )}
                    </div>
                  </td>
                  {prevYear && (
                    <td className="px-4 py-3 text-right">
                      <div className="text-gray-600">{num(val(c, prevYear))}</div>
                      <ShareBar value={val(c, prevYear)} max={max} tone="gray" />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold text-gray-800">{num(val(c, curYear))}</div>
                    <ShareBar value={val(c, curYear)} max={max} />
                  </td>
                  {prevYear && (
                    <td className="px-4 py-3 text-right">
                      <Change prev={val(c, prevYear)} cur={val(c, curYear)} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-emerald-200 bg-emerald-50/70 font-bold text-gray-800">
            <tr>
              <td className="px-4 py-3" />
              <td className="px-4 py-3">
                รวมทั้งหมด
                <div className="text-xs font-normal text-gray-500">
                  {hospLevel ? `${num(rows.length)} หน่วยบริการ` : `${num(total(curYear).hosp_count ?? total(prevYear).hosp_count)} หน่วยบริการ`}
                </div>
              </td>
              {prevYear && <td className="whitespace-nowrap px-4 py-3 text-right">{num(total(prevYear).kpi_value)}</td>}
              <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-700">{num(total(curYear).kpi_value)}</td>
              {prevYear && (
                <td className="px-4 py-3 text-right">
                  <Change prev={total(prevYear).kpi_value} cur={total(curYear).kpi_value} />
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// แถวรวมท้ายตารางยา (รวมเฉพาะแถวในตารางนั้น)
function DrugTotalRow({ label, sums, prevYear, curYear, before, showChange = true, showValue = true, sticky = false }) {
  const g = (y, f) => sums[y]?.[f] || 0;
  return (
    <tfoot className={`border-t-2 border-emerald-200 bg-emerald-50 font-bold text-gray-800 ${sticky ? 'sticky bottom-0' : ''}`}>
      <tr>
        <td className="px-4 py-3" colSpan={before}>
          {label}
        </td>
        {prevYear && <td className="px-4 py-3 text-right">{num(g(prevYear, 'vs_uc'))}</td>}
        <td className="px-4 py-3 text-right">{num(g(curYear, 'vs_uc'))}</td>
        {showValue && prevYear && <td className="whitespace-nowrap px-4 py-3 text-right">{num(g(prevYear, 'kpi_value'))}</td>}
        {showValue && <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-700">{num(g(curYear, 'kpi_value'))}</td>}
        {prevYear && showChange && (
          <td className="px-4 py-3 text-right">
            <Change prev={g(prevYear, 'kpi_value')} cur={g(curYear, 'kpi_value')} />
          </td>
        )}
      </tr>
    </tfoot>
  );
}

function TopGroups({ items, q, prevYear, curYear }) {
  const val = (d, y) => d.byYear[y]?.kpi_value || 0;
  const sorted = [...items].sort((a, b) => val(b, curYear) - val(a, curYear));
  const top = sorted.slice(0, 10);
  const max = Math.max(...top.map((d) => val(d, curYear)), 0);
  const years = [prevYear, curYear].filter(Boolean);
  // Excel ใส่ทุกกลุ่มยา (บนหน้าแสดง 10 อันดับ)
  const sheet = [
    ['อันดับ', 'กลุ่มยา 11 หลัก', 'ชื่อกลุ่มยา', 'ราคา/course', ...years.flatMap((y) => [`ครั้ง UC ${y}`, `มูลค่า ${y} (บาท)`])],
    ...sorted.map((d, i) => [
      i + 1,
      d.code11,
      d.full_name,
      d.price,
      ...years.flatMap((y) => [d.byYear[y]?.vs_uc || 0, d.byYear[y]?.kpi_value || 0]),
    ]),
  ];
  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-800">10 กลุ่มยามูลค่าสูงสุด ปี {curYear}</h2>
        <ExcelButton sheets={[{ name: 'กลุ่มยา', rows: sheet }]} filename={kpiFile(q, 'drug_groups')} label="Excel ทุกกลุ่ม" />
      </div>
      <ol className="space-y-4">
        {top.map((d, i) => (
          <li key={d.code11}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-gray-800">
                {i + 1}. {d.full_name}
              </span>
              <span className="whitespace-nowrap text-emerald-700">{num(val(d, curYear))} บาท</span>
            </div>
            <ShareBar value={val(d, curYear)} max={max} />
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
              <span className="mono">{d.code11}</span>
              {prevYear && (
                <>
                  <span>· ปี {prevYear}: {num(val(d, prevYear))} บาท</span>
                  <Change prev={val(d, prevYear)} cur={val(d, curYear)} />
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Code24({ d }) {
  return (
    <>
      <div className="mono text-gray-800">{d.code24 || '(ว่าง)'}</div>
      {d.didstd && d.didstd !== d.code24 && (
        <div className="mono text-xs text-amber-700" title="รหัสที่หน่วยบริการส่งมา ก่อนล้างอักขระ">
          ส่งมา: {d.didstd}
        </div>
      )}
    </>
  );
}

function HospDrugs({ drugs, q, prevYear, curYear }) {
  const get = (d, y, f) => d.byYear[y]?.[f] || 0;
  const rows = [...drugs].sort(
    (a, b) =>
      (a.price === null) - (b.price === null) ||
      get(b, curYear, 'kpi_value') - get(a, curYear, 'kpi_value') ||
      get(b, curYear, 'vs_uc') - get(a, curYear, 'vs_uc')
  );
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-800">รายการยาที่จ่าย ({rows.length} รหัส 24 หลัก)</h2>
        <ExcelButton tables={[{ id: 'kpi-hosp-drugs', name: 'รายการยาที่จ่าย' }]} filename={kpiFile(q, 'drugs')} />
      </div>
      <div className="overflow-x-auto">
        <table id="kpi-hosp-drugs" className="w-full text-sm">
          <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
            <tr>
              <th className="px-4 py-3 font-semibold">รหัส 24 หลัก</th>
              <th className="px-4 py-3 font-semibold">ชื่อยา</th>
              <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">รหัสที่มาของยา</th>
              <th className="px-4 py-3 font-semibold">กลุ่มยา (11 หลัก)</th>
              {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ครั้ง UC {prevYear}</th>}
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ครั้ง UC {curYear}</th>
              {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">มูลค่า {prevYear}</th>}
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">มูลค่า {curYear}</th>
              {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">เปลี่ยนแปลง</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((d) => {
              const unmatched = d.price === null;
              return (
                <tr key={d.code24} className={unmatched ? 'bg-gray-50 text-gray-500' : 'hover:bg-emerald-50/50'}>
                  <td className="px-4 py-3">
                    <Code24 d={d} />
                  </td>
                  <td className="px-4 py-3">{d.drug_name || '-'}</td>
                  <td className="mono px-4 py-3 text-center">{d.source_code || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{d.full_name || NOT_IN_GROUP}</div>
                    <div className="text-xs text-gray-500">
                      <span className="mono">{d.code11 || '-'}</span>
                      {!unmatched && ` · ${num(d.price)} บาท/course`}
                    </div>
                  </td>
                  {prevYear && <td className="px-4 py-3 text-right">{num(get(d, prevYear, 'vs_uc'))}</td>}
                  <td className="px-4 py-3 text-right">{num(get(d, curYear, 'vs_uc'))}</td>
                  {prevYear && <td className="whitespace-nowrap px-4 py-3 text-right">{num(get(d, prevYear, 'kpi_value'))}</td>}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{num(get(d, curYear, 'kpi_value'))}</td>
                  {prevYear && (
                    <td className="px-4 py-3 text-right">
                      {unmatched ? '-' : <Change prev={get(d, prevYear, 'kpi_value')} cur={get(d, curYear, 'kpi_value')} />}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <DrugTotalRow
            label={`รวม (${num(rows.length)} รหัส)`}
            sums={sumByYear(rows, ['vs_uc', 'kpi_value'])}
            prevYear={prevYear}
            curYear={curYear}
            before={4}
          />
        </table>
      </div>
    </section>
  );
}

// รหัส 24 หลักที่ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก — แยกแสดงต่างหาก
function NotFound24({ items, q, prevYear, curYear }) {
  const total = items.total ?? items.length;
  const isHosp = q.view === 'hosp';
  const get = (d, y, f) => d.byYear[y]?.[f] || 0;
  const xlsx = `/api/kpi/not-found-24?${new URLSearchParams(Object.entries(q).filter(([, v]) => v))}`;
  return (
    <section className="card mt-6 overflow-hidden border border-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/60 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-amber-900">รหัส 24 หลักที่ไม่พบข้อมูล ({num(total)} รหัส)</h2>
          <p className="text-xs text-amber-800">
            ไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก จึงไม่มีชื่อยาและรหัสที่มาของยา
            {total > items.length && ` · แสดง ${num(items.length)} รหัสแรก (เรียงตามครั้ง UC ปี ${curYear})`}
          </p>
        </div>
        {total > 0 && (
          <ExcelButton href={xlsx} tone="amber" label="ดาวน์โหลด Excel ทั้งหมด" />
        )}
      </div>
      {total === 0 ? (
        <div className="px-6 py-6 text-center text-sm text-gray-500">พบรหัส 24 หลักครบทุกรายการ</div>
      ) : (
        <div className="max-h-[36rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-amber-50 text-left text-amber-900">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">รหัส 24 หลัก</th>
                <th className="px-4 py-3 font-semibold">กลุ่มยา (11 หลัก)</th>
                {!isHosp && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">หน่วยบริการ</th>}
                {prevYear && <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ครั้ง UC {prevYear}</th>}
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">ครั้ง UC {curYear}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((d, i) => (
                <tr key={d.code24} className="hover:bg-amber-50/40">
                  <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Code24 d={d} />
                  </td>
                  <td className="px-4 py-2">
                    {d.price === null ? <span className="text-gray-400">{NOT_IN_GROUP}</span> : d.full_name}
                    <div className="mono text-xs text-gray-500">{d.code11 || '-'}</div>
                  </td>
                  {!isHosp && (
                    <td className="px-4 py-2 text-right">
                      {num(Math.max(get(d, prevYear, 'hosp_count'), get(d, curYear, 'hosp_count')))}
                    </td>
                  )}
                  {prevYear && <td className="px-4 py-2 text-right">{num(get(d, prevYear, 'vs_uc'))}</td>}
                  <td className="px-4 py-2 text-right">{num(get(d, curYear, 'vs_uc'))}</td>
                </tr>
              ))}
            </tbody>
            <DrugTotalRow
              label={`รวมทั้งหมด (${num(total)} รหัส)`}
              sums={items.sums || sumByYear(items, ['vs_uc', 'kpi_value'])}
              prevYear={prevYear}
              curYear={curYear}
              before={isHosp ? 3 : 4}
              showChange={false}
              showValue={false}
              sticky
            />
          </table>
        </div>
      )}
    </section>
  );
}
