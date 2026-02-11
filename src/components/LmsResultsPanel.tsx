import { useState } from 'react';
import type { LmsValidationResults, LmsV2IssueType } from '../lmsTypes';
import {
  exportLmsV1Results,
  exportLmsV2Results,
  exportLmsV3Results,
  exportAllLmsResults,
} from '../utils/lmsCsvExport';

interface LmsResultsPanelProps {
  results: LmsValidationResults;
}

type Tab = 'v1' | 'v2' | 'v3';

const STATUS_BADGE: Record<string, string> = {
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  skip: 'bg-yellow-100 text-yellow-800',
};

const ISSUE_BADGE: Record<LmsV2IssueType, { bg: string; label: string }> = {
  should_be_zero: { bg: 'bg-amber-100 text-amber-800', label: 'Should Be 0' },
  missing_amount: { bg: 'bg-red-100 text-red-800', label: 'Missing Amount' },
  okr_has_amount: { bg: 'bg-amber-100 text-amber-800', label: 'OKR Has Amount' },
  rev2_only_has_rev1: { bg: 'bg-purple-100 text-purple-800', label: 'Rev1 on Rev2-Only' },
};

export default function LmsResultsPanel({ results }: LmsResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('v1');
  const { summary } = results;

  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    {
      key: 'v1',
      label: 'V1: EID Reference',
      count: summary.v1Fail + summary.v1Skip,
      color: summary.v1Fail > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      key: 'v2',
      label: 'V2: Quota Alignment',
      count: summary.v2AlignmentIssues,
      color: summary.v2AlignmentIssues > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      key: 'v3',
      label: 'V3: On Leave',
      count: summary.v3OnLeaveWithQuota,
      color: summary.v3OnLeaveWithQuota > 0 ? 'text-red-600' : 'text-green-600',
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Summary Bar */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            LMS Validation Results
          </h2>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-500">
              Total: <span className="font-semibold text-gray-800">{summary.totalRecords}</span>
            </span>
            <span className="text-green-600">
              V1 Pass: <span className="font-semibold">{summary.v1Pass}</span>
            </span>
            <span className="text-red-600">
              V1 Fail: <span className="font-semibold">{summary.v1Fail}</span>
            </span>
            <span className="text-yellow-600">
              TBH: <span className="font-semibold">{summary.v1Skip}</span>
            </span>
            <span className="text-orange-600">
              V2: <span className="font-semibold">{summary.v2AlignmentIssues}</span>
            </span>
            <span className="text-purple-600">
              V3: <span className="font-semibold">{summary.v3OnLeaveWithQuota}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`ml-2 text-xs font-semibold ${tab.color}`}>
              ({tab.count} issue{tab.count !== 1 ? 's' : ''})
            </span>
          </button>
        ))}
      </div>

      {/* Tab Description */}
      <TabDescription tab={activeTab} />

      {/* Tab Content */}
      <div className="p-4 max-h-[500px] overflow-auto">
        {activeTab === 'v1' && <V1Table results={results} />}
        {activeTab === 'v2' && <V2Table results={results} />}
        {activeTab === 'v3' && <V3Table results={results} />}
      </div>

      {/* Export Buttons */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex gap-3 flex-wrap">
        <ExportBtn label="Export All (CSV)" onClick={() => exportAllLmsResults(results)} />
        <ExportBtn label="V1 - Failed Only" onClick={() => exportLmsV1Results(results, 'fail')} />
        <ExportBtn label="V1 - All" onClick={() => exportLmsV1Results(results, 'all')} />
        {results.v2.length > 0 && (
          <ExportBtn label="V2 - Alignment" onClick={() => exportLmsV2Results(results)} />
        )}
        {results.v3.length > 0 && (
          <ExportBtn label="V3 - On Leave" onClick={() => exportLmsV3Results(results)} />
        )}
      </div>
    </div>
  );
}

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  v1: 'Verifies that each Employee ID exists in the SCR with Active Status = "Yes", On Leave = blank, and Country within the selected region.',
  v2: 'Checks that monthly quota amounts align with the Quota Effective Date, Component type, and Plan Type. Validates Rev 1 columns (R\u2013W) and Rev 2 columns (AA\u2013AF) based on component mapping. For Semi: amounts expected through Jun. For Qtrly: amounts expected through quarter end. For OKR: all amounts should be 0.',
  v3: 'Identifies employees who are marked On Leave (Active Status = "Yes", On Leave = "Yes") in the SCR but still have quota amounts > 0 for the selected Quota Processing Month.',
};

function TabDescription({ tab }: { tab: Tab }) {
  return (
    <div className="mx-4 mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700 leading-relaxed">
      <span className="font-semibold mr-1">i</span>
      {TAB_DESCRIPTIONS[tab]}
    </div>
  );
}

function ExportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </button>
  );
}

// ===== V1 Table =====
function V1Table({ results }: { results: LmsValidationResults }) {
  const failAndSkip = results.v1.filter((r) => r.status !== 'pass');
  if (failAndSkip.length === 0) {
    return <EmptyState message="All EID reference checks passed!" />;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 uppercase">
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Row</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">EID</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Name</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Geo</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Eff. Date</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Status</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Reason</th>
          <th className="sticky top-0 bg-white pb-2 z-10">Notes</th>
        </tr>
      </thead>
      <tbody>
        {failAndSkip.map((r, i) => (
          <tr key={i} className="border-t border-gray-300">
            <td className="py-2 pr-3 text-gray-600">{r.record.row}</td>
            <td className="py-2 pr-3 font-mono text-gray-800">{r.record.employeeId || '-'}</td>
            <td className="py-2 pr-3 text-gray-800 max-w-[200px] truncate">{r.record.name}</td>
            <td className="py-2 pr-3 text-gray-600">{r.record.geo}</td>
            <td className="py-2 pr-3 text-gray-600 text-xs">{r.record.quotaEffectiveDate ? r.record.quotaEffectiveDate.toISOString().slice(0, 10) : '-'}</td>
            <td className="py-2 pr-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[r.status]}`}>
                {r.status.toUpperCase()}
              </span>
            </td>
            <td className="py-2 pr-3 text-gray-600 text-xs">{r.reason}</td>
            <td className="py-2 text-gray-500 text-xs max-w-[200px] truncate" title={r.record.notes}>{r.record.notes || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ===== V2 Table =====
function V2Table({ results }: { results: LmsValidationResults }) {
  if (results.v2.length === 0) {
    return <EmptyState message="All quota amounts are properly aligned!" />;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 uppercase">
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">Row</th>
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">EID</th>
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">Name</th>
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">Component</th>
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">Plan</th>
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">Eff. Date</th>
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">Column</th>
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">Issue</th>
          <th className="sticky top-0 bg-white pb-2 pr-2 z-10">Value</th>
          <th className="sticky top-0 bg-white pb-2 z-10">Notes</th>
        </tr>
      </thead>
      <tbody>
        {results.v2.flatMap((r) => {
          const effStr = r.record.quotaEffectiveDate
            ? r.record.quotaEffectiveDate.toISOString().slice(0, 10)
            : '';
          return r.issues.map((issue, j) => (
            <tr key={`${r.record.row}-${j}`} className={j === 0 ? 'border-t-2 border-gray-300' : 'border-t border-gray-100'}>
              {j === 0 ? (
                <>
                  <td className="py-2 pr-2 text-gray-600" rowSpan={r.issues.length}>{r.record.row}</td>
                  <td className="py-2 pr-2 font-mono text-gray-800" rowSpan={r.issues.length}>{r.record.employeeId}</td>
                  <td className="py-2 pr-2 text-gray-800 max-w-[130px] truncate" rowSpan={r.issues.length}>{r.record.name}</td>
                  <td className="py-2 pr-2 text-gray-600 text-xs" rowSpan={r.issues.length}>{r.record.component}</td>
                  <td className="py-2 pr-2 text-gray-600 text-xs" rowSpan={r.issues.length}>{r.record.planType}</td>
                  <td className="py-2 pr-2 text-gray-600 text-xs" rowSpan={r.issues.length}>{effStr}</td>
                </>
              ) : null}
              <td className="py-2 pr-2 font-mono text-xs text-gray-700">{issue.column}</td>
              <td className="py-2 pr-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ISSUE_BADGE[issue.issueType].bg}`}>
                  {ISSUE_BADGE[issue.issueType].label}
                </span>
              </td>
              <td className="py-2 pr-2 text-xs font-mono text-gray-600">{formatQuotaVal(issue.actualValue)}</td>
              {j === 0 ? (
                <td className="py-2 text-gray-500 text-xs max-w-[150px] truncate" rowSpan={r.issues.length} title={r.record.notes}>{r.record.notes || '-'}</td>
              ) : null}
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}

// ===== V3 Table =====
function V3Table({ results }: { results: LmsValidationResults }) {
  if (results.v3.length === 0) {
    return <EmptyState message="No on-leave employees with active quota found!" />;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 uppercase">
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Row</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">EID</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Name</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Component</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Month</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Column</th>
          <th className="sticky top-0 bg-white pb-2 pr-3 z-10">Value</th>
          <th className="sticky top-0 bg-white pb-2 z-10">Notes</th>
        </tr>
      </thead>
      <tbody>
        {results.v3.flatMap((r) =>
          r.quotaColumnsWithValues.map((col, j) => (
            <tr key={`${r.record.row}-${j}`} className={j === 0 ? 'border-t-2 border-gray-300' : 'border-t border-gray-100'}>
              {j === 0 ? (
                <>
                  <td className="py-2 pr-3 text-gray-600" rowSpan={r.quotaColumnsWithValues.length}>{r.record.row}</td>
                  <td className="py-2 pr-3 font-mono text-gray-800" rowSpan={r.quotaColumnsWithValues.length}>{r.record.employeeId}</td>
                  <td className="py-2 pr-3 text-gray-800 max-w-[200px] truncate" rowSpan={r.quotaColumnsWithValues.length}>{r.record.name}</td>
                  <td className="py-2 pr-3 text-gray-600 text-xs" rowSpan={r.quotaColumnsWithValues.length}>{r.record.component}</td>
                  <td className="py-2 pr-3" rowSpan={r.quotaColumnsWithValues.length}>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                      {r.processingMonth}
                    </span>
                  </td>
                </>
              ) : null}
              <td className="py-2 pr-3 font-mono text-xs text-gray-700">{col.column}</td>
              <td className="py-2 pr-3 text-xs font-mono text-red-600 font-semibold">{formatQuotaVal(col.value)}</td>
              {j === 0 ? (
                <td className="py-2 text-gray-500 text-xs max-w-[150px] truncate" rowSpan={r.quotaColumnsWithValues.length} title={r.record.notes}>{r.record.notes || '-'}</td>
              ) : null}
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

function formatQuotaVal(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'number') return val === 0 ? '0' : val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return String(val);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <svg className="w-12 h-12 mb-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm font-medium text-green-600">{message}</p>
    </div>
  );
}
