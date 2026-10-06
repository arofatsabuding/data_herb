// หน้าจอระหว่างรอข้อมูลจากเซิร์ฟเวอร์ (ใช้ใน loading.jsx)
export default function LoadingScreen() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 py-24 text-emerald-700" aria-live="polite">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 rounded-full border-4 border-emerald-100" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-emerald-500 border-r-teal-500" />
      </div>
      <p className="font-semibold">กำลังโหลดข้อมูล…</p>
      <div className="mt-4 w-full max-w-3xl space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-emerald-50" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}
