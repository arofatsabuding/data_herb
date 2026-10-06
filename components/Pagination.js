import Link from 'next/link';

function pageList(page, totalPages) {
  const pages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…' + p);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, totalPages, params }) {
  if (totalPages <= 1) return null;
  const href = (p) => {
    const sp = new URLSearchParams(params);
    sp.set('page', p);
    return `/search?${sp}`;
  };
  const item = 'flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm transition-colors duration-300';

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1" aria-label="แบ่งหน้า">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${item} text-gray-600 hover:bg-emerald-50`}>
          ก่อนหน้า
        </Link>
      )}
      {pageList(page, totalPages).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? 'page' : undefined}
            className={
              p === page
                ? `${item} bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow`
                : `${item} text-gray-600 hover:bg-emerald-50`
            }
          >
            {p.toLocaleString('th-TH')}
          </Link>
        )
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} className={`${item} text-gray-600 hover:bg-emerald-50`}>
          ถัดไป
        </Link>
      )}
    </nav>
  );
}
