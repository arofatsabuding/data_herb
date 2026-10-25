// เครื่องมือสำหรับ AI agent / ระบบภายนอก — REST API (/api/v1) ใช้ทุกตัว, MCP server (/api/mcp) ใช้เฉพาะ group 'drug' (MCP_TOOLS)
// ทุกเครื่องมืออ่านอย่างเดียว ไม่ต้อง login
import { getDrugsByCode24, getDrugsByTtmtid, getStats, listDrugGroups, searchDrugs } from './drugs';
import {
  COMPARE_YEARS,
  EXCLUDED_ZONES,
  KPI_NAME,
  NOT_IN_GROUP,
  VIEWS,
  availableYears,
  getCodeErrors,
  getCompareReport,
  kpiAvailable,
  parseKpiQuery,
  parseYears,
  pctChange,
  rate,
  resolveSets,
  yearPairs,
} from './kpi';
import { getKpiDb } from './db';
import { MAX_ITEMS, checkDrugList } from './drug-check';
import kpiLib from '@/scripts/kpi-lib';

export class ToolError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const round = (n, d = 2) => (n === null || n === undefined ? null : Math.round(Number(n) * 10 ** d) / 10 ** d);
const digits = (v) => String(v ?? '').replace(/\D/g, '');

// ---------- ข้อมูลยา ----------

// ตัดคอลัมน์ให้เหลือเท่าที่ agent ต้องใช้
function drugOut(d) {
  return {
    code24: d.code24,
    source_code: d.source_code,
    ttmtid: d.ttmtid,
    drug_type: d.drug_type,
    drug_name: d.drug_name,
    trade_name: d.trade_name,
    strength: d.strength,
    dosage_form: d.dosage_form,
    pack_size: d.pack_size,
    manufacturer: d.manufacturer,
    ...(d.registration_no !== undefined && { registration_no: d.registration_no, indication: d.indication }),
    in_ttmt_master: Boolean(d.in_master),
    drug_group: d.has_drug_group ? d.drug_group : null,
    reimburse_per_course: d.has_drug_group ? { amount: d.reimburse_amount, unit: d.reimburse_unit } : null,
  };
}

function searchDrugsTool(a) {
  const r = searchDrugs({
    q: a.q,
    type: a.type,
    group: a.group,
    unit: a.unit,
    name: a.name,
    mfr: a.manufacturer,
    src: a.source_code,
    page: a.page,
    pageSize: Math.min(Number(a.page_size) || 20, 100),
  });
  return { total: r.total, page: r.page, page_size: r.pageSize, total_pages: r.totalPages, drugs: r.rows.map(drugOut) };
}

function getDrugByCode24(a) {
  const code24 = digits(a.code24);
  if (code24.length !== 24) throw new ToolError('code24 ต้องเป็นตัวเลข 24 หลัก');
  const rows = getDrugsByCode24(code24);
  if (!rows.length) {
    return {
      code24,
      found: false,
      message: 'ไม่พบรหัสนี้ในไฟล์รหัสยาแผนไทย 24 หลัก (ยาเดี่ยว/ยาตำรับ) — อาจเป็นรหัสที่ผิดหรือถูกยกเลิกรหัสแล้ว',
    };
  }
  return { code24, found: true, drugs: rows.map(drugOut) };
}

function getDrugsByTtmtidTool(a) {
  const ttmtid = digits(a.ttmtid);
  if (!ttmtid) throw new ToolError('กรุณาระบุ ttmtid');
  const rows = getDrugsByTtmtid(ttmtid);
  return { ttmtid, found: rows.length > 0, drugs: rows.map(drugOut) };
}

function drugGroupsTool() {
  return {
    drug_groups: listDrugGroups().map((g) => ({
      drug_group: g.drug_group,
      drugs: g.total,
      single: g.single,
      recipe: g.recipe,
      reimburse_per_course: { amount: g.reimburse_amount, unit: g.reimburse_unit },
      sample_ingredients: g.ingredients,
    })),
  };
}

function drugStatsTool() {
  const s = getStats();
  return {
    total_drugs: s.total,
    in_ttmt_master: s.in_master,
    with_drug_group: s.with_group,
    without_drug_group: s.without_group,
    drug_groups: s.groups,
    manufacturers: s.manufacturers,
    by_type: s.byType,
    by_reimburse_unit: s.byUnit,
    data_sources: s.meta,
  };
}

// ตรวจรายการยาของ HIS — items (JSON) หรือ codes (ข้อความ คั่นด้วย , เว้นวรรค หรือขึ้นบรรทัด)
function checkDrugListTool(a) {
  const items = Array.isArray(a.items)
    ? a.items
    : String(a.codes ?? '')
        .split(/[\s,;]+/)
        .filter(Boolean);
  if (!items.length) throw new ToolError('กรุณาส่งรายการยา (items) หรือรหัสยา (codes)');
  if (items.length > MAX_ITEMS) throw new ToolError(`ตรวจได้ครั้งละไม่เกิน ${MAX_ITEMS} รายการ — แบ่งส่งหลายครั้ง`);
  return checkDrugList(items);
}

// ---------- ตัวชี้วัด ----------

// ใช้ไฟล์ล่าสุดของแต่ละปีเสมอ (เหมือนผู้ใช้ที่ไม่ได้เลือกไฟล์ในหน้า /kpi)
// years = ปีที่จะเทียบ เช่น "2568,2570" (ไม่ระบุ = ปีล่าสุดตามค่าเริ่มต้น)
function requireKpi(years) {
  const sets = kpiAvailable() ? resolveSets({}, parseYears(years)) : [];
  if (!sets.length) throw new ToolError('ยังไม่มีข้อมูลตัวชี้วัด', 503);
  return sets;
}

// ไฟล์ของปีใหม่อาจดึงข้อมูลปีก่อนมาแทน (opendata ยังไม่มีข้อมูลปีนั้น) — ต้องบอก agent ให้ชัด
function datasetOut(s) {
  const fetchYear = kpiLib.listFiles(s.year).find((f) => f.name === s.file)?.fetchYear;
  return {
    year: s.year,
    file: s.file,
    rows: s.dataset.rows,
    data_as_of: s.dataset.max_date_com,
    ...(fetchYear &&
      fetchYear !== s.year && {
        actual_data_year: fetchYear,
        warning: `ไฟล์ปี ${s.year} นี้ยังเป็นข้อมูลปี ${fetchYear} จาก opendata (ยังไม่มีข้อมูลปี ${s.year}) — ตัวเลขปี ${s.year} จึงยังไม่ใช่ผลงานจริงของปี ${s.year}`,
      }),
  };
}

function kpiDatasetsTool() {
  // แสดงทุกปีที่มีข้อมูล (เลือกปีเทียบใน kpi_report ด้วย years)
  return { kpi: KPI_NAME, note: 'ใช้ไฟล์ล่าสุดของแต่ละปีเสมอ', datasets: requireKpi(availableYears()).map(datasetOut) };
}

function kpiFindAreaTool(a) {
  requireKpi();
  const text = String(a.query || '').trim();
  if (!text) throw new ToolError('กรุณาระบุ query');
  const db = getKpiDb();
  const params = { text, like: `%${text}%` };
  const inReport = `health_zone IS NOT NULL AND health_zone NOT IN (${EXCLUDED_ZONES.map((z) => `'${z}'`).join(', ')})`;
  const hospitals = db
    .prepare(
      `SELECT hospcode code, MAX(name) name, MAX(type_name) type, MAX(district) district, MAX(province) province,
              MAX(health_zone) zone
         FROM kpi_hosp WHERE ${inReport} AND (hospcode = @text OR name LIKE @like)
        GROUP BY hospcode ORDER BY hospcode = @text DESC, MAX(name) LIMIT 20`
    )
    .all(params);
  const provinces = db
    .prepare(
      `SELECT province_code code, MAX(province) name, MAX(health_zone) zone FROM kpi_hosp
        WHERE ${inReport} AND (province LIKE @like OR province_code = @text) GROUP BY province_code LIMIT 10`
    )
    .all(params);
  const districts = db
    .prepare(
      `SELECT district_code code, MAX(district) name, MAX(province) province FROM kpi_hosp
        WHERE ${inReport} AND (district LIKE @like OR district_code = @text) GROUP BY district_code LIMIT 10`
    )
    .all(params);
  return { hospitals, provinces, districts, zones_note: 'เขตสุขภาพใช้รหัส 01–12 (ไม่รวมเขต 13 กรุงเทพฯ)' };
}

const LEVEL_PARAM = { zone: 'zone', province: 'province', district: 'district', hosp: 'hosp' };

function yearSummary(t) {
  if (!t) return null;
  return {
    kpi_value_baht: round(t.kpi_value, 0),
    uc_visits: t.vs_uc,
    uc_visits_in_drug_group: t.matched_vs_uc,
    all_visits: t.vs_all,
    drug_rows: t.rows,
    hospitals: t.hosp_count,
  };
}

function kpiReportTool(a) {
  const sets = requireKpi(a.years);
  const level = a.level || (a.hospcode ? 'hosp' : 'country');
  if (!VIEWS[level]) throw new ToolError(`level ต้องเป็น ${Object.keys(VIEWS).join(', ')}`);
  const code = String(a.code || a.hospcode || '').trim();
  if (level !== 'country' && !code) throw new ToolError(`กรุณาระบุ code ของ ${level}`);
  const sp = { view: level, type: a.office_type || '' };
  if (LEVEL_PARAM[level]) sp[LEVEL_PARAM[level]] = level === 'zone' ? code.padStart(2, '0') : code;
  // อำเภอต้องมีจังหวัดด้วย — รหัสอำเภอ 4 หลักขึ้นต้นด้วยรหัสจังหวัด
  if (level === 'district') sp.province = code.slice(0, 2);
  const { q } = parseKpiQuery(sp);

  const report = getCompareReport(q, sets);
  if (!report) throw new ToolError('ไม่พบพื้นที่/หน่วยบริการนี้ในข้อมูลตัวชี้วัด (หรืออยู่นอกการคำนวณ เช่น เขต 13)', 404);

  const years = sets.map((s) => s.year);
  const curYear = years[years.length - 1];
  const prevYear = years.length > 1 ? years[years.length - 2] : null;
  const cur = report.totals[curYear] || {};
  const prev = prevYear ? report.totals[prevYear] || {} : null;
  const limit = Math.min(Number(a.limit) || 20, 200);
  const latestValue = (x) => x.byYear[curYear]?.kpi_value || 0;
  const perYear = (x, fields) =>
    Object.fromEntries(years.map((y) => [y, Object.fromEntries(fields.map((f) => [f, round(x.byYear[y]?.[f] ?? 0, 0)]))]));

  const errors = getCodeErrors(q, sets);
  const out = {
    kpi: KPI_NAME,
    definition: `มูลค่า = จำนวนครั้งที่จ่ายยาในสิทธิ UC × ราคาต่อ course ของกลุ่มยา; รายการที่${NOT_IN_GROUP}คิดเป็น 0 บาท; ไม่รวมเขตสุขภาพที่ 13 และหน่วยบริการที่ไม่พบเขต`,
    level,
    area: { name: report.area.title, detail: report.area.subtitle },
    datasets: sets.map(datasetOut),
    by_year: Object.fromEntries(years.map((y) => [y, yearSummary(report.totals[y])])),
    // เปลี่ยนแปลงจากปีก่อนหน้าไปปีล่าสุด (changes = ทุกคู่ปีที่ติดกัน)
    change: prev
      ? {
          from_year: prevYear,
          to_year: curYear,
          kpi_value_baht: round((cur.kpi_value || 0) - (prev.kpi_value || 0), 0),
          kpi_value_pct: round(pctChange(prev.kpi_value, cur.kpi_value)),
          uc_visits_pct: round(pctChange(prev.vs_uc, cur.vs_uc)),
        }
      : null,
    changes: yearPairs(years).map(([from, to]) => {
      const f = report.totals[from] || {};
      const t = report.totals[to] || {};
      return {
        from_year: from,
        to_year: to,
        kpi_value_baht: round((t.kpi_value || 0) - (f.kpi_value || 0), 0),
        kpi_value_pct: round(pctChange(f.kpi_value, t.kpi_value)),
        uc_visits_pct: round(pctChange(f.vs_uc, t.vs_uc)),
      };
    }),
    // รหัสยาผิด = รหัสที่ส่งมาไม่พบในไฟล์รหัสยาแผนไทย 24 หลัก (นับเป็นรายการ หน่วยบริการ × รหัสยา)
    drug_code_error_rate: Object.fromEntries(
      years.map((y) => {
        const e = errors.totals[y] || {};
        return [y, { drug_rows: e.rows || 0, bad_rows: e.bad_rows || 0, error_rate_pct: round(rate(e.bad_rows, e.rows)) }];
      })
    ),
    web_path: `/kpi?${new URLSearchParams(Object.entries(sp).filter(([, v]) => v))}`,
  };

  if (VIEWS[level].child) {
    const children = [...report.children].sort((x, y) => latestValue(y) - latestValue(x));
    out.breakdown = {
      by: VIEWS[level].childLabel,
      total: children.length,
      items: children.slice(0, limit).map((c) => ({
        code: c.key,
        name: c.label,
        by_year: perYear(c, ['kpi_value', 'vs_uc']),
        kpi_value_pct: round(pctChange(c.byYear[prevYear]?.kpi_value, c.byYear[curYear]?.kpi_value)),
      })),
    };
    out.top_drug_groups = [...report.topGroups]
      .sort((x, y) => latestValue(y) - latestValue(x))
      .slice(0, 10)
      .map((g) => ({ code11: g.code11, name: g.full_name, price_per_course: g.price, by_year: perYear(g, ['vs_uc', 'kpi_value']) }));
  } else {
    const drugs = [...report.children].sort((x, y) => latestValue(y) - latestValue(x));
    out.drugs = {
      total: drugs.length,
      items: drugs.slice(0, limit).map((d) => ({
        code24: d.code24 || null,
        drug_name: d.drug_name || null,
        source_code: d.source_code || null,
        in_dtam_24_file: Boolean(d.in24),
        drug_group: d.price === null ? NOT_IN_GROUP : d.full_name,
        price_per_course: d.price,
        by_year: perYear(d, ['vs_uc', 'kpi_value']),
      })),
    };
  }
  return out;
}

// ---------- รายการเครื่องมือ ----------

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const int = (description, extra = {}) => ({ type: 'integer', description, ...extra });

export const TOOLS = [
  {
    name: 'search_drugs',
    group: 'drug',
    description:
      'ค้นหายาสมุนไพร/ยาแผนไทยจากรหัสยาแผนไทย 24 หลัก (กรมการแพทย์แผนไทยฯ) รวมกับ TTMT Master (สมสท.) — ค้นด้วยชื่อยา รหัส 24 หลัก TTMTID ผู้ผลิต หรือ Drug Group และกรองได้',
    inputSchema: {
      type: 'object',
      properties: {
        q: str('คำค้น: ชื่อยา, รหัส 24 หลัก (หรือส่วนต้น), TTMTID, ผู้ผลิต, Drug Group, เลขทะเบียน'),
        type: str('ประเภทยา', { enum: ['เดี่ยว', 'ตำรับ'] }),
        group: str('"has" = มี Drug Group, "none" = ไม่มี, หรือชื่อ Drug Group ตรงตัว'),
        unit: str('หน่วยเบิก', { enum: ['บาท', 'point'] }),
        name: str('ชื่อยาตรงตัว'),
        manufacturer: str('ชื่อผู้ผลิตตรงตัว'),
        source_code: str('รหัสที่มาของยา เช่น "1-", "4-"'),
        page: int('หน้าที่ (เริ่ม 1)', { minimum: 1 }),
        page_size: int('จำนวนต่อหน้า (สูงสุด 100, ค่าเริ่มต้น 20)', { minimum: 1, maximum: 100 }),
      },
    },
    run: searchDrugsTool,
  },
  {
    name: 'get_drug_by_code24',
    group: 'drug',
    description:
      'ดูข้อมูลยาจากรหัสยาแผนไทย 24 หลัก — ได้ TTMTID, ชื่อยา, ผู้ผลิต, รหัสที่มาของยา, Drug Group และยอดเบิกต่อ course; ถ้าไม่พบแปลว่ารหัสผิดหรือถูกยกเลิก',
    inputSchema: { type: 'object', properties: { code24: str('รหัสยาแผนไทย 24 หลัก') }, required: ['code24'] },
    run: getDrugByCode24,
  },
  {
    name: 'get_drugs_by_ttmtid',
    group: 'drug',
    description: 'ดูรายการยาทั้งหมดที่ผูกกับ TTMTID (รหัส TTMT ของ สมสท.) — ได้รหัส 24 หลักที่ตรงกัน',
    inputSchema: { type: 'object', properties: { ttmtid: str('TTMTID') }, required: ['ttmtid'] },
    run: getDrugsByTtmtidTool,
  },
  {
    name: 'check_drug_list',
    group: 'drug',
    description: `ตรวจรายการยาสมุนไพร/ยาแผนไทยจาก HIS ของโรงพยาบาล (ครั้งละไม่เกิน ${MAX_ITEMS} รายการ) ว่าข้อมูลครบถ้วนหรือไม่ ตามกติกาเดียวกับตัวชี้วัด: รหัส 24 หลักถูกรูปแบบ, พบในไฟล์รหัสยาแผนไทย 24 หลัก, 11 หลักแรกอยู่ในกลุ่มยาที่คิดมูลค่า, มี TTMTID ตรงกัน, อยู่ใน TTMT Master และมี Drug Group — คืนสถานะ ok/warning/error พร้อมเหตุผลรายการละข้อ และสรุปอัตรารหัสยาที่ผิดพลาด`,
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          maxItems: MAX_ITEMS,
          description: 'รายการยา — ใส่เป็นรหัส 24 หลัก หรือ object',
          items: {
            anyOf: [
              { type: 'string', description: 'รหัสยาแผนไทย 24 หลัก (didstd)' },
              {
                type: 'object',
                properties: {
                  code24: str('รหัสยาแผนไทย 24 หลักที่ HIS ใช้ (didstd)'),
                  ttmtid: str('TTMTID ที่ HIS บันทึกไว้ (ถ้ามี) — ใช้ตรวจว่าตรงกันไหม'),
                  drug_name: str('ชื่อยาใน HIS (ถ้ามี) — ส่งกลับมาคู่กับชื่อในไฟล์รหัส 24 หลักให้เทียบเอง'),
                  local_code: str('รหัสยาภายในของโรงพยาบาล (ถ้ามี) — ส่งกลับมาในผลตรวจ ใช้จับคู่'),
                },
                required: ['code24'],
              },
            ],
          },
        },
        codes: str('ทางเลือกแทน items: รหัส 24 หลักหลายรหัสคั่นด้วยจุลภาคหรือเว้นวรรค (ใช้กับ GET)'),
      },
    },
    run: checkDrugListTool,
  },
  {
    name: 'list_drug_groups',
    group: 'drug',
    description: 'รายการ Drug Group ทั้งหมด พร้อมจำนวนยา และอัตราเบิกต่อ course',
    inputSchema: { type: 'object', properties: {} },
    run: drugGroupsTool,
  },
  {
    name: 'drug_stats',
    group: 'drug',
    description: 'สรุปภาพรวมฐานข้อมูลยา: จำนวนยา, มี/ไม่มี Drug Group, แยกตามประเภทและหน่วยเบิก, วันที่ของไฟล์ต้นทาง',
    inputSchema: { type: 'object', properties: {} },
    run: drugStatsTool,
  },
  {
    name: 'kpi_find_area',
    group: 'kpi',
    description:
      'ค้นหารหัสหน่วยบริการ (5 หลัก) / รหัสจังหวัด / รหัสอำเภอ จากชื่อ เพื่อนำไปใช้กับ kpi_report — เช่น "โรงพยาบาลสารภี" หรือ "เชียงใหม่"',
    inputSchema: {
      type: 'object',
      properties: { query: str('ชื่อหรือรหัสหน่วยบริการ / จังหวัด / อำเภอ') },
      required: ['query'],
    },
    run: kpiFindAreaTool,
  },
  {
    name: 'kpi_report',
    group: 'kpi',
    description: `ผลงานตัวชี้วัด "${KPI_NAME}" เปรียบเทียบปีงบประมาณ (ค่าเริ่มต้น ${COMPARE_YEARS} ปีล่าสุด หรือเลือกเองด้วย years) พร้อม % เปลี่ยนแปลง และอัตรารหัสยาผิด — ระดับประเทศ / เขตสุขภาพ / จังหวัด / อำเภอ / หน่วยบริการ (ระดับหน่วยบริการได้รายการยาด้วย) ถ้ารู้แค่ชื่อให้ใช้ kpi_find_area หารหัสก่อน`,
    inputSchema: {
      type: 'object',
      properties: {
        level: str('ระดับ (ค่าเริ่มต้น country หรือ hosp ถ้าใส่ hospcode)', { enum: Object.keys(VIEWS) }),
        code: str('รหัสพื้นที่: เขต "01"–"12", รหัสจังหวัด 2 หลัก, รหัสอำเภอ 4 หลัก, หรือรหัสหน่วยบริการ 5 หลัก'),
        hospcode: str('รหัสหน่วยบริการ 5 หลัก (ใช้แทน level=hosp + code)'),
        office_type: str('กรองประเภทหน่วยบริการ (type_code) — ใช้ไม่ได้กับระดับหน่วยบริการ'),
        years: str(
          `ปีงบประมาณที่จะเทียบ คั่นด้วยจุลภาค อย่างน้อย 2 ปี เช่น "2568,2570" (ไม่ระบุ = ${COMPARE_YEARS} ปีล่าสุด, ดูปีที่มีได้จาก kpi_datasets)`
        ),
        limit: int('จำนวนแถวย่อย/รายการยาสูงสุด (ค่าเริ่มต้น 20, สูงสุด 200)', { minimum: 1, maximum: 200 }),
      },
    },
    run: kpiReportTool,
  },
  {
    name: 'kpi_datasets',
    group: 'kpi',
    description: 'ไฟล์ข้อมูลตัวชี้วัดที่ใช้คำนวณอยู่ (ปีงบประมาณ, จำนวนแถว, ข้อมูล ณ วันที่)',
    inputSchema: { type: 'object', properties: {} },
    run: kpiDatasetsTool,
  },
];

// MCP เปิดเฉพาะข้อมูลยา (ตัดสินใจ 2026-10-25) — เครื่องมือตัวชี้วัดใช้ได้ทาง REST เท่านั้น
export const MCP_TOOLS = TOOLS.filter((t) => t.group === 'drug');

const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

export function runTool(name, args) {
  const tool = TOOL_MAP[name];
  if (!tool) throw new ToolError(`ไม่มีเครื่องมือ ${name}`, 404);
  return tool.run(args && typeof args === 'object' ? args : {});
}
