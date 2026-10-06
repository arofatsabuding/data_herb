// Excel ผลค้นหายาทั้งหมดตามเงื่อนไขในหน้า /search
import { drugExportHeader, drugExportRow, iterateDrugs } from '@/lib/drugs';
import { xlsxResponse } from '@/lib/excel';

export const dynamic = 'force-dynamic';

export function GET(request) {
  const sp = request.nextUrl.searchParams;
  const filters = Object.fromEntries(['q', 'type', 'group', 'unit', 'name', 'mfr', 'src'].map((k) => [k, sp.get(k) || '']));

  const rows = [drugExportHeader()];
  for (const row of iterateDrugs(filters)) rows.push(drugExportRow(row));

  const stamp = new Date().toISOString().slice(0, 10);
  return xlsxResponse(`data_herb_${stamp}.xlsx`, [{ name: 'ข้อมูลยา', rows }]);
}
