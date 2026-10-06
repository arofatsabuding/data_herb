// ตั้งเวลาดึงข้อมูล s_ttm4 จาก opendata.moph.go.th ทุกวันเวลา 22:00 (เวลาไทย)
// ทำงานอัตโนมัติเมื่อรัน `npm start` (production)
// ตั้งค่า (env):
//   OPENDATA_CRON=off       ปิดการตั้งเวลา
//   OPENDATA_CRON=on        เปิดในโหมด dev ด้วย (ปกติ dev ไม่ตั้งเวลา)
//   OPENDATA_CRON_TIME      รูปแบบ cron (ค่าเริ่มต้น "0 22 * * *")
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts', 'fetch-opendata.js');
const LOG_DIR = path.join(ROOT, 'logs');

function isEnabled() {
  const flag = (process.env.OPENDATA_CRON || '').toLowerCase();
  if (flag === 'off') return false;
  if (flag === 'on') return true;
  return process.env.NODE_ENV === 'production';
}

function runFetch() {
  if (globalThis.__opendataRunning) {
    console.log('[opendata] รอบก่อนหน้ายังทำงานอยู่ — ข้ามรอบนี้');
    return;
  }
  globalThis.__opendataRunning = true;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD
  const logFile = path.join(LOG_DIR, `opendata-${stamp}.log`);
  const out = fs.openSync(logFile, 'a');
  console.log(`[opendata] เริ่มดึงข้อมูล → ${path.relative(ROOT, logFile)}`);

  // แยกเป็น process ลูก เพื่อไม่ให้หน้าเว็บช้าระหว่างดึงข้อมูล
  const child = spawn(process.execPath, ['--max-old-space-size=4096', SCRIPT], {
    cwd: ROOT,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  child.on('exit', (code) => {
    globalThis.__opendataRunning = false;
    fs.closeSync(out);
    console.log(`[opendata] เสร็จสิ้น (exit ${code}) — ดูรายละเอียดที่ ${path.relative(ROOT, logFile)}`);
  });
}

export function startOpendataScheduler() {
  if (globalThis.__opendataScheduled || !isEnabled()) return;
  globalThis.__opendataScheduled = true;
  const expr = process.env.OPENDATA_CRON_TIME || '0 22 * * *';
  cron.schedule(expr, runFetch, { timezone: 'Asia/Bangkok' });
  console.log(`[opendata] ตั้งเวลาดึงข้อมูลแล้ว (${expr}, Asia/Bangkok)`);
}
