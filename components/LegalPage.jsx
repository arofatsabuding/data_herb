import Link from 'next/link';

// โครงหน้าเอกสาร (นโยบายความเป็นส่วนตัว / ข้อกำหนดการใช้งาน)
// sections = [{ title, body: [ข้อความ | { list: [...] }] }]
export default function LegalPage({ title, subtitle, updated, sections, other }) {
  return (
    <div>
      <section className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="mx-auto max-w-4xl px-4 py-10 md:py-14 lg:max-w-6xl">
          <span className="badge mb-4 border border-emerald-200 bg-emerald-100 px-4 py-1 text-sm text-emerald-700">
            ปรับปรุงล่าสุด {updated}
          </span>
          <h1 className="mb-2 text-3xl font-bold text-gray-800 md:text-4xl">{title}</h1>
          <p className="max-w-2xl text-gray-600">{subtitle}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 lg:max-w-6xl lg:grid-cols-[14rem_1fr]">
        {/* สารบัญ */}
        <nav aria-label="สารบัญ" className="hidden lg:block">
          <div className="sticky top-24 space-y-1 text-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">สารบัญ</div>
            {sections.map((s, i) => (
              <a key={s.title} href={`#s${i + 1}`} className="block rounded-lg px-3 py-1.5 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700">
                {i + 1}. {s.title}
              </a>
            ))}
            <Link href={other.href} className="mt-4 block rounded-lg border border-emerald-200 px-3 py-2 text-emerald-700 hover:bg-emerald-50">
              {other.label} →
            </Link>
          </div>
        </nav>

        <article className="card space-y-8 p-6 md:p-10">
          {sections.map((s, i) => (
            <section key={s.title} id={`s${i + 1}`} className="scroll-mt-24">
              <h2 className="mb-3 flex items-center gap-3 text-xl font-bold text-gray-800">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm text-white">
                  {i + 1}
                </span>
                {s.title}
              </h2>
              <div className="space-y-3 leading-relaxed md:pl-11 text-gray-700">
                {s.body.map((b, j) =>
                  typeof b === 'string' ? (
                    <p key={j}>{b}</p>
                  ) : (
                    <ul key={j} className="list-disc space-y-1.5 pl-5 marker:text-emerald-500">
                      {b.list.map((li) => (
                        <li key={li}>{li}</li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          ))}
          <div className="border-t border-gray-100 pt-6 text-sm text-gray-500 lg:hidden">
            <Link href={other.href} className="text-emerald-700 hover:underline">
              {other.label} →
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
