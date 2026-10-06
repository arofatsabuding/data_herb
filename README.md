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
| `npm run dev` | รันโหมดพัฒนา |
| `npm run build` / `npm start` | build และรันสำหรับใช้งานจริง |
| `npm run lint` | ตรวจโค้ด |

## อัปเดตข้อมูลรอบใหม่

1. วางไฟล์ใหม่ใน `publicfiles/`
   - `รหัสยา24หลักทั้งหมด.xlsx` (ใช้ sheet ที่ชื่อขึ้นต้นด้วย "เดี่ยว" และ "ตำรับ")
   - `MasterTTMT*.xls` (มีได้ไฟล์เดียว)
2. รัน `npm run import` แล้วรีสตาร์ทเซิร์ฟเวอร์

## โครงสร้าง

```
app/                หน้าเว็บ (Next.js App Router)
  page.js           หน้าแรก
  search/           ค้นหา + ตัวกรอง + แบ่งหน้า
  drug/[id]/        รายละเอียดยา
  groups/           รายการ Drug Group
  stats/            สรุปข้อมูล
  api/export/       ดาวน์โหลด CSV
components/         ส่วนประกอบหน้าเว็บ
lib/drugs.js        ฟังก์ชันค้นหาข้อมูล (ใช้ร่วมกับ API/แชทบอท)
scripts/            import.js + schema.sql
publicfiles/        ไฟล์ Excel ต้นทาง
data/herb.db        ฐานข้อมูล (สร้างจาก npm run import, ไม่ commit)
```

## หลักการรวมข้อมูล

- 1 แถวในฐานข้อมูล = 1 แถวใน Excel (sheet เดี่ยว + ตำรับ, ไม่ใช้ sheet ยกเลิก)
- เชื่อม `TTMTID` กับ `TTMTCode` ใน Master
- ถ้าไม่พบใน Master หรือไม่มีค่า `Drug_Group_Nhso` → แสดง "ไม่มี Drug Group"
- รหัส 24 หลักบางรหัสซ้ำกันได้ (TTMTID ต่างกัน เช่น ขนาดบรรจุต่างกัน)
