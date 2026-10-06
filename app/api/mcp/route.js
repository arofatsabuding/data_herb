// MCP server (Streamable HTTP แบบ stateless) — ให้ Claude / AI อื่นที่รองรับ MCP เรียกเครื่องมือชุดเดียวกับ REST API
// เพิ่มใน client ด้วย URL: https://<โดเมน>/api/mcp  (ไม่ต้องใช้ key)
import { TOOLS, ToolError, runTool } from '@/lib/agent-tools';
import { CORS, json, preflight } from '@/lib/api-http';

export const dynamic = 'force-dynamic';

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'data-herb', title: 'Data Herb — รหัสยาสมุนไพรและตัวชี้วัด', version: '1.0.0' };
const INSTRUCTIONS =
  'ข้อมูลรหัสยาแผนไทย 24 หลัก + TTMT Master + Drug Group และตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" รายหน่วยบริการ/พื้นที่ ' +
  'ถามรหัส 24 หลัก → get_drug_by_code24; ถามผลงานหน่วยบริการ → kpi_report (ถ้ารู้แค่ชื่อ ใช้ kpi_find_area หารหัสก่อน) ' +
  'ตอบจากข้อมูลที่เครื่องมือคืนมาเท่านั้น และบอกปี/ไฟล์ข้อมูลที่ใช้ — ถ้า datasets มี warning ต้องแจ้งผู้ใช้ด้วย';

const result = (id, res) => ({ jsonrpc: '2.0', id, result: res });
const failure = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

function handle(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return failure(msg?.id, -32600, 'Invalid Request');
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      return result(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return result(id, {});
    case 'tools/list':
      return result(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
          annotations: { readOnlyHint: true, openWorldHint: false },
        })),
      });
    case 'tools/call': {
      try {
        const data = runTool(params.name, params.arguments);
        return result(id, { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data });
      } catch (e) {
        // ไม่มีเครื่องมือนี้ = protocol error; อย่างอื่นให้ model เห็นข้อความแล้วแก้เอง
        if (e instanceof ToolError && e.status === 404 && e.message.startsWith('ไม่มีเครื่องมือ')) {
          return failure(id, -32602, e.message);
        }
        if (!(e instanceof ToolError)) console.error('[mcp]', e);
        const text = e instanceof ToolError ? e.message : 'เกิดข้อผิดพลาดภายในระบบ';
        return result(id, { content: [{ type: 'text', text }], isError: true });
      }
    }
    default:
      if (isNotification) return null; // notifications/initialized ฯลฯ — ไม่ต้องตอบ
      return failure(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(failure(null, -32700, 'Parse error'), 400);
  }
  const replies = (Array.isArray(body) ? body : [body]).map(handle).filter(Boolean);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return json(Array.isArray(body) ? replies : replies[0]);
}

// ไม่มี stream จาก server → client (stateless)
export function GET() {
  return new Response('MCP endpoint — ใช้ POST (Streamable HTTP)', { status: 405, headers: { ...CORS, Allow: 'POST' } });
}

export const DELETE = GET;
export const OPTIONS = preflight;
