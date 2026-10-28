// เอกสาร OpenAPI ของ /api/v1 — สร้างจาก inputSchema ของเครื่องมือ (lib/agent-tools.js)
import { TOOLS } from './agent-tools';

const schemaOf = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

// กลุ่มใน Swagger UI ตาม group ของเครื่องมือ
const TAGS = { drug: 'ข้อมูลยา', kpi: 'มูลค่ายาสมุนไพร' };

// path params ใช้ {ชื่อ}; query = พารามิเตอร์ที่เหลือของเครื่องมือ
// example = ค่าตัวอย่างที่ Swagger UI (/api-docs/swagger) กรอกให้ตอนทดสอบ
export const ENDPOINTS = [
  { path: '/drugs', tool: 'search_drugs', summary: 'ค้นหายา', example: { q: 'ขมิ้นชัน' } },
  {
    path: '/drugs/check',
    tool: 'check_drug_list',
    method: 'post',
    summary: 'ตรวจรายการยาจาก HIS ว่าข้อมูลครบถ้วน (รหัส 24 หลัก, กลุ่มยาที่คิดมูลค่า, TTMTID, Drug Group)',
    body: {
      items: [
        { local_code: 'H001', code24: '410000000109145020110664', ttmtid: '9000400', drug_name: 'ขมิ้นชัน' },
        { local_code: 'H002', code24: '41003010001 1111111111111' },
        { local_code: 'H003', code24: '12345' },
      ],
    },
  },
  {
    path: '/drugs/{code24}',
    tool: 'get_drug_by_code24',
    summary: 'ข้อมูลยาจากรหัส 24 หลัก (TTMTID, Drug Group, รหัสที่มาของยา)',
    example: { code24: '410000000109145020110664' },
  },
  { path: '/ttmt/{ttmtid}', tool: 'get_drugs_by_ttmtid', summary: 'รายการยาของ TTMTID', example: { ttmtid: '9000400' } },
  { path: '/drug-groups', tool: 'list_drug_groups', summary: 'รายการ Drug Group' },
  { path: '/stats', tool: 'drug_stats', summary: 'สรุปฐานข้อมูลยา' },
  { path: '/kpi', tool: 'kpi_report', summary: 'มูลค่ายาสมุนไพรในสิทธิ UC (ประเทศ/เขต/จังหวัด/อำเภอ/หน่วยบริการ)' },
  {
    path: '/kpi/hosp/{code}',
    tool: 'kpi_report',
    summary: 'มูลค่ายาสมุนไพรของหน่วยบริการ (รหัส 5 หลัก)',
    fixed: ['level', 'hospcode'],
    example: { code: '11442' },
  },
  {
    path: '/kpi/areas',
    tool: 'kpi_find_area',
    summary: 'ค้นหารหัสหน่วยบริการ/จังหวัด/อำเภอจากชื่อ',
    rename: { query: 'q' },
    example: { q: 'สารภี' },
  },
  { path: '/kpi/datasets', tool: 'kpi_datasets', summary: 'ไฟล์ข้อมูลมูลค่ายาสมุนไพรที่ใช้อยู่' },
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
        ...(e.example?.[name] && { example: e.example[name] }),
      })),
      ...Object.entries(properties)
        .filter(([name]) => !inPath.includes(name) && !e.fixed?.includes(name))
        .map(([name, s]) => ({
          name: e.rename?.[name] || name,
          in: 'query',
          required: required.includes(name),
          schema: { type: s.type, ...(s.enum && { enum: s.enum }) },
          description: s.description,
          ...(e.example?.[e.rename?.[name] || name] && { example: e.example[e.rename?.[name] || name] }),
        })),
    ];
    const method = e.method || 'get';
    paths[e.path] = {
      [method]: {
        operationId: e.path === '/kpi/hosp/{code}' ? 'kpi_hospital' : e.tool,
        tags: [TAGS[schemaOf[e.tool].group]],
        summary: e.summary,
        description: schemaOf[e.tool].description,
        ...(method === 'post'
          ? {
              requestBody: {
                required: true,
                content: { 'application/json': { schema: schemaOf[e.tool].inputSchema, ...(e.body && { example: e.body }) } },
              },
            }
          : { parameters }),
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
      title: 'HERB Center API',
      version: '1.0.0',
      description:
        'ข้อมูลรหัสยาแผนไทย 24 หลัก (กรมการแพทย์แผนไทยฯ) + TTMT Master (สมสท.) + Drug Group และมูลค่ายาสมุนไพรในสิทธิ UC — อ่านอย่างเดียว ไม่ต้องใช้ key (POST /drugs/check ตรวจรายการยาจาก HIS โดยไม่บันทึกข้อมูล); MCP server อยู่ที่ /api/mcp',
    },
    servers: [{ url: `${origin}/api/v1` }],
    tags: [
      { name: TAGS.drug, description: 'รหัสยาแผนไทย 24 หลัก, TTMTID, Drug Group และตรวจรายการยาจาก HIS' },
      { name: TAGS.kpi, description: 'มูลค่ายาสมุนไพรในสิทธิ UC' },
    ],
    paths,
  };
}
