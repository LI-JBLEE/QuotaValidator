import type {
  LmsQuotaRecord,
  LmsV1Result,
  LmsV2Result,
  LmsV2Issue,
  LmsV3Result,
  LmsValidationResults,
  LmsMonth,
} from '../lmsTypes';
import { LMS_MONTHS, LMS_MONTH_TO_CAL } from '../lmsTypes';
import type { ReferenceRecord, Region } from '../types';
import { COUNTRY_REGION_MAP, getCountriesForRegion } from '../types';

function isTbhOrBlank(eid: string): boolean {
  return !eid || eid === '-' || eid.toLowerCase().startsWith('tbh');
}

function numericValue(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function hasPositiveAmount(val: number | string | null | undefined): boolean {
  return numericValue(val) > 0;
}

/**
 * Determine which months should have quota > 0 based on Plan Type and effective date.
 * Returns an expectation for each of the 6 H2 months (JAN-JUN).
 */
function getExpectedActiveMonths(
  effectiveMonth: number, // 1-6 (Jan=1, Jun=6)
  planType: string,
): { month: LmsMonth; shouldHaveAmount: boolean }[] {
  const result: { month: LmsMonth; shouldHaveAmount: boolean }[] = [];

  for (const m of LMS_MONTHS) {
    const calMonth = LMS_MONTH_TO_CAL[m];

    if (calMonth < effectiveMonth) {
      // Before effective date: should be 0
      result.push({ month: m, shouldHaveAmount: false });
      continue;
    }

    const pt = planType.toLowerCase();

    if (pt === 'okr') {
      // OKR: no quota amounts at all
      result.push({ month: m, shouldHaveAmount: false });
    } else if (pt === 'semi') {
      // Semi: through end of half (Jun) -> should have amounts
      result.push({ month: m, shouldHaveAmount: true });
    } else if (pt === 'qtrly') {
      // Qtrly: through end of current quarter only
      // Q3 FY = Jan-Mar (cal 1-3), Q4 FY = Apr-Jun (cal 4-6)
      const effectiveQuarterEnd = effectiveMonth <= 3 ? 3 : 6;
      result.push({ month: m, shouldHaveAmount: calMonth <= effectiveQuarterEnd });
    } else {
      // Unknown plan type: assume should have amounts (conservative)
      result.push({ month: m, shouldHaveAmount: true });
    }
  }

  return result;
}

export function runLmsValidation(
  records: LmsQuotaRecord[],
  refRecords: ReferenceRecord[],
  selectedProcessingMonth: string, // e.g., "Feb-26"
  selectedRegion: Region,
): LmsValidationResults {
  // Build reference lookup
  const refMap = new Map<string, ReferenceRecord[]>();
  for (const ref of refRecords) {
    const existing = refMap.get(ref.eid) || [];
    existing.push(ref);
    refMap.set(ref.eid, existing);
  }

  const validCountries = new Set(getCountriesForRegion(selectedRegion));

  // Geo-to-Region mapping for EIDs not found in SCR
  const GEO_TO_REGION: Record<string, Region> = {
    APAC: 'APAC',
    EMEA: 'EMEAL',
    LATAM: 'EMEAL',
    NAMER: 'NAMER',
  };

  // Filter records to only include employees whose country (from SCR) is in the selected region.
  // If EID is not found in SCR, use Quota file's Geo column for region matching.
  // Geo="SA" is always included regardless of selected region.
  const filteredRecords = records.filter((rec) => {
    if (isTbhOrBlank(rec.employeeId)) return true; // keep TBH/blank for skip reporting
    const refs = refMap.get(rec.employeeId);
    if (!refs || refs.length === 0) {
      // EID not found in SCR — use Geo column from Quota file
      const geo = rec.geo.toUpperCase();
      if (geo === 'SA') return true; // SA always included
      const mappedRegion = GEO_TO_REGION[geo];
      return mappedRegion === selectedRegion;
    }
    return refs.some((ref) => ref.country != null && validCountries.has(ref.country));
  });

  // ===== V1: EID Reference Check =====
  const v1Results: LmsV1Result[] = [];
  for (const rec of filteredRecords) {
    if (isTbhOrBlank(rec.employeeId)) {
      v1Results.push({ record: rec, status: 'skip', reason: 'TBH / Blank EID' });
      continue;
    }

    const refs = refMap.get(rec.employeeId);
    if (!refs || refs.length === 0) {
      v1Results.push({ record: rec, status: 'fail', reason: 'EID not found in reference file' });
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
          `Country="${ref.country ?? '(blank)'}"${regionOfCountry ? ` (Region: ${regionOfCountry})` : ''} - not in ${selectedRegion}`
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

    v1Results.push({
      record: rec,
      status: foundValid ? 'pass' : 'fail',
      reason: foundValid ? '' : lastIssues.join('; '),
      refInfo: lastRef ? {
        activeStatus: lastRef.activeStatus,
        onLeave: lastRef.onLeave,
        country: lastRef.country,
      } : undefined,
    });
  }

  // ===== V2: Quota Amount Alignment =====
  const v2Results: LmsV2Result[] = [];

  for (const rec of filteredRecords) {
    if (isTbhOrBlank(rec.employeeId)) continue;

    const effectiveDate = rec.quotaEffectiveDate;
    if (!effectiveDate) continue;

    const effectiveCalMonth = effectiveDate.getUTCMonth() + 1; // 1-based
    // If effective date is after Jun, skip (no months to validate in H2)
    if (effectiveCalMonth > 6) continue;
    // If effective date is before Jan (prior year), clamp to Jan
    const effectiveMonth = Math.max(1, effectiveCalMonth);

    const component = rec.component;
    const planType = rec.planType;
    const issues: LmsV2Issue[] = [];

    const expectedMonths = getExpectedActiveMonths(effectiveMonth, planType);

    const checkRev1 = component === 'Non-SA' || component === 'Rev 1 Only' || component === 'Rev 1 & Rev 2';
    const checkRev2 = component === 'Rev 2 Only' || component === 'Rev 1 & Rev 2';
    const isRev2Only = component === 'Rev 2 Only';

    for (const { month, shouldHaveAmount } of expectedMonths) {
      // Check Rev 1 columns (R-W)
      if (checkRev1) {
        const rev1Val = rec.rev1Monthly[month];
        if (shouldHaveAmount && !hasPositiveAmount(rev1Val)) {
          issues.push({
            column: `Rev1-${month}`,
            month,
            issueType: 'missing_amount',
            expectedBehavior: `Expected amount > 0 (${planType}, effective from ${LMS_MONTHS[effectiveMonth - 1]})`,
            actualValue: rev1Val,
          });
        }
        if (!shouldHaveAmount && hasPositiveAmount(rev1Val)) {
          const isOkr = planType.toLowerCase() === 'okr';
          issues.push({
            column: `Rev1-${month}`,
            month,
            issueType: isOkr ? 'okr_has_amount' : 'should_be_zero',
            expectedBehavior: isOkr
              ? 'OKR plan type should have 0 quota'
              : 'Month before effective date or after quarter end should be 0',
            actualValue: rev1Val,
          });
        }
      }

      // Check Rev 2 columns (AA-AF)
      if (checkRev2) {
        const rev2Val = rec.rev2Monthly[month];
        if (shouldHaveAmount && !hasPositiveAmount(rev2Val)) {
          issues.push({
            column: `Rev2-${month}`,
            month,
            issueType: 'missing_amount',
            expectedBehavior: `Expected amount > 0 (${planType}, effective from ${LMS_MONTHS[effectiveMonth - 1]})`,
            actualValue: rev2Val,
          });
        }
        if (!shouldHaveAmount && hasPositiveAmount(rev2Val)) {
          const isOkr = planType.toLowerCase() === 'okr';
          issues.push({
            column: `Rev2-${month}`,
            month,
            issueType: isOkr ? 'okr_has_amount' : 'should_be_zero',
            expectedBehavior: isOkr
              ? 'OKR plan type should have 0 quota'
              : 'Month before effective date or after quarter end should be 0',
            actualValue: rev2Val,
          });
        }
      }

      // For Rev 2 Only: Rev 1 columns should NOT have amounts > 0
      if (isRev2Only) {
        const rev1Val = rec.rev1Monthly[month];
        if (hasPositiveAmount(rev1Val)) {
          issues.push({
            column: `Rev1-${month}`,
            month,
            issueType: 'rev2_only_has_rev1',
            expectedBehavior: 'Rev 2 Only component should not have Rev 1 amounts (blank or 0 expected)',
            actualValue: rev1Val,
          });
        }
      }
    }

    if (issues.length > 0) {
      // Sort issues: Rev1 before Rev2, then by month order (JAN->JUN)
      const monthOrder: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6 };
      issues.sort((a, b) => {
        const aIsRev1 = a.column.startsWith('Rev1') ? 0 : 1;
        const bIsRev1 = b.column.startsWith('Rev1') ? 0 : 1;
        if (aIsRev1 !== bIsRev1) return aIsRev1 - bIsRev1;
        return (monthOrder[a.month] ?? 0) - (monthOrder[b.month] ?? 0);
      });
      v2Results.push({ record: rec, issues });
    }
  }

  // ===== V3: On Leave with Quota =====
  const v3Results: LmsV3Result[] = [];

  // Extract processing month key (e.g., "Feb-26" -> "FEB")
  const processingMonthKey = selectedProcessingMonth.split('-')[0].toUpperCase() as LmsMonth;

  for (const rec of filteredRecords) {
    if (isTbhOrBlank(rec.employeeId)) continue;

    const refs = refMap.get(rec.employeeId);
    if (!refs || refs.length === 0) continue;

    const onLeaveRef = refs.find(
      (ref) => ref.activeStatus === 'Yes' && ref.onLeave === 'Yes'
    );
    if (!onLeaveRef) continue;

    // Check if the processing month is within LMS range (JAN-JUN)
    if (!LMS_MONTHS.includes(processingMonthKey)) continue;

    const component = rec.component;
    const quotaColumnsWithValues: { column: string; value: number | string | null }[] = [];

    const checkRev1 = component === 'Non-SA' || component === 'Rev 1 Only' || component === 'Rev 1 & Rev 2';
    const checkRev2 = component === 'Rev 2 Only' || component === 'Rev 1 & Rev 2';

    if (checkRev1) {
      const val = rec.rev1Monthly[processingMonthKey];
      if (hasPositiveAmount(val)) {
        quotaColumnsWithValues.push({ column: `Rev1-${processingMonthKey}`, value: val });
      }
    }

    if (checkRev2) {
      const val = rec.rev2Monthly[processingMonthKey];
      if (hasPositiveAmount(val)) {
        quotaColumnsWithValues.push({ column: `Rev2-${processingMonthKey}`, value: val });
      }
    }

    if (quotaColumnsWithValues.length > 0) {
      v3Results.push({
        record: rec,
        refInfo: {
          activeStatus: onLeaveRef.activeStatus,
          onLeave: onLeaveRef.onLeave,
          country: onLeaveRef.country,
        },
        processingMonth: processingMonthKey,
        quotaColumnsWithValues,
      });
    }
  }

  // ===== Summary =====
  return {
    v1: v1Results,
    v2: v2Results,
    v3: v3Results,
    summary: {
      v1Pass: v1Results.filter((r) => r.status === 'pass').length,
      v1Fail: v1Results.filter((r) => r.status === 'fail').length,
      v1Skip: v1Results.filter((r) => r.status === 'skip').length,
      v2AlignmentIssues: v2Results.length,
      v3OnLeaveWithQuota: v3Results.length,
      totalRecords: filteredRecords.length,
    },
  };
}
