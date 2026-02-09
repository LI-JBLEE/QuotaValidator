import type {
  QuotaRecord,
  ReferenceRecord,
  ValidationResults,
  V1Result,
  V2Result,
  V3Result,
  FiscalHalf,
  Region,
} from '../types';
import { COUNTRY_REGION_MAP, getCountriesForRegion, H1_MONTHS, H2_MONTHS } from '../types';
import { parseSubmissionMonthLabel } from './excelParser';

function isTbhOrBlank(eid: string): boolean {
  return !eid || eid === '-' || eid.toLowerCase().startsWith('tbh');
}

function isQuotaValueMissing(val: number | string | null | undefined): boolean {
  return (
    val === null ||
    val === undefined ||
    (typeof val === 'string' && (val.trim() === '' || val.trim() === '-')) ||
    val === 0
  );
}

export function runValidation(
  allRecords: QuotaRecord[],
  refRecords: ReferenceRecord[],
  selectedMonth: string, // e.g., "Jan-26"
  selectedRegion: Region,
): ValidationResults {
  const parsed = parseSubmissionMonthLabel(selectedMonth);
  if (!parsed) throw new Error(`Invalid submission month: ${selectedMonth}`);

  // Filter records matching the selected submission month (use UTC to avoid timezone drift)
  const targetRecords = allRecords.filter((rec) => {
    if (!rec.submissionMonth) return false;
    return (
      rec.submissionMonth.getUTCFullYear() === parsed.year &&
      rec.submissionMonth.getUTCMonth() + 1 === parsed.month
    );
  });

  // Build reference lookup: EID -> ReferenceRecord[]
  const refMap = new Map<string, ReferenceRecord[]>();
  for (const ref of refRecords) {
    const existing = refMap.get(ref.eid) || [];
    existing.push(ref);
    refMap.set(ref.eid, existing);
  }

  // Get valid countries for selected region
  const validCountries = new Set(getCountriesForRegion(selectedRegion));

  // ========== VALIDATION 1: EID Reference Check ==========
  const v1Results: V1Result[] = [];
  for (const rec of targetRecords) {
    if (isTbhOrBlank(rec.eid)) {
      v1Results.push({
        record: rec,
        status: 'skip',
        reason: 'TBH / Blank EID',
      });
      continue;
    }

    const refs = refMap.get(rec.eid);
    if (!refs || refs.length === 0) {
      v1Results.push({
        record: rec,
        status: 'fail',
        reason: 'EID not found in reference file',
      });
      continue;
    }

    let foundValid = false;
    let lastIssues: string[] = [];
    let lastRef: ReferenceRecord | undefined;

    for (const ref of refs) {
      const issues: string[] = [];
      if (ref.activeStatus !== 'Yes') {
        issues.push(`Active Status="${ref.activeStatus ?? '(blank)'}" (expected Yes)`);
      }
      if (ref.onLeave) {
        issues.push(`On Leave="${ref.onLeave}" (expected blank)`);
      }
      if (!ref.country || !validCountries.has(ref.country)) {
        const regionOfCountry = ref.country ? COUNTRY_REGION_MAP[ref.country] : undefined;
        issues.push(
          `Country="${ref.country ?? '(blank)'}"${regionOfCountry ? ` (Region: ${regionOfCountry})` : ''} - not in ${selectedRegion}`,
        );
      }

      if (issues.length === 0) {
        foundValid = true;
        lastRef = ref;
        break;
      }
      lastIssues = issues;
      lastRef = ref;
    }

    if (foundValid) {
      v1Results.push({
        record: rec,
        status: 'pass',
        reason: '',
        refInfo: lastRef
          ? {
              activeStatus: lastRef.activeStatus,
              onLeave: lastRef.onLeave,
              country: lastRef.country,
            }
          : undefined,
      });
    } else {
      v1Results.push({
        record: rec,
        status: 'fail',
        reason: lastIssues.join('; '),
        refInfo: lastRef
          ? {
              activeStatus: lastRef.activeStatus,
              onLeave: lastRef.onLeave,
              country: lastRef.country,
            }
          : undefined,
      });
    }
  }

  // ========== VALIDATION 2: Duplicate EID Check ==========
  const eidMap = new Map<string, QuotaRecord[]>();
  for (const rec of targetRecords) {
    if (isTbhOrBlank(rec.eid)) continue;
    const existing = eidMap.get(rec.eid) || [];
    existing.push(rec);
    eidMap.set(rec.eid, existing);
  }

  const v2Results: V2Result[] = [];
  for (const [eid, recs] of eidMap.entries()) {
    if (recs.length > 1) {
      v2Results.push({ eid, occurrences: recs });
    }
  }

  // ========== VALIDATION 3: Missing Quota Amounts ==========
  // Fiscal year starts in July:
  //   H1 (Jul-Dec): submission months 7-12 -> check JUL..DEC columns
  //   H2 (Jan-Jun): submission months 1-6  -> check JAN..JUN columns
  const isH1 = parsed.month >= 7;
  const half: FiscalHalf = isH1 ? 'H1' : 'H2';
  const halfMonthKeys = isH1 ? H1_MONTHS : H2_MONTHS;
  // Calendar month numbers for the half: H1 = 7..12, H2 = 1..6
  const halfStartCalMonth = isH1 ? 7 : 1;

  const v3Results: V3Result[] = [];

  for (const rec of targetRecords) {
    const qs = rec.quotaStartDate;
    if (!qs) continue;

    const startYear = qs.getUTCFullYear();
    const startMonth = qs.getUTCMonth() + 1; // 1-based calendar month

    // Determine the fiscal year boundary for this half
    // H1 covers Jul-Dec of parsed.year (for submission Jul-25, that's Jul-Dec 2025)
    // H2 covers Jan-Jun of parsed.year (for submission Jan-26, that's Jan-Jun 2026)
    const halfEndCalMonth = isH1 ? 12 : 6;
    const halfYear = parsed.year;

    // Skip if quota starts after the end of this half
    if (startYear > halfYear || (startYear === halfYear && startMonth > halfEndCalMonth)) {
      continue;
    }

    // Determine effective start month within the half
    let effectiveStartCalMonth: number;
    if (startYear < halfYear || (startYear === halfYear && startMonth < halfStartCalMonth)) {
      effectiveStartCalMonth = halfStartCalMonth;
    } else {
      effectiveStartCalMonth = startMonth;
    }

    const missingMonths: string[] = [];
    const quotaValues: Record<string, number | string | null> = {};
    const missingMonthsY2Y3: string[] = [];
    const quotaValuesY2Y3: Record<string, number | string | null> = {};
    const hasY2Y3 = rec.monthlyQuotasY2Y3 !== null;

    // Comp2 (only for DMC records)
    const isDMC = rec.dualMetric.toUpperCase() === 'DMC';
    const hasComp2 = isDMC && rec.monthlyQuotasComp2 !== null;
    const hasComp2Y2Y3 = isDMC && rec.monthlyQuotasComp2Y2Y3 !== null;
    const missingMonthsComp2: string[] = [];
    const quotaValuesComp2: Record<string, number | string | null> = {};
    const missingMonthsComp2Y2Y3: string[] = [];
    const quotaValuesComp2Y2Y3: Record<string, number | string | null> = {};

    for (let i = 0; i < halfMonthKeys.length; i++) {
      const key = halfMonthKeys[i];
      const calMonth = halfStartCalMonth + i;

      // Comp1 Y1
      const val = rec.monthlyQuotas[key];
      quotaValues[key] = val;

      // Comp1 Y2Y3
      const valY2 = hasY2Y3 ? rec.monthlyQuotasY2Y3![key] : null;
      quotaValuesY2Y3[key] = valY2;

      // Comp2 Y1
      const valComp2 = hasComp2 ? rec.monthlyQuotasComp2![key] : null;
      quotaValuesComp2[key] = valComp2;

      // Comp2 Y2Y3
      const valComp2Y2 = hasComp2Y2Y3 ? rec.monthlyQuotasComp2Y2Y3![key] : null;
      quotaValuesComp2Y2Y3[key] = valComp2Y2;

      if (calMonth >= effectiveStartCalMonth) {
        if (isQuotaValueMissing(val)) {
          missingMonths.push(key);
        }
        if (hasY2Y3 && isQuotaValueMissing(valY2)) {
          missingMonthsY2Y3.push(key);
        }
        if (hasComp2 && isQuotaValueMissing(valComp2)) {
          missingMonthsComp2.push(key);
        }
        if (hasComp2Y2Y3 && isQuotaValueMissing(valComp2Y2)) {
          missingMonthsComp2Y2Y3.push(key);
        }
      }
    }

    const hasMissing =
      missingMonths.length > 0 ||
      missingMonthsY2Y3.length > 0 ||
      missingMonthsComp2.length > 0 ||
      missingMonthsComp2Y2Y3.length > 0;

    if (hasMissing) {
      v3Results.push({
        record: rec, half, missingMonths, quotaValues,
        missingMonthsY2Y3, quotaValuesY2Y3, hasY2Y3,
        missingMonthsComp2, quotaValuesComp2,
        missingMonthsComp2Y2Y3, quotaValuesComp2Y2Y3,
        hasComp2, hasComp2Y2Y3,
      });
    }
  }

  // ========== Summary ==========
  const v1Pass = v1Results.filter((r) => r.status === 'pass').length;
  const v1Fail = v1Results.filter((r) => r.status === 'fail').length;
  const v1Skip = v1Results.filter((r) => r.status === 'skip').length;

  return {
    v1: v1Results,
    v2: v2Results,
    v3: v3Results,
    summary: {
      v1Pass,
      v1Fail,
      v1Skip,
      v2DuplicateEids: v2Results.length,
      v3MissingQuota: v3Results.length,
      totalRecords: targetRecords.length,
    },
  };
}
