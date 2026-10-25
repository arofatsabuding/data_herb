import Link from 'next/link';
import SwaggerUI from '@/components/SwaggerUI';

export const metadata = { title: 'ทดสอบ API (Swagger UI) — HERB Center' };

export default function SwaggerPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ทดสอบเชื่อมต่อ API (Swagger UI)</h1>
          <p className="mt-2 text-gray-600">
            เลือก endpoint → กรอกค่า → กด <b>Execute</b> เพื่อเรียก API จริงและดูผลลัพธ์ · ไม่ต้องใช้ key · POST /drugs/check
            ไม่บันทึกข้อมูลที่ส่งมา
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/api-docs" className="rounded-full border border-emerald-200 px-4 py-2 text-emerald-700 hover:bg-emerald-50">
            ← คู่มือ API / MCP
          </Link>
          <a
            href="/api/v1/openapi.json"
            className="rounded-full border border-emerald-200 px-4 py-2 text-emerald-700 hover:bg-emerald-50"
          >
            openapi.json
          </a>
        </div>
      </div>
      <div className="card overflow-hidden p-2 sm:p-4">
        <SwaggerUI url="/api/v1/openapi.json" />
      </div>
    </div>
  );
}
