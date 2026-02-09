export interface QuotaRecord {
  sheet: string;
  row: number;
  eid: string;
  name: string;
  level: string;
  repRegion: string;
  dualMetric: string; // "SMC" or "DMC" (from "Single/Dual Metric" column)
  quotaStartDate: Date | null;
  submissionMonth: Date | null;
  monthlyQuotas: MonthlyQuotas;
  monthlyQuotasY2Y3: MonthlyQuotas | null; // null if Y2&Y3 columns not present
  monthlyQuotasComp2: MonthlyQuotas | null; // Comp2 Y1 (only for DMC records)
  monthlyQuotasComp2Y2Y3: MonthlyQuotas | null; // Comp2 Y2&Y3 (only for DMC records)
}

export type MonthlyQuotas = {
  JUL: number | string | null;
  AUG: number | string | null;
  SEP: number | string | null;
  OCT: number | string | null;
  NOV: number | string | null;
  DEC: number | string | null;
  JAN: number | string | null;
  FEB: number | string | null;
  MAR: number | string | null;
  APR: number | string | null;
  MAY: number | string | null;
  JUN: number | string | null;
};

export interface ReferenceRecord {
  eid: string;
  fullName: string;
  activeStatus: string | null;
  onLeave: string | null;
  country: string | null;
  jobTitle: string | null;
}

export type ValidationStatus = 'pass' | 'fail' | 'skip';

export interface V1Result {
  record: QuotaRecord;
  status: ValidationStatus;
  reason: string;
  refInfo?: {
    activeStatus: string | null;
    onLeave: string | null;
    country: string | null;
  };
}

export interface V2Result {
  eid: string;
  occurrences: QuotaRecord[];
}

export type FiscalHalf = 'H1' | 'H2';

export const H1_MONTHS = ['JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
export const H2_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'] as const;

export interface V3Result {
  record: QuotaRecord;
  half: FiscalHalf;
  missingMonths: string[];
  quotaValues: Record<string, number | string | null>;
  missingMonthsY2Y3: string[];
  quotaValuesY2Y3: Record<string, number | string | null>;
  hasY2Y3: boolean;
  // Comp2 (only populated for DMC records)
  missingMonthsComp2: string[];
  quotaValuesComp2: Record<string, number | string | null>;
  missingMonthsComp2Y2Y3: string[];
  quotaValuesComp2Y2Y3: Record<string, number | string | null>;
  hasComp2: boolean;
  hasComp2Y2Y3: boolean;
}

export interface ValidationResults {
  v1: V1Result[];
  v2: V2Result[];
  v3: V3Result[];
  summary: {
    v1Pass: number;
    v1Fail: number;
    v1Skip: number;
    v2DuplicateEids: number;
    v3MissingQuota: number;
    totalRecords: number;
  };
}

export type Region = 'APAC' | 'EMEAL' | 'NAMER';

export const COUNTRY_REGION_MAP: Record<string, Region> = {
  'Australia': 'APAC',
  'Austria': 'EMEAL',
  'Belgium': 'EMEAL',
  'Brazil': 'EMEAL',
  'Canada': 'NAMER',
  'China': 'APAC',
  'France': 'EMEAL',
  'Germany': 'EMEAL',
  'Hong Kong': 'APAC',
  'India': 'APAC',
  'Ireland': 'EMEAL',
  'Israel': 'EMEAL',
  'Italy': 'EMEAL',
  'Japan': 'APAC',
  'Malaysia': 'APAC',
  'Mexico': 'EMEAL',
  'Netherlands': 'EMEAL',
  'Singapore': 'APAC',
  'Spain': 'EMEAL',
  'Sweden': 'EMEAL',
  'United Arab Emirates': 'EMEAL',
  'United Kingdom': 'EMEAL',
  'United States of America': 'NAMER',
};

export const REGIONS: Region[] = ['APAC', 'EMEAL', 'NAMER'];

export function getCountriesForRegion(region: Region): string[] {
  return Object.entries(COUNTRY_REGION_MAP)
    .filter(([, r]) => r === region)
    .map(([country]) => country);
}
