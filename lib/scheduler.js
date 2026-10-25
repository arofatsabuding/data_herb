// งานเบื้องหลังของตัวชี้วัด (ทำทีละงานตามคิว)
// 1) ดึงข้อมูล s_ttm4 จาก opendata.moph.go.th ทุกวันเวลา 22:00 (เวลาไทย) → publicfiles/opendata-2570/
//    ถ้าไม่สำเร็จ ดึงใหม่อีก 5 ครั้ง (ห่างกัน 10 นาที) — ครบแล้วยังไม่สำเร็จ ถือว่าวันนั้นไม่มีรายงาน
//    ถ้าเซิร์ฟเวอร์ปิดอยู่ตอน 22:00 จะเริ่มรอบนั้นให้เมื่อเปิดเซิร์ฟเวอร์
// 2) นำเข้าไฟล์ที่ผู้ใช้เลือกแต่ยังไม่มีในฐานข้อมูล
// 3) สร้างฐานข้อมูลใหม่หลังผู้ดูแลอัปโหลดไฟล์อ้างอิง (หน้า /admin)
// ทำงานเองเมื่อเปิดเว็บ (npm start / npm run dev) — ตั้งค่า (env):
//   OPENDATA_CRON=on|off    เปิด/ปิดการดึงข้อมูลอัตโนมัติ (ไม่ตั้ง = เปิดเฉพาะ npm start, ปิดใน npm run dev)
//   OPENDATA_CRON_TIME      รูปแบบ cron (ค่าเริ่มต้น "0 22 * * *")
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import kpiLib from '../scripts/kpi-lib';
import { swapHerbDb } from './db';

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
    fetching: fetchInProgress(),
  };
}

// ไม่ตั้ง OPENDATA_CRON = ดึงเฉพาะเซิร์ฟเวอร์จริง (npm start) เครื่องทีมที่รัน dev จะไม่ดึงซ้ำ
export function cronEnabled() {
  const v = (process.env.OPENDATA_CRON || '').toLowerCase();
  if (v === 'on') return true;
  if (v === 'off') return false;
  return process.env.NODE_ENV === 'production';
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
    env: { ...process.env, FETCH_BY: job.label },
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
// คืนค่า false ถ้ามีคนกำลังดึงอยู่ (จากหน้าเว็บ ตั้งเวลา หรือ command line)
export function runFetchNow() {
  if (fetchInProgress()) return false;
  return enqueue({ key: 'fetch', kind: 'opendata', label: 'ดึงข้อมูลทันที (สั่งจากหน้าเว็บ)', args: FETCH_ARGS() });
}

// กำลังดึงข้อมูลอยู่หรือไม่ → { by, startedAt } | null
export function fetchInProgress() {
  if (state.running?.key === 'fetch') return { by: state.running.label, startedAt: state.startedAt };
  if (state.queue.some((j) => j.key === 'fetch')) return { by: 'รอคิว', startedAt: null };
  return kpiLib.fetchLockInfo();
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

// ---------- สร้างฐานข้อมูลใหม่จากไฟล์อ้างอิง ----------
// 1) scripts/import.js --no-swap → data/herb.db.tmp แล้วเซิร์ฟเวอร์สลับเป็น data/herb.db
// 2) scripts/import-kpi.js --references → ตารางอ้างอิงใน kpi.db + คำนวณทุกไฟล์ใหม่
// อัปโหลดเพิ่มระหว่างทำขั้นที่ 1 → ทำใหม่อีกรอบเมื่อเสร็จ (ให้ได้ไฟล์ล่าสุดครบ)

export function rebuildReferences(by) {
  if (state.running?.key === 'reference') {
    state.referenceAgain = by;
    return;
  }
  enqueue({
    key: 'reference',
    kind: 'reference',
    label: `สร้างฐานข้อมูลรหัสยาใหม่ (${by})`,
    args: [path.join(ROOT, 'scripts', 'import.js'), '--no-swap'],
    onDone: (code) => {
      const again = state.referenceAgain;
      state.referenceAgain = null;
      if (code !== 0) return finishReference(false, 'สร้าง data/herb.db ไม่สำเร็จ');
      swapWithRetry(() => {
        if (again) rebuildReferences(again);
        else
          enqueue({
            key: 'reference-kpi',
            kind: 'reference',
            label: 'คำนวณตัวชี้วัดใหม่ด้วยไฟล์อ้างอิงล่าสุด',
            args: [path.join(ROOT, 'scripts', 'import-kpi.js'), '--references'],
            onDone: (c) => finishReference(c === 0, c === 0 ? null : 'คำนวณตัวชี้วัดใหม่ไม่สำเร็จ'),
          });
      });
    },
  });
}

// สลับไฟล์ herb.db — ถ้ามี process อื่นเปิดอยู่ชั่วคราว ลองใหม่ทุก 2 วินาที (สูงสุด 30 ครั้ง)
function swapWithRetry(then, tries = 30) {
  try {
    swapHerbDb();
    then();
  } catch (err) {
    if (tries > 1 && (err.code === 'EPERM' || err.code === 'EBUSY')) setTimeout(() => swapWithRetry(then, tries - 1), 2000);
    else finishReference(false, `สลับไฟล์ data/herb.db ไม่ได้: ${err.message}`);
  }
}

function finishReference(ok, error) {
  state.referenceLast = { ok, error, finishedAt: new Date().toISOString(), log: state.last?.log ?? null };
  console.log(`[kpi] ปรับปรุงไฟล์อ้างอิง: ${ok ? 'สำเร็จ' : error}`);
}

// สถานะสำหรับหน้าผู้ดูแล
export function referenceStatus() {
  const busy =
    ['reference', 'reference-kpi'].includes(state.running?.key) || state.queue.some((j) => j.kind === 'reference');
  return { busy, running: busy ? state.running?.label ?? 'รอคิว' : null, last: state.referenceLast ?? null };
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
