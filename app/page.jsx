import Link from 'next/link';
import SearchForm from '@/components/SearchForm';
import { CheckIcon, LayersIcon, PillIcon, XIcon } from '@/components/Icons';
import { getStats } from '@/lib/drugs';

export const dynamic = 'force-dynamic';

const EXAMPLES = ['ขมิ้นชัน', 'ฟ้าทะลายโจร', 'ประสะมะแว้ง', '9000025', 'H001001'];

export default function Home() {
  const s = getStats();
  const pct = ((s.with_group / s.total) * 100).toFixed(1);

  const cards = [
    { label: 'รายการยาทั้งหมด', value: s.total, icon: PillIcon, color: 'from-blue-500 to-indigo-600', href: '/search' },
    { label: 'มี Drug Group', value: s.with_group, icon: CheckIcon, color: 'from-emerald-500 to-teal-600', href: '/search?group=has' },
    { label: 'ไม่มี Drug Group', value: s.without_group, icon: XIcon, color: 'from-gray-400 to-gray-600', href: '/search?group=none' },
    { label: 'จำนวน Drug Group', value: s.groups, icon: LayersIcon, color: 'from-amber-400 to-orange-500', href: '/groups' },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-200/50 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center md:py-28">
          <span className="badge mb-6 border border-emerald-200 bg-emerald-100 px-4 py-1 text-sm text-emerald-700">
            รหัสยาแผนไทย 24 หลัก × TTMT × Drug Group
          </span>
          <h1 className="mb-4 text-4xl font-bold text-gray-800 md:text-5xl">
            ค้นหารหัส
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              ยาสมุนไพร
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600">
            รวมข้อมูลจากกรมการแพทย์แผนไทยและการแพทย์ทางเลือก และ สมสท. ไว้ในที่เดียว
            ดูได้ทันทีว่ายาแต่ละรายการมีรหัส 24 หลัก, TTMTID และอยู่ใน Drug Group ใด
          </p>
          <div className="rounded-2xl border border-emerald-100 bg-white/70 p-3 shadow-lg shadow-emerald-900/5 backdrop-blur">
            <SearchForm />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-gray-500">ตัวอย่าง:</span>
            {EXAMPLES.map((e) => (
              <Link
                key={e}
                href={`/search?q=${encodeURIComponent(e)}`}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-gray-600 transition-colors hover:border-emerald-400 hover:text-emerald-700"
              >
                {e}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* สถิติ */}
      <section className="mx-auto -mt-10 max-w-7xl px-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} href={c.href} className="card group relative p-6 transition-all duration-300 hover:-translate-y-1">
              <span
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
              >
                <c.icon className="h-6 w-6" />
              </span>
              <div className="text-3xl font-bold text-gray-800">{c.value.toLocaleString('th-TH')}</div>
              <div className="text-gray-600">{c.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* สัดส่วน */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="card p-6 md:p-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-800">สัดส่วนรายการที่มี Drug Group</h2>
            <span className="text-3xl font-bold text-emerald-600">{pct}%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {s.byType.map((t) => (
              <Link
                key={t.drug_type}
                href={`/search?type=${encodeURIComponent(t.drug_type)}`}
                className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 transition-colors hover:border-emerald-300"
              >
                <div className="font-semibold text-emerald-900">ยา{t.drug_type}</div>
                <div className="text-sm text-gray-600">
                  ทั้งหมด {t.total.toLocaleString('th-TH')} รายการ · มี Drug Group{' '}
                  {t.with_group.toLocaleString('th-TH')} ({((t.with_group / t.total) * 100).toFixed(1)}%)
                </div>
              </Link>
            ))}
          </div>
          <h3 className="mb-3 mt-8 font-bold text-gray-800">หน่วยการเบิกของรายการที่มี Drug Group</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {s.byUnit.map((u) => (
              <Link
                key={u.unit}
                href={`/search?unit=${encodeURIComponent(u.unit)}`}
                className={`rounded-xl border p-4 transition-colors ${
                  u.unit === 'point'
                    ? 'border-violet-100 bg-violet-50 hover:border-violet-300'
                    : 'border-amber-100 bg-amber-50 hover:border-amber-300'
                }`}
              >
                <div className={`font-semibold ${u.unit === 'point' ? 'text-violet-800' : 'text-amber-800'}`}>
                  เบิกเป็น {u.unit}
                </div>
                <div className="text-sm text-gray-600">
                  {u.total.toLocaleString('th-TH')} รายการ · {u.groups.toLocaleString('th-TH')} Drug Group
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-500">
            &quot;ไม่มี Drug Group&quot; หมายถึง TTMTID ไม่อยู่ใน TTMT Master หรืออยู่แต่ไม่ได้ระบุ Drug Group
          </p>
        </div>
      </section>
    </>
  );
}
