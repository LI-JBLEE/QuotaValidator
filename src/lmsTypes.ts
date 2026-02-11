import type { ValidationStatus } from './types';

export type LmsComponent = 'Non-SA' | 'Rev 1 Only' | 'Rev 2 Only' | 'Rev 1 & Rev 2';
export type LmsPlanType = 'Semi' | 'Qtrly' | 'OKR';

export type LmsMonthlyQuotas = {
  JAN: number | string | null;
  FEB: number | string | null;
  MAR: number | string | null;
  APR: number | string | null;
  MAY: number | string | null;
  JUN: number | string | null;
};

export const LMS_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'] as const;
export type LmsMonth = (typeof LMS_MONTHS)[number];

export const LMS_MONTH_TO_CAL: Record<LmsMonth, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
};

export interface LmsQuotaRecord {
  row: number;
  name: string;
  employeeId: string;
  managerId: string;
  managerName: string;
  geo: string;
  tier: string;
  segment: string;
  sdGroup: string;
  team: string;
  component: string;
  planType: string;
  recentEvent: string;
  quotaEffectiveDate: Date | null;
  notes: string;
  q3Quota: number | string | null;
  q4Quota: number | string | null;
  h2Quota: number | string | null;
  rev1Monthly: LmsMonthlyQuotas;
  q3GlobalQuota: number | string | null;
  q4GlobalQuota: number | string | null;
  h2GlobalQuota: number | string | null;
  rev2Monthly: LmsMonthlyQuotas;
  bookCountMonthly: LmsMonthlyQuotas;
}

// V1: EID Reference Check
export interface LmsV1Result {
  record: LmsQuotaRecord;
  status: ValidationStatus;
  reason: string;
  refInfo?: {
    activeStatus: string | null;
    onLeave: string | null;
    country: string | null;
  };
}

// V2: Quota Amount Alignment
export type LmsV2IssueType =
  | 'should_be_zero'
  | 'missing_amount'
  | 'okr_has_amount'
  | 'rev2_only_has_rev1';

export interface LmsV2Issue {
  column: string;
  month: LmsMonth;
  issueType: LmsV2IssueType;
  expectedBehavior: string;
  actualValue: number | string | null;
}

export interface LmsV2Result {
  record: LmsQuotaRecord;
  issues: LmsV2Issue[];
}

// V3: On Leave with Quota
export interface LmsV3Result {
  record: LmsQuotaRecord;
  refInfo: {
    activeStatus: string | null;
    onLeave: string | null;
    country: string | null;
  };
  processingMonth: LmsMonth;
  quotaColumnsWithValues: {
    column: string;
    value: number | string | null;
  }[];
}

// Combined Results
export interface LmsValidationResults {
  v1: LmsV1Result[];
  v2: LmsV2Result[];
  v3: LmsV3Result[];
  summary: {
    v1Pass: number;
    v1Fail: number;
    v1Skip: number;
    v2AlignmentIssues: number;
    v3OnLeaveWithQuota: number;
    totalRecords: number;
  };
}
