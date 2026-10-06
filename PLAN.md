# แผนพัฒนาเว็บ data_herb — รวมรหัสยาสมุนไพร (DTAM × สมสท.)

> ฉบับที่ 2 — 2026-10-06 · อัปเดตตามคำตอบของทีม

## 1. ข้อมูลต้นทาง

| ไฟล์ | ที่มา | ใช้ sheet | แถว |
|---|---|---|---|
| `ไฟล์/รหัสยา24หลักทั้งหมด.xlsx` | กรมการแพทย์แผนไทยฯ | เดี่ยว, ตำรับ (**ไม่ใช้ sheet ยกเลิก**) | 11,482 + 33,059 |
| `ไฟล์/MasterTTMT_THIS_20260715.xls` | สมสท. | l_ttmt_master_ed (ถือเป็นฉบับสมบูรณ์) | 9,470 |

กติกาการรวม:
- รวม sheet เดี่ยว + ตำรับ → 1 แถวต่อรหัส 24 หลัก (มี TTMTID ทุกแถว)
- จับคู่ TTMTID ↔ `TTMTCode` ใน Master
- ถ้า TTMTID ไม่อยู่ใน Master **หรือ** อยู่แต่ช่อง Drug_Group_Nhso ว่าง → แสดง **"ไม่มี Drug Group"**
- ผลเบื้องต้น: มี Drug Group ≈ 5,339 รายการ จาก 44,541

## 2. เทคโนโลยี

- **Next.js 15 (App Router) + JavaScript** (ไม่ใช้ TypeScript)
- **SQLite** ผ่าน `better-sqlite3` — ไฟล์เดียว `data/herb.db` ใช้ SQL ปกติ (ใกล้เคียง MySQL)
- **Tailwind CSS v3** + ฟอนต์ **Sarabun**
- Import script: `npm run import` อ่าน Excel → สร้าง `data/herb.db` ใหม่ทั้งหมด
- Deploy บน **server ของหน่วยงาน** (`npm run build && npm start` หรือ PM2/Docker) — ไม่ต้อง login

### ตาราง

- `drug_codes` — code24 (PK), ttmtid, drug_type (เดี่ยว/ตำรับ), ชื่อยา, ชื่อการค้า, สรรพคุณ, ความแรง, รูปแบบยา, ผู้ผลิต, เลขทะเบียน, รหัสทำงาน, ครั้งที่กำหนด, ขนาดบรรจุ
- `ttmt_master` — ttmt_code (PK), active_ingredient, strength, dosage_form, trade_name, manufacturer, fsn, ttmt_type, ed, drug_group_nhso
- View `drug_lookup` = `drug_codes LEFT JOIN ttmt_master` + คอลัมน์ `has_drug_group`
- `meta` — วันที่ import, ชื่อไฟล์ต้นทาง

## 3. ดีไซน์ (อ้างอิง thaipadi.com)

- โทนหลัก emerald/teal ไล่สี (`from-emerald-500 to-teal-600`), ส่วนพื้นเข้มสีกรมท่า (`#0a0e27`, `#0f1429`, `#1a1f3a`), เน้นสีทอง amber
- ฟอนต์ Sarabun, การ์ด `rounded-2xl` + เงา + hover ขยายเล็กน้อย
- Hero ไล่สีพร้อมช่องค้นหาใหญ่ตรงกลาง, การ์ดสถิติ, footer สีเข้ม

## 4. หน้าเว็บ

1. **หน้าแรก/ค้นหา** — ค้นด้วยชื่อยา / รหัส 24 หลัก / TTMTID / ผู้ผลิต / Drug Group; กรองประเภท (เดี่ยว/ตำรับ), มี-ไม่มี Drug Group; ตารางแบ่งหน้า
2. **รายละเอียดยา** `/drug/[code24]` — ข้อมูลจาก DTAM และ Master เทียบกัน
3. **สรุป** `/stats` — จำนวนรายการ, สัดส่วนที่มี Drug Group, รายการ Drug Group
4. **Export CSV** ตามผลค้นหา
5. **ปุ่มแชท AI** ลอยมุมขวาล่าง

## 5. AI

- **Chatbot** `/api/chat` — Claude + tool use (`search_drugs`, `get_drug`, `list_drug_groups`, `stats`) ตอบจาก DB จริงเท่านั้น
- **AI agent ภายนอก:**
  - REST API `GET /api/v1/drugs?q=`, `/api/v1/drugs/{code24}`, `/api/v1/ttmt/{ttmtid}`, `/api/v1/drug-groups`, `/api/v1/stats` + `/api/v1/openapi.json`
  - MCP server `/api/mcp` ใช้ tools ชุดเดียวกับ chatbot
  - API key สำหรับ agent (หน้าเว็บสาธารณะไม่ต้อง login)

## 6. GitHub

- repo **data_herb** (private), branch `main` + ทำงานผ่าน PR
- GitHub Actions: lint + build
- `.env.example` (ANTHROPIC_API_KEY, AGENT_API_KEYS) — ห้าม commit secrets
- commit ไฟล์ Excel ต้นทางใน `ไฟล์/` (ไม่ commit `data/herb.db` — สร้างด้วย `npm run import`)

## 7. ลำดับงาน

| # | งาน | สถานะ |
|---|---|---|
| 1 | ติดตั้ง gh, ตั้งโปรเจกต์ Next.js (JS) + git | กำลังทำ |
| 2 | Import script + SQLite | |
| 3 | หน้าค้นหา / รายละเอียด / สรุป / export | |
| 4 | REST API + OpenAPI | |
| 5 | Chatbot + ปุ่มแชท | |
| 6 | MCP server + API key | |
| 7 | push GitHub (รอ `gh auth login`) + CI | |
| 8 | คู่มือ deploy บน server หน่วยงาน | |
