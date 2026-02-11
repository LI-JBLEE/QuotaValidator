import * as XLSX from 'xlsx';
import { parseDate, cellVal, strVal } from './excelParser';
import type { LmsQuotaRecord, LmsMonthlyQuotas } from '../lmsTypes';

// Fixed column indices for LMS file (0-based)
const LMS_COLS = {
  name: 0,              // A
  employeeId: 1,        // B
  managerId: 2,         // C
  managerName: 3,       // D
  geo: 4,               // E
  tier: 5,              // F
  segment: 6,           // G
  sdGroup: 7,           // H
  team: 8,              // I
  component: 9,         // J
  planType: 10,         // K
  recentEvent: 11,      // L
  quotaEffectiveDate: 12, // M
  notes: 13,            // N
  q3Quota: 14,          // O
  q4Quota: 15,          // P
  h2Quota: 16,          // Q
  rev1Jan: 17,          // R
  rev1Feb: 18,          // S
  rev1Mar: 19,          // T
  rev1Apr: 20,          // U
  rev1May: 21,          // V
  rev1Jun: 22,          // W
  q3GlobalQuota: 23,    // X
  q4GlobalQuota: 24,    // Y
  h2GlobalQuota: 25,    // Z
  rev2Jan: 26,          // AA
  rev2Feb: 27,          // AB
  rev2Mar: 28,          // AC
  rev2Apr: 29,          // AD
  rev2May: 30,          // AE
  rev2Jun: 31,          // AF
  bookJan: 32,          // AG
  bookFeb: 33,          // AH
  bookMar: 34,          // AI
  bookApr: 35,          // AJ
  bookMay: 36,          // AK
  bookJun: 37,          // AL
};

function readLmsMonthly(row: unknown[], janCol: number): LmsMonthlyQuotas {
  return {
    JAN: cellVal(row, janCol) as number | string | null,
    FEB: cellVal(row, janCol + 1) as number | string | null,
    MAR: cellVal(row, janCol + 2) as number | string | null,
    APR: cellVal(row, janCol + 3) as number | string | null,
    MAY: cellVal(row, janCol + 4) as number | string | null,
    JUN: cellVal(row, janCol + 5) as number | string | null,
  };
}

export function parseLmsQuotaFile(data: ArrayBuffer): LmsQuotaRecord[] {
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const records: LmsQuotaRecord[] = [];

  // Header at row 0 (Row 1 in Excel), data from row 1 (Row 2 in Excel)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const eid = strVal(row, LMS_COLS.employeeId);
    if (!eid) continue;

    records.push({
      row: i + 1,
      name: strVal(row, LMS_COLS.name),
      employeeId: eid,
      managerId: strVal(row, LMS_COLS.managerId),
      managerName: strVal(row, LMS_COLS.managerName),
      geo: strVal(row, LMS_COLS.geo),
      tier: strVal(row, LMS_COLS.tier),
      segment: strVal(row, LMS_COLS.segment),
      sdGroup: strVal(row, LMS_COLS.sdGroup),
      team: strVal(row, LMS_COLS.team),
      component: strVal(row, LMS_COLS.component),
      planType: strVal(row, LMS_COLS.planType),
      recentEvent: strVal(row, LMS_COLS.recentEvent),
      quotaEffectiveDate: parseDate(cellVal(row, LMS_COLS.quotaEffectiveDate)),
      notes: strVal(row, LMS_COLS.notes),
      q3Quota: cellVal(row, LMS_COLS.q3Quota) as number | string | null,
      q4Quota: cellVal(row, LMS_COLS.q4Quota) as number | string | null,
      h2Quota: cellVal(row, LMS_COLS.h2Quota) as number | string | null,
      rev1Monthly: readLmsMonthly(row, LMS_COLS.rev1Jan),
      q3GlobalQuota: cellVal(row, LMS_COLS.q3GlobalQuota) as number | string | null,
      q4GlobalQuota: cellVal(row, LMS_COLS.q4GlobalQuota) as number | string | null,
      h2GlobalQuota: cellVal(row, LMS_COLS.h2GlobalQuota) as number | string | null,
      rev2Monthly: readLmsMonthly(row, LMS_COLS.rev2Jan),
      bookCountMonthly: readLmsMonthly(row, LMS_COLS.bookJan),
    });
  }

  return records;
}

export function generateLmsProcessingMonths(): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const months: { year: number; month: number }[] = [];

  if (currentMonth >= 7) {
    for (let m = 7; m <= currentMonth; m++) {
      months.push({ year: currentYear, month: m });
    }
  } else {
    for (let m = 7; m <= 12; m++) {
      months.push({ year: currentYear - 1, month: m });
    }
    for (let m = 1; m <= currentMonth; m++) {
      months.push({ year: currentYear, month: m });
    }
  }

  return months.map(({ year, month }) => {
    const yy = String(year).slice(-2);
    return `${monthNames[month - 1]}-${yy}`;
  });
}
