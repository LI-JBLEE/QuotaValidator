import { Fragment, useState } from 'react';
import type { ValidationResults } from '../types';
import { H1_MONTHS, H2_MONTHS } from '../types';
import { exportV1Results, exportV2Results, exportV3Results, exportAllResults } from '../utils/csvExport';

interface ResultsPanelProps {
  results: ValidationResults;
}

type Tab = 'v1' | 'v2' | 'v3';

const STATUS_BADGE: Record<string, string> = {
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  skip: 'bg-yellow-100 text-yellow-800',
};

export default function ResultsPanel({ results }: ResultsPanelProps) {
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
      label: 'V2: Duplicates',
      count: summary.v2DuplicateEids,
      color: summary.v2DuplicateEids > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      key: 'v3',
      label: 'V3: Quota Amounts',
      count: summary.v3MissingQuota,
      color: summary.v3MissingQuota > 0 ? 'text-red-600' : 'text-green-600',
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Summary Bar */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Validation Results
          </h2>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-500">
              Total: <span className="font-semibold text-gray-800">{summary.totalRecords}</span>
            </span>
            <span className="text-green-600">
              Pass: <span className="font-semibold">{summary.v1Pass}</span>
            </span>
            <span className="text-red-600">
              Fail: <span className="font-semibold">{summary.v1Fail}</span>
            </span>
            <span className="text-yellow-600">
              TBH: <span className="font-semibold">{summary.v1Skip}</span>
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
        <ExportBtn label="Export All (CSV)" onClick={() => exportAllResults(results)} />
        <ExportBtn label="V1 - Failed Only" onClick={() => exportV1Results(results, 'fail')} />
        <ExportBtn label="V1 - All" onClick={() => exportV1Results(results, 'all')} />
        {results.v2.length > 0 && (
          <ExportBtn label="V2 - Duplicates" onClick={() => exportV2Results(results)} />
        )}
        {results.v3.length > 0 && (
          <ExportBtn label="V3 - Missing Quota" onClick={() => exportV3Results(results)} />
        )}
      </div>
    </div>
  );
}

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  v1: 'Verifies that each EID exists in the reference file with Active Status = "Yes", On Leave = blank, and Country within the selected region.',
  v2: 'Checks for duplicate EIDs across all Quota sheets within the selected submission month.',
  v3: 'Ensures monthly quota amounts (Comp1 Y1, Y2&Y3) are populated from the Quota Start Date onward within the fiscal half. For DMC records, also validates Comp2 Y1 and Y2&Y3. H1 (Jul\u2013Dec) for submission months Jul\u2013Dec; H2 (Jan\u2013Jun) for submission months Jan\u2013Jun. Flags records with missing or zero values.',
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

function V1Table({ results }: { results: ValidationResults }) {
  const failAndSkip = results.v1.filter((r) => r.status !== 'pass');
  if (failAndSkip.length === 0) {
    return <EmptyState message="All EID reference checks passed!" />;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 uppercase">
          <th className="pb-2 pr-3">Sheet</th>
          <th className="pb-2 pr-3">Row</th>
          <th className="pb-2 pr-3">EID</th>
          <th className="pb-2 pr-3">Name</th>
          <th className="pb-2 pr-3">Status</th>
          <th className="pb-2">Reason</th>
        </tr>
      </thead>
      <tbody>
        {failAndSkip.map((r, i) => (
          <tr key={i} className="border-t border-gray-100">
            <td className="py-2 pr-3 text-gray-600">{r.record.sheet}</td>
            <td className="py-2 pr-3 text-gray-600">{r.record.row}</td>
            <td className="py-2 pr-3 font-mono text-gray-800">{r.record.eid || '-'}</td>
            <td className="py-2 pr-3 text-gray-800 max-w-[200px] truncate">{r.record.name}</td>
            <td className="py-2 pr-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[r.status]}`}>
                {r.status.toUpperCase()}
              </span>
            </td>
            <td className="py-2 text-gray-600 text-xs">{r.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function V2Table({ results }: { results: ValidationResults }) {
  if (results.v2.length === 0) {
    return <EmptyState message="No duplicate EIDs found!" />;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 uppercase">
          <th className="pb-2 pr-3">EID</th>
          <th className="pb-2 pr-3">Count</th>
          <th className="pb-2 pr-3">Sheet</th>
          <th className="pb-2 pr-3">Row</th>
          <th className="pb-2">Name</th>
        </tr>
      </thead>
      <tbody>
        {results.v2.flatMap((dup) =>
          dup.occurrences.map((rec, i) => (
            <tr key={`${dup.eid}-${i}`} className="border-t border-gray-100">
              <td className="py-2 pr-3 font-mono text-gray-800">{dup.eid}</td>
              <td className="py-2 pr-3">
                {i === 0 && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    {dup.occurrences.length}x
                  </span>
                )}
              </td>
              <td className="py-2 pr-3 text-gray-600">{rec.sheet}</td>
              <td className="py-2 pr-3 text-gray-600">{rec.row}</td>
              <td className="py-2 text-gray-800">{rec.name}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

function V3Table({ results }: { results: ValidationResults }) {
  if (results.v3.length === 0) {
    return <EmptyState message="All quota amounts are properly filled!" />;
  }

  const displayMonths = results.v3[0]?.half === 'H1' ? H1_MONTHS : H2_MONTHS;
  const anyHasY2Y3 = results.v3.some((r) => r.hasY2Y3);
  const anyHasComp2 = results.v3.some((r) => r.hasComp2);
  const anyHasComp2Y2Y3 = results.v3.some((r) => r.hasComp2Y2Y3);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 uppercase">
          <th className="pb-2 pr-2">Sheet</th>
          <th className="pb-2 pr-2">Row</th>
          <th className="pb-2 pr-2">EID</th>
          <th className="pb-2 pr-2">Name</th>
          <th className="pb-2 pr-2">QSD</th>
          <th className="pb-2 pr-2">Type</th>
          <th className="pb-2 pr-2">Missing</th>
          {displayMonths.map((m) => (
            <th key={m} className="pb-2 pr-1 text-right">{m}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.v3.map((r, i) => {
          const qsStr = r.record.quotaStartDate
            ? r.record.quotaStartDate.toISOString().slice(0, 10)
            : '';
          const missingSetY1 = new Set(r.missingMonths);
          const missingSetY2 = new Set(r.missingMonthsY2Y3);
          const missingSetComp2 = new Set(r.missingMonthsComp2);
          const missingSetComp2Y2 = new Set(r.missingMonthsComp2Y2Y3);
          const showY1 = r.missingMonths.length > 0;
          const showY2 = r.hasY2Y3 && r.missingMonthsY2Y3.length > 0;
          const showComp2 = r.hasComp2 && r.missingMonthsComp2.length > 0;
          const showComp2Y2 = r.hasComp2Y2Y3 && r.missingMonthsComp2Y2Y3.length > 0;
          let isFirstRow = true;

          const infoCell = (show: boolean) => {
            if (!isFirstRow && show) return { sheet: '', row: '', eid: '', name: '', qs: '' };
            if (show) {
              isFirstRow = false;
              return { sheet: r.record.sheet, row: r.record.row, eid: r.record.eid || '-', name: r.record.name, qs: qsStr };
            }
            return null;
          };

          const y1Info = infoCell(showY1);
          const y2Info = infoCell(showY2);
          const c2Info = infoCell(showComp2);
          const c2y2Info = infoCell(showComp2Y2);

          return (
            <Fragment key={i}>
              {/* Comp1 Y1 row */}
              {showY1 && (
                <tr className="border-t border-gray-100">
                  <td className="py-2 pr-2 text-gray-600">{y1Info!.sheet}</td>
                  <td className="py-2 pr-2 text-gray-600">{y1Info!.row}</td>
                  <td className="py-2 pr-2 font-mono text-gray-800">{y1Info!.eid}</td>
                  <td className="py-2 pr-2 text-gray-800 max-w-[130px] truncate">{y1Info!.name}</td>
                  <td className="py-2 pr-2 text-gray-600 text-xs">{y1Info!.qs}</td>
                  <td className="py-2 pr-2">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Y1</span>
                  </td>
                  <td className="py-2 pr-2">
                    <span className="text-xs text-red-600 font-medium">{r.missingMonths.join(', ')}</span>
                  </td>
                  {displayMonths.map((m) => (
                    <td key={m} className={`py-2 pr-1 text-right text-xs font-mono ${missingSetY1.has(m) ? 'text-red-600 bg-red-50 font-semibold' : 'text-gray-500'}`}>
                      {formatQuotaVal(r.quotaValues[m])}
                    </td>
                  ))}
                </tr>
              )}
              {/* Comp1 Y2&Y3 row */}
              {showY2 && (
                <tr className="bg-gray-50/50">
                  <td className="py-2 pr-2 text-gray-600">{y2Info!.sheet}</td>
                  <td className="py-2 pr-2 text-gray-600">{y2Info!.row}</td>
                  <td className="py-2 pr-2 font-mono text-gray-800">{y2Info!.eid}</td>
                  <td className="py-2 pr-2 text-gray-800 max-w-[130px] truncate">{y2Info!.name}</td>
                  <td className="py-2 pr-2 text-gray-600 text-xs">{y2Info!.qs}</td>
                  <td className="py-2 pr-2">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Y2&Y3</span>
                  </td>
                  <td className="py-2 pr-2">
                    <span className="text-xs text-red-600 font-medium">{r.missingMonthsY2Y3.join(', ')}</span>
                  </td>
                  {displayMonths.map((m) => (
                    <td key={m} className={`py-2 pr-1 text-right text-xs font-mono ${missingSetY2.has(m) ? 'text-red-600 bg-red-50 font-semibold' : 'text-gray-500'}`}>
                      {formatQuotaVal(r.quotaValuesY2Y3[m])}
                    </td>
                  ))}
                </tr>
              )}
              {/* Comp2 Y1 row */}
              {showComp2 && (
                <tr className="bg-purple-50/30">
                  <td className="py-2 pr-2 text-gray-600">{c2Info!.sheet}</td>
                  <td className="py-2 pr-2 text-gray-600">{c2Info!.row}</td>
                  <td className="py-2 pr-2 font-mono text-gray-800">{c2Info!.eid}</td>
                  <td className="py-2 pr-2 text-gray-800 max-w-[130px] truncate">{c2Info!.name}</td>
                  <td className="py-2 pr-2 text-gray-600 text-xs">{c2Info!.qs}</td>
                  <td className="py-2 pr-2">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">C2:Y1</span>
                  </td>
                  <td className="py-2 pr-2">
                    <span className="text-xs text-red-600 font-medium">{r.missingMonthsComp2.join(', ')}</span>
                  </td>
                  {displayMonths.map((m) => (
                    <td key={m} className={`py-2 pr-1 text-right text-xs font-mono ${missingSetComp2.has(m) ? 'text-red-600 bg-red-50 font-semibold' : 'text-gray-500'}`}>
                      {formatQuotaVal(r.quotaValuesComp2[m])}
                    </td>
                  ))}
                </tr>
              )}
              {/* Comp2 Y2&Y3 row */}
              {showComp2Y2 && (
                <tr className="bg-purple-50/20">
                  <td className="py-2 pr-2 text-gray-600">{c2y2Info!.sheet}</td>
                  <td className="py-2 pr-2 text-gray-600">{c2y2Info!.row}</td>
                  <td className="py-2 pr-2 font-mono text-gray-800">{c2y2Info!.eid}</td>
                  <td className="py-2 pr-2 text-gray-800 max-w-[130px] truncate">{c2y2Info!.name}</td>
                  <td className="py-2 pr-2 text-gray-600 text-xs">{c2y2Info!.qs}</td>
                  <td className="py-2 pr-2">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-fuchsia-100 text-fuchsia-700">C2:Y2&Y3</span>
                  </td>
                  <td className="py-2 pr-2">
                    <span className="text-xs text-red-600 font-medium">{r.missingMonthsComp2Y2Y3.join(', ')}</span>
                  </td>
                  {displayMonths.map((m) => (
                    <td key={m} className={`py-2 pr-1 text-right text-xs font-mono ${missingSetComp2Y2.has(m) ? 'text-red-600 bg-red-50 font-semibold' : 'text-gray-500'}`}>
                      {formatQuotaVal(r.quotaValuesComp2Y2Y3[m])}
                    </td>
                  ))}
                </tr>
              )}
            </Fragment>
          );
        })}
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
