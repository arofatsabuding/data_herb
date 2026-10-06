import { cookies } from 'next/headers';
import Link from 'next/link';
import FetchNowButton from '@/components/FetchNowButton';
import { ArrowLeftIcon } from '@/components/Icons';
import { PREF_COOKIE, getDatasets, parsePrefs, resolveSets } from '@/lib/kpi';
import { MAX_RETRIES, cronEnabled, getJobStatus, isQueued } from '@/lib/scheduler';
import kpiLib from '@/scripts/kpi-lib';
import { fetchNow, savePrefs } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ตั้งค่าตัวชี้วัด — Data Herb' };

const num = (n) => Number(n || 0).toLocaleString('th-TH');
const mb = (n) => (n / 1024 / 1024).toLocaleString('th-TH', { maximumFractionDigits: 1 });
const dt = (v) => (v ? new Date(v).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : '-');
const day = (iso) => new Date(`${iso}T12:00:00+07:00`).toLocaleDateString('th-TH', { dateStyle: 'medium' });

const MESSAGES = {
  'saved=1': ['ok', 'บันทึกแล้ว — การตั้งค่านี้ใช้เฉพาะเบราว์เซอร์ของคุณ ไฟล์ที่ยังไม่ได้นำเข้าจะพร้อมใช้ในประมาณ 1 นาที'],
  'fetch=started': ['ok', 'เริ่มดึงข้อมูลแล้ว (ประมาณ 4–10 นาที) รีเฟรชหน้านี้เพื่อดูสถานะ'],
  'fetch=busy': ['warn', 'กำลังดึงข้อมูลอยู่แล้ว — รอให้เสร็จก่อน'],
  'error=code': ['error', 'รหัสยืนยันไม่ถูกต้อง — ไม่ได้ดึงข้อมูล'],
  'error=nocode': ['error', 'เซิร์ฟเวอร์ยังไม่ได้ตั้งรหัสยืนยัน (FETCH_NOW_CODE ใน .env)'],
  'error=file': ['error', 'ไม่พบไฟล์ที่เลือก'],
};

const ROUND_STATUS = {
  ok: ['สำเร็จ', 'text-emerald-700'],
  running: ['กำลังดึงข้อมูล', 'text-amber-600'],
  failed: ['ไม่สำเร็จ — รอดึงใหม่', 'text-amber-600'],
  no_report: ['ไม่มีรายงาน', 'text-rose-600'],
};

function Message({ sp }) {
  const key = Object.keys(MESSAGES).find((k) => {
    const [name, value] = k.split('=');
    return sp[name] === value;
  });
  if (!key) return null;
  const [tone, text] = MESSAGES[key];
  const color = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
  }[tone];
  return <div className={`mb-6 rounded-2xl border px-5 py-3 text-sm ${color}`}>{text}</div>;
}

export default async function KpiSettingsPage({ searchParams }) {
  const sp = await searchParams;
  const prefs = parsePrefs((await cookies()).get(PREF_COOKIE)?.value);
  const inUse = Object.fromEntries(resolveSets(prefs).map((s) => [s.year, s.file]));
  const imported = new Set(getDatasets().map((d) => d.file));
  const years = kpiLib.listYears();
  const job = getJobStatus();
  const rounds = Object.entries(kpiLib.readFetchStatus().rounds).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/kpi" className="mb-6 inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline">
        <ArrowLeftIcon className="h-4 w-4" />
        กลับไปหน้าติดตามตัวชี้วัด
      </Link>
      <h1 className="mb-2 text-3xl font-bold text-gray-800">ตั้งค่าตัวชี้วัด</h1>
      <p className="mb-8 text-gray-600">
        เลือกว่าแต่ละปีจะใช้รายงาน (ไฟล์) ไหนมาเปรียบเทียบ — <b>การตั้งค่าเก็บในเบราว์เซอร์ของคุณ</b>{' '}
        แต่ละคนเลือกต่างกันได้ในเวลาเดียวกัน
      </p>

      <Message sp={sp} />

      <form action={savePrefs} className="mb-8 space-y-6">
        {years.map((year) => {
          const files = kpiLib.listFiles(year);
          const choice = prefs[year] && files.some((f) => f.name === prefs[year]) ? prefs[year] : 'latest';
          return (
            <section key={year} className="card overflow-hidden">
              <h2 className="border-b border-gray-100 px-6 py-4 text-lg font-bold text-gray-800">
                ปีงบประมาณ {year}
                <span className="ml-2 text-sm font-normal text-gray-500">publicfiles/opendata-{year}/</span>
              </h2>
              <div className="max-h-96 divide-y divide-gray-100 overflow-auto">
                <label className="flex cursor-pointer items-start gap-3 px-6 py-4 hover:bg-emerald-50/50">
                  <input type="radio" name={`file_${year}`} value="latest" defaultChecked={choice === 'latest'} className="mt-1 accent-emerald-600" />
                  <div>
                    <div className="font-semibold text-gray-800">ใช้ไฟล์ที่โหลดมาล่าสุดเสมอ (ค่าเริ่มต้น)</div>
                    <div className="text-sm text-gray-500">
                      ตอนนี้คือ <span className="mono">{files[0]?.name || 'ยังไม่มีไฟล์'}</span>
                    </div>
                  </div>
                </label>
                {files.map((f, i) => (
                  <label key={f.name} className="flex cursor-pointer items-start gap-3 px-6 py-3 hover:bg-emerald-50/50">
                    <input type="radio" name={`file_${year}`} value={f.name} defaultChecked={choice === f.name} className="mt-1 accent-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <div className="mono break-all text-sm text-gray-800">
                        {f.name}
                        {i === 0 && <span className="badge ml-2 bg-emerald-100 text-emerald-700">ล่าสุด</span>}
                        {inUse[year] === f.name && <span className="badge ml-2 bg-sky-100 text-sky-700">คุณใช้อยู่</span>}
                        {!imported.has(f.name) && (
                          <span className="badge ml-2 bg-gray-100 text-gray-600">
                            {isQueued(f.name) ? 'กำลังนำเข้า…' : 'เลือกแล้วจะนำเข้าให้ (~1 นาที)'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        ข้อมูลวันที่ {f.stamp} · {num(f.rows)} แถว · {mb(f.size)} MB · บันทึกเมื่อ {dt(f.mtime)}
                        {f.fetchYear && f.fetchYear !== year && (
                          <span className="ml-1 text-amber-700">· ดึงจาก API ปี {f.fetchYear} (ใช้แทนชั่วคราว)</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
        <button type="submit" className="btn-primary">
          บันทึกการตั้งค่าของฉัน
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-1 text-lg font-bold text-gray-800">ดึงข้อมูลอัตโนมัติ</h2>
          <p className={`mb-3 text-sm font-semibold ${cronEnabled() ? 'text-emerald-600' : 'text-rose-600'}`}>
            {cronEnabled() ? `เปิด · ทุกวัน 22:00 น. · ไม่สำเร็จจะดึงใหม่อีก ${MAX_RETRIES} ครั้ง (ห่างกัน 10 นาที)` : 'ปิด (OPENDATA_CRON=off)'}
          </p>
          {rounds.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1 font-normal">รอบวันที่</th>
                  <th className="py-1 font-normal">สถานะ</th>
                  <th className="py-1 text-right font-normal">ครั้งที่ดึง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rounds.map(([date, r]) => {
                  const [label, color] = ROUND_STATUS[r.status] || [r.status, 'text-gray-600'];
                  return (
                    <tr key={date}>
                      <td className="py-1.5">{day(date)}</td>
                      <td className={`py-1.5 font-semibold ${color}`}>{label}</td>
                      <td className="py-1.5 text-right">
                        {r.attempts}/{MAX_RETRIES + 1}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">ยังไม่มีรอบที่ดึงอัตโนมัติ</p>
          )}
          {job.retryAt && <p className="mt-2 text-xs text-amber-700">จะดึงใหม่เวลา {dt(job.retryAt)}</p>}
        </section>

        <section className="card p-6">
          <h2 className="mb-1 text-lg font-bold text-gray-800">ดึงรายงาน ณ ปัจจุบัน</h2>
          <p className="mb-3 text-sm text-gray-500">ไม่ต้องรอ 22:00 — ต้องกรอกรหัสยืนยันก่อน</p>
          <div className="mb-3 text-sm">
            สถานะงาน:{' '}
            {job.running ? (
              <span className="font-semibold text-amber-600">
                {job.running} (เริ่ม {dt(job.startedAt)})
              </span>
            ) : (
              <span className="font-semibold text-gray-800">ว่าง</span>
            )}
            {job.queue.length > 0 && <span className="text-xs text-gray-500"> · รอคิว {job.queue.length} งาน</span>}
            {job.last && (
              <div className="mt-1 text-xs text-gray-500">
                ล่าสุด: {job.last.label} {job.last.code === 0 ? 'สำเร็จ' : `ไม่สำเร็จ (exit ${job.last.code})`} ·{' '}
                {dt(job.last.finishedAt)} · log: <span className="mono">{job.last.log}</span>
              </div>
            )}
          </div>
          <FetchNowButton action={fetchNow} disabled={job.runningKey === 'fetch' || job.queue.includes('fetch')} />
        </section>
      </div>
    </div>
  );
}
