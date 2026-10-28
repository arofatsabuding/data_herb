import Link from 'next/link';

// แสดงแทนเนื้อหาของหน้าที่ต้อง login (หรือ login แล้วแต่สิทธิ์ไม่พอ)
export default function LoginRequired({ next, title, user }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-6 text-center">
        <h1 className="mb-2 text-lg font-bold text-gray-800">{title}</h1>
        {user ? (
          <p className="text-sm text-gray-600">
            บัญชีของคุณ ({user.name || 'ไม่ระบุชื่อ'} · {user.roleLabel}) ไม่มีสิทธิ์เข้าหน้านี้ — ติดต่อผู้พัฒนาระบบ
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-600">กรุณาเข้าสู่ระบบด้วย ThaiD ก่อน</p>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary inline-block">
              เข้าสู่ระบบ
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
