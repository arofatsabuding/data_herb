import SearchForm from '@/components/SearchForm';
import DrugTable from '@/components/DrugTable';
import Pagination from '@/components/Pagination';
import { DownloadIcon } from '@/components/Icons';
import { listFilterOptions, searchDrugs } from '@/lib/drugs';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ค้นหายา — Data Herb' };

export default async function SearchPage({ searchParams }) {
  const sp = await searchParams;
  const q = sp.q || '';
  const type = sp.type || '';
  const group = sp.group || '';
  const unit = sp.unit || '';
  const name = sp.name || '';
  const mfr = sp.mfr || '';
  const src = sp.src || '';
  const result = searchDrugs({ q, type, group, unit, name, mfr, src, page: sp.page });
  const options = listFilterOptions({ q, type, group, unit, name, mfr, src });

  const filters = Object.fromEntries(Object.entries({ q, type, group, unit, name, mfr, src }).filter(([, v]) => v));
  const exportHref = `/api/export?${new URLSearchParams(filters)}`;
  const from = (result.page - 1) * result.pageSize + 1;
  const to = from + result.rows.length - 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">ค้นหายาสมุนไพร</h1>
      <SearchForm
        q={q}
        type={type}
        unit={unit}
        group={['has', 'none'].includes(group) ? group : ''}
        name={name}
        mfr={mfr}
        src={src}
        options={options}
        compact
      />

      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-600">
          {result.total ? (
            <>
              แสดง {from.toLocaleString('th-TH')}–{to.toLocaleString('th-TH')} จาก{' '}
              <b className="text-emerald-700">{result.total.toLocaleString('th-TH')}</b> รายการ
            </>
          ) : (
            'ไม่พบรายการ'
          )}
          {group && !['has', 'none'].includes(group) && (
            <span className="badge ml-2 bg-emerald-100 text-emerald-700">Drug Group: {group}</span>
          )}
        </p>
        {result.total > 0 && (
          <a href={exportHref} className="btn-ghost">
            <DownloadIcon className="h-4 w-4" />
            ดาวน์โหลด CSV
          </a>
        )}
      </div>

      <DrugTable rows={result.rows} />
      <Pagination page={result.page} totalPages={result.totalPages} params={filters} />
    </div>
  );
}
