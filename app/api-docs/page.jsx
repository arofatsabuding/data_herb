import { headers } from 'next/headers';
import { MCP_TOOLS } from '@/lib/agent-tools';
import { ISSUES, MAX_ITEMS } from '@/lib/drug-check';
import { publicOrigin } from '@/lib/api-http';
import { ENDPOINTS } from '@/lib/openapi';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'API สำหรับ AI — HERB Center' };

function Code({ children }) {
  return <pre className="mono overflow-x-auto rounded-xl bg-navy-900 p-4 text-sm text-emerald-200">{children}</pre>;
}

export default async function ApiDocsPage() {
  const origin = publicOrigin({ headers: await headers(), url: 'http://localhost' });
  const mcp = `${origin}/api/mcp`;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">API สำหรับ AI และระบบภายนอก</h1>
        <p className="mt-2 text-gray-600">
          ให้ AI (เช่น Claude) หรือระบบอื่นดึงข้อมูลรหัสยาและผลงานตัวชี้วัดจากเว็บนี้ได้โดยตรง — อ่านอย่างเดียว ไม่ต้องใช้ key
        </p>
      </div>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-emerald-800">1. MCP server — เชื่อมกับ Claude / AI ที่รองรับ MCP (เฉพาะข้อมูลยา)</h2>
        <Code>{mcp}</Code>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Claude (เว็บ/แอป): Settings → Connectors → Add custom connector → วาง URL ด้านบน</li>
          <li>
            Claude Code: <span className="mono">claude mcp add --transport http herb-center {mcp}</span>
          </li>
          <li>จากนั้นถามได้เลย เช่น “รหัส 24 หลัก 4100… มี TTMTID อะไร” หรือ “ตรวจรายการยาเหล่านี้ว่าข้อมูลครบไหม”</li>
          <li>MCP มีเฉพาะเครื่องมือข้อมูลยา — ข้อมูลตัวชี้วัดใช้ผ่าน REST API ด้านล่าง</li>
        </ul>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-emerald-800">2. REST API (JSON)</h2>
        <p className="text-sm text-gray-600">
          เอกสาร OpenAPI:{' '}
          <a className="mono text-emerald-700 underline" href="/api/v1/openapi.json">
            {origin}/api/v1/openapi.json
          </a>{' '}
          (ใช้กับ ChatGPT Actions หรือเครื่องมืออื่นที่อ่าน OpenAPI ได้)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50 text-left text-emerald-900">
              <tr>
                <th className="px-3 py-2 font-semibold">Endpoint</th>
                <th className="px-3 py-2 font-semibold">ใช้ทำอะไร</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ENDPOINTS.map((e) => (
                <tr key={e.path}>
                  <td className="mono whitespace-nowrap px-3 py-2">
                    {(e.method || 'get').toUpperCase()} /api/v1{e.path}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm font-semibold text-gray-700">ตัวอย่าง</p>
        <Code>
          {`curl ${origin}/api/v1/drugs/410000000019200234123964
curl "${origin}/api/v1/kpi/hosp/11442"
curl "${origin}/api/v1/kpi?level=province&code=50"
curl "${origin}/api/v1/kpi/areas?q=สารภี"`}
        </Code>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-emerald-800">3. สำหรับ HIS ของโรงพยาบาล — ตรวจรายการยาว่าข้อมูลครบถ้วน</h2>
        <p className="text-sm text-gray-600">
          ส่งรายการยาสมุนไพร/ยาแผนไทยในคลังยาของ HIS มาตรวจ (ครั้งละไม่เกิน {MAX_ITEMS} รายการ) ระบบไม่บันทึกข้อมูลที่ส่งมา ·
          ใช้กติกาเดียวกับการคำนวณตัวชี้วัด จึงรู้ก่อนส่งข้อมูลว่ารายการไหนจะถูกนับเป็นรหัสยาที่ผิดพลาด หรือได้มูลค่า 0 บาท
        </p>
        <Code>
          {`curl -X POST ${origin}/api/v1/drugs/check \\
  -H "Content-Type: application/json" \\
  -d '{"items": [
        {"code24": "410000000019200234123964", "ttmtid": "...", "local_code": "HERB001"},
        {"code24": "4100-0000-0000-0000-0000-0000", "local_code": "HERB002"}
      ]}'

# ทดสอบเร็วด้วย GET (เหมาะกับไม่กี่รหัส)
curl "${origin}/api/v1/drugs/check?codes=410000000019200234123964,123"`}
        </Code>
        <p className="text-sm font-semibold text-gray-700">ผลตรวจแต่ละรายการ: status = ok / warning / error พร้อม issues</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50 text-left text-emerald-900">
              <tr>
                <th className="px-3 py-2 font-semibold">code</th>
                <th className="px-3 py-2 font-semibold">ระดับ</th>
                <th className="px-3 py-2 font-semibold">ความหมาย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(ISSUES).map(([code, i]) => (
                <tr key={code}>
                  <td className="mono whitespace-nowrap px-3 py-2">{code}</td>
                  <td className={`px-3 py-2 font-semibold ${i.level === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>{i.level}</td>
                  <td className="px-3 py-2 text-gray-600">{i.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          error = กระทบตัวชี้วัด (นับเป็นรหัสผิดพลาด หรือได้ 0 บาท) · warning = ไม่กระทบตัวชี้วัด แต่ข้อมูลยังไม่ครบ (เช่น ยังเบิกตามอัตรา
          Drug Group ไม่ได้) · ใช้ผ่าน MCP ได้ด้วยเครื่องมือ <span className="mono">check_drug_list</span>
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-emerald-800">เครื่องมือ (MCP tools)</h2>
        <ul className="space-y-2 text-sm">
          {MCP_TOOLS.map((t) => (
            <li key={t.name}>
              <span className="mono font-semibold text-gray-800">{t.name}</span>
              <span className="text-gray-600"> — {t.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
