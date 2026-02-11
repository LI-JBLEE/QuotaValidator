import type { LmsValidationResults } from '../lmsTypes';
import { escapeCsv, toCsvRow, downloadCsv } from './csvExport';

export function exportLmsV1Results(results: LmsValidationResults, filter: 'all' | 'fail') {
  const rows: string[] = [];
  rows.push(toCsvRow([
    'Row', 'EID', 'Name', 'Geo', 'Tier', 'Component', 'Status', 'Reason',
    'Ref Active Status', 'Ref On Leave', 'Ref Country',
  ]));

  const items = filter === 'fail'
    ? results.v1.filter((r) => r.status === 'fail' || r.status === 'skip')
    : results.v1;

  for (const r of items) {
    rows.push(toCsvRow([
      r.record.row,
      r.record.employeeId,
      r.record.name,
      r.record.geo,
      r.record.tier,
      r.record.component,
      r.status.toUpperCase(),
      r.reason,
      r.refInfo?.activeStatus ?? '',
      r.refInfo?.onLeave ?? '',
      r.refInfo?.country ?? '',
    ]));
  }

  downloadCsv(`lms_v1_eid_reference_check_${filter}.csv`, rows.join('\n'));
}

export function exportLmsV2Results(results: LmsValidationResults) {
  const rows: string[] = [];
  rows.push(toCsvRow([
    'Row', 'EID', 'Name', 'Component', 'Plan Type', 'Effective Date',
    'Issue Column', 'Issue Type', 'Expected', 'Actual Value',
  ]));

  for (const r of results.v2) {
    const effStr = r.record.quotaEffectiveDate
      ? r.record.quotaEffectiveDate.toISOString().slice(0, 10)
      : '';
    for (const issue of r.issues) {
      rows.push(toCsvRow([
        r.record.row,
        r.record.employeeId,
        r.record.name,
        r.record.component,
        r.record.planType,
        effStr,
        issue.column,
        issue.issueType,
        issue.expectedBehavior,
        issue.actualValue,
      ]));
    }
  }

  downloadCsv('lms_v2_quota_alignment.csv', rows.join('\n'));
}

export function exportLmsV3Results(results: LmsValidationResults) {
  const rows: string[] = [];
  rows.push(toCsvRow([
    'Row', 'EID', 'Name', 'Component', 'Processing Month',
    'On Leave', 'Quota Column', 'Quota Value',
  ]));

  for (const r of results.v3) {
    for (const col of r.quotaColumnsWithValues) {
      rows.push(toCsvRow([
        r.record.row,
        r.record.employeeId,
        r.record.name,
        r.record.component,
        r.processingMonth,
        r.refInfo.onLeave ?? '',
        col.column,
        col.value,
      ]));
    }
  }

  downloadCsv('lms_v3_on_leave_quota.csv', rows.join('\n'));
}

export function exportAllLmsResults(results: LmsValidationResults) {
  const rows: string[] = [];
  rows.push(toCsvRow([
    'Validation', 'Row', 'EID', 'Name', 'Status/Issue', 'Details',
  ]));

  // V1
  for (const r of results.v1) {
    rows.push(toCsvRow([
      'V1-EID Check', r.record.row, r.record.employeeId, r.record.name,
      r.status.toUpperCase(), r.reason,
    ]));
  }

  // V2
  for (const r of results.v2) {
    const effStr = r.record.quotaEffectiveDate
      ? r.record.quotaEffectiveDate.toISOString().slice(0, 10)
      : '';
    const issueDetails = r.issues.map(
      (i) => `${i.column}: ${i.issueType} (actual=${escapeCsv(i.actualValue)})`
    ).join('; ');
    rows.push(toCsvRow([
      'V2-Alignment', r.record.row, r.record.employeeId, r.record.name,
      `${r.issues.length} issue(s)`, `Effective: ${effStr}; ${issueDetails}`,
    ]));
  }

  // V3
  for (const r of results.v3) {
    const colDetails = r.quotaColumnsWithValues.map(
      (c) => `${c.column}=${c.value}`
    ).join('; ');
    rows.push(toCsvRow([
      'V3-On Leave', r.record.row, r.record.employeeId, r.record.name,
      'ON_LEAVE_WITH_QUOTA', `Month: ${r.processingMonth}; ${colDetails}`,
    ]));
  }

  downloadCsv('lms_validation_results_all.csv', rows.join('\n'));
}
