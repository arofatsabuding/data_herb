import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/Icons';
import { getKpiYears, kpiAvailable } from '@/lib/kpi';
import { getJobStatus } from '@/lib/scheduler';
import kpiLib from '@/scripts/kpi-lib';
import { fetchNow, saveCompareFile } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ตั้งค่าตัวชี้วัด — Data Herb' };

const YEAR = kpiLib.COMPARE_YEAR;
const num = (n) => Number(n || 0).toLocaleString('th-TH');
const mb = (n) => (n / 1024 / 1024).toLocaleString('th-TH', { maximumFractionDigits: 1 });
const dt = (v) => (v ? new Date(v).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : '-');

const JOB_LABEL = { opendata: 'ดึงข้อมูลจาก API', 'kpi-import': 'นำเข้าไฟล์ที่เลือก' };

const MESSAGES = {
  'saved=started': ['ok', 'บันทึกแล้ว — กำลังนำเข้าไฟล์ (ประมาณ 1–2 นาที) รีเฟรชหน้านี้เพื่อดูสถานะ'],
  'saved=queued': ['ok', 'บันทึกแล้ว — จะนำเข้าไฟล์ต่อทันทีหลังดึงข้อมูลเสร็จ'],
  'fetch=started': ['ok', 'เริ่มดึงข้อมูลแล้ว (ประมาณ 4–10 นาที) รีเฟรชหน้านี้เพื่อดูสถานะ'],
  'fetch=busy': ['warn', 'มีงานอื่นทำงานอยู่ — ลองใหม่อีกครั้งเมื่องานเสร็จ'],
  'error=password': ['error', 'รหัสผ่านไม่ถูกต้อง'],
  'error=file': ['error', 'ไม่พบไฟล์ที่เลือก'],
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

function PasswordField() {
  if (!process.env.KPI_ADMIN_PASSWORD) return null;
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-600 sm:w-64">
      รหัสผ่านผู้ดูแล
      <input type="password" name="password" required className="input" autoComplete="current-password" />
    </label>
  );
}

export default async function KpiSettingsPage({ searchParams }) {
  const sp = await searchParams;
  const settings = kpiLib.readSettings();
  const files = kpiLib.listCompareFiles();
  const loaded = kpiAvailable() ? getKpiYears().find((f) => f.year === YEAR) : null;
  const effective = kpiLib.resolveCompareFile(settings);
  const effectiveName = effective ? effective.split(/[\\/]/).pop() : null;
  const job = getJobStatus();
  const cronOn = (process.env.OPENDATA_CRON || '').toLowerCase() !== 'off';
  const pinnedMissing = settings.compareFile !== 'latest' && !files.some((f) => f.name === settings.compareFile);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/kpi" className="mb-6 inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline">
        <ArrowLeftIcon className="h-4 w-4" />
        กลับไปหน้าติดตามตัวชี้วัด
      </Link>
      <h1 className="mb-2 text-3xl font-bold text-gray-800">ตั้งค่าตัวชี้วัด</h1>
      <p className="mb-8 text-gray-600">เลือกว่าข้อมูลปี {YEAR} จะใช้ไฟล์รายวันไฟล์ไหนมาเปรียบเทียบกับปี 2569</p>

      <Message sp={sp} />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-gray-500">ไฟล์ที่ใช้ในรายงานตอนนี้</div>
          <div className="mono mt-1 break-all text-sm font-semibold text-gray-800">{loaded?.file || '-'}</div>
          {loaded && <div className="mt-1 text-xs text-gray-500">{num(loaded.rows)} แถว · นำเข้าเมื่อ {dt(loaded.imported_at)}</div>}
          {loaded && effectiveName && loaded.file !== effectiveName && !job.running && (
            <div className="mt-2 text-xs text-amber-700">ยังไม่ตรงกับการตั้งค่า ({effectiveName}) — กดบันทึกอีกครั้งเพื่อนำเข้า</div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-sm text-gray-500">สถานะงาน</div>
          {job.running ? (
            <div className="mt-1 font-semibold text-amber-600">
              กำลัง{JOB_LABEL[job.running]} (เริ่ม {dt(job.startedAt)})
              {job.queued && <div className="text-xs font-normal">มีคำขอนำเข้ารอต่อคิว</div>}
            </div>
          ) : (
            <div className="mt-1 font-semibold text-gray-800">ว่าง</div>
          )}
          {job.last && (
            <div className="mt-1 text-xs text-gray-500">
              ล่าสุด: {JOB_LABEL[job.last.kind]} {job.last.code === 0 ? 'สำเร็จ' : `ไม่สำเร็จ (exit ${job.last.code})`} ·{' '}
              {dt(job.last.finishedAt)} · log: <span className="mono">{job.last.log}</span>
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-sm text-gray-500">ดึงข้อมูลอัตโนมัติ</div>
          <div className={`mt-1 font-semibold ${cronOn ? 'text-emerald-600' : 'text-rose-600'}`}>
            {cronOn ? `เปิด · ทุกวัน ${process.env.OPENDATA_CRON_TIME ? `(${process.env.OPENDATA_CRON_TIME})` : '22:00 น.'}` : 'ปิด (OPENDATA_CRON=off)'}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            ดึงปี {YEAR} ถ้า API มีข้อมูลแล้ว ถ้ายังไม่มีใช้ปี {process.env.OPENDATA_FALLBACK_YEAR || '2569'} แทนชั่วคราว ·
            ถ้าพลาดรอบ 22:00 จะดึงย้อนหลังให้เอง
          </div>
          <form action={fetchNow} className="mt-3 flex flex-col gap-2">
            <PasswordField />
            <button type="submit" disabled={!!job.running} className="btn-primary text-sm disabled:opacity-50">
              ดึงข้อมูลตอนนี้
            </button>
          </form>
        </div>
      </div>

      <form action={saveCompareFile} className="card overflow-hidden">
        <h2 className="border-b border-gray-100 px-6 py-4 text-lg font-bold text-gray-800">ไฟล์ปี {YEAR} ที่ใช้เปรียบเทียบ</h2>
        <div className="divide-y divide-gray-100">
          <label className="flex cursor-pointer items-start gap-3 px-6 py-4 hover:bg-emerald-50/50">
            <input type="radio" name="compareFile" value="latest" defaultChecked={settings.compareFile === 'latest' || pinnedMissing} className="mt-1 accent-emerald-600" />
            <div>
              <div className="font-semibold text-gray-800">ใช้ไฟล์ที่โหลดมาล่าสุดเสมอ (ค่าเริ่มต้น)</div>
              <div className="text-sm text-gray-500">
                รายงานจะอัปเดตเองทุกครั้งที่ดึงข้อมูลได้ไฟล์ใหม่ — ตอนนี้คือ{' '}
                <span className="mono">{files[0]?.name || 'ยังไม่มีไฟล์'}</span>
              </div>
            </div>
          </label>
          {files.map((f, i) => (
            <label key={f.name} className="flex cursor-pointer items-start gap-3 px-6 py-3 hover:bg-emerald-50/50">
              <input type="radio" name="compareFile" value={f.name} defaultChecked={settings.compareFile === f.name} className="mt-1 accent-emerald-600" />
              <div className="min-w-0 flex-1">
                <div className="mono break-all text-sm text-gray-800">
                  {f.name}
                  {i === 0 && <span className="badge ml-2 bg-emerald-100 text-emerald-700">ล่าสุด</span>}
                  {loaded?.file === f.name && <span className="badge ml-2 bg-sky-100 text-sky-700">ใช้อยู่</span>}
                </div>
                <div className="text-xs text-gray-500">
                  ข้อมูลวันที่ {f.stamp} · {num(f.rows)} แถว · {mb(f.size)} MB · บันทึกเมื่อ {dt(f.mtime)}
                  {f.fetchYear && f.fetchYear !== YEAR && (
                    <span className="ml-1 text-amber-700">· ดึงจาก API ปี {f.fetchYear} (ใช้แทนชั่วคราว)</span>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4 sm:flex-row sm:items-end">
          <PasswordField />
          <button type="submit" disabled={!!job.running && job.running !== 'opendata'} className="btn-primary disabled:opacity-50">
            บันทึกการตั้งค่า
          </button>
        </div>
      </form>
    </div>
  );
}
