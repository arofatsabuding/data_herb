import Link from 'next/link';

export function GroupBadge({ drug }) {
  if (drug.has_drug_group) {
    return (
      <Link
        href={`/search?group=${encodeURIComponent(drug.drug_group)}`}
        className="badge bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
      >
        {drug.drug_group}
      </Link>
    );
  }
  return (
    <span
      className="badge bg-gray-100 text-gray-500"
      title={drug.in_master ? 'อยู่ใน Master แต่ไม่ระบุ Drug Group' : 'ไม่พบ TTMTID นี้ใน Master'}
    >
      ไม่มี Drug Group
    </span>
  );
}

export function TypeBadge({ type }) {
  const cls = type === 'ตำรับ' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
  return <span className={`badge ${cls}`}>{type}</span>;
}

export function formatRate(amount, unit) {
  if (amount === null || amount === undefined || !unit) return null;
  return `${Number(amount).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${unit}`;
}

// อัตราเบิกต่อ course: บาท = สีทอง, point = สีม่วง
export function RateBadge({ amount, unit }) {
  const text = formatRate(amount, unit);
  if (!text) return <span className="text-xs text-gray-400">-</span>;
  const cls = unit === 'point' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-800';
  return <span className={`badge ${cls}`}>{text}</span>;
}
