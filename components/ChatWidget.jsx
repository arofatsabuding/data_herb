'use client';

import { Fragment, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'dataherb_chat';
const SUGGESTIONS = [
  'รหัส 24 หลัก 410000000019200234123964 มี TTMTID อะไร',
  'ผลงานมูลค่ายาสมุนไพร UC ของโรงพยาบาลสารภีเป็นเท่าไหร่',
  'จังหวัดไหนในเขตสุขภาพที่ 1 มีมูลค่าสูงสุด',
  'Drug Group ของยาขมิ้นชันมีอะไรบ้าง',
];

// แปลงข้อความตอบกลับเป็น JSX: **ตัวหนา** และลิงก์ (/kpi?... หรือ https://...)
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|(?<![\w/])\/(?:kpi|search|drug|groups|stats|api-docs)[^\s)]*)/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^(https?:\/\/|\/)/.test(p)) {
      return (
        <a key={i} href={p} className="break-all text-emerald-700 underline hover:text-emerald-900">
          {p}
        </a>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

function MessageText({ text }) {
  return text.split('\n').map((line, i) => (
    <div key={i} className={line.trim() ? (line.startsWith('- ') ? 'pl-3 -indent-3' : '') : 'h-2'}>
      {line.startsWith('- ') ? (
        <>
          <span className="text-emerald-600">• </span>
          {renderInline(line.slice(2))}
        </>
      ) : (
        renderInline(line)
      )}
    </div>
  ));
}

function ChatIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // [{role, content, tools?, error?}]
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  // จำบทสนทนาไว้ระหว่างเปลี่ยนหน้า (เฉพาะแท็บนี้)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setMessages(saved);
    } catch {}
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages, busy]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const update = (fn) =>
    setMessages((m) => {
      const copy = [...m];
      copy[copy.length - 1] = fn({ ...copy[copy.length - 1] });
      return copy;
    });

  async function ask(text) {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    const history = [...messages.filter((m) => !m.error && m.content), { role: 'user', content: q }];
    setMessages((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '', tools: [] }]);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'text') update((m) => ({ ...m, content: m.content + ev.text }));
          else if (ev.type === 'tool') update((m) => ({ ...m, tools: [...(m.tools || []), ev.name] }));
          else if (ev.type === 'error') update((m) => ({ ...m, notice: ev.message }));
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') update((m) => ({ ...m, error: true, content: m.content || e.message }));
    } finally {
      // คำตอบว่าง (เช่น ถูกยกเลิก) ไม่ต้องเก็บไว้ในประวัติ
      update((m) => (m.content ? m : { ...m, error: true, content: m.notice || 'ยกเลิกแล้ว' }));
      setBusy(false);
      abortRef.current = null;
    }
  }

  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3.5 font-semibold text-white shadow-xl shadow-emerald-600/30 transition hover:scale-105"
          aria-label="เปิดแชทถาม AI"
        >
          <ChatIcon className="h-5 w-5" />
          ถาม AI
        </button>
      )}

      {open && (
        <div
          className="fixed inset-x-2 bottom-2 z-50 flex h-[80vh] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[36rem] sm:w-[26rem]"
          role="dialog"
          aria-label="แชทถาม AI"
        >
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-white">
            <div>
              <div className="font-semibold">ถาม AI เรื่องยาสมุนไพร</div>
              <div className="text-xs text-emerald-50">ตอบจากข้อมูลในเว็บนี้ · AI อาจผิดพลาดได้ ควรตรวจสอบอีกครั้ง</div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button type="button" onClick={clear} className="rounded-lg px-2 py-1 text-xs hover:bg-white/20">
                  เริ่มใหม่
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-lg leading-none hover:bg-white/20" aria-label="ปิด">
                ×
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 text-sm">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-gray-600">ถามเรื่องรหัสยา Drug Group หรือผลงานตัวชี้วัดของหน่วยบริการได้เลย เช่น</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="block w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-left text-gray-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="ml-8 whitespace-pre-wrap rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-white">
                  {m.content}
                </div>
              ) : (
                <div
                  key={i}
                  className={`mr-4 rounded-2xl rounded-bl-sm px-3 py-2 ${m.error ? 'bg-rose-50 text-rose-700' : 'bg-white text-gray-800 shadow-sm'}`}
                >
                  {m.tools?.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {m.tools.map((t, j) => (
                        <span key={j} className="badge bg-emerald-50 text-emerald-700">
                          🔎 {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.content ? (
                    <MessageText text={m.content} />
                  ) : (
                    <span className="inline-flex items-center gap-2 text-gray-500">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                      กำลังคิด…
                    </span>
                  )}
                  {m.notice && m.content !== m.notice && <div className="mt-1 text-xs text-rose-600">{m.notice}</div>}
                </div>
              )
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-gray-100 bg-white p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1500}
              placeholder="พิมพ์คำถาม…"
              className="input py-2"
              aria-label="คำถาม"
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-xl bg-gray-200 px-4 text-sm font-semibold text-gray-700">
                หยุด
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40">
                ส่ง
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
