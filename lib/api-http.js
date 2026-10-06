// ตัวช่วยสำหรับ REST API / MCP — JSON + CORS (เปิดให้ทุกเว็บ/agent เรียกได้ ข้อมูลอ่านอย่างเดียว)
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version',
};

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { ...CORS, 'Cache-Control': 'no-store', ...headers } });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

// URL ที่คนภายนอกเห็น (หลัง Cloudflare Tunnel request.url เป็น localhost)
export function publicOrigin(request) {
  const h = request.headers;
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!host) return new URL(request.url).origin;
  const proto = h.get('x-forwarded-proto') || (/^(localhost|127\.|\[::1\])/.test(host) ? 'http' : 'https');
  return `${proto.split(',')[0]}://${host}`;
}
