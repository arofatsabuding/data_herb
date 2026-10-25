import Link from 'next/link';
import { RateBadge } from '@/components/Badges';
import ComboBox from '@/components/ComboBox';
import ExcelButton from '@/components/ExcelButton';
import { REIMBURSE_UNITS, listDrugGroups } from '@/lib/drugs';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Drug Group — HERB Center' };

// ชื่อในรายการเลือก: Drug Group + ตัวยาสำคัญ (พิมพ์ชื่อตัวยาก็หาเจอ)
const groupLabel = (g) => (g.ingredients.length ? `${g.drug_group} — ${g.ingredients.join(', ')}` : g.drug_group);

export default async function GroupsPage({ searchParams }) {
  const sp = await searchParams;
  const all = listDrugGroups();
  const group = all.some((g) => g.drug_group === sp.group) ? sp.group : '';
  const unit = REIMBURSE_UNITS.includes(sp.unit) ? sp.unit : '';
  const groups = all.filter((g) => (!group || g.drug_group === group) && (!unit || g.reimburse_unit === unit));
  const filtered = Boolean(group || unit);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">Drug Group (สปสช.)</h1>
          <p className="text-gray-600">
            {filtered
              ? `แสดง ${groups.length.toLocaleString('th-TH')} จาก ${all.length.toLocaleString('th-TH')} กลุ่ม`
              : `ทั้งหมด ${all.length.toLocaleString('th-TH')} กลุ่ม`}{' '}
            — คลิกเพื่อดูรายการยาในกลุ่ม
          </p>
        </div>
        <ExcelButton
          filename="drug_groups"
          sheets={[
            {
              name: 'Drug Group',
              rows: [
                ['Drug Group', 'จำนวนยา', 'ยาเดี่ยว', 'ยาตำรับ', 'เบิกได้ต่อ course', 'หน่วยเบิก', 'ตัวยาสำคัญ (ตัวอย่าง)'],
                ...groups.map((g) => [g.drug_group, g.total, g.single, g.recipe, g.reimburse_amount, g.reimburse_unit, g.ingredients.join(', ')]),
              ],
            },
          ]}
        />
      </div>

      <form action="/groups" method="get" className="card mb-6 flex flex-col gap-3 p-4 md:flex-row">
        <ComboBox
          name="group"
          defaultValue={group}
          options={all.map((g) => ({ value: g.drug_group, label: groupLabel(g) }))}
          allLabel={`ทุก Drug Group (${all.length.toLocaleString('th-TH')}) — พิมพ์ชื่อกลุ่มหรือตัวยา`}
          aria-label="Drug Group"
          className="flex-1"
        />
        <select name="unit" defaultValue={unit} className="input md:w-44" aria-label="หน่วยเบิก">
          <option value="">ทุกหน่วยเบิก</option>
          <option value="บาท">เบิกเป็นบาท</option>
          <option value="point">เบิกเป็น point</option>
        </select>
        <button type="submit" className="btn-primary">
          แสดงผล
        </button>
        {filtered && (
          <Link href="/groups" className="btn-ghost justify-center">
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      {!groups.length && <div className="card p-8 text-center text-gray-600">ไม่พบ Drug Group ตามที่เลือก</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Link
            key={g.drug_group}
            href={`/search?group=${encodeURIComponent(g.drug_group)}`}
            className="card group p-5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="mono text-lg font-bold text-emerald-700">{g.drug_group}</span>
              <span className="badge bg-emerald-100 text-emerald-700">{g.total.toLocaleString('th-TH')} รายการ</span>
            </div>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="text-gray-500">เบิกได้ / course</span>
              <RateBadge amount={g.reimburse_amount} unit={g.reimburse_unit} />
            </div>
            <div className="mb-2 text-sm text-gray-700">{g.ingredients.join(', ') || '-'}</div>
            <div className="text-xs text-gray-500">
              เดี่ยว {g.single.toLocaleString('th-TH')} · ตำรับ {g.recipe.toLocaleString('th-TH')}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
