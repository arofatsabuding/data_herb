// เอกสาร OpenAPI ของ /api/v1 — สร้างจาก inputSchema ของเครื่องมือ (lib/agent-tools.js)
import { TOOLS } from './agent-tools';

const schemaOf = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

// path params ใช้ {ชื่อ}; query = พารามิเตอร์ที่เหลือของเครื่องมือ
export const ENDPOINTS = [
  { path: '/drugs', tool: 'search_drugs', summary: 'ค้นหายา' },
  { path: '/drugs/{code24}', tool: 'get_drug_by_code24', summary: 'ข้อมูลยาจากรหัส 24 หลัก (TTMTID, Drug Group, รหัสที่มาของยา)' },
  { path: '/ttmt/{ttmtid}', tool: 'get_drugs_by_ttmtid', summary: 'รายการยาของ TTMTID' },
  { path: '/drug-groups', tool: 'list_drug_groups', summary: 'รายการ Drug Group' },
  { path: '/stats', tool: 'drug_stats', summary: 'สรุปฐานข้อมูลยา' },
  { path: '/kpi', tool: 'kpi_report', summary: 'ผลงานตัวชี้วัดมูลค่ายาสมุนไพรในสิทธิ UC (ประเทศ/เขต/จังหวัด/อำเภอ/หน่วยบริการ)' },
  { path: '/kpi/hosp/{code}', tool: 'kpi_report', summary: 'ผลงานตัวชี้วัดของหน่วยบริการ (รหัส 5 หลัก)', fixed: ['level', 'hospcode'] },
  { path: '/kpi/areas', tool: 'kpi_find_area', summary: 'ค้นหารหัสหน่วยบริการ/จังหวัด/อำเภอจากชื่อ', rename: { query: 'q' } },
  { path: '/kpi/datasets', tool: 'kpi_datasets', summary: 'ไฟล์ข้อมูลตัวชี้วัดที่ใช้อยู่' },
];

export function buildOpenApi(origin) {
  const paths = {};
  for (const e of ENDPOINTS) {
    const { properties = {}, required = [] } = schemaOf[e.tool].inputSchema;
    const inPath = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const parameters = [
      ...inPath.map((name) => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: properties[name]?.description,
      })),
      ...Object.entries(properties)
        .filter(([name]) => !inPath.includes(name) && !e.fixed?.includes(name))
        .map(([name, s]) => ({
          name: e.rename?.[name] || name,
          in: 'query',
          required: required.includes(name),
          schema: { type: s.type, ...(s.enum && { enum: s.enum }) },
          description: s.description,
        })),
    ];
    paths[e.path] = {
      get: {
        operationId: e.path === '/kpi/hosp/{code}' ? 'kpi_hospital' : e.tool,
        summary: e.summary,
        description: schemaOf[e.tool].description,
        parameters,
        responses: {
          200: { description: 'JSON', content: { 'application/json': { schema: { type: 'object' } } } },
          400: { description: 'พารามิเตอร์ไม่ถูกต้อง' },
          404: { description: 'ไม่พบข้อมูล' },
        },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Data Herb API',
      version: '1.0.0',
      description:
        'ข้อมูลรหัสยาแผนไทย 24 หลัก (กรมการแพทย์แผนไทยฯ) + TTMT Master (สมสท.) + Drug Group และตัวชี้วัดมูลค่ายาสมุนไพรในสิทธิ UC — อ่านอย่างเดียว ไม่ต้องใช้ key; MCP server อยู่ที่ /api/mcp',
    },
    servers: [{ url: `${origin}/api/v1` }],
    paths,
  };
}
