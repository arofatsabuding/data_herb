import crypto from 'crypto';
import { cookies } from 'next/headers';
import { STATE_COOKIE, cookieOptions, safeNext, thaidConfigured, thaidUrl } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const redirect = (location) => new Response(null, { status: 303, headers: { Location: location } });

// เริ่ม login: สุ่ม state เก็บใน cookie (ตรวจตอน callback กันการปลอมคำขอ) แล้วพาไปหน้า ThaiD
export async function GET(request) {
  if (!thaidConfigured()) return redirect('/login?error=config');
  const state = crypto.randomBytes(24).toString('hex');
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  (await cookies()).set(STATE_COOKIE, JSON.stringify({ state, next }), cookieOptions(10 * 60));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.THAID_CLIENT_ID,
    redirect_uri: process.env.THAID_REDIRECT_URI,
    scope: process.env.THAID_SCOPE || 'pid name name_en',
    state,
  });
  return redirect(`${thaidUrl()}/api/v2/oauth2/auth/?${params}`);
}
