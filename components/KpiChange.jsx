import { pctChange } from '@/lib/kpi';

// ป้ายร้อยละการเปลี่ยนแปลง: เขียว = เพิ่ม, แดง = ลด
export default function Change({ prev, cur, size = 'sm' }) {
  const pct = pctChange(prev, cur);
  const big = size === 'lg';
  const base = `inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold ${
    big ? 'px-4 py-1.5 text-lg' : 'px-2 py-0.5 text-xs'
  }`;
  if (pct === null) return <span className={`${base} bg-sky-100 text-sky-700`}>ใหม่</span>;
  const up = pct > 0.005;
  const down = pct < -0.005;
  const color = up ? 'bg-emerald-100 text-emerald-700' : down ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`${base} ${color}`}>
      {up ? '▲' : down ? '▼' : '•'} {up ? '+' : ''}
      {pct.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
    </span>
  );
}
