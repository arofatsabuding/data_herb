// ตรวจเว็บที่รันอยู่แบบเร็ว ๆ ว่าหน้าหลัก / API / MCP ยังทำงาน — ใช้ก่อนเปิด PR และใน CI
//   npm run test:smoke                         ตรวจ http://localhost:3000 (npm run dev)
//   npm run test:smoke -- http://localhost:4000  ตรวจเซิร์ฟเวอร์จริง
//   SMOKE_REQUIRE_KPI=1                        ไม่มีข้อมูลตัวชี้วัด = ไม่ผ่าน (ค่าเริ่มต้น: ข้ามได้)
const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const REQUIRE_KPI = process.env.SMOKE_REQUIRE_KPI === '1';

const results = [];

async function check(name, fn) {
  try {
    const note = await fn();
    results.push({ ok: true, name, note });
  } catch (e) {
    results.push({ ok: false, name, note: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function get(path, { expect = 200 } = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  assert(res.status === expect, `HTTP ${res.status} (ต้องเป็น ${expect})`);
  return res;
}

async function getJson(path, opts) {
  return (await get(path, opts)).json();
}

// รอให้เซิร์ฟเวอร์พร้อม (CI เริ่มเซิร์ฟเวอร์ก่อนแล้วเรียกสคริปต์นี้ทันที)
async function waitForServer(ms = 60000) {
  const until = Date.now() + ms;
  for (;;) {
    try {
      await fetch(BASE + '/api/v1');
      return;
    } catch {
      if (Date.now() > until) throw new Error(`เชื่อมต่อ ${BASE} ไม่ได้ — เปิดเซิร์ฟเวอร์ก่อน (npm run dev หรือ npm start)`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function main() {
  await waitForServer();

  // หน้าเว็บ — ทุกหน้าต้องตอบ 200 และหน้าหลักต้องโหลด CSS ได้ (ถ้า build ทับตอนเซิร์ฟเวอร์รันอยู่ CSS จะหาย)
  await check('หน้าหลัก + CSS', async () => {
    const html = await (await get('/')).text();
    assert(html.includes('HERB Center'), 'ไม่พบชื่อ HERB Center ในหน้าหลัก');
    const css = html.match(/\/_next\/static\/[^"']+\.css/)?.[0];
    assert(css, 'ไม่พบไฟล์ CSS ในหน้าหลัก');
    await get(css);
    return css;
  });
  for (const path of ['/search?q=' + encodeURIComponent('ขมิ้นชัน'), '/groups', '/kpi', '/stats', '/api-docs', '/api-docs/swagger', '/llms.txt']) {
    await check(`หน้า ${decodeURIComponent(path)}`, () => get(path).then(() => ''));
  }

  // REST API
  await check('GET /api/v1', async () => {
    const j = await getJson('/api/v1');
    assert(Array.isArray(j.endpoints) && j.endpoints.length > 0, 'ไม่มีรายการ endpoints');
    return `${j.endpoints.length} endpoints`;
  });
  await check('GET /api/v1/openapi.json', async () => {
    const j = await getJson('/api/v1/openapi.json');
    assert(j.openapi && j.paths, 'ไม่ใช่เอกสาร OpenAPI');
    return `${Object.keys(j.paths).length} paths`;
  });
  await check('GET /api/v1/stats', async () => {
    const j = await getJson('/api/v1/stats');
    assert(j.total_drugs > 0, 'total_drugs = 0 — รัน npm run import หรือยัง');
    return `${j.total_drugs.toLocaleString()} รายการยา`;
  });
  let code24 = null;
  await check('ค้นหายา → รายละเอียดจากรหัส 24 หลัก', async () => {
    const j = await getJson('/api/v1/drugs?q=' + encodeURIComponent('ขมิ้นชัน'));
    assert(j.total > 0 && j.drugs?.length, 'ค้นหา "ขมิ้นชัน" ไม่พบ');
    code24 = j.drugs[0].code24;
    const d = await getJson('/api/v1/drugs/' + encodeURIComponent(code24));
    assert(JSON.stringify(d).includes(code24), 'รายละเอียดยาไม่ตรงกับรหัสที่ค้น');
    return `${j.total} รายการ, ${code24}`;
  });
  await check('POST /api/v1/drugs/check (ตรวจรายการยาจาก HIS)', async () => {
    const res = await fetch(BASE + '/api/v1/drugs/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ code24, local_code: 'A' }, { code24: '123', local_code: 'B' }] }),
    });
    assert(res.status === 200, `HTTP ${res.status}`);
    const j = await res.json();
    assert(j.summary?.total === 2, 'summary.total ไม่ใช่ 2');
    assert(j.results[0].issues.every((i) => i.code !== 'NOT_IN_DTAM24'), `${code24} ควรพบในไฟล์รหัส 24 หลัก`);
    assert(j.results[1].status === 'error', 'รหัส "123" ควรเป็น error');
    return `${j.results[0].status} / ${j.results[1].status}`;
  });
  await check('GET /api/v1/drug-groups', async () => {
    const j = await getJson('/api/v1/drug-groups');
    assert(JSON.stringify(j).length > 100, 'ไม่มีข้อมูล Drug Group');
    return '';
  });

  // ตัวชี้วัด — เครื่องที่ยังไม่ได้ import:kpi จะตอบ 503 (ข้ามได้ เว้นแต่ตั้ง SMOKE_REQUIRE_KPI=1)
  await check('GET /api/v1/kpi (ประเทศ)', async () => {
    const res = await fetch(BASE + '/api/v1/kpi?level=country');
    if (res.status === 503 && !REQUIRE_KPI) return 'ข้าม — ยังไม่มีข้อมูลตัวชี้วัด (npm run import:kpi)';
    assert(res.status === 200, `HTTP ${res.status}`);
    const j = await res.json();
    const years = Object.keys(j.by_year || {});
    assert(years.length > 0, 'ไม่มีข้อมูลรายปี');
    return `ปี ${years.join(', ')}`;
  });

  // MCP
  await check('MCP initialize + tools/list', async () => {
    const call = async (body) => {
      const res = await fetch(BASE + '/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify(body),
      });
      assert(res.status === 200, `HTTP ${res.status}`);
      return res.json();
    };
    const init = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    assert(init.result?.serverInfo, 'initialize ไม่คืน serverInfo');
    const list = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const n = list.result?.tools?.length;
    assert(n > 0, 'tools/list ว่าง');
    assert(!list.result.tools.some((t) => t.name.startsWith('kpi_')), 'MCP ต้องมีเฉพาะเครื่องมือข้อมูลยา');
    return `${n} tools`;
  });

  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.note ? ` — ${r.note}` : ''}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${BASE}: ผ่าน ${results.length - failed}/${results.length}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
