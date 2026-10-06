import Link from 'next/link';
import { RateBadge } from '@/components/Badges';
import ExcelButton from '@/components/ExcelButton';
import { listDrugGroups } from '@/lib/drugs';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Drug Group — Data Herb' };

export default function GroupsPage() {
  const groups = listDrugGroups();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">Drug Group (สปสช.)</h1>
          <p className="text-gray-600">ทั้งหมด {groups.length.toLocaleString('th-TH')} กลุ่ม — คลิกเพื่อดูรายการยาในกลุ่ม</p>
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
