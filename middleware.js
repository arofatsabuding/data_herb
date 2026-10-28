import { NextResponse } from 'next/server';

// ThaiD ส่งผู้ใช้กลับมาที่ /login?code=…&state=… (ถ้าลงทะเบียน redirect uri เป็น /login)
// → ส่งต่อให้ /api/auth/thaid/callback ตรวจ state และตั้ง session ทันที (ก่อนหน้าเริ่ม render)
export function middleware(request) {
  const sp = request.nextUrl.searchParams;
  if (!sp.has('code') && !(sp.has('state') && sp.has('error'))) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/api/auth/thaid/callback';
  return NextResponse.redirect(url, 303);
}

export const config = { matcher: '/login' };
