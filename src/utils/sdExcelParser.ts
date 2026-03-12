import * as XLSX from 'xlsx';
import type { MonthlyQuotas, QuotaRecord } from '../types';
import {
  cellVal,
  normalizeEid,
  parseDate,
  parseSubmissionMonthLabel,
  strVal,
} from './excelParser';

export interface ParsedSdQuotaFile {
  records: QuotaRecord[];
  submissionMonths: string[];
}

type MonthColIndices = Record<string, number>;

const MONTHS = ['JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'] as const;
const SD_SHEETS = ['SD IC', 'SD MGRs'] as const;
const HEADER_ROW_INDEX = 4;
const DATA_START_ROW_INDEX = 5;

function formatSubmissionMonth(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${months[date.getUTCMonth()]}-${yy}`;
}

function buildMonthIndices(startColIndex: number): MonthColIndices {
  const result: Partial<MonthColIndices> = {};
  for (let i = 0; i < MONTHS.length; i++) {
    result[MONTHS[i]] = startColIndex + i;
  }
  return result as MonthColIndices;
}

function readMonthCols(row: unknown[], indices: MonthColIndices): MonthlyQuotas {
  return {
    JUL: cellVal(row, indices.JUL) as number | string | null,
    AUG: cellVal(row, indices.AUG) as number | string | null,
    SEP: cellVal(row, indices.SEP) as number | string | null,
    OCT: cellVal(row, indices.OCT) as number | string | null,
    NOV: cellVal(row, indices.NOV) as number | string | null,
    DEC: cellVal(row, indices.DEC) as number | string | null,
    JAN: cellVal(row, indices.JAN) as number | string | null,
    FEB: cellVal(row, indices.FEB) as number | string | null,
    MAR: cellVal(row, indices.MAR) as number | string | null,
    APR: cellVal(row, indices.APR) as number | string | null,
    MAY: cellVal(row, indices.MAY) as number | string | null,
    JUN: cellVal(row, indices.JUN) as number | string | null,
  };
}

function isEncryptedWorkbookError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('encrypted file') ||
    message.includes('password-protected') ||
    message.includes('/encryptioninfo')
  );
}

function isExampleRow(eid: string, name: string): boolean {
  return eid === '123456' || name.toLowerCase().includes('example');
}

function parseWorkbook(data: ArrayBuffer): XLSX.WorkBook {
  try {
    return XLSX.read(data, { type: 'array' });
  } catch (error) {
    if (isEncryptedWorkbookError(error)) {
      throw new Error(
        'This SD workbook is encrypted or sensitivity-protected. Upload a readable copy of the workbook to use the browser validator.',
      );
    }
    throw error;
  }
}

export function parseSdQuotaFile(data: ArrayBuffer): ParsedSdQuotaFile {
  const workbook = parseWorkbook(data);
  const component1Months = buildMonthIndices(25);
  const component2Months = buildMonthIndices(63);

  const records: QuotaRecord[] = [];
  const submissionMonthSet = new Set<string>();

  for (const sheetName of SD_SHEETS) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    if (!rows[HEADER_ROW_INDEX]) continue;

    for (let rowIndex = DATA_START_ROW_INDEX; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row) continue;

      const submissionMonth = parseDate(cellVal(row, 0));
      if (!submissionMonth) continue;

      const eid = normalizeEid(strVal(row, 1));
      const name = strVal(row, 2);
      if (!eid && !name) continue;
      if (isExampleRow(eid, name)) continue;

      const monthLabel = formatSubmissionMonth(submissionMonth);
      submissionMonthSet.add(monthLabel);

      records.push({
        sheet: sheetName,
        row: rowIndex + 1,
        eid,
        name,
        level: strVal(row, 3),
        repRegion: strVal(row, 9),
        dualMetric: '',
        quotaStartDate: parseDate(cellVal(row, 13)),
        submissionMonth,
        monthlyQuotas: readMonthCols(row, component1Months),
        monthlyQuotasY2Y3: null,
        monthlyQuotasComp2: readMonthCols(row, component2Months),
        monthlyQuotasComp2Y2Y3: null,
        validateComp2: true,
      });
    }
  }

  const submissionMonths = Array.from(submissionMonthSet).sort((left, right) => {
    const a = parseSubmissionMonthLabel(left);
    const b = parseSubmissionMonthLabel(right);
    if (!a || !b) return 0;
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  if (records.length === 0) {
    throw new Error('Could not find any usable records in the SD IC or SD MGRs sheets.');
  }

  return { records, submissionMonths };
}
