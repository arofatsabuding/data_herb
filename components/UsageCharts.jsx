import { CLAIM_GROUPS, pctChange } from '@/lib/kpi';

// กราฟหน้า /analysis — ความเสียหายจากการเบิกจ่ายไม่ได้ (HTML/CSS ล้วน ชี้ที่แท่งเพื่อดูตัวเลข)

const num = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const pct1 = (n) => `${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`;
// ย่อเลขบาทให้อ่านง่ายบนแท่ง (ตัวเลขเต็มอยู่ใน tooltip และตาราง)
const short = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ล้าน`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toLocaleString('th-TH', { maximumFractionDigits: 1 })} พัน`;
  return num(v);
};
const GROUP_KEYS = Object.keys(CLAIM_GROUPS);

export default function UsageCharts({ groups, items, years, curYear }) {
  const lossValue = groups.loss_known.kpi_value;
  const knownValue = lossValue + groups.claimable.kpi_value;
  const top = items
    .filter((d) => d.group === 'loss_known' && d.byYear[curYear]?.kpi_value > 0)
    .sort((a, b) => b.byYear[curYear].kpi_value - a.byYear[curYear].kpi_value)
    .slice(0, 10);

  return (
    <section className="card mb-6 overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-800">ความเสียหายจากการเบิกจ่ายไม่ได้ · ปี {curYear}</h2>
        <p className="text-xs text-gray-500">
          เบิก สปสช. ได้เฉพาะยาที่มี Drug Group — มูลค่าคิดจากราคาต่อ course ของกลุ่มยา 11 หลัก จึงรู้ยอดเงินได้เฉพาะรหัสที่นับมูลค่ายา
        </p>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[18rem_1fr]">
        {/* ตัวเลขหลัก */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-800">มูลค่าที่เบิกจ่ายไม่ได้ (รู้ยอดเงิน)</div>
          <div className="mt-1 text-3xl font-bold text-gray-800">{num(lossValue)}</div>
          <div className="text-sm text-gray-600">บาท</div>
          <div className="mt-3 text-sm text-gray-700">
            คิดเป็น <b>{pct1(knownValue ? (lossValue / knownValue) * 100 : 0)}</b> ของมูลค่ายาสมุนไพรที่รู้ยอดเงิน ({num(knownValue)} บาท)
          </div>
          <div className="mt-3 border-t border-amber-200 pt-3 text-sm text-gray-700">
            ไม่รู้ยอดเงินอีก <b>{num(groups.loss_unknown.items)}</b> รายการ
            <div className="text-xs text-gray-500">
              ({num(groups.loss_unknown.vs_uc)} ครั้ง UC · {num(groups.loss_unknown.codes)} รหัส)
            </div>
          </div>
        </div>

        {/* สัดส่วน 3 กลุ่ม */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-700">สัดส่วน 3 กลุ่ม ปี {curYear}</h3>
          <Legend />
          <div className="mt-3 space-y-3">
            <ShareBar title="ครั้งที่จ่ายยา UC" groups={groups} field="vs_uc" unit="ครั้ง" />
            <ShareBar title="รายการยา (หน่วยบริการ × รหัส)" groups={groups} field="items" unit="รายการ" />
            <ShareBar title="รหัสยา" groups={groups} field="codes" unit="รหัส" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-t border-gray-100 p-6 lg:grid-cols-2">
        <YearBars
          title="มูลค่าที่เบิกจ่ายไม่ได้ (รู้ยอดเงิน) รายปี"
          unit="บาท"
          color={CLAIM_GROUPS.loss_known.color}
          values={years.map((y) => ({ year: y, v: groups.loss_known.byYear[y]?.kpi_value || 0 }))}
          fmt={short}
        />
        <YearBars
          title="รายการที่เบิกจ่ายไม่ได้ (ไม่รู้ยอดเงิน) รายปี"
          unit="รายการ"
          color={CLAIM_GROUPS.loss_unknown.color}
          values={years.map((y) => ({ year: y, v: groups.loss_unknown.byYear[y]?.items || 0 }))}
          fmt={num}
        />
      </div>

      {top.length > 0 && (
        <div className="border-t border-gray-100 p-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            10 อันดับยาที่เบิกจ่ายไม่ได้มูลค่าสูงสุด ปี {curYear} (นับมูลค่ายา แต่ไม่มี Drug Group)
          </h3>
          <TopBars rows={top} curYear={curYear} />
        </div>
      )}
    </section>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {GROUP_KEYS.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: CLAIM_GROUPS[k].color }} aria-hidden="true" />
          {CLAIM_GROUPS[k].label}
        </li>
      ))}
    </ul>
  );
}

// แท่งเดียวเต็ม 100% แบ่งตาม 3 กลุ่ม — ช่องว่าง 2px ระหว่างกลุ่ม, ใส่ % บนช่องที่กว้างพอ
function ShareBar({ title, groups, field, unit }) {
  const total = GROUP_KEYS.reduce((t, k) => t + groups[k][field], 0);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{title}</span>
        <span>
          รวม {num(total)} {unit}
        </span>
      </div>
      <div className="flex h-8 gap-0.5 overflow-hidden rounded" role="img" aria-label={title}>
        {GROUP_KEYS.map((k) => {
          const v = groups[k][field];
          const share = total ? (v / total) * 100 : 0;
          if (!share) return null;
          return (
            <div
              key={k}
              className="flex items-center justify-center text-xs font-semibold text-gray-900 hover:opacity-80"
              style={{ width: `${share}%`, background: CLAIM_GROUPS[k].color }}
              title={`${CLAIM_GROUPS[k].label}: ${num(v)} ${unit} (${pct1(share)})`}
            >
              {share >= 8 && pct1(share)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// แท่งแนวตั้งรายปี (หน่วยเดียวต่อกราฟ) — ป้ายค่าบนแท่ง + % เทียบปีก่อนหน้า
function YearBars({ title, unit, color, values, fmt }) {
  const max = Math.max(...values.map((x) => x.v), 1);
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <p className="mb-3 text-xs text-gray-500">หน่วย: {unit} · ใช้เกณฑ์จากไฟล์อ้างอิงปัจจุบันกับทุกปี</p>
      <div className="flex h-48 items-end gap-6 border-b border-gray-200 px-2">
        {values.map((x, i) => {
          const ch = i > 0 ? pctChange(values[i - 1].v, x.v) : null;
          return (
            <div key={x.year} className="flex h-full flex-1 flex-col items-center justify-end">
              <div className="mb-1 text-center text-xs font-semibold text-gray-800">
                {fmt(x.v)}
                {ch !== null && (
                  <div className="font-normal text-gray-500">
                    {ch > 0 ? '+' : ''}
                    {pct1(ch)}
                  </div>
                )}
              </div>
              <div
                className="w-full max-w-[5rem] rounded-t hover:opacity-80"
                style={{ height: `${(x.v / max) * 70}%`, minHeight: x.v ? 2 : 0, background: color }}
                title={`ปี ${x.year}: ${num(x.v)} ${unit}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-6 px-2 pt-1">
        {values.map((x) => (
          <div key={x.year} className="flex-1 text-center text-xs text-gray-600">
            {x.year}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopBars({ rows, curYear }) {
  const max = rows[0].byYear[curYear].kpi_value;
  return (
    <ol className="space-y-2">
      {rows.map((d, i) => {
        const v = d.byYear[curYear];
        return (
          <li key={d.code24} className="grid grid-cols-[1.5rem_minmax(0,9rem)_1fr] sm:grid-cols-[1.5rem_minmax(0,16rem)_1fr] items-center gap-3 text-sm">
            <span className="text-right text-gray-400">{i + 1}</span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-gray-800" title={d.drug_name}>
                {d.drug_name || d.code24}
              </div>
              <div className="truncate text-xs text-gray-500" title={d.manufacturer || ''}>
                {d.manufacturer || 'ไม่ระบุผู้ผลิต'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-5 rounded-r hover:opacity-80"
                style={{ width: `${(v.kpi_value / max) * 75}%`, minWidth: 2, background: CLAIM_GROUPS.loss_known.color }}
                title={`${d.drug_name || d.code24}: ${num(v.kpi_value)} บาท · ${num(v.vs_uc)} ครั้ง UC`}
              />
              <span className="whitespace-nowrap text-xs font-semibold text-gray-800">{short(v.kpi_value)} บาท</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
