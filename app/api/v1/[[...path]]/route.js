// REST API สำหรับระบบภายนอก / AI agent — อ่านอย่างเดียว ไม่ต้องใช้ key
// ทุก endpoint เรียกเครื่องมือชุดเดียวกับ MCP (lib/agent-tools.js) เอกสารอยู่ที่ /api/v1/openapi.json
import { ToolError, runTool } from '@/lib/agent-tools';
import { json, preflight, publicOrigin } from '@/lib/api-http';
import { ENDPOINTS, buildOpenApi } from '@/lib/openapi';

export const dynamic = 'force-dynamic';

// path → [ชื่อเครื่องมือ, อาร์กิวเมนต์จาก path]
function route(path) {
  const [a, b, c, ...rest] = path;
  if (rest.length) return null;
  if (a === 'drugs' && !b) return ['search_drugs', {}];
  if (a === 'drugs' && b && !c) return ['get_drug_by_code24', { code24: b }];
  if (a === 'ttmt' && b && !c) return ['get_drugs_by_ttmtid', { ttmtid: b }];
  if (a === 'drug-groups' && !b) return ['list_drug_groups', {}];
  if (a === 'stats' && !b) return ['drug_stats', {}];
  if (a === 'kpi' && !b) return ['kpi_report', {}];
  if (a === 'kpi' && b === 'areas' && !c) return ['kpi_find_area', {}];
  if (a === 'kpi' && b === 'datasets' && !c) return ['kpi_datasets', {}];
  if (a === 'kpi' && b === 'hosp' && c) return ['kpi_report', { level: 'hosp', code: c }];
  return null;
}

// ชื่อพารามิเตอร์ใน query string ที่ต่างจากชื่อในเครื่องมือ
const QUERY_ALIAS = { kpi_find_area: { q: 'query' } };

export async function GET(request, { params }) {
  const path = (await params).path ?? [];
  const origin = publicOrigin(request);

  if (!path.length) {
    return json({
      name: 'Data Herb API',
      description: 'ข้อมูลรหัสยาแผนไทย 24 หลัก + TTMT Master + Drug Group และตัวชี้วัดมูลค่ายาสมุนไพรในสิทธิ UC',
      openapi: `${origin}/api/v1/openapi.json`,
      mcp: `${origin}/api/mcp`,
      endpoints: ENDPOINTS.map((e) => ({ path: `/api/v1${e.path}`, summary: e.summary })),
    });
  }
  if (path.length === 1 && path[0] === 'openapi.json') return json(buildOpenApi(origin));

  const target = route(path.map(decodeURIComponent));
  if (!target) return json({ error: 'ไม่พบ endpoint นี้ — ดูรายการที่ /api/v1' }, 404);
  const [tool, fromPath] = target;

  const alias = QUERY_ALIAS[tool] || {};
  const args = {};
  for (const [k, v] of request.nextUrl.searchParams) if (v !== '') args[alias[k] || k] = v;
  try {
    return json(runTool(tool, { ...args, ...fromPath }));
  } catch (e) {
    if (e instanceof ToolError) return json({ error: e.message }, e.status);
    console.error('[api/v1]', e);
    return json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, 500);
  }
}

export const OPTIONS = preflight;
