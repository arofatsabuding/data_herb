// แชท AI ในหน้าเว็บ — Claude ตอบจากฐานข้อมูลจริงผ่านเครื่องมือชุดเดียวกับ REST API / MCP (lib/agent-tools.js)
// ส่งผลกลับเป็น NDJSON ทีละบรรทัด: {type:"text",text} | {type:"tool",name} | {type:"error",message} | {type:"done"}
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, ToolError, runTool } from '@/lib/agent-tools';
import { chatEnabled, checkChatLimit } from '@/lib/chat-limit';

export const dynamic = 'force-dynamic';

const MODEL = process.env.CHAT_MODEL || 'claude-opus-5-5';
const MAX_TURNS = 8; // จำนวนรอบเรียกเครื่องมือสูงสุดต่อคำถาม
const MAX_HISTORY = 20;
const MAX_CHARS = 1500;

const SYSTEM = `คุณคือผู้ช่วยของเว็บ Data Herb (ข้อมูลยาสมุนไพร/ยาแผนไทย) ตอบเป็นภาษาไทย สั้น กระชับ สุภาพ

ข้อมูลที่มี:
- รหัสยาแผนไทย 24 หลัก (กรมการแพทย์แผนไทยและการแพทย์ทางเลือก) รวมกับ TTMT Master (สมสท.) → TTMTID, Drug Group, อัตราเบิกต่อ course, รหัสที่มาของยา
- ตัวชี้วัด "มูลค่ายาสมุนไพรในสิทธิ UC" รายหน่วยบริการ/อำเภอ/จังหวัด/เขตสุขภาพ/ประเทศ เทียบ 2 ปีงบประมาณ

กติกา:
- ตัวเลขและรหัสทุกตัวต้องมาจากผลของเครื่องมือเท่านั้น ห้ามเดา ถ้าเครื่องมือไม่พบข้อมูลให้บอกตรง ๆ
- ผู้ใช้ให้ชื่อหน่วยบริการ/พื้นที่ → ใช้ kpi_find_area หารหัสก่อน ถ้าเจอหลายแห่งให้ถามกลับว่าหมายถึงแห่งไหน
- ตอบเรื่องตัวชี้วัดต้องบอกปีที่เทียบ และถ้า datasets มี warning ต้องแจ้งผู้ใช้ด้วย
- แสดงเงินเป็นบาทพร้อมตัวคั่นหลักพัน, ร้อยละทศนิยม 2 ตำแหน่ง
- ถ้ามี web_path ให้แนบลิงก์ไปหน้านั้น (เช่น /kpi?view=hosp&hosp=11442) ให้ผู้ใช้ดูรายละเอียดต่อ
- จัดรูปแบบด้วยข้อความธรรมดา ใช้ **ตัวหนา** และรายการขึ้นต้นด้วย "- " ได้ ห้ามใช้ตาราง markdown หรือหัวข้อ #
- คำถามนอกเรื่องยาสมุนไพร/ตัวชี้วัดของเว็บนี้ ให้ตอบสั้น ๆ ว่าช่วยได้เฉพาะเรื่องในเว็บนี้`;

const API_TOOLS = TOOLS.map(({ name, description, inputSchema }) => ({ name, description, input_schema: inputSchema }));

// ข้อความที่แสดงระหว่าง AI กำลังค้นข้อมูล
const TOOL_LABEL = {
  search_drugs: 'ค้นหายา',
  get_drug_by_code24: 'ค้นรหัส 24 หลัก',
  get_drugs_by_ttmtid: 'ค้น TTMTID',
  list_drug_groups: 'ดูรายการ Drug Group',
  drug_stats: 'ดูสรุปข้อมูลยา',
  kpi_find_area: 'ค้นหาหน่วยบริการ/พื้นที่',
  kpi_report: 'ดึงผลงานตัวชี้วัด',
  kpi_datasets: 'ดูไฟล์ข้อมูลตัวชี้วัด',
};

// ประวัติจากเบราว์เซอร์: [{role:'user'|'assistant', content:string}] — รับเฉพาะข้อความ
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? MAX_CHARS : 8000) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  return msgs;
}

function clientIp(request) {
  const h = request.headers;
  return h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
}

export async function POST(request) {
  if (!chatEnabled()) return Response.json({ error: 'ยังไม่ได้เปิดใช้งานแชท AI' }, { status: 503 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const messages = cleanHistory(body?.messages);
  if (!messages) return Response.json({ error: 'กรุณาพิมพ์คำถาม' }, { status: 400 });

  const limited = checkChatLimit(clientIp(request));
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const s = client.beta.messages.stream(
            {
              model: MODEL,
              max_tokens: 16000,
              output_config: { effort: 'medium' },
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default',
              cache_control: { type: 'ephemeral' },
              system: SYSTEM,
              tools: API_TOOLS,
              messages,
            },
            { signal: request.signal }
          );
          s.on('text', (text) => send({ type: 'text', text }));
          const message = await s.finalMessage();

          if (message.stop_reason === 'refusal') {
            send({ type: 'error', message: 'ขออภัย ไม่สามารถตอบคำถามนี้ได้' });
            break;
          }
          if (message.stop_reason === 'pause_turn') {
            messages.push({ role: 'assistant', content: message.content });
            continue;
          }
          const toolUses = message.content.filter((b) => b.type === 'tool_use');
          if (!toolUses.length) break;
          if (message.stop_reason === 'max_tokens') {
            send({ type: 'error', message: 'คำตอบยาวเกินไป กรุณาถามให้แคบลง' });
            break;
          }

          messages.push({ role: 'assistant', content: message.content });
          const results = toolUses.map((t) => {
            send({ type: 'tool', name: TOOL_LABEL[t.name] || t.name });
            try {
              return { type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(runTool(t.name, t.input)) };
            } catch (e) {
              if (!(e instanceof ToolError)) console.error('[chat tool]', t.name, e);
              return {
                type: 'tool_result',
                tool_use_id: t.id,
                is_error: true,
                content: e instanceof ToolError ? e.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล',
              };
            }
          });
          messages.push({ role: 'user', content: results });
          if (turn === MAX_TURNS - 1) send({ type: 'error', message: 'คำถามนี้ซับซ้อนเกินไป กรุณาถามให้แคบลง' });
        }
        send({ type: 'done' });
      } catch (e) {
        if (request.signal.aborted) return controller.close();
        console.error('[chat]', e);
        const message =
          e instanceof Anthropic.RateLimitError
            ? 'ระบบ AI มีผู้ใช้มาก กรุณาลองใหม่อีกครั้งในอีกสักครู่'
            : e instanceof Anthropic.AuthenticationError
              ? 'ตั้งค่า API key ของแชท AI ไม่ถูกต้อง'
              : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
        send({ type: 'error', message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
