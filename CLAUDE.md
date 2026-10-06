# CLAUDE.md — คู่มือสำหรับ Claude Code (และคนในทีม)

ไฟล์นี้ Claude Code อ่านอัตโนมัติทุกครั้งที่เปิดโปรเจกต์ ใส่เฉพาะสิ่งที่ต้องรู้ก่อนแก้โค้ด
รายละเอียดการใช้งาน/ตั้งค่าอยู่ใน [README.md](README.md) · แผนงานและการตัดสินใจของทีมอยู่ใน [PLAN.md](PLAN.md)

## โปรเจกต์นี้คืออะไร

**Data Herb** — เว็บค้นหารหัสยาสมุนไพร/ยาแผนไทย (Next.js 15 + SQLite) ของทีม DTAM
- รวม **รหัสยาแผนไทย 24 หลัก** (กรมการแพทย์แผนไทยฯ) กับ **TTMT Master** (สมสท.) → TTMTID, Drug Group, อัตราเบิกต่อ course
- **ตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC"** เทียบ 2 ปีงบประมาณ ระดับประเทศ/เขต/จังหวัด/อำเภอ/หน่วยบริการ จากข้อมูล opendata.moph.go.th (ดึงอัตโนมัติทุกวัน 22:00)
- เปิดให้ AI ใช้: REST API `/api/v1`, MCP server `/api/mcp`, แชท "ถาม AI" ในเว็บ (`/api/chat`)
- เว็บจริง: https://drug.thaipadi.com (Cloudflare Tunnel → `next start` พอร์ต 4000 บนเครื่องผู้ดูแลโปรเจกต์) · repo: github.com/arofatsabuding/data_herb (private)
- ผู้ใช้และทีมสื่อสารเป็น **ภาษาไทย** — ตอบเป็นภาษาไทย ข้อความบนหน้าเว็บเป็นภาษาไทย คอมเมนต์ในโค้ดเป็นภาษาไทย

## กติกาโค้ด (ต้องทำตาม)

- **JavaScript ไม่ใช้ TypeScript** — ไฟล์ที่มี JSX ใช้ `.jsx` (หน้า/คอมโพเนนต์), ไฟล์ที่ไม่มี JSX ใช้ `.js` (`lib/`, `route.js`, `scripts/`)
- **SQLite** ผ่าน `better-sqlite3` (sync) — เขียน SQL ปกติแบบ parameterized (`@name`) ห้ามต่อสตริงจากค่าที่ผู้ใช้ส่งมา
- Tailwind CSS v3 + ฟอนต์ Sarabun · โทนสี emerald/teal ไล่สี, พื้นเข้มสีกรมท่า (`navy-950/900/800`), สีทอง amber สำหรับปุ่มผู้ดูแลระบบ, สีแดง rose สำหรับส่วน "รหัสยาที่ผิดพลาด"
- Server Component เป็นค่าเริ่มต้น ใส่ `'use client'` เฉพาะคอมโพเนนต์ที่ต้องใช้ state/event
- อย่า import ค่าที่ไม่ใช่คอมโพเนนต์ (เช่น array) จากไฟล์ `'use client'` เข้า Server Component — ให้ย้ายไปไว้ใน `lib/` (ดู `lib/nav.js`)
- ไฟล์ดาวน์โหลดทุกจุดเป็น **Excel (.xlsx) ไม่ใช่ CSV** — ใช้ `components/ExcelButton.jsx` (ฝั่งเบราว์เซอร์) หรือ `lib/excel.js` (`xlsxResponse` ฝั่งเซิร์ฟเวอร์) ทุกตารางใหม่ต้องมีปุ่ม Excel
- ตารางที่แสดงตัวเลขต้องมี **แถวรวม** ท้ายตาราง
- เขียนให้เหมือนโค้ดรอบ ๆ (ชื่อ, ความหนาแน่นของคอมเมนต์, สไตล์) — รัน `npm run lint` ก่อน commit

## คำสั่ง

```bash
npm install
npm run import          # Excel ใน publicfiles/ → data/herb.db (ปิดเซิร์ฟเวอร์ก่อน: Windows ล็อกไฟล์)
npm run import:kpi      # opendata-<ปี>/*.xlsx → data/kpi.db (ไม่ต้องปิดเซิร์ฟเวอร์)
npm run fetch:opendata  # ดึงข้อมูลจาก opendata.moph.go.th → publicfiles/opendata-2570/ → kpi.db
npm run dev             # http://localhost:3000 (เครื่องทีม)
npm run build && npm start   # http://localhost:4000 (เซิร์ฟเวอร์จริง)
npm run lint
```

- **dev และ start ใช้โฟลเดอร์ `.next` เดียวกัน** — อย่ารัน `npm run dev` หรือ `npm run build` ในโฟลเดอร์ที่ `npm start` กำลังรันอยู่
- บนเซิร์ฟเวอร์จริง: หยุด `npm start` → `npm run build` → เริ่ม `npm start` ใหม่ → เปิดหน้าเว็บตรวจว่า CSS โหลด (ถ้า build ทับตอนเซิร์ฟเวอร์รันอยู่ หน้าเว็บจะไม่มีสไตล์)
- เครื่องทีมที่รัน dev ควรตั้ง `OPENDATA_CRON=off` ใน `.env` ไม่ให้ดึงข้อมูล 22:00 ซ้ำกับเซิร์ฟเวอร์จริง

## แผนที่โค้ด

| ที่ | ทำอะไร |
|---|---|
| `app/search`, `app/drug/[id]`, `app/groups` | เมนู **ข้อมูลยา** (ค้นหา + รายละเอียด) และ **Drug Group** |
| `app/kpi` (+ `actions.js`) | เมนู **ตัวชี้วัด** — เลือกระดับพื้นที่, เลือกไฟล์ข้อมูลแต่ละปี (cookie `kpi_files`), ปุ่มดึงรายงาน |
| `app/stats` | เมนู **สรุป** — สรุปตัวชี้วัดระดับประเทศ + สถิติฐานข้อมูลยา |
| `app/admin` | **ผู้ดูแลระบบ** — อัปโหลดไฟล์อ้างอิง, ดาวน์โหลดไฟล์ระบบ (ต้องใส่รหัส, cookie 8 ชม.) |
| `app/api/v1/[[...path]]`, `app/api/mcp`, `app/api/chat` | REST API / MCP / แชท AI — ทั้งหมดเรียกเครื่องมือชุดเดียวกันใน `lib/agent-tools.js` |
| `app/api/export`, `app/api/kpi/not-found-24` | ดาวน์โหลด Excel ข้อมูลทั้งหมด (เกินที่แสดงบนหน้า) |
| `app/llms.txt`, `app/api-docs` | บอก AI/คนว่ามี API อะไร |
| `lib/drugs.js` | query ข้อมูลยา (`drug_lookup` ใน herb.db) |
| `lib/kpi.js` | query ตัวชี้วัด (kpi.db) — `resolveSets`, `getCompareReport`, `getCodeErrors`, `EXCLUDED_ZONES` |
| `lib/agent-tools.js` | เครื่องมือ 8 ตัวสำหรับ AI (`search_drugs`, `get_drug_by_code24`, `kpi_report`, `kpi_find_area`, …) — **แก้ที่นี่ที่เดียว** REST/MCP/แชทได้ผลพร้อมกัน; `lib/openapi.js` สร้างเอกสารจาก schema ของเครื่องมือ |
| `lib/scheduler.js` + `instrumentation.js` | ตั้งเวลาดึง opendata 22:00, retry 5 ครั้ง, ล็อก `data/fetch.lock` |
| `lib/nav.js`, `components/NavLinks.jsx` | เมนูหลัก (ไฮไลต์เมนูที่เปิดอยู่) |
| `scripts/import.js` + `schema.sql` | สร้าง herb.db; `scripts/kpi-lib.js` + `import-kpi.js` สร้าง kpi.db; `scripts/reference-files.js` ชื่อไฟล์อ้างอิง + ตรวจรูปแบบไฟล์ที่อัปโหลด |

ฐานข้อมูล (ไม่อยู่ใน git — สร้างจากสคริปต์):
- `data/herb.db`: `drug_codes`, `ttmt_master`, `drug_group_rates`, `meta`, view `drug_lookup`
- `data/kpi.db`: `datasets` (1 ไฟล์ = 1 dataset), `sttm4` (หน่วยบริการ × รหัสยา), `kpi_hosp` (สรุปรายหน่วยบริการ), `dtam24`, `herbal_drug_master_11`, `health_office`, `health_office_type`

## กติกาข้อมูล (อย่าเปลี่ยนโดยไม่ถามเจ้าของโปรเจกต์)

- ไฟล์รหัส 24 หลัก: ใช้เฉพาะ sheet **เดี่ยว + ตำรับ** (ไม่ใช้ sheet ยกเลิก) · 1 แถวใน Excel = 1 แถวในฐานข้อมูล (รหัส 24 หลักซ้ำได้ — TTMTID ต่างกัน)
- เชื่อม `TTMTID` ↔ `TTMTCode` ใน Master · ไม่พบใน Master หรือ `Drug_Group_Nhso` ว่าง → แสดง **"ไม่มี Drug Group"**
- ตัวชี้วัด: มูลค่า = `vs_uc` × `price` ของกลุ่มยา 11 หลัก (`herbal_drug_master_11`) · กลุ่มที่ไม่พบ = 0 บาท และแสดงเป็น **"ไม่พบรายการยาหรือรายการยาถูกยกเลิกรหัส"**
- **ไม่นับเขตสุขภาพที่ 13** และหน่วยบริการที่ไม่พบเขต (`EXCLUDED_ZONES`)
- อัตรารหัสยาที่ผิดพลาด = รหัส (หลังล้าง) ที่ไม่พบในไฟล์รหัส 24 หลัก ÷ ทั้งหมด นับตาม **รายการยา (หน่วยบริการ × รหัสยา)** · คอลัมน์ "เปลี่ยนแปลง" แสดงเป็น **%**
- ไฟล์ในโฟลเดอร์ `opendata-2570/` ตอนนี้ยังเป็น **ข้อมูลปี 2569** (opendata ยังไม่มี 2570 — `fetchYear` ใน manifest) หน้าเว็บและ API ต้องเตือนเรื่องนี้เสมอ จะหายเองเมื่อดึงข้อมูล 2570 ได้จริง
- ข้อมูลยาและตัวชี้วัดเปิดให้ทุกคนอ่าน (API/MCP ไม่ใช้ key) — ตัดสินใจแล้ว

## ขั้นตอนทำงานร่วมกัน

1. แตก branch จาก `main` (`feat/...`, `fix/...`, `docs/...`) — อย่า commit ตรงเข้า `main`
2. แก้โค้ด → `npm run lint` → `npm run build` ต้องผ่าน → ทดสอบหน้าที่แก้จริงในเบราว์เซอร์
3. commit ข้อความภาษาอังกฤษสั้น ๆ บอกว่าเปลี่ยนอะไร → push branch → เปิด PR (หรือ merge เข้า `main` ถ้าเจ้าของโปรเจกต์อนุญาต)
4. งานจะถือว่า "เสร็จ" เมื่อ merge เข้า `main`, push แล้ว และเซิร์ฟเวอร์ :4000 build + restart แล้ว (เฉพาะเครื่องที่รันเว็บจริง)
5. ถ้าเปลี่ยนพฤติกรรม/การตั้งค่า ให้อัปเดต README.md หรือ PLAN.md ในงานเดียวกัน

## สิ่งที่ห้าม / ต้องระวัง

- ห้าม commit `.env`, `data/*.db`, `logs/`, `publicfiles/opendata-2570/*.xlsx` (อยู่ใน `.gitignore` แล้ว) และห้ามใส่รหัสผ่าน/API key ลงในโค้ดหรือเอกสาร
- รหัสต่าง ๆ อยู่ใน `.env`: `FETCH_NOW_CODE`, `ADMIN_CODE`, `ADMIN_PAGE_CODE`, `ANTHROPIC_API_KEY` — ถามเจ้าของโปรเจกต์ ไม่ต้องเดา
- แชท AI มีค่าใช้จ่ายจริงต่อข้อความ — อย่าทดสอบวนซ้ำ ๆ กับ key จริง (ทดสอบด้วย key ปลอมได้ ระบบจะตอบ error ที่ควบคุมไว้)
- PowerShell 5.1 `Set-Content -Encoding utf8` ใส่ BOM หน้าไฟล์ — ใช้เครื่องมือแก้ไฟล์ของ Claude หรือ Bash แทน
- ไฟล์ใช้ LF (`.gitattributes`) — คำเตือน CRLF ตอน `git add` บน Windows เป็นเรื่องปกติ
