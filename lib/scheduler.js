// งานเบื้องหลังของตัวชี้วัด (ทำทีละงานตามคิว)
// 1) ดึงข้อมูล s_ttm4 จาก opendata.moph.go.th ทุกวันเวลา 22:00 (เวลาไทย) → publicfiles/opendata-2570/
//    ถ้าไม่สำเร็จ ดึงใหม่อีก 5 ครั้ง (ห่างกัน 10 นาที) — ครบแล้วยังไม่สำเร็จ ถือว่าวันนั้นไม่มีรายงาน
//    ถ้าเซิร์ฟเวอร์ปิดอยู่ตอน 22:00 จะเริ่มรอบนั้นให้เมื่อเปิดเซิร์ฟเวอร์
// 2) นำเข้าไฟล์ที่ผู้ใช้เลือกแต่ยังไม่มีในฐานข้อมูล
// ทำงานเองเมื่อเปิดเว็บ (npm start / npm run dev) — ตั้งค่า (env):
//   OPENDATA_CRON=off       ปิดการดึงข้อมูลอัตโนมัติ
//   OPENDATA_CRON_TIME      รูปแบบ cron (ค่าเริ่มต้น "0 22 * * *")
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import kpiLib from '../scripts/kpi-lib';

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, 'logs');
const FETCH_HOUR = 22;
export const MAX_RETRIES = 5; // ดึงใหม่หลังรอบ 22:00 ไม่สำเร็จ
const RETRY_DELAY_MS = Number(process.env.OPENDATA_RETRY_DELAY_MS) || 10 * 60 * 1000;

// สถานะเก็บใน globalThis ให้ทุกโมดูลในเซิร์ฟเวอร์เห็นตรงกัน
const state = (globalThis.__kpiJobs ??= { running: null, startedAt: null, last: null, queue: [], retryTimer: null });

export function getJobStatus() {
  return {
    running: state.running?.label ?? null,
    runningKey: state.running?.key ?? null,
    startedAt: state.startedAt,
    last: state.last,
    queue: state.queue.map((j) => j.key),
    retryAt: state.retryAt ?? null,
  };
}

export function cronEnabled() {
  return (process.env.OPENDATA_CRON || '').toLowerCase() !== 'off';
}

function bangkokNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

// รอบ 22:00 ล่าสุดที่ผ่านมาแล้ว → { date: 'YYYY-MM-DD', time: ms }
function lastRound() {
  const { date, hour } = bangkokNow();
  const t = new Date(`${date}T${String(FETCH_HOUR).padStart(2, '0')}:00:00+07:00`).getTime();
  const time = hour >= FETCH_HOUR ? t : t - 24 * 3600 * 1000;
  return { date: new Date(time).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }), time };
}

// ---------- คิวงาน ----------

function enqueue(job) {
  if (state.running?.key === job.key || state.queue.some((j) => j.key === job.key)) return false;
  state.queue.push(job);
  next();
  return true;
}

function next() {
  if (state.running || !state.queue.length) return;
  const job = state.queue.shift();
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const logFile = path.join(LOG_DIR, `${job.kind}-${stamp}.log`);
  const out = fs.openSync(logFile, 'a');
  state.running = job;
  state.startedAt = new Date().toISOString();
  console.log(`[kpi] เริ่ม: ${job.label} → ${path.relative(ROOT, logFile)}`);

  // แยกเป็น process ลูก เพื่อไม่ให้หน้าเว็บช้าระหว่างทำงาน
  const child = spawn(process.execPath, ['--max-old-space-size=4096', ...job.args], {
    cwd: ROOT,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  let done = false;
  const finish = (code) => {
    if (done) return;
    done = true;
    fs.closeSync(out);
    state.running = null;
    state.last = { label: job.label, code, finishedAt: new Date().toISOString(), log: path.relative(ROOT, logFile) };
    console.log(`[kpi] ${job.label} เสร็จสิ้น (exit ${code})`);
    try {
      job.onDone?.(code);
    } catch (err) {
      console.error('[kpi]', err);
    }
    next();
  };
  child.on('exit', finish);
  child.on('error', () => finish(-1));
}

// ---------- ดึงข้อมูล ----------

const FETCH_ARGS = () => [path.join(ROOT, 'scripts', 'fetch-opendata.js')];

// รอบประจำวัน: ครั้งแรก + ดึงใหม่ได้อีก MAX_RETRIES ครั้ง
function runRoundAttempt(date) {
  const round = kpiLib.readFetchStatus().rounds[date] || { attempts: 0 };
  if (round.status === 'ok' || round.status === 'no_report') return;
  if ((round.attempts || 0) > MAX_RETRIES) {
    kpiLib.updateFetchRound(date, { status: 'no_report' });
    return;
  }
  const attempt = (round.attempts || 0) + 1;
  kpiLib.updateFetchRound(date, { attempts: attempt, status: 'running' });
  const label = attempt === 1 ? `ดึงข้อมูลรอบ 22:00 (${date})` : `ดึงข้อมูลใหม่ครั้งที่ ${attempt - 1}/${MAX_RETRIES} (${date})`;
  const queued = enqueue({
    key: 'fetch',
    kind: 'opendata',
    label,
    args: FETCH_ARGS(),
    onDone: (code) => onRoundDone(date, attempt, code),
  });
  // มีการดึงข้อมูลอยู่แล้ว (เช่น กดดึงเอง) → ไม่นับครั้งนี้ แล้วตรวจใหม่ภายหลัง
  if (!queued) {
    kpiLib.updateFetchRound(date, { attempts: attempt - 1, status: 'failed' });
    scheduleRetry(date);
  }
}

function onRoundDone(date, attempt, code) {
  if (code === 0) {
    kpiLib.updateFetchRound(date, { status: 'ok' });
    return;
  }
  if (attempt > MAX_RETRIES) {
    kpiLib.updateFetchRound(date, { status: 'no_report' });
    console.log(`[kpi] ดึงข้อมูลไม่สำเร็จครบ ${MAX_RETRIES + 1} ครั้ง — วันที่ ${date} ไม่มีรายงาน`);
    return;
  }
  kpiLib.updateFetchRound(date, { status: 'failed' });
  scheduleRetry(date);
}

function scheduleRetry(date, delay = RETRY_DELAY_MS) {
  clearTimeout(state.retryTimer);
  state.retryAt = new Date(Date.now() + delay).toISOString();
  state.retryTimer = setTimeout(() => {
    state.retryAt = null;
    runRoundAttempt(date);
  }, delay);
}

// ดึงทันที (ผู้ใช้กรอกรหัสยืนยันแล้ว) — ไม่นับเป็นรอบประจำวัน
export function runFetchNow() {
  return enqueue({ key: 'fetch', kind: 'opendata', label: 'ดึงข้อมูลทันที (สั่งจากหน้าเว็บ)', args: FETCH_ARGS() });
}

// ---------- นำเข้าไฟล์ที่ผู้ใช้เลือก ----------

export function ensureImported(year, file) {
  return enqueue({
    key: `import:${file}`,
    kind: 'kpi-import',
    label: `นำเข้า ${file}`,
    args: [path.join(ROOT, 'scripts', 'import-kpi.js'), '--year', String(year), '--file', file],
  });
}

export function isQueued(file) {
  return state.running?.key === `import:${file}` || state.queue.some((j) => j.key === `import:${file}`);
}

// ---------- เริ่มตัวตั้งเวลา ----------

// เปิดเซิร์ฟเวอร์: รอบ 22:00 ล่าสุดยังไม่จบ (เซิร์ฟเวอร์ปิดอยู่ หรือดับระหว่างดึงใหม่) → ทำต่อ
function resumeRound() {
  const { date, time } = lastRound();
  const round = kpiLib.readFetchStatus().rounds[date];
  if (round?.status === 'ok' || round?.status === 'no_report') return;
  if (!round) {
    const newest = kpiLib.listFiles(kpiLib.FETCH_YEAR_TARGET).reduce((m, f) => Math.max(m, f.mtime), 0);
    if (newest >= time) return; // มีไฟล์หลัง 22:00 แล้ว (เช่น ดึงด้วยมือ)
  }
  console.log(`[kpi] รอบ 22:00 วันที่ ${date} ยังไม่สำเร็จ — ดึงข้อมูลต่อ`);
  runRoundAttempt(date);
}

export function startOpendataScheduler() {
  if (globalThis.__opendataScheduled || !cronEnabled()) return;
  globalThis.__opendataScheduled = true;
  const expr = process.env.OPENDATA_CRON_TIME || `0 ${FETCH_HOUR} * * *`;
  cron.schedule(expr, () => runRoundAttempt(bangkokNow().date), { timezone: 'Asia/Bangkok' });
  setTimeout(resumeRound, 60 * 1000); // ตรวจหลังเปิดเซิร์ฟเวอร์ 1 นาที
  console.log(`[kpi] ตั้งเวลาดึงข้อมูลแล้ว (${expr}, Asia/Bangkok) — ไม่สำเร็จจะดึงใหม่อีก ${MAX_RETRIES} ครั้ง`);
}
