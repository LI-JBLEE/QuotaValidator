import type {
  QuotaRecord,
  ReferenceRecord,
  V1Result,
  V2Result,
  V3Result,
  Region,
  FiscalHalf,
} from '../types';
import {
  COUNTRY_REGION_MAP,
  getCountriesForRegion,
  MARKET_SEGMENT_REGION_MAP,
  COUNTRY_CODE_REGION_MAP,
  H1_MONTHS,
  H2_MONTHS,
} from '../types';
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

export type RegionMatchType = 'scr' | 'segment_direct' | 'segment_country_code' | 'unknown';

export interface OverlayRegionInfo {
  matchType: RegionMatchType;
  comment: string;
}

export interface OverlayV1Result extends V1Result {
  regionInfo: OverlayRegionInfo;
}

export interface OverlayV2Result extends V2Result {
  regionInfoMap: Record<string, OverlayRegionInfo>; // eid -> regionInfo
}

export interface OverlayV3Result extends V3Result {
  regionInfo: OverlayRegionInfo;
}

export interface OverlayValidationResults {
  v1: OverlayV1Result[];
  v2: OverlayV2Result[];
  v3: OverlayV3Result[];
  summary: {
    v1Pass: number;
    v1Fail: number;
    v1Skip: number;
    v2DuplicateEids: number;
    v3MissingQuota: number;
    totalRecords: number;
  };
}

/**
 * Determine the region for a record based on:
 * (1) SCR country lookup
 * (2) Market Segment direct match (APAC, EMEAL, EMEA, LATAM, NAMER)
 * (3) Market Segment as 2-letter ISO country code
 * (4) Unknown
 */
function resolveRegion(
  rec: QuotaRecord,
  refMap: Map<string, ReferenceRecord[]>,
  validCountries: Set<string>,
  selectedRegion: Region,
): { included: boolean; info: OverlayRegionInfo } {
  const eid = rec.eid;

  if (isTbhOrBlank(eid)) {
    return { included: true, info: { matchType: 'unknown', comment: 'TBH / Blank EID' } };
  }

  // (1) SCR lookup
  const refs = refMap.get(eid);
  if (refs && refs.length > 0) {
    const matchingRef = refs.find((ref) => ref.country != null && validCountries.has(ref.country));
    if (matchingRef) {
      return {
        included: true,
        info: { matchType: 'scr', comment: `SCR: ${matchingRef.country}` },
      };
    }
    // SCR found but country not in region
    const firstRef = refs[0];
    const country = firstRef.country;
    if (country) {
      const refRegion = COUNTRY_REGION_MAP[country];
      if (refRegion && refRegion !== selectedRegion) {
        return {
          included: false,
          info: { matchType: 'scr', comment: `SCR Country "${country}" belongs to ${refRegion}, not ${selectedRegion}` },
        };
      }
    }
    // SCR found but country is blank/unknown — fall through to Market Segment
  }

  // (2) Market Segment direct match
  const marketSegment = rec.repRegion.trim();
  const segmentUpper = marketSegment.toUpperCase();

  const directRegion = MARKET_SEGMENT_REGION_MAP[segmentUpper];
  if (directRegion) {
    if (directRegion === selectedRegion) {
      return {
        included: true,
        info: { matchType: 'segment_direct', comment: `Market Segment: ${marketSegment}` },
      };
    }
    return {
      included: false,
      info: { matchType: 'segment_direct', comment: `Market Segment "${marketSegment}" → ${directRegion}, not ${selectedRegion}` },
    };
  }

  // (3) Market Segment as 2-letter country code
  if (segmentUpper.length === 2) {
    const codeRegion = COUNTRY_CODE_REGION_MAP[segmentUpper];
    if (codeRegion) {
      if (codeRegion === selectedRegion) {
        return {
          included: true,
          info: { matchType: 'segment_country_code', comment: `Market Segment "${marketSegment}" → country code → ${codeRegion}` },
        };
      }
      return {
        included: false,
        info: { matchType: 'segment_country_code', comment: `Market Segment "${marketSegment}" → ${codeRegion}, not ${selectedRegion}` },
      };
    }
  }

  // (4) Unknown — include with warning
  return {
    included: true,
    info: {
      matchType: 'unknown',
      comment: `Region unconfirmed: EID not in SCR, Market Segment "${marketSegment}" not recognized as a region or country code`,
    },
  };
}

export function runOverlayValidation(
  allRecords: QuotaRecord[],
  refRecords: ReferenceRecord[],
  selectedMonth: string,
  selectedRegion: Region,
): OverlayValidationResults {
  const parsed = parseSubmissionMonthLabel(selectedMonth);
  if (!parsed) throw new Error(`Invalid submission month: ${selectedMonth}`);

  // Filter records matching the selected submission month
  const targetRecords = allRecords.filter((rec) => {
    if (!rec.submissionMonth) return false;
    return (
      rec.submissionMonth.getUTCFullYear() === parsed.year &&
      rec.submissionMonth.getUTCMonth() + 1 === parsed.month
    );
  });

  // Build reference lookup
  const refMap = new Map<string, ReferenceRecord[]>();
  for (const ref of refRecords) {
    const existing = refMap.get(ref.eid) || [];
    existing.push(ref);
    refMap.set(ref.eid, existing);
  }

  const validCountries = new Set(getCountriesForRegion(selectedRegion));

  // Resolve region info for each record and filter
  const regionInfoCache = new Map<QuotaRecord, OverlayRegionInfo>();
  const filteredRecords: QuotaRecord[] = [];

  for (const rec of targetRecords) {
    const { included, info } = resolveRegion(rec, refMap, validCountries, selectedRegion);
    regionInfoCache.set(rec, info);
    if (included) {
      filteredRecords.push(rec);
    }
  }

  // ========== V1: EID Reference Check ==========
  const v1Results: OverlayV1Result[] = [];
  for (const rec of filteredRecords) {
    const regionInfo = regionInfoCache.get(rec)!;

    if (isTbhOrBlank(rec.eid)) {
      v1Results.push({
        record: rec,
        status: 'skip',
        reason: 'TBH / Blank EID',
        regionInfo,
      });
      continue;
    }

    const refs = refMap.get(rec.eid);
    if (!refs || refs.length === 0) {
      v1Results.push({
        record: rec,
        status: 'fail',
        reason: 'EID not found in reference file',
        regionInfo,
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

    v1Results.push({
      record: rec,
      status: foundValid ? 'pass' : 'fail',
      reason: foundValid ? '' : lastIssues.join('; '),
      refInfo: lastRef
        ? {
            activeStatus: lastRef.activeStatus,
            onLeave: lastRef.onLeave,
            country: lastRef.country,
          }
        : undefined,
      regionInfo,
    });
  }

  // ========== V2: Duplicate EID Check ==========
  const eidMap = new Map<string, QuotaRecord[]>();
  for (const rec of filteredRecords) {
    if (isTbhOrBlank(rec.eid)) continue;
    const existing = eidMap.get(rec.eid) || [];
    existing.push(rec);
    eidMap.set(rec.eid, existing);
  }

  const v2Results: OverlayV2Result[] = [];
  for (const [eid, recs] of eidMap.entries()) {
    if (recs.length > 1) {
      const regionInfoMap: Record<string, OverlayRegionInfo> = {};
      for (const rec of recs) {
        regionInfoMap[`${rec.sheet}-${rec.row}`] = regionInfoCache.get(rec)!;
      }
      v2Results.push({ eid, occurrences: recs, regionInfoMap });
    }
  }

  // ========== V3: Missing Quota Amounts ==========
  const isH1 = parsed.month >= 7;
  const half: FiscalHalf = isH1 ? 'H1' : 'H2';
  const halfMonthKeys = isH1 ? H1_MONTHS : H2_MONTHS;
  const halfStartCalMonth = isH1 ? 7 : 1;

  const v3Results: OverlayV3Result[] = [];

  for (const rec of filteredRecords) {
    const qs = rec.quotaStartDate;
    if (!qs) continue;

    const regionInfo = regionInfoCache.get(rec)!;
    const startYear = qs.getUTCFullYear();
    const startMonth = qs.getUTCMonth() + 1;
    const halfEndCalMonth = isH1 ? 12 : 6;
    const halfYear = parsed.year;

    if (startYear > halfYear || (startYear === halfYear && startMonth > halfEndCalMonth)) {
      continue;
    }

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

      const val = rec.monthlyQuotas[key];
      quotaValues[key] = val;

      const valY2 = hasY2Y3 ? rec.monthlyQuotasY2Y3![key] : null;
      quotaValuesY2Y3[key] = valY2;

      const valComp2 = hasComp2 ? rec.monthlyQuotasComp2![key] : null;
      quotaValuesComp2[key] = valComp2;

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
        record: rec,
        half,
        missingMonths,
        quotaValues,
        missingMonthsY2Y3,
        quotaValuesY2Y3,
        hasY2Y3,
        missingMonthsComp2,
        quotaValuesComp2,
        missingMonthsComp2Y2Y3,
        quotaValuesComp2Y2Y3,
        hasComp2,
        hasComp2Y2Y3,
        regionInfo,
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
      totalRecords: filteredRecords.length,
    },
  };
}
