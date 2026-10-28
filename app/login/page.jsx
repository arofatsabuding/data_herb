import Image from 'next/image';
import Link from 'next/link';
import logo from '@/public/herbcenter.png';
import seal from '@/public/thaid-seal.png';
import { allowed, currentUser, safeNext, thaidConfigured } from '@/lib/auth';
import { logout } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'เข้าสู่ระบบ — HERB Center' };

const ERRORS = {
  config: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าการเชื่อมต่อ ThaiD (THAID_CLIENT_ID, THAID_CLIENT_SECRET, THAID_REDIRECT_URI ใน .env)',
  denied: 'ยกเลิกการยืนยันตัวตนที่ ThaiD',
  state: 'คำขอเข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง กรุณากดเข้าสู่ระบบใหม่อีกครั้ง',
  token: 'ยืนยันตัวตนกับ ThaiD ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
};

const Svg = ({ children, className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);
const ChartIcon = (p) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
const FileIcon = (p) => (
  <Svg {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M12 18v-6M9 15l3-3 3 3" />
  </Svg>
);
const RefreshIcon = (p) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </Svg>
);
const CodeIcon = (p) => (
  <Svg {...p}>
    <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
  </Svg>
);
const ShieldIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
const LogoutIcon = (p) => (
  <Svg {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
  </Svg>
);

const FEATURES = [
  { icon: ChartIcon, title: 'หน้าสรุป', text: 'ภาพรวมตัวชี้วัดมูลค่ายาสมุนไพรในสิทธิ UC ระดับประเทศ' },
  { icon: ChartIcon, title: 'วิเคราะห์รหัสยา', text: 'ยาที่ใช้มากแต่ไม่มี Drug Group หรือไม่เข้าเกณฑ์ตัวชี้วัด พร้อมผู้ผลิต' },
  { icon: FileIcon, title: 'ผู้ดูแลระบบ', text: 'อัปโหลดไฟล์อ้างอิงฉบับใหม่ และดาวน์โหลดไฟล์ในระบบ' },
  { icon: RefreshIcon, title: 'ดึงรายงาน ณ ปัจจุบัน', text: 'ดึงข้อมูลจาก opendata ได้ทันที ไม่ต้องรอรอบ 22:00 น.' },
];

const STEPS = ['กดปุ่มสีน้ำเงิน "เข้าสู่ระบบด้วย ThaiD" ด้านบน', 'ยืนยันตัวตนในแอป ThaiD บนมือถือ', 'ระบบพากลับมาที่ HERB Center อัตโนมัติ'];

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const user = await currentUser();
  const next = safeNext(sp.next);
  const error = ERRORS[sp.error];

  const links = user
    ? [
        { href: '/stats', label: 'สรุป', icon: ChartIcon, tone: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
        { href: '/analysis', label: 'วิเคราะห์รหัสยา', icon: ChartIcon, tone: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
        allowed(user, 'admin') && {
          href: '/admin',
          label: 'ผู้ดูแลระบบ',
          icon: FileIcon,
          tone: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
        },
        allowed(user, 'dev') && {
          href: '/dev',
          label: 'ผู้พัฒนา',
          icon: CodeIcon,
          tone: 'border-dashed border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100',
        },
      ].filter(Boolean)
    : [];

  return (
    <section className="relative flex min-h-[calc(100dvh-4.25rem)] items-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-teal-200/40 blur-3xl" />
      <div className="absolute right-1/3 top-10 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:py-20 lg:grid-cols-2 lg:gap-16">
        {/* แนะนำ */}
        <div className="order-2 lg:order-1">
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-100">
              <Image src={logo} alt="" className="h-full w-full object-contain" />
            </span>
            <span className="leading-tight">
              <span className="block text-2xl font-bold text-gray-800">HERB Center</span>
              <span className="block text-sm text-emerald-600">ฐานข้อมูลรหัสยาสมุนไพร</span>
            </span>
          </div>
          <h1 className="mb-3 text-3xl font-bold leading-snug text-gray-800 md:text-4xl">
            เข้าสู่ระบบด้วย
            <span className="block whitespace-nowrap bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              บัตรประชาชนดิจิทัล
            </span>
          </h1>
          <p className="mb-8 max-w-lg text-gray-600">
            ปลอดภัย ไม่ต้องจำรหัสผ่าน — ยืนยันตัวตนผ่านแอป ThaiD ของกรมการปกครอง แล้วใช้งานส่วนที่ต้องเข้าสู่ระบบได้ทันที
          </p>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
                  <f.icon />
                </span>
                <span>
                  <span className="block font-semibold text-gray-800">{f.title}</span>
                  <span className="block text-sm text-gray-600">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* กล่องเข้าสู่ระบบ */}
        <div className="order-1 lg:order-2">
          <div className="card mx-auto max-w-md overflow-hidden shadow-2xl shadow-emerald-900/10">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />
            {user ? (
              <div className="p-8 text-center">
                <span className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-3xl font-bold text-white shadow-lg shadow-emerald-500/30">
                  {(user.name || '?').trim().charAt(0)}
                </span>
                <p className="text-sm text-gray-500">เข้าสู่ระบบแล้ว</p>
                <h2 className="mb-2 text-xl font-bold text-gray-800">{user.name || 'ไม่ระบุชื่อ'}</h2>
                <span className="badge bg-emerald-100 text-emerald-700">{user.roleLabel}</span>
                <div className="mt-6 grid gap-2">
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-semibold transition-colors ${l.tone}`}
                    >
                      <l.icon />
                      <span className="flex-1 text-left">{l.label}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
                <form action={logout} className="mt-6">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <LogoutIcon className="h-4 w-4" />
                    ออกจากระบบ
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-800">ยินดีต้อนรับ</h2>
                <p className="mb-6 text-gray-600">
                  กด<b className="text-indigo-800">ปุ่มสีน้ำเงินด้านล่าง</b>เพื่อเข้าสู่ระบบ
                </p>

                {error && (
                  <div className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <span className="font-bold">!</span>
                    {error}
                  </div>
                )}

                {thaidConfigured() ? (
                  <>
                    <div className="mb-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-indigo-700">
                      <span className="animate-bounce" aria-hidden="true">
                        ↓
                      </span>
                      กดที่ปุ่มนี้
                      <span className="animate-bounce" aria-hidden="true">
                        ↓
                      </span>
                    </div>
                    <a
                      href={`/api/auth/thaid?next=${encodeURIComponent(next)}`}
                      className="group relative flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[#0b0f5c] via-[#1a1f7a] to-[#2a2f8f] p-4 text-white shadow-xl shadow-indigo-900/30 ring-4 ring-indigo-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-900/40 hover:ring-indigo-300 focus-visible:outline-none focus-visible:ring-indigo-400 active:translate-y-0"
                    >
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full ring-4 ring-amber-300/80">
                        <Image src={seal} alt="" className="h-full w-full object-cover" priority />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-bold sm:text-xl">
                          เข้าสู่ระบบ<span className="whitespace-nowrap">ด้วย ThaiD</span>
                        </span>
                        <span className="block text-sm text-indigo-100">กดที่นี่ แล้วยืนยันตัวตนในแอป ThaiD</span>
                      </span>
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-lg font-bold text-indigo-950 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </a>
                  </>
                ) : (
                  !error && <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{ERRORS.config}</div>
                )}

                <ol className="mt-8 space-y-3 border-t border-gray-100 pt-6">
                  {STEPS.map((s, i) => (
                    <li key={s} className={`flex items-center gap-3 text-sm ${i === 0 ? 'font-semibold text-indigo-800' : 'text-gray-600'}`}>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          i === 0 ? 'bg-indigo-700 text-white' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>

                <div className="mt-6 flex gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-gray-500">
                  <ShieldIcon className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span>
                    ระบบบันทึกชื่อ เวลาเข้าใช้ และ IP เพื่อตรวจสอบการเข้าใช้งาน · <b className="text-gray-600">ไม่เก็บเลขบัตรประชาชนเต็ม</b>{' '}
                    และไม่เคยเห็นรหัสผ่านของคุณ · การเข้าสู่ระบบถือว่ายอมรับ{' '}
                    <Link href="/terms" className="text-emerald-700 underline-offset-2 hover:underline">
                      ข้อกำหนดการใช้งาน
                    </Link>{' '}
                    และ{' '}
                    <Link href="/privacy" className="text-emerald-700 underline-offset-2 hover:underline">
                      นโยบายความเป็นส่วนตัว
                    </Link>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
