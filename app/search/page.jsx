import SearchForm from '@/components/SearchForm';
import DrugTable from '@/components/DrugTable';
import Pagination from '@/components/Pagination';
import ExcelButton from '@/components/ExcelButton';
import { RateBadge, formatRate } from '@/components/Badges';
import { listDrugGroups, listFilterOptions, searchDrugs } from '@/lib/drugs';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ข้อมูลยา — HERB Center' };

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
  const groups = listDrugGroups();
  // ตัวเลือก Drug Group: รหัสกลุ่ม — ตัวยาสำคัญ · อัตราเบิก (พิมพ์ชื่อตัวยาก็หาเจอ)
  const options = {
    ...listFilterOptions({ q, type, group, unit, name, mfr, src }),
    groups: groups.map((g) => ({
      value: g.drug_group,
      label: [g.drug_group, g.ingredients.join(', '), formatRate(g.reimburse_amount, g.reimburse_unit)].filter(Boolean).join(' — '),
    })),
  };
  const picked = groups.find((g) => g.drug_group === group);

  const filters = Object.fromEntries(Object.entries({ q, type, group, unit, name, mfr, src }).filter(([, v]) => v));
  const exportHref = `/api/export?${new URLSearchParams(filters)}`;
  const from = (result.page - 1) * result.pageSize + 1;
  const to = from + result.rows.length - 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">ข้อมูลยาสมุนไพร</h1>
      <SearchForm
        q={q}
        type={type}
        unit={unit}
        group={group}
        name={name}
        mfr={mfr}
        src={src}
        options={options}
        compact
      />

      {/* Drug Group ที่เลือก — อัตราเบิกและตัวยาสำคัญ (เดิมอยู่ที่เมนู Drug Group) */}
      {picked && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm">
          <span className="mono text-lg font-bold text-emerald-700">{picked.drug_group}</span>
          <span className="flex items-center gap-2">
            <span className="text-gray-500">เบิกได้ / course</span>
            <RateBadge amount={picked.reimburse_amount} unit={picked.reimburse_unit} />
          </span>
          <span className="text-gray-600">
            {picked.total.toLocaleString('th-TH')} รายการ (เดี่ยว {picked.single.toLocaleString('th-TH')} · ตำรับ{' '}
            {picked.recipe.toLocaleString('th-TH')})
          </span>
          {picked.ingredients.length > 0 && <span className="text-gray-700">ตัวยาสำคัญ: {picked.ingredients.join(', ')}</span>}
        </div>
      )}

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
        </p>
        {result.total > 0 && (
          <ExcelButton href={exportHref} label={`ดาวน์โหลด Excel (${result.total.toLocaleString('th-TH')} รายการ)`} />
        )}
      </div>

      <DrugTable rows={result.rows} />
      <Pagination page={result.page} totalPages={result.totalPages} params={filters} />
    </div>
  );
}
