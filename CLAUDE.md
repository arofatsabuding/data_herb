# CLAUDE.md — คู่มือสำหรับ Claude Code (และคนในทีม)

ไฟล์นี้ Claude Code อ่านอัตโนมัติทุกครั้งที่เปิดโปรเจกต์ ใส่เฉพาะสิ่งที่ต้องรู้ก่อนแก้โค้ด
รายละเอียดการใช้งาน/ตั้งค่าอยู่ใน [README.md](README.md) · แผนงานและการตัดสินใจของทีมอยู่ใน [PLAN.md](PLAN.md)

## โปรเจกต์นี้คืออะไร

**HERB Center** — เว็บค้นหารหัสยาสมุนไพร/ยาแผนไทย (Next.js 15 + SQLite) ของทีม DTAM
- รวม **รหัสยาแผนไทย 24 หลัก** (กรมการแพทย์แผนไทยฯ) กับ **TTMT Master** (สมสท.) → TTMTID, Drug Group, อัตราเบิกต่อ course
- **ตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC"** เทียบ 2 ปีงบประมาณล่าสุด หรือปีที่ผู้ใช้เลือกเอง (cookie `kpi_years`) ระดับประเทศ/เขต/จังหวัด/อำเภอ/หน่วยบริการ จากข้อมูล opendata.moph.go.th (ดึงอัตโนมัติทุกวัน 22:00)
- เปิดให้ AI/ระบบอื่นใช้: REST API `/api/v1` (ข้อมูลยา + ตัวชี้วัด), MCP server `/api/mcp` (**เฉพาะข้อมูลยา**) · แชท "ถาม AI" เอาออกแล้วเพราะมีค่าใช้จ่าย — อย่าเพิ่มกลับโดยไม่ถามเจ้าของโปรเจกต์
- เว็บจริง: https://herb.thaipadi.com (Cloudflare Tunnel → `next start` พอร์ต 4000 บนเครื่องผู้ดูแลโปรเจกต์) · repo: github.com/arofatsabuding/data_herb (private)
- ผู้ใช้และทีมสื่อสารเป็น **ภาษาไทย** — ตอบเป็นภาษาไทย ข้อความบนหน้าเว็บเป็นภาษาไทย คอมเมนต์ในโค้ดเป็นภาษาไทย

## กติกาโค้ด (ต้องทำตาม)

- **JavaScript ไม่ใช้ TypeScript** — ไฟล์ที่มี JSX ใช้ `.jsx` (หน้า/คอมโพเนนต์), ไฟล์ที่ไม่มี JSX ใช้ `.js` (`lib/`, `route.js`, `scripts/`)
- **SQLite** ผ่าน `better-sqlite3` (sync) — เขียน SQL ปกติแบบ parameterized (`@name`) ห้ามต่อสตริงจากค่าที่ผู้ใช้ส่งมา
- Tailwind CSS v3 + ฟอนต์ Sarabun · **โทนสว่าง**: พื้นขาว/`slate-50`, หัวหน้า (hero) ไล่สี `emerald-50 → teal-50`, ตัวเน้น emerald/teal ไล่สี · สีทอง amber สำหรับเมนูที่ต้อง login (สรุป/วิเคราะห์รหัสยา/ผู้ดูแลระบบ), สีฟ้า sky เส้นประสำหรับเมนูผู้พัฒนา, สีแดง rose สำหรับส่วน "รหัสยาที่ผิดพลาด"
- Server Component เป็นค่าเริ่มต้น ใส่ `'use client'` เฉพาะคอมโพเนนต์ที่ต้องใช้ state/event
- อย่า import ค่าที่ไม่ใช่คอมโพเนนต์ (เช่น array) จากไฟล์ `'use client'` เข้า Server Component — ให้ย้ายไปไว้ใน `lib/` (ดู `lib/nav.js`)
- ไฟล์ดาวน์โหลดทุกจุดเป็น **Excel (.xlsx) ไม่ใช่ CSV** — ใช้ `components/ExcelButton.jsx` (ฝั่งเบราว์เซอร์) หรือ `lib/excel.js` (`xlsxResponse` ฝั่งเซิร์ฟเวอร์) ทุกตารางใหม่ต้องมีปุ่ม Excel
- ตารางที่แสดงตัวเลขต้องมี **แถวรวม** ท้ายตาราง
- เขียนให้เหมือนโค้ดรอบ ๆ (ชื่อ, ความหนาแน่นของคอมเมนต์, สไตล์) — รัน `npm run check` ก่อน commit (`.editorconfig` กำหนด 2 ช่องว่าง, LF, UTF-8)

## คำสั่ง

```bash
npm install
npm run import          # Excel ใน publicfiles/ → data/herb.db (ปิดเซิร์ฟเวอร์ก่อน: Windows ล็อกไฟล์)
npm run import:kpi      # opendata-<ปี>/*.xlsx → data/kpi.db (ไม่ต้องปิดเซิร์ฟเวอร์)
npm run fetch:opendata  # ดึงข้อมูลจาก opendata.moph.go.th → publicfiles/opendata-2570/ → kpi.db
npm run dev             # http://localhost:3000 (เครื่องทีม) — build ไว้ที่ .next-dev
npm run build && npm start   # http://localhost:4000 (เซิร์ฟเวอร์จริง) — build ไว้ที่ .next
npm run check           # lint + build (ต้องผ่านก่อนเปิด PR — CI รันแบบเดียวกัน)
npm run test:smoke      # ตรวจหน้าเว็บ/API/MCP ของเว็บที่รันอยู่ (ค่าเริ่มต้น :3000, ใส่ -- http://localhost:4000 ได้)
```

- `npm run dev` (`.next-dev`) กับ `npm start` (`.next`) แยกโฟลเดอร์กันแล้ว รัน dev บนเครื่องเซิร์ฟเวอร์จริงได้ แต่ **ห้ามรัน `npm run build` ตอน `npm start` รันอยู่** (ทับ `.next` → หน้าเว็บไม่มีสไตล์)
- บนเซิร์ฟเวอร์จริง: หยุด `npm start` → `npm run build` → เริ่ม `npm start` ใหม่ → `npm run test:smoke -- http://localhost:4000`
- ดึงข้อมูล 22:00 อัตโนมัติ **เฉพาะ `npm start`** — `npm run dev` ไม่ดึง (บังคับได้ด้วย `OPENDATA_CRON=on|off`)

## แผนที่โค้ด

| ที่ | ทำอะไร |
|---|---|
| `app/search`, `app/drug/[id]`, `app/groups` | เมนู **ข้อมูลยา** (ค้นหา + รายละเอียด) และ **Drug Group** |
| `app/kpi` (+ `actions.js`) | เมนู **ตัวชี้วัด** — เลือกระดับพื้นที่, เลือกปีที่เทียบ (cookie `kpi_years`), เลือกไฟล์ข้อมูลแต่ละปี (cookie `kpi_files`), ปุ่มดึงรายงาน |
| `app/analysis` (+ `app/api/analysis/drug-usage`) | เมนู **วิเคราะห์รหัสยา** (ต้อง login) — ยาที่ใช้มาก × เข้าเกณฑ์ตัวชี้วัด × มี Drug Group + ผู้ผลิต (`getDrugUsage`, `usageByManufacturer` ใน `lib/kpi.js`, cache ในหน่วยความจำ) |
| `app/stats` | เมนู **สรุป** — สรุปตัวชี้วัดระดับประเทศ + สถิติฐานข้อมูลยา |
| `app/admin` | **ผู้ดูแลระบบ** — อัปโหลดไฟล์อ้างอิง, ดาวน์โหลดไฟล์ระบบ (ต้อง login) |
| `app/login`, `app/api/auth/*`, `middleware.js` | **เข้าสู่ระบบด้วย ThaiD** (วิธีเดียว) — `lib/auth.js` (session, `ACCESS` สิทธิ์ขั้นต่ำของแต่ละส่วน, dev = `THAID_DEV_CIDS`), `lib/auth-db.js` (data/auth.db: ผู้ใช้ + ประวัติเข้าใช้) |
| `app/privacy`, `app/terms` (+ `components/LegalPage.jsx`, `lib/site.js`) | นโยบายความเป็นส่วนตัว / ข้อกำหนดการใช้งาน — **แก้สิ่งที่ระบบเก็บ (ข้อมูลผู้ใช้, cookie, log) ต้องแก้ /privacy ในงานเดียวกัน** |
| `app/dev` | **ผู้พัฒนา** — รายชื่อผู้ใช้, ตั้ง role (user/admin), ประวัติเข้าใช้ (เฉพาะ dev) |
| `app/api/v1/[[...path]]`, `app/api/mcp` | REST API / MCP — เรียกเครื่องมือชุดเดียวกันใน `lib/agent-tools.js` (MCP ใช้เฉพาะ `MCP_TOOLS` = group `drug`) |
| `app/api/export`, `app/api/kpi/not-found-24` | ดาวน์โหลด Excel ข้อมูลทั้งหมด (เกินที่แสดงบนหน้า) |
| `app/llms.txt`, `app/api-docs` | บอก AI/คนว่ามี API อะไร · `app/api-docs/swagger` = Swagger UI (`components/SwaggerUI.jsx`, swagger-ui-dist) อ่าน `/api/v1/openapi.json` — ค่าตัวอย่างตั้งที่ `example`/`body` ใน `lib/openapi.js` |
| `lib/drugs.js` | query ข้อมูลยา (`drug_lookup` ใน herb.db) |
| `lib/drug-check.js` | ตรวจรายการยาที่ HIS ส่งมา (`POST /api/v1/drugs/check`, MCP `check_drug_list`) — กติกาเดียวกับตัวชี้วัด |
| `lib/kpi.js` | query ตัวชี้วัด (kpi.db) — `resolveSets`, `getCompareReport`, `getCodeErrors`, `getDrugUsage`, `EXCLUDED_ZONES` |
| `lib/agent-tools.js` | เครื่องมือ 9 ตัวสำหรับ AI (`search_drugs`, `get_drug_by_code24`, `check_drug_list`, `kpi_report`, `kpi_find_area`, …) — **แก้ที่นี่ที่เดียว** REST/MCP ได้ผลพร้อมกัน · ทุกตัวต้องมี `group: 'drug' | 'kpi'` (kpi ไม่ออก MCP); `lib/openapi.js` สร้างเอกสารจาก schema ของเครื่องมือ |
| `lib/scheduler.js` + `instrumentation.js` | ตั้งเวลาดึง opendata 22:00 (เฉพาะ `npm start`), retry 5 ครั้ง, ล็อก `data/fetch.lock` |
| `scripts/smoke-test.js`, `.github/` | smoke test, CI (GitHub Actions), PR template |
| `lib/nav.js`, `components/SiteNav.jsx` | เมนูหลัก (ไฮไลต์เมนูที่เปิดอยู่) + เมนูที่ต้อง login · จอเล็กกว่า `xl` (1280px) ยุบเป็นปุ่มแฮมเบอร์เกอร์ |
| `scripts/import.js` + `schema.sql` | สร้าง herb.db; `scripts/kpi-lib.js` + `import-kpi.js` สร้าง kpi.db; `scripts/reference-files.js` ชื่อไฟล์อ้างอิง + ตรวจรูปแบบไฟล์ที่อัปโหลด |

ฐานข้อมูล (ไม่อยู่ใน git — สร้างจากสคริปต์):
- `data/herb.db`: `drug_codes`, `ttmt_master`, `drug_group_rates`, `meta`, view `drug_lookup`
- `data/auth.db`: `users` (cid_hash, cid_masked, name, role), `login_log` — สร้างเองตอน login ครั้งแรก
- `data/kpi.db`: `datasets` (1 ไฟล์ = 1 dataset), `sttm4` (หน่วยบริการ × รหัสยา), `kpi_hosp` (สรุปรายหน่วยบริการ), `dtam24`, `herbal_drug_master_11`, `health_office`, `health_office_type`

## กติกาข้อมูล (อย่าเปลี่ยนโดยไม่ถามเจ้าของโปรเจกต์)

- ไฟล์รหัส 24 หลัก: ใช้เฉพาะ sheet **เดี่ยว + ตำรับ** (ไม่ใช้ sheet ยกเลิก) · 1 แถวใน Excel = 1 แถวในฐานข้อมูล (รหัส 24 หลักซ้ำได้ — TTMTID ต่างกัน)
- เชื่อม `TTMTID` ↔ `TTMTCode` ใน Master · ไม่พบใน Master หรือ `Drug_Group_Nhso` ว่าง → แสดง **"ไม่มี Drug Group"**
- ตัวชี้วัด: มูลค่า = `vs_uc` × `price` ของกลุ่มยา 11 หลัก (`herbal_drug_master_11`) · กลุ่มที่ไม่พบ = 0 บาท และแสดงเป็น **"ไม่พบรายการยาหรือรายการยาถูกยกเลิกรหัส"**
- **ไม่นับเขตสุขภาพที่ 13** และหน่วยบริการที่ไม่พบเขต (`EXCLUDED_ZONES`)
- อัตรารหัสยาที่ผิดพลาด = รหัส (หลังล้าง) ที่ไม่พบในไฟล์รหัส 24 หลัก ÷ ทั้งหมด นับตาม **รายการยา (หน่วยบริการ × รหัสยา)** · คอลัมน์ "เปลี่ยนแปลง" แสดงเป็น **%**
- ไฟล์ในโฟลเดอร์ `opendata-2570/` ตอนนี้ยังเป็น **ข้อมูลปี 2569** (opendata ยังไม่มี 2570 — `fetchYear` ใน manifest) หน้าเว็บและ API ต้องเตือนเรื่องนี้เสมอ จะหายเองเมื่อดึงข้อมูล 2570 ได้จริง
- ข้อมูลยาและตัวชี้วัดเปิดให้ทุกคนอ่าน (API/MCP ไม่ใช้ key) — ตัดสินใจแล้ว

## ขั้นตอนทำงานร่วมกัน (git ปกติ)

1. `git checkout main && git pull` แล้วแตก branch (`feat/...`, `fix/...`, `docs/...`) — อย่า commit ตรงเข้า `main`
2. แก้โค้ด → `npm run check` ผ่าน → `npm run dev` แล้วเปิดหน้าที่แก้ (`npm run test:smoke` ช่วยตรวจรวม)
3. commit ข้อความภาษาอังกฤษสั้น ๆ → push branch → เปิด PR — CI (`.github/workflows/ci.yml`) ตรวจ lint + build + smoke test ให้อัตโนมัติ
4. CI ผ่าน → merge เข้า `main` · แตะกติกาข้อมูล (หัวข้อด้านบน) ให้ถามเจ้าของโปรเจกต์ก่อน
5. deploy บนเครื่องเซิร์ฟเวอร์จริง: `git pull` → หยุด `npm start` → `npm ci` (ถ้า package-lock เปลี่ยน) → `npm run build` → `npm start` → `npm run test:smoke -- http://localhost:4000`
6. เปลี่ยนพฤติกรรม/การตั้งค่า → อัปเดต README.md หรือ PLAN.md ในงานเดียวกัน

## สิ่งที่ห้าม / ต้องระวัง

- ห้าม commit `.env`, `data/*.db`, `logs/`, `publicfiles/opendata-2570/*.xlsx` (อยู่ใน `.gitignore` แล้ว) และห้ามใส่รหัสผ่าน/API key ลงในโค้ดหรือเอกสาร
- ค่าลับอยู่ใน `.env`: `THAID_CLIENT_ID`, `THAID_CLIENT_SECRET`, `THAID_DEV_CIDS` — ถามเจ้าของโปรเจกต์ ส่งกันทางช่องทางส่วนตัว ห้ามโพสต์ใน issue/PR/แชทกลุ่ม · เครื่องทีมไม่มีค่าเหล่านี้ก็พัฒนาได้ (แค่เข้าสู่ระบบไม่ได้)
- ห้ามเก็บเลขบัตรประชาชนเต็มลงฐานข้อมูลหรือ log — `data/auth.db` เก็บ sha256 + เลขที่ปิดบางส่วนเท่านั้น
- PowerShell 5.1 `Set-Content -Encoding utf8` ใส่ BOM หน้าไฟล์ — ใช้เครื่องมือแก้ไฟล์ของ Claude หรือ Bash แทน
- ไฟล์ใช้ LF (`.gitattributes`) — คำเตือน CRLF ตอน `git add` บน Windows เป็นเรื่องปกติ
- `instrumentation.js` ต้องคงรูปแบบ `if (process.env.NEXT_RUNTIME === 'nodejs') { await import(...) }` — ถ้าเขียนแบบ early return, `npm run dev` จะ bundle `lib/scheduler` (fs/path) ให้ edge runtime แล้วทุกหน้าตอบ 500
- push ไฟล์ใน `.github/workflows/` ต้องมีสิทธิ์ `workflow` ใน token ของ gh — ถ้าถูกปฏิเสธ รัน `gh auth refresh -h github.com -s workflow`
