# HERB Center — ฐานข้อมูลรหัสยาสมุนไพร

เว็บรวม **รหัสยาแผนไทย 24 หลัก** (กรมการแพทย์แผนไทยและการแพทย์ทางเลือก) กับ **TTMT Master** (สมสท.)
เพื่อดูว่ายาแต่ละรายการมี TTMTID อะไร อยู่ใน Drug Group ใด เบิกได้เท่าไหร่ต่อ course
พร้อมติดตามตัวชี้วัด **มูลค่ายาสมุนไพรในสิทธิ UC** รายหน่วยบริการถึงระดับประเทศ และเปิดให้ AI ดึงข้อมูลได้

- เว็บจริง: **https://herb.thaipadi.com**
- เอกสารในโปรเจกต์:
  - **README.md** (ไฟล์นี้) — ภาพรวม, ติดตั้ง, การใช้งาน, การตั้งค่า
  - **[CLAUDE.md](CLAUDE.md)** — กติกาโค้ด แผนที่โค้ด และขั้นตอนทำงานร่วมกัน (Claude Code อ่านอัตโนมัติ — คนในทีมควรอ่านด้วย)
  - **[PLAN.md](PLAN.md)** — แผนงาน สถานะ และการตัดสินใจของทีม

## เมนูในเว็บ

| เมนู | URL | ทำอะไร |
|---|---|---|
| หน้าหลัก | `/` | ช่องค้นหา + ตัวเลขสรุป |
| ข้อมูลยา | `/search`, `/drug/[id]` | ค้นหา/กรอง (ประเภท, Drug Group, หน่วยเบิก, ชื่อยา, ผู้ผลิต, รหัสที่มาของยา) + รายละเอียดยา |
| Drug Group | `/groups` | รายการ Drug Group พร้อมอัตราเบิก |
| ตัวชี้วัด | `/kpi` | มูลค่ายาสมุนไพรในสิทธิ UC เทียบ 2 ปีล่าสุด หรือติ๊กเลือกปีที่จะเทียบเอง (เช่น 2568 · 2569 · 2570) + อัตรารหัสยาที่ผิดพลาด + รหัส 24 หลักที่ไม่พบ |
| สรุป | `/stats` | สรุปตัวชี้วัดระดับประเทศ + สถิติฐานข้อมูลยา |
| ผู้ดูแลระบบ | `/admin` | อัปโหลดไฟล์อ้างอิง / ดาวน์โหลดไฟล์ระบบ (ต้องใส่รหัส) |
| (footer) API / MCP | `/api-docs` | วิธีให้ AI หรือระบบอื่นดึงข้อมูล |

ทุกตารางมีปุ่ม **ดาวน์โหลด Excel** · ปุ่ม **ถาม AI** มุมขวาล่างจะแสดงเมื่อตั้ง `ANTHROPIC_API_KEY`

## ติดตั้งบนเครื่องทีม (หลัง clone)

ต้องมี **Node.js 18.18 ขึ้นไป** และ git

```bash
git clone https://github.com/arofatsabuding/data_herb.git
cd data_herb
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

`npm run dev` ไม่ดึงข้อมูลอัตโนมัติ 22:00 (ดึงเฉพาะเซิร์ฟเวอร์จริงที่รัน `npm start`) — ไม่ต้องตั้งอะไรเพิ่ม

รหัสต่าง ๆ (`FETCH_NOW_CODE`, `ADMIN_CODE`, `ADMIN_PAGE_CODE`, `ANTHROPIC_API_KEY`) ขอจากผู้ดูแลโปรเจกต์ — ไม่ต้องใส่ก็รันได้ แต่ปุ่มที่ต้องใช้รหัส/แชท AI จะใช้ไม่ได้

สร้างฐานข้อมูล (ไม่อยู่ใน git) แล้วเปิดเว็บ:

```bash
npm run import            # ไฟล์ Excel ใน publicfiles/ → data/herb.db
npm run import:kpi        # ไฟล์ opendata-<ปี>/ → data/kpi.db
npm run dev               # http://localhost:3000
```

> ไฟล์ข้อมูลปี 2569 อยู่ใน git แล้ว แต่ไฟล์ใน `publicfiles/opendata-2570/` **ไม่อยู่ใน git** (ไฟล์ใหญ่ ดึงใหม่ทุกวัน)
> ข้อมูลปีย้อนหลัง (เช่น 2568) ดึงได้ด้วย `npm run fetch:opendata -- --year 2568` → `publicfiles/opendata-2568/`
> ถ้าต้องการข้อมูลเทียบหลายปีบนเครื่องตัวเอง ให้รัน `npm run fetch:opendata` (ใช้อินเทอร์เน็ต ประมาณ 4–8 นาที) หรือขอไฟล์จากผู้ดูแลมาวางในโฟลเดอร์นั้น แล้วรัน `npm run import:kpi`

ใช้กับ **Claude Code**: เปิด `claude` ในโฟลเดอร์โปรเจกต์ — Claude จะอ่าน `CLAUDE.md` เองและทำงานตามกติกาของทีม

## ทำงานร่วมกันหลายคน

ใช้ git ปกติ: แตก branch → แก้ → `npm run check` → push → เปิด PR → CI ผ่านแล้ว merge (รายละเอียดใน [CLAUDE.md](CLAUDE.md))

```bash
git checkout main && git pull
git checkout -b feat/<เรื่องที่ทำ>
# ... แก้โค้ด ...
npm run check                 # lint + build
git push -u origin feat/<เรื่องที่ทำ> && gh pr create
```

ทุก PR มี **CI** บน GitHub Actions ตรวจ lint → สร้างฐานข้อมูลจากไฟล์ใน git → build → smoke test (หน้าเว็บ, REST API, MCP)

## คำสั่ง

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | โหมดพัฒนา http://localhost:3000 (build ที่ `.next-dev` แยกจากเซิร์ฟเวอร์จริง, ไม่ดึงข้อมูล 22:00) |
| `npm run build` / `npm start` | build และรันใช้งานจริง http://localhost:4000 |
| `npm run import` | สร้าง data/herb.db ใหม่จากไฟล์ Excel (ปิดเซิร์ฟเวอร์ก่อน — Windows ล็อกไฟล์) |
| `npm run import:kpi` | นำเข้าไฟล์ล่าสุดของทุกโฟลเดอร์ `opendata-<ปี>` ลง data/kpi.db (ไม่ต้องปิดเซิร์ฟเวอร์) |
| `npm run fetch:opendata` | ดึง s_ttm4 จาก opendata.moph.go.th → `publicfiles/opendata-2570/` → นำเข้า kpi.db |
| `npm run lint` | ตรวจโค้ด |
| `npm run check` | lint + build (ต้องผ่านก่อนเปิด PR) |
| `npm run test:smoke` | ตรวจหน้าเว็บ / REST API / MCP ของเว็บที่รันอยู่ (`-- http://localhost:4000` = เซิร์ฟเวอร์จริง) |

## ไฟล์อ้างอิง (publicfiles/)

อัปเดตได้จากเมนู **ผู้ดูแลระบบ** โดยไม่ต้องปิดเซิร์ฟเวอร์: ระบบตรวจชื่อ sheet/หัวคอลัมน์ก่อน (ไม่ถูกต้อง = ใช้ไฟล์เดิมต่อ)
ตั้งชื่อไฟล์ใหม่ตามตารางนี้เสมอ สำรองไฟล์เดิมที่ `data/reference-archive/` (5 รุ่นล่าสุด) แล้วสร้างฐานข้อมูล + คำนวณตัวชี้วัดใหม่ (~15 วินาที)
หรือวางไฟล์เองแล้วรัน `npm run import` + `npm run import:kpi`

| ไฟล์ | ที่มา / ชื่อเดิม | ต้องมี |
|---|---|---|
| `dtam_drug_codes_24.xlsx` | กรมการแพทย์แผนไทยฯ (รหัสยา24หลักทั้งหมด.xlsx) | sheet ขึ้นต้นด้วย "เดี่ยว" และ "ตำรับ", คอลัมน์ TTMTID, รหัสยาแผนไทย 24 หลัก |
| `ttmt_master.xls` (หรือ .xlsx) | สมสท. (MasterTTMT_THIS_20260715.xls) | TTMTCode, Drug_Group_Nhso |
| `ttmt_drug_group_rates.xlsx` | อัตราเบิกต่อ Drug Group | drug_group, course, unit (บาท/point) |
| `herbal_drug_master_11.xlsx` | กลุ่มยา 11 หลัก + ราคาต่อ course (ตัวชี้วัด) | code11, full_name, course, price |
| `health_office.xlsx` | หน่วยบริการ → อำเภอ/จังหวัด/เขต | code5, name, health_office_type_code, district_code, province_code, health_zone |
| `health_office_type.xlsx` | ประเภทหน่วยบริการ | code, name |
| `opendata-<ปี>/Data_<ปี>_sttm4_<แถว>_<dd-mm-yy>[_HH.MM].xlsx` | ข้อมูลการจ่ายยาจาก opendata (1 แถว = หน่วยบริการ × รหัสยา) | — |

## หลักการรวมข้อมูลยา

- ใช้ sheet **เดี่ยว + ตำรับ** (ไม่ใช้ sheet ยกเลิก) · 1 แถวใน Excel = 1 แถวในฐานข้อมูล (รหัส 24 หลักซ้ำได้ เช่น ขนาดบรรจุต่างกัน → TTMTID ต่างกัน)
- เชื่อม `TTMTID` กับ `TTMTCode` ใน Master · ไม่พบ หรือ `Drug_Group_Nhso` ว่าง → **"ไม่มี Drug Group"**
- เชื่อม Drug Group กับ `ttmt_drug_group_rates.xlsx` → อัตราเบิกต่อ course เป็น บาท หรือ point

## ตัวชี้วัด (/kpi)

**มูลค่ายาสมุนไพรในสิทธิ UC** เทียบ 2 โฟลเดอร์ `opendata-<ปี>` ล่าสุด (ตอนนี้ 2569 → 2570) พร้อมร้อยละการเปลี่ยนแปลง

| ระดับ | ตัวอย่าง URL |
|---|---|
| ประเทศ (ค่าเริ่มต้น) | `/kpi?view=country` |
| เขตสุขภาพ | `/kpi?view=zone&zone=12` |
| จังหวัด | `/kpi?view=province&province=96` |
| อำเภอ | `/kpi?view=district&province=96&district=9611` |
| หน่วยบริการ | `/kpi?view=hosp&hosp=11442` |

วิธีคำนวณ
1. ล้าง `didstd` ให้เหลือแต่ตัวเลข ใช้ 11 หลักแรกหากลุ่มยาใน `herbal_drug_master_11`
2. มูลค่า = `vs_uc` × `price` — กลุ่มที่ไม่พบ = 0 บาท ("ไม่พบรายการยาหรือรายการยาถูกยกเลิกรหัส")
3. ไม่นับหน่วยบริการในเขตสุขภาพที่ 13 และที่ไม่พบเขตสุขภาพ (`EXCLUDED_ZONES` ใน `lib/kpi.js`)
4. รหัส 24 หลัก (หลังล้าง) ตรวจกับไฟล์รหัสยาแผนไทย → ชื่อยา + รหัสที่มาของยา; รหัสที่ไม่พบแสดงแยก (ดาวน์โหลด Excel ได้)
5. **อัตรารหัสยาที่ผิดพลาด** = รหัสที่ไม่พบในไฟล์รหัส 24 หลัก (รวมรหัสว่าง/ไม่ครบหลัก) ÷ ทั้งหมด × 100 นับตามรายการยา (หน่วยบริการ × รหัสยา)

เลือกไฟล์ข้อมูลของแต่ละปีได้จาก dropdown ในหน้า /kpi (ค่าเริ่มต้น "ล่าสุดเสมอ") — เก็บใน cookie `kpi_files` แต่ละคนเลือกต่างกันได้
ทุกไฟล์เป็น dataset แยกใน kpi.db (~28 MB/ไฟล์) ไฟล์ที่ยังไม่นำเข้าจะนำเข้าเบื้องหลังเมื่อมีคนเลือก (~1 นาที) เก็บสูงสุด `KPI_MAX_DATASETS` ไฟล์

> ⚠️ ตอนนี้ opendata ยังไม่มีข้อมูลปี 2570 ระบบจึงดึงข้อมูล 2569 มาเก็บในโฟลเดอร์ 2570 ไปก่อน (dropdown, หน้าเว็บ และ API จะบอกว่าเป็นข้อมูลปีไหน)
> เมื่อ API มีข้อมูล 2570 ระบบจะเปลี่ยนไปดึง 2570 เอง (`OPENDATA_FETCH_YEAR=auto`)

### ดึงข้อมูลอัตโนมัติทุกวัน 22:00 (เซิร์ฟเวอร์จริง)

- เริ่มเองเมื่อเปิดเว็บ (`instrumentation.js` → `lib/scheduler.js`) · log: `logs/opendata-YYYY-MM-DD.log` · สถานะ: `data/fetch-status.json` (แสดงในหน้า /kpi)
- บันทึกไฟล์เฉพาะเมื่อดึงครบ 77 จังหวัด · ไม่สำเร็จ → ลองใหม่ 5 ครั้ง ห่าง 10 นาที ครบแล้วยังไม่ได้ = วันนั้น "ไม่มีรายงาน"
- ดึงได้ครั้งละ 1 งาน (`data/fetch.lock`) · เซิร์ฟเวอร์ปิดอยู่ตอน 22:00 → เริ่มรอบนั้น 1 นาทีหลังเปิด
- **ดึงรายงาน ณ ปัจจุบัน**: ปุ่มในหน้า /kpi (ต้องใส่ `FETCH_NOW_CODE`) หรือ `npm run fetch:opendata`

## สำหรับ AI และระบบภายนอก

ข้อมูลอ่านอย่างเดียว เปิดให้ทุกคนใช้ ไม่ต้องใช้ key — คู่มือเต็มที่ `/api-docs`

| ช่องทาง | URL | ใช้กับ |
|---|---|---|
| MCP server (Streamable HTTP) | `/api/mcp` | Claude (Settings → Connectors → Add custom connector), Claude Code: `claude mcp add --transport http herb-center https://herb.thaipadi.com/api/mcp` |
| REST API (JSON) | `/api/v1`, เอกสาร `/api/v1/openapi.json` | ChatGPT Actions, สคริปต์, ระบบอื่น |
| llms.txt | `/llms.txt` | AI ที่เข้ามาอ่านเว็บ |
| แชทในเว็บ | `/api/chat` + ปุ่ม "ถาม AI" | ผู้ใช้เว็บ (Claude Opus 5.5, จำกัด 20 ข้อความ/IP/ชม. และ 500/วัน) |

ตัวอย่าง: `GET /api/v1/drugs/<รหัส 24 หลัก>` · `GET /api/v1/kpi/hosp/11442` · `GET /api/v1/kpi/areas?q=สารภี` · `GET /api/v1/kpi?level=province&code=50`

ทั้ง 3 ช่องทางใช้เครื่องมือชุดเดียวกันใน `lib/agent-tools.js`

## ตั้งค่า (.env)

ดูตัวอย่างทั้งหมดที่ `.env.example` — `.env` ไม่ขึ้น git

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `FETCH_NOW_CODE` | (ไม่ตั้ง = ปุ่มใช้ไม่ได้) | รหัสยืนยันปุ่ม "ดึงรายงาน ณ ปัจจุบัน" |
| `ADMIN_PAGE_CODE` | ค่าในโค้ด | รหัสเข้าเมนูผู้ดูแลระบบ — **เซิร์ฟเวอร์จริงควรตั้งเสมอ** |
| `ADMIN_CODE` | ใช้ `FETCH_NOW_CODE` | รหัสยืนยันการอัปโหลดไฟล์อ้างอิง |
| `ANTHROPIC_API_KEY` | (ไม่ตั้ง = ไม่มีปุ่มแชท) | key ของ Claude สำหรับแชท AI (มีค่าใช้จ่าย) |
| `CHAT_MODEL` / `CHAT_PER_IP` / `CHAT_PER_DAY` / `CHAT_ENABLED` | `claude-opus-5-5` / 20 / 500 / เปิด | โมเดล, โควตาแชท, `0` = ปิดแชทชั่วคราว |
| `OPENDATA_CRON` | เปิดเฉพาะ `npm start` | `on` / `off` = บังคับเปิด/ปิดการดึงอัตโนมัติ |
| `OPENDATA_CRON_TIME` | `0 22 * * *` | เวลาดึง (cron) |
| `OPENDATA_FETCH_YEAR` / `OPENDATA_FALLBACK_YEAR` | `auto` / 2569 | ปีที่ดึง / ปีที่ใช้แทนเมื่อยังไม่มีข้อมูล (`none` = ไม่ดึง) |
| `KPI_MAX_DATASETS` | 12 | จำนวนไฟล์ตัวชี้วัดที่เก็บในฐานข้อมูลพร้อมกัน |

## โครงสร้างโปรเจกต์

```
app/                 หน้าเว็บ + API (Next.js App Router)
  search/ drug/[id]/ groups/ kpi/ stats/ admin/ api-docs/
  api/v1/ api/mcp/ api/chat/      REST API / MCP / แชท AI
  api/export/ api/kpi/ api/admin/ ดาวน์โหลด Excel / ไฟล์ระบบ
  llms.txt/
components/          ส่วนประกอบหน้าเว็บ (ExcelButton, ChatWidget, NavLinks, Kpi*, …)
lib/                 drugs.js, kpi.js, agent-tools.js, scheduler.js, excel.js, db.js, …
scripts/             import.js + schema.sql, import-kpi.js + kpi-lib.js, fetch-opendata.js, reference-files.js
publicfiles/         ไฟล์ Excel ต้นทาง (opendata-2570/*.xlsx ไม่อยู่ใน git)
data/                herb.db, kpi.db, สถานะการดึงข้อมูล (ไม่อยู่ใน git)
logs/                log การดึงข้อมูล (ไม่อยู่ใน git)
```

## ติดตั้งบนเซิร์ฟเวอร์จริง

```bash
npm ci && npm run import && npm run import:kpi && npm run build
pm2 start npm --name data_herb -- start   # รันตลอด + เริ่มเองหลังรีบูต: pm2 save && pm2 startup
```

ตอนนี้เปิดสู่อินเทอร์เน็ตผ่าน Cloudflare Tunnel (herb.thaipadi.com → localhost:4000)
อัปเดตโค้ด: `git pull` → หยุดเว็บ → `npm ci` (ถ้า package เปลี่ยน) → `npm run build` → เริ่มเว็บใหม่ → `npm run test:smoke -- http://localhost:4000`
