# Data Herb — ค้นหารหัสยาสมุนไพร

รวมรหัสยาแผนไทย 24 หลัก (กรมการแพทย์แผนไทยและการแพทย์ทางเลือก) กับ TTMT Master (สมสท.)
เพื่อดูว่ายาแต่ละรายการมีรหัส 24 หลัก, TTMTID และอยู่ใน Drug Group ใด

แผนงานทั้งหมดอยู่ที่ [PLAN.md](PLAN.md)

## เริ่มต้นใช้งาน

ต้องมี Node.js 18.18 ขึ้นไป

```bash
npm install
npm run import   # อ่าน Excel ใน publicfiles/ แล้วสร้าง data/herb.db
npm run dev      # เปิด http://localhost:3000
```

## คำสั่ง

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run import` | สร้างฐานข้อมูล SQLite ใหม่จากไฟล์ Excel |
| `npm run dev` | รันโหมดพัฒนา (http://localhost:3000) |
| `npm run build` / `npm start` | build และรันสำหรับใช้งานจริง (http://localhost:4000) |
| `npm run import:kpi` | นำเข้าข้อมูลตัวชี้วัด (ปี 2569 + ไฟล์ล่าสุดของปี 2570) ลง data/kpi.db — ไม่ต้องปิดเซิร์ฟเวอร์ |
| `npm run fetch:opendata` | ดึงข้อมูล s_ttm4 จาก opendata.moph.go.th → บันทึก Excel ใน publicfiles/opendata-2570/ → นำเข้า kpi.db |
| `npm run lint` | ตรวจโค้ด |

## อัปเดตข้อมูลรอบใหม่

1. วางไฟล์ใหม่ใน `publicfiles/`
   - `รหัสยา24หลักทั้งหมด.xlsx` (ใช้ sheet ที่ชื่อขึ้นต้นด้วย "เดี่ยว" และ "ตำรับ")
   - `MasterTTMT*.xls` (มีได้ไฟล์เดียว)
   - `ttmt_drug_group.xlsx` (อัตราเบิกต่อ Drug Group: คอลัมน์ drug_group, course, unit)
2. รัน `npm run import` แล้วรีสตาร์ทเซิร์ฟเวอร์

## ติดตามตัวชี้วัด (/kpi)

ตัวชี้วัด **มูลค่ายาสมุนไพรในสิทธิ UC** เปรียบเทียบ 2 ปีงบประมาณล่าสุด (2569 → 2570) พร้อมร้อยละการเปลี่ยนแปลง

เลือกรูปแบบการแสดงผลได้ (พารามิเตอร์ `view` ใน URL)

| รูปแบบ | ต้องระบุ | ตัวอย่าง URL |
|---|---|---|
| ภาพรวมหน่วยบริการ | รหัส 5 หลัก (ค่าเริ่มต้น 11442) | `/kpi?view=hosp&hosp=11442` |
| ภาพรวมอำเภอ | จังหวัด + อำเภอ | `/kpi?view=district&province=96&district=9611` |
| ภาพรวมจังหวัด | จังหวัด | `/kpi?view=province&province=96` |
| ภาพรวมเขต | เขตสุขภาพ | `/kpi?view=zone&zone=12` |
| ภาพรวมประเทศ | - | `/kpi?view=country` (ค่าเริ่มต้น) |

| ไฟล์ใน publicfiles/ | ใช้ทำอะไร |
|---|---|
| `Data_2569_sttm4_*.xlsx` | ข้อมูลการจ่ายยาสมุนไพรปี 2569 (1 แถว = หน่วยบริการ × รหัสยา) |
| `health_office.xlsx` | hospcode → ชื่อหน่วยบริการ, อำเภอ, จังหวัด, เขตสุขภาพ (จับคู่กับ code5) |
| `health_office_type.xlsx` | ประเภทหน่วยบริการ |
| `herbal_drug_master_11.xlsx` | กลุ่มยา 11 หลัก + ราคาต่อ course |
| `opendata-2570/Data_2570_sttm4_<แถว>_<dd-mm-yy>.xlsx` | ข้อมูลรายวันที่ดึงจาก API (ไม่ commit ขึ้น git) |

วิธีคำนวณ
1. ล้าง `didstd` ให้เหลือแต่ตัวเลข แล้วตัด 11 หลักแรก → หากลุ่มใน herbal_drug_master_11
2. มูลค่าตัวชี้วัด = `vs_uc` × `price` (รหัสที่ไม่อยู่ในกลุ่ม = 0 บาท)

### ดึงข้อมูลอัตโนมัติทุกวัน 22:00

เมื่อรัน `npm start` เซิร์ฟเวอร์จะตั้งเวลาดึงข้อมูลทุกวัน 22:00 (เวลาไทย) ให้เอง log อยู่ที่ `logs/opendata-YYYY-MM-DD.log`
- บันทึกไฟล์เฉพาะเมื่อดึงได้ครบทั้ง 77 จังหวัด (ถ้าไม่ครบ ข้อมูลเดิมยังอยู่)
- รันซ้ำวันเดียวกันจะเขียนทับไฟล์ของวันนั้น
- ถ้าเซิร์ฟเวอร์ปิดอยู่ตอน 22:00 รอบนั้นจะไม่ทำงาน — รัน `npm run fetch:opendata` เองได้

ตั้งค่าใน `.env`

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `OPENDATA_FETCH_YEAR` | 2569 | ปีที่ส่งให้ API (เปลี่ยนเป็น 2570 เมื่อ API มีข้อมูลปีใหม่) |
| `OPENDATA_SAVE_YEAR` | 2570 | ปีที่ใช้ตั้งชื่อไฟล์และแสดงบนเว็บ |
| `OPENDATA_CRON` | เปิดเมื่อ production | `off` = ปิด, `on` = เปิดในโหมด dev ด้วย |
| `OPENDATA_CRON_TIME` | `0 22 * * *` | เวลาแบบ cron |

## โครงสร้าง

```
app/                หน้าเว็บ (Next.js App Router)
  page.jsx          หน้าแรก
  search/           ค้นหา + ตัวกรอง + แบ่งหน้า
  drug/[id]/        รายละเอียดยา
  groups/           รายการ Drug Group
  stats/            สรุปข้อมูล
  kpi/              ติดตามตัวชี้วัด
  api/export/       ดาวน์โหลด CSV
components/         ส่วนประกอบหน้าเว็บ
lib/drugs.js        ฟังก์ชันค้นหาข้อมูล (ใช้ร่วมกับ API/แชทบอท)
lib/kpi.js          ฟังก์ชันสรุปตัวชี้วัด
lib/scheduler.js    ตั้งเวลาดึงข้อมูล 22:00
scripts/            import.js + schema.sql, import-kpi.js, fetch-opendata.js
publicfiles/        ไฟล์ Excel ต้นทาง
data/herb.db        ฐานข้อมูลยา (npm run import, ไม่ commit)
data/kpi.db         ฐานข้อมูลตัวชี้วัด (npm run import:kpi, ไม่ commit)
```

## หลักการรวมข้อมูล

- 1 แถวในฐานข้อมูล = 1 แถวใน Excel (sheet เดี่ยว + ตำรับ, ไม่ใช้ sheet ยกเลิก)
- เชื่อม `TTMTID` กับ `TTMTCode` ใน Master
- ถ้าไม่พบใน Master หรือไม่มีค่า `Drug_Group_Nhso` → แสดง "ไม่มี Drug Group"
- เชื่อม Drug Group กับ `ttmt_drug_group.xlsx` → อัตราเบิกต่อ course (`course`) เป็น บาท หรือ point (`unit`)
- ถ้าเซิร์ฟเวอร์เปิดอยู่ ให้ปิดก่อนรัน `npm run import` (Windows ล็อกไฟล์ฐานข้อมูล)
- รหัส 24 หลักบางรหัสซ้ำกันได้ (TTMTID ต่างกัน เช่น ขนาดบรรจุต่างกัน)
