// /llms.txt — บอก AI ที่เข้ามาอ่านเว็บว่ามี API / MCP ให้ใช้
import { TOOLS } from '@/lib/agent-tools';
import { publicOrigin } from '@/lib/api-http';
import { ENDPOINTS } from '@/lib/openapi';

export const dynamic = 'force-dynamic';

export function GET(request) {
  const o = publicOrigin(request);
  const text = `# HERB Center

> ค้นหารหัสยาแผนไทย 24 หลัก (กรมการแพทย์แผนไทยฯ) รวมกับ TTMT Master (สมสท.) และ Drug Group พร้อมตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" รายหน่วยบริการ/อำเภอ/จังหวัด/เขต/ประเทศ ข้อมูลเปิดให้อ่านได้ ไม่ต้องใช้ key

## สำหรับ AI agent

- MCP server (Streamable HTTP): ${o}/api/mcp
- REST API (JSON): ${o}/api/v1
- OpenAPI: ${o}/api/v1/openapi.json
- คู่มือ: ${o}/api-docs

## REST endpoints

${ENDPOINTS.map((e) => `- GET ${o}/api/v1${e.path} — ${e.summary}`).join('\n')}

## MCP tools

${TOOLS.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

## ตัวอย่าง

- รหัส 24 หลักนี้มี TTMTID อะไร → GET ${o}/api/v1/drugs/<รหัส 24 หลัก>
- ผลงานหน่วยบริการ 11442 → GET ${o}/api/v1/kpi/hosp/11442
- หารหัสหน่วยบริการจากชื่อ → GET ${o}/api/v1/kpi/areas?q=<ชื่อ>
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
}
