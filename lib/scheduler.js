// งานเบื้องหลังของตัวชี้วัด
// 1) ดึงข้อมูล s_ttm4 จาก opendata.moph.go.th ทุกวันเวลา 22:00 (เวลาไทย) → publicfiles/opendata-2570/
// 2) เก็บตกอัตโนมัติ: ถ้ารอบ 22:00 ล่าสุดไม่ได้ไฟล์ (เซิร์ฟเวอร์ปิดอยู่ / API ล่ม) จะลองใหม่ตอนเปิดเซิร์ฟเวอร์
//    และทุกชั่วโมง (สูงสุด 3 ครั้งต่อรอบ)
// 3) นำเข้าไฟล์ปี 2570 ตามที่เลือกในหน้าตั้งค่า
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
const MAX_CATCHUP_ATTEMPTS = 3;

// สถานะเก็บใน globalThis ให้ทุกโมดูลในเซิร์ฟเวอร์เห็นตรงกัน
const state = (globalThis.__kpiJobs ??= { running: null, startedAt: null, last: null, attempts: {}, queued: false });

export function getJobStatus() {
  return { running: state.running, startedAt: state.startedAt, last: state.last, queued: state.queued };
}

function isEnabled() {
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

// เวลา 22:00 ล่าสุดที่ผ่านมาแล้ว (ms)
function lastScheduledTime() {
  const { date, hour } = bangkokNow();
  const t = new Date(`${date}T${String(FETCH_HOUR).padStart(2, '0')}:00:00+07:00`).getTime();
  return hour >= FETCH_HOUR ? t : t - 24 * 3600 * 1000;
}

function runScript(kind, args, onDone) {
  if (state.running) return false;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const logFile = path.join(LOG_DIR, `${kind}-${stamp}.log`);
  const out = fs.openSync(logFile, 'a');
  state.running = kind;
  state.startedAt = new Date().toISOString();
  console.log(`[kpi] เริ่ม ${kind} → ${path.relative(ROOT, logFile)}`);

  // แยกเป็น process ลูก เพื่อไม่ให้หน้าเว็บช้าระหว่างทำงาน
  const child = spawn(process.execPath, ['--max-old-space-size=4096', ...args], {
    cwd: ROOT,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  const finish = (code) => {
    if (state.running !== kind) return;
    fs.closeSync(out);
    state.running = null;
    state.last = { kind, code, finishedAt: new Date().toISOString(), log: path.relative(ROOT, logFile) };
    console.log(`[kpi] ${kind} เสร็จสิ้น (exit ${code}) — ดูรายละเอียดที่ ${path.relative(ROOT, logFile)}`);
    onDone?.(code);
    // มีคำขอนำเข้าค้างไว้ระหว่างดึงข้อมูล → ทำต่อ
    if (state.queued) {
      state.queued = false;
      runCompareImport();
    }
  };
  child.on('exit', finish);
  child.on('error', () => finish(-1));
  return true;
}

export function runFetch() {
  const started = runScript('opendata', [path.join(ROOT, 'scripts', 'fetch-opendata.js')]);
  if (!started) console.log(`[kpi] ${state.running} ยังทำงานอยู่ — ข้ามรอบดึงข้อมูลนี้`);
  return started;
}

// นำเข้าไฟล์ปี 2570 ตามการตั้งค่า (ถ้ากำลังดึงข้อมูลอยู่ จะทำต่อหลังดึงเสร็จ)
export function runCompareImport() {
  if (state.running) {
    state.queued = true;
    return 'queued';
  }
  runScript('kpi-import', [path.join(ROOT, 'scripts', 'import-kpi.js'), '--compare-only']);
  return 'started';
}

// ได้ไฟล์ของรอบ 22:00 ล่าสุดแล้วหรือยัง → ถ้ายัง ดึงใหม่ (จำกัดจำนวนครั้งต่อรอบ)
function catchUp() {
  if (state.running) return;
  const due = lastScheduledTime();
  const newest = kpiLib.listCompareFiles().reduce((m, f) => Math.max(m, f.mtime), 0);
  if (newest >= due) return;
  const n = state.attempts[due] || 0;
  if (n >= MAX_CATCHUP_ATTEMPTS) return;
  state.attempts = { [due]: n + 1 };
  console.log(`[kpi] ยังไม่มีไฟล์ของรอบ 22:00 ล่าสุด — ดึงข้อมูลย้อนหลัง (ครั้งที่ ${n + 1}/${MAX_CATCHUP_ATTEMPTS})`);
  runFetch();
}

export function startOpendataScheduler() {
  if (globalThis.__opendataScheduled || !isEnabled()) return;
  globalThis.__opendataScheduled = true;
  const expr = process.env.OPENDATA_CRON_TIME || `0 ${FETCH_HOUR} * * *`;
  cron.schedule(
    expr,
    () => {
      state.attempts = { [lastScheduledTime()]: 1 };
      runFetch();
    },
    { timezone: 'Asia/Bangkok' }
  );
  cron.schedule('30 * * * *', catchUp, { timezone: 'Asia/Bangkok' });
  setTimeout(catchUp, 60 * 1000); // ตรวจหลังเปิดเซิร์ฟเวอร์ 1 นาที
  console.log(`[kpi] ตั้งเวลาดึงข้อมูลแล้ว (${expr}, Asia/Bangkok) + เก็บตกทุกชั่วโมง`);
}
