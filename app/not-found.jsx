import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="mb-2 text-6xl font-bold text-emerald-500">404</div>
      <h1 className="mb-6 text-xl font-semibold text-gray-800">ไม่พบหน้าที่ต้องการ</h1>
      <Link href="/search" className="btn-primary">
        ไปหน้าข้อมูลยา
      </Link>
    </div>
  );
}
