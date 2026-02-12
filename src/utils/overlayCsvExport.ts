import { H1_MONTHS, H2_MONTHS } from '../types';
import { toCsvRow, downloadCsv } from './csvExport';
import type { OverlayValidationResults } from './overlayValidators';

export function exportOverlayV1Results(results: OverlayValidationResults, filter: 'all' | 'fail') {
  const rows: string[] = [];
  rows.push(toCsvRow(['Sheet', 'Row', 'EID', 'Name', 'Market Segment', 'Status', 'Reason', 'Region Match', 'Region Comment', 'Ref Active Status', 'Ref On Leave', 'Ref Country']));

  const items = filter === 'fail'
    ? results.v1.filter((r) => r.status === 'fail' || r.status === 'skip')
    : results.v1;

  for (const r of items) {
    rows.push(
      toCsvRow([
        r.record.sheet,
        r.record.row,
        r.record.eid,
        r.record.name,
        r.record.repRegion,
        r.status.toUpperCase(),
        r.reason,
        r.regionInfo.matchType,
        r.regionInfo.comment,
        r.refInfo?.activeStatus ?? '',
        r.refInfo?.onLeave ?? '',
        r.refInfo?.country ?? '',
      ]),
    );
  }

  downloadCsv(`overlay_v1_eid_reference_${filter}.csv`, rows.join('\n'));
}

export function exportOverlayV2Results(results: OverlayValidationResults) {
  const rows: string[] = [];
  rows.push(toCsvRow(['EID', 'Occurrences', 'Sheet', 'Row', 'Name']));

  for (const dup of results.v2) {
    for (const rec of dup.occurrences) {
      rows.push(toCsvRow([dup.eid, dup.occurrences.length, rec.sheet, rec.row, rec.name]));
    }
  }

  downloadCsv('overlay_v2_duplicate_eids.csv', rows.join('\n'));
}

export function exportOverlayV3Results(results: OverlayValidationResults) {
  const monthKeys = results.v3[0]?.half === 'H1' ? H1_MONTHS : H2_MONTHS;
  const anyHasY2Y3 = results.v3.some((r) => r.hasY2Y3);
  const anyHasComp2 = results.v3.some((r) => r.hasComp2);
  const anyHasComp2Y2Y3 = results.v3.some((r) => r.hasComp2Y2Y3);

  const y1Headers = monthKeys.map((m) => `Y1-${m}`);
  const y2y3Headers = anyHasY2Y3 ? monthKeys.map((m) => `Y2Y3-${m}`) : [];
  const comp2Y1Headers = anyHasComp2 ? monthKeys.map((m) => `C2:Y1-${m}`) : [];
  const comp2Y2Y3Headers = anyHasComp2Y2Y3 ? monthKeys.map((m) => `C2:Y2Y3-${m}`) : [];

  const rows: string[] = [];
  rows.push(toCsvRow([
    'Sheet', 'Row', 'EID', 'Name', 'Market Segment', 'Dual Metric', 'Quota Start Date', 'Half',
    'Region Match', 'Region Comment',
    'Missing (Y1)', ...y1Headers,
    ...(anyHasY2Y3 ? ['Missing (Y2&Y3)', ...y2y3Headers] : []),
    ...(anyHasComp2 ? ['Missing (C2:Y1)', ...comp2Y1Headers] : []),
    ...(anyHasComp2Y2Y3 ? ['Missing (C2:Y2&Y3)', ...comp2Y2Y3Headers] : []),
  ]));

  for (const r of results.v3) {
    const qsStr = r.record.quotaStartDate
      ? r.record.quotaStartDate.toISOString().slice(0, 10)
      : '';
    const row: unknown[] = [
      r.record.sheet,
      r.record.row,
      r.record.eid,
      r.record.name,
      r.record.repRegion,
      r.record.dualMetric,
      qsStr,
      r.half,
      r.regionInfo.matchType,
      r.regionInfo.comment,
      r.missingMonths.join(', '),
      ...monthKeys.map((m) => r.quotaValues[m]),
    ];
    if (anyHasY2Y3) {
      row.push(
        r.missingMonthsY2Y3.join(', '),
        ...monthKeys.map((m) => r.quotaValuesY2Y3[m]),
      );
    }
    if (anyHasComp2) {
      row.push(
        r.missingMonthsComp2.join(', '),
        ...monthKeys.map((m) => r.quotaValuesComp2[m]),
      );
    }
    if (anyHasComp2Y2Y3) {
      row.push(
        r.missingMonthsComp2Y2Y3.join(', '),
        ...monthKeys.map((m) => r.quotaValuesComp2Y2Y3[m]),
      );
    }
    rows.push(toCsvRow(row));
  }

  downloadCsv('overlay_v3_missing_quota_amounts.csv', rows.join('\n'));
}

export function exportAllOverlayResults(results: OverlayValidationResults) {
  const rows: string[] = [];
  rows.push(toCsvRow([
    'Validation', 'Sheet', 'Row', 'EID', 'Name', 'Market Segment', 'Status/Issue', 'Details', 'Region Match', 'Region Comment',
  ]));

  for (const r of results.v1) {
    rows.push(toCsvRow([
      'V1-EID Check', r.record.sheet, r.record.row, r.record.eid, r.record.name,
      r.record.repRegion, r.status.toUpperCase(), r.reason,
      r.regionInfo.matchType, r.regionInfo.comment,
    ]));
  }

  for (const dup of results.v2) {
    for (const rec of dup.occurrences) {
      const info = dup.regionInfoMap[`${rec.sheet}-${rec.row}`];
      rows.push(toCsvRow([
        'V2-Duplicate', rec.sheet, rec.row, dup.eid, rec.name,
        rec.repRegion, 'DUPLICATE', `Appears ${dup.occurrences.length} times`,
        info?.matchType ?? '', info?.comment ?? '',
      ]));
    }
  }

  for (const r of results.v3) {
    const qsStr = r.record.quotaStartDate
      ? r.record.quotaStartDate.toISOString().slice(0, 10)
      : '';
    const details: string[] = [`Start: ${qsStr}`];
    if (r.missingMonths.length > 0) details.push(`Y1: ${r.missingMonths.join(', ')}`);
    if (r.missingMonthsY2Y3.length > 0) details.push(`Y2&Y3: ${r.missingMonthsY2Y3.join(', ')}`);
    if (r.missingMonthsComp2.length > 0) details.push(`C2:Y1: ${r.missingMonthsComp2.join(', ')}`);
    if (r.missingMonthsComp2Y2Y3.length > 0) details.push(`C2:Y2&Y3: ${r.missingMonthsComp2Y2Y3.join(', ')}`);
    rows.push(toCsvRow([
      'V3-Missing Quota', r.record.sheet, r.record.row, r.record.eid, r.record.name,
      r.record.repRegion, 'MISSING', details.join('; '),
      r.regionInfo.matchType, r.regionInfo.comment,
    ]));
  }

  downloadCsv('overlay_validation_results_all.csv', rows.join('\n'));
}
