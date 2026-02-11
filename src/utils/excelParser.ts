import * as XLSX from 'xlsx';
import type { QuotaRecord, ReferenceRecord, MonthlyQuotas } from '../types';

// Convert Excel serial number to a UTC Date without timezone drift.
// Excel epoch: serial 1 = Jan 1, 1900 (with Lotus 1-2-3 leap year bug for serial <= 59).
export function excelSerialToDate(serial: number): Date {
  // Adjust for the fake Feb 29, 1900 (Lotus bug)
  const adjusted = serial > 59 ? serial - 1 : serial;
  // Serial 1 = Jan 1, 1900, so base is Dec 31, 1899
  const ms = Date.UTC(1899, 11, 31) + adjusted * 86400000;
  return new Date(ms);
}

export function parseDate(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === 'number' && value > 1) return excelSerialToDate(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function cellVal(row: unknown[], colIndex: number): unknown {
  return row[colIndex] ?? null;
}

export function strVal(row: unknown[], colIndex: number): string {
  const v = cellVal(row, colIndex);
  if (v == null) return '';
  return String(v).trim();
}

export interface ParsedQuotaFile {
  records: QuotaRecord[];
  submissionMonths: string[]; // formatted as "Mon-YY"
}

function formatSubmissionMonth(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${months[d.getUTCMonth()]}-${yy}`;
}

export function parseSubmissionMonthLabel(label: string): { year: number; month: number } | null {
  const match = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (!match) return null;
  const monthNames: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const month = monthNames[match[1].toLowerCase()];
  const year = 2000 + parseInt(match[2], 10);
  return { year, month };
}

type MonthColIndices = Record<string, number>;

interface QuotaColumnMap {
  submissionMonth: number;
  eid: number;
  name: number;
  level: number;
  repRegion: number;
  quotaStartDate: number;
  dualMetric: number; // "Single/Dual Metric" column
  y1: MonthColIndices;       // Comp1: Y1 (or direct month names)
  y2y3: MonthColIndices | null; // Comp1: Y2 & Y3 (null if not present)
  comp2Y1: MonthColIndices | null; // Comp2: Y1 (null if not present)
  comp2Y2Y3: MonthColIndices | null; // Comp2: Y2 & Y3 (null if not present)
}

const MONTHS = ['JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'];
const MONTH_DEFAULTS_LSS: Record<string, number> = {
  JUL: 23, AUG: 24, SEP: 25, OCT: 26, NOV: 27, DEC: 28,
  JAN: 29, FEB: 30, MAR: 31, APR: 32, MAY: 33, JUN: 34,
};

// Detect column positions dynamically from the header row.
// Y1 columns: first occurrence of each month (e.g., "JAN" or "Comp1: Y1 - JAN")
// Y2Y3 columns: headers containing "Y2" and ending with month name
function detectQuotaColumns(header: unknown[]): QuotaColumnMap {
  const result: Partial<QuotaColumnMap> = {};
  // 4 categories: comp1_y1, comp1_y2y3, comp2_y1, comp2_y2y3
  const comp1Y1Cols: Record<string, number | undefined> = {};
  const comp1Y2Y3Cols: Record<string, number | undefined> = {};
  const comp2Y1Cols: Record<string, number | undefined> = {};
  const comp2Y2Y3Cols: Record<string, number | undefined> = {};

  for (let c = 0; c < header.length; c++) {
    if (header[c] == null) continue;
    const h = String(header[c]).trim();
    const hUpper = h.toUpperCase();
    const hLower = h.toLowerCase();

    if (hLower.startsWith('submission')) result.submissionMonth = c;
    else if (h === 'EID') result.eid = c;
    else if (h === 'Name') result.name = c;
    else if (h === 'Level') result.level = c;
    else if (hLower.includes('rep region')) result.repRegion = c;
    else if (hLower.includes('quota start')) result.quotaStartDate = c;
    else if (hLower.includes('single/dual') || hLower.includes('dual metric')) result.dualMetric = c;

    const isComp2 = hUpper.includes('COMP2');
    const isY2Y3 = hUpper.includes('Y2');

    for (const m of MONTHS) {
      const endsWithMonth = h === m || hUpper.endsWith(`- ${m}`) || hUpper.endsWith(`\n${m}`);
      if (!endsWithMonth) continue;

      if (isComp2 && isY2Y3) {
        if (comp2Y2Y3Cols[m] === undefined) comp2Y2Y3Cols[m] = c;
      } else if (isComp2) {
        if (comp2Y1Cols[m] === undefined) comp2Y1Cols[m] = c;
      } else if (isY2Y3) {
        if (comp1Y2Y3Cols[m] === undefined) comp1Y2Y3Cols[m] = c;
      } else {
        if (comp1Y1Cols[m] === undefined) comp1Y1Cols[m] = c;
      }
    }
  }

  // Build Comp1 Y1 with fallback defaults
  const y1: MonthColIndices = {};
  for (const m of MONTHS) {
    y1[m] = comp1Y1Cols[m] ?? MONTH_DEFAULTS_LSS[m];
  }

  // Comp1 Y2Y3 only if at least one column was found
  const hasComp1Y2Y3 = Object.keys(comp1Y2Y3Cols).length > 0;
  let y2y3: MonthColIndices | null = null;
  if (hasComp1Y2Y3) {
    y2y3 = {};
    for (const m of MONTHS) {
      y2y3[m] = comp1Y2Y3Cols[m] ?? -1;
    }
  }

  // Comp2 Y1 only if at least one column was found
  const hasComp2Y1 = Object.keys(comp2Y1Cols).length > 0;
  let comp2Y1: MonthColIndices | null = null;
  if (hasComp2Y1) {
    comp2Y1 = {};
    for (const m of MONTHS) {
      comp2Y1[m] = comp2Y1Cols[m] ?? -1;
    }
  }

  // Comp2 Y2Y3 only if at least one column was found
  const hasComp2Y2Y3 = Object.keys(comp2Y2Y3Cols).length > 0;
  let comp2Y2Y3: MonthColIndices | null = null;
  if (hasComp2Y2Y3) {
    comp2Y2Y3 = {};
    for (const m of MONTHS) {
      comp2Y2Y3[m] = comp2Y2Y3Cols[m] ?? -1;
    }
  }

  return {
    submissionMonth: result.submissionMonth ?? 0,
    eid: result.eid ?? 1,
    name: result.name ?? 2,
    level: result.level ?? 3,
    repRegion: result.repRegion ?? 9,
    quotaStartDate: result.quotaStartDate ?? 11,
    dualMetric: result.dualMetric ?? -1, // -1 means not found (LSS files may not have it)
    y1,
    y2y3,
    comp2Y1,
    comp2Y2Y3,
  };
}

function readMonthCols(row: unknown[], indices: MonthColIndices): MonthlyQuotas {
  return {
    JUL: indices['JUL'] >= 0 ? cellVal(row, indices['JUL']) as number | string | null : null,
    AUG: indices['AUG'] >= 0 ? cellVal(row, indices['AUG']) as number | string | null : null,
    SEP: indices['SEP'] >= 0 ? cellVal(row, indices['SEP']) as number | string | null : null,
    OCT: indices['OCT'] >= 0 ? cellVal(row, indices['OCT']) as number | string | null : null,
    NOV: indices['NOV'] >= 0 ? cellVal(row, indices['NOV']) as number | string | null : null,
    DEC: indices['DEC'] >= 0 ? cellVal(row, indices['DEC']) as number | string | null : null,
    JAN: indices['JAN'] >= 0 ? cellVal(row, indices['JAN']) as number | string | null : null,
    FEB: indices['FEB'] >= 0 ? cellVal(row, indices['FEB']) as number | string | null : null,
    MAR: indices['MAR'] >= 0 ? cellVal(row, indices['MAR']) as number | string | null : null,
    APR: indices['APR'] >= 0 ? cellVal(row, indices['APR']) as number | string | null : null,
    MAY: indices['MAY'] >= 0 ? cellVal(row, indices['MAY']) as number | string | null : null,
    JUN: indices['JUN'] >= 0 ? cellVal(row, indices['JUN']) as number | string | null : null,
  };
}

export function parseQuotaFile(data: ArrayBuffer): ParsedQuotaFile {
  // Read WITHOUT cellDates to get raw serial numbers (avoids timezone drift)
  const wb = XLSX.read(data, { type: 'array' });

  const sheetNames: [string, string][] = [];
  for (let idx = 0; idx < wb.SheetNames.length; idx++) {
    const name = wb.SheetNames[idx];
    const lower = name.toLowerCase().trim();

    if (lower === 'instructions') continue;

    const sheetMeta = wb.Workbook?.Sheets?.[idx];
    if (sheetMeta && sheetMeta.Hidden && Number(sheetMeta.Hidden) !== 0) continue;

    if (!lower.endsWith('quota') && !lower.endsWith('quotas')) continue;

    sheetNames.push([name, name]);
  }

  const allRecords: QuotaRecord[] = [];
  const submissionMonthSet = new Set<string>();

  for (const [sheetName, label] of sheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Dynamically detect column positions from header row (row index 4)
    const header = rows[4];
    if (!header) continue;

    const colIdx = detectQuotaColumns(header);

    // Data starts from row index 6 (after example row at index 5)
    for (let i = 6; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const smRaw = cellVal(row, colIdx.submissionMonth);
      const smDate = parseDate(smRaw);

      if (!smDate) continue;

      const monthLabel = formatSubmissionMonth(smDate);
      submissionMonthSet.add(monthLabel);

      const eid = strVal(row, colIdx.eid);
      const name = strVal(row, colIdx.name);
      const level = strVal(row, colIdx.level);
      const repRegion = strVal(row, colIdx.repRegion);
      const dualMetric = colIdx.dualMetric >= 0 ? strVal(row, colIdx.dualMetric) : '';
      const qsDate = parseDate(cellVal(row, colIdx.quotaStartDate));

      const record: QuotaRecord = {
        sheet: label,
        row: i + 1, // 1-based for display
        eid,
        name,
        level,
        repRegion,
        dualMetric,
        quotaStartDate: qsDate,
        submissionMonth: smDate,
        monthlyQuotas: readMonthCols(row, colIdx.y1),
        monthlyQuotasY2Y3: colIdx.y2y3 ? readMonthCols(row, colIdx.y2y3) : null,
        monthlyQuotasComp2: colIdx.comp2Y1 ? readMonthCols(row, colIdx.comp2Y1) : null,
        monthlyQuotasComp2Y2Y3: colIdx.comp2Y2Y3 ? readMonthCols(row, colIdx.comp2Y2Y3) : null,
      };

      allRecords.push(record);
    }
  }

  const sortedMonths = Array.from(submissionMonthSet).sort((a, b) => {
    const pa = parseSubmissionMonthLabel(a);
    const pb = parseSubmissionMonthLabel(b);
    if (!pa || !pb) return 0;
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.month - pb.month;
  });

  return { records: allRecords, submissionMonths: sortedMonths };
}

// Some Excel files have incorrect !ref metadata (e.g., "A1" only).
// Recalculate the actual used range by scanning all cell keys.
function fixSheetRange(ws: XLSX.WorkSheet) {
  let maxR = 0;
  let maxC = 0;
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue;
    const decoded = XLSX.utils.decode_cell(key);
    if (decoded.r > maxR) maxR = decoded.r;
    if (decoded.c > maxC) maxC = decoded.c;
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
}

export function parseReferenceFile(data: ArrayBuffer): ReferenceRecord[] {
  // Read WITHOUT cellDates to get raw serial numbers
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  fixSheetRange(ws);

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    for (const cell of row) {
      if (cell != null && String(cell).trim().toLowerCase().includes('employee id')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx !== -1) break;
  }

  if (headerIdx === -1) {
    throw new Error('Could not find header row with "Employee ID" in reference file');
  }

  const header = rows[headerIdx];
  const colMap: Record<string, number> = {};
  for (let c = 0; c < (header?.length ?? 0); c++) {
    const val = header[c];
    if (val != null) {
      colMap[String(val).trim()] = c;
    }
  }

  const eidCol = colMap['Employee ID'] ?? 0;
  const nameCol = colMap['Full Legal Name'] ?? 3;
  const activeCol = colMap['Active Status'] ?? 8;
  const leaveCol = colMap['On Leave'] ?? 9;
  const countryCol = colMap['Country'] ?? 28;
  const titleCol = colMap['Job Title'] ?? 15;

  const records: ReferenceRecord[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const eid = strVal(row, eidCol);
    if (!eid) continue;

    records.push({
      eid,
      fullName: strVal(row, nameCol),
      activeStatus: strVal(row, activeCol) || null,
      onLeave: strVal(row, leaveCol) || null,
      country: strVal(row, countryCol) || null,
      jobTitle: strVal(row, titleCol) || null,
    });
  }

  return records;
}
