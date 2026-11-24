import ExcelButton from '@/components/ExcelButton';
import { TARGET_LEVELS, TARGET_PERIODS, TARGET_STATUS } from '@/lib/targets';

const num = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const when = (t) =>
  t ? new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) + ' น.' : '-';

const TONE = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700',
  replaced: 'bg-gray-100 text-gray-600',
};

// ตารางคำขอค่าเป้าหมาย (เขต / จังหวัด / อำเภอ / หน่วยบริการ) — ใช้ในหน้า /targets และ /admin · actions(row) = ปุ่มท้ายแถว (เช่น อนุมัติ/ไม่อนุมัติ)
export default function TargetTable({ id, title, rows, sheet, filename, actions, empty = 'ยังไม่มีรายการ', reviewer = false }) {
  const TH = 'whitespace-nowrap px-4 py-2 font-semibold';
  const TD = 'px-4 py-2';
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-800">
          {title} ({num(rows.length)} รายการ)
        </h2>
        {rows.length > 0 && <ExcelButton tables={[{ id, name: sheet }]} filename={filename} />}
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-6 text-sm text-gray-500">{empty}</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table id={id} className="w-full text-sm">
            <thead className="sticky top-0 bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
              <tr>
                <th className={TH}>ส่งเมื่อ</th>
                <th className={TH}>ปี</th>
                <th className={TH}>ระดับ</th>
                <th className={TH}>รหัส</th>
                <th className={TH}>พื้นที่</th>
                {TARGET_PERIODS.map((p) => (
                  <th key={p.key} className={`${TH} text-right`}>
                    เป้าหมาย {p.label} (บาท)
                  </th>
                ))}
                <th className={TH}>ผู้ส่ง</th>
                <th className={TH}>สถานะ</th>
                {reviewer && <th className={TH}>ผู้พิจารณา</th>}
                {actions && <th className={TH} data-excel-skip="1"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-emerald-50/40">
                  <td className={`${TD} whitespace-nowrap`}>{when(t.submitted_at)}</td>
                  <td className={TD}>{t.year}</td>
                  <td className={`${TD} whitespace-nowrap`}>{TARGET_LEVELS[t.level]?.label || t.level}</td>
                  <td className={`${TD} mono`}>{t.code}</td>
                  <td className={TD}>{t.area_name || '-'}</td>
                  {TARGET_PERIODS.map((p) => (
                    <td key={p.key} className={`${TD} text-right`}>
                      {num(t[p.key])}
                    </td>
                  ))}
                  <td className={TD}>{t.submitted_name || '-'}</td>
                  <td className={TD} data-excel={TARGET_STATUS[t.status]}>
                    <span className={`badge ${TONE[t.status]}`}>{TARGET_STATUS[t.status]}</span>
                  </td>
                  {reviewer && (
                    <td className={`${TD} whitespace-nowrap`}>
                      {t.reviewed_name || '-'}
                      {t.reviewed_at && <div className="text-xs text-gray-500">{when(t.reviewed_at)}</div>}
                    </td>
                  )}
                  {actions && <td className={TD}>{actions(t)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t-2 border-emerald-200 bg-emerald-50 font-bold text-gray-800">
              <tr>
                <td className="px-4 py-3" colSpan={5}>
                  รวม ({num(rows.length)} รายการ)
                </td>
                {TARGET_PERIODS.map((p) => (
                  <td key={p.key} className="px-4 py-3 text-right">
                    {num(rows.reduce((s, t) => s + Number(t[p.key] || 0), 0))}
                  </td>
                ))}
                <td colSpan={2 + (reviewer ? 1 : 0) + (actions ? 1 : 0)}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
