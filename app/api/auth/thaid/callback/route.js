import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import { SESSION_COOKIE, SESSION_MAX_AGE, STATE_COOKIE, clientIp, cookieOptions, sessionValue, thaidConfigured, thaidUrl } from '@/lib/auth';
import { recordLogin } from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

const redirect = (location) => new Response(null, { status: 303, headers: { Location: location } });

function parseState(raw) {
  try {
    const v = JSON.parse(raw || '');
    return typeof v?.state === 'string' ? v : null;
  } catch {
    return null;
  }
}

// ThaiD ส่งกลับมาพร้อม code + state → ตรวจ state → แลก code เป็นข้อมูลผู้ใช้ → บันทึกการเข้าใช้ → ตั้ง session
export async function GET(request) {
  if (!thaidConfigured()) return redirect('/login?error=config');
  const sp = request.nextUrl.searchParams;
  const store = await cookies();
  const saved = parseState(store.get(STATE_COOKIE)?.value);
  store.delete(STATE_COOKIE);

  if (sp.get('error')) return redirect('/login?error=denied');
  const code = sp.get('code');
  const state = sp.get('state') || '';
  if (!code || !saved || state.length !== saved.state.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))) {
    return redirect('/login?error=state');
  }

  let info;
  try {
    const basic = Buffer.from(`${process.env.THAID_CLIENT_ID}:${process.env.THAID_CLIENT_SECRET}`).toString('base64');
    const res = await fetch(`${thaidUrl()}/api/v2/oauth2/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.THAID_REDIRECT_URI }),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    info = await res.json().catch(() => null);
    if (!res.ok || !info?.pid) {
      // ไม่ log ข้อมูลตอบกลับทั้งก้อน (มี token/เลขบัตร) — log เฉพาะสถานะและรหัสข้อผิดพลาด
      console.error('ThaiD token error:', res.status, info?.error || '', info?.error_description || '');
      return redirect('/login?error=token');
    }
  } catch (err) {
    console.error('ThaiD token error:', err.message);
    return redirect('/login?error=token');
  }

  const user = recordLogin({
    cid: info.pid,
    name: info.name,
    nameEn: info.name_en,
    ip: await clientIp(),
    userAgent: (await headers()).get('user-agent'),
  });
  store.set(SESSION_COOKIE, sessionValue(user.id), cookieOptions(SESSION_MAX_AGE));
  return redirect(saved.next || '/');
}
