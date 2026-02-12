import { useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import ConfigPanel from './ConfigPanel';
import OverlayResultsPanel from './OverlayResultsPanel';
import { parseQuotaFile, parseReferenceFile } from '../utils/excelParser';
import { runOverlayValidation } from '../utils/overlayValidators';
import type { OverlayValidationResults } from '../utils/overlayValidators';
import type { QuotaRecord, ReferenceRecord, Region } from '../types';

export default function LmsOverlayTab() {
  // File state
  const [quotaFileName, setQuotaFileName] = useState('');
  const [refFileName, setRefFileName] = useState('');
  const [quotaRecords, setQuotaRecords] = useState<QuotaRecord[]>([]);
  const [refRecords, setRefRecords] = useState<ReferenceRecord[]>([]);
  const [submissionMonths, setSubmissionMonths] = useState<string[]>([]);

  // Config state
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<Region>('APAC');

  // Validation state
  const [results, setResults] = useState<OverlayValidationResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  const handleQuotaFile = useCallback((data: ArrayBuffer, fileName: string) => {
    try {
      setError('');
      const parsed = parseQuotaFile(data);
      setQuotaRecords(parsed.records);
      setSubmissionMonths(parsed.submissionMonths);
      setQuotaFileName(fileName);
      // Auto-select the latest month
      if (parsed.submissionMonths.length > 0) {
        setSelectedMonth(parsed.submissionMonths[parsed.submissionMonths.length - 1]);
      }
      setResults(null);
    } catch (e) {
      setError(`Failed to parse Quota file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const handleRefFile = useCallback((data: ArrayBuffer, fileName: string) => {
    try {
      setError('');
      const records = parseReferenceFile(data);
      setRefRecords(records);
      setRefFileName(fileName);
      setResults(null);
    } catch (e) {
      setError(`Failed to parse Reference file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const handleRunValidation = useCallback(() => {
    if (!quotaRecords.length || !refRecords.length || !selectedMonth) return;
    setIsRunning(true);
    setError('');
    // Use setTimeout to allow UI to update with spinner
    setTimeout(() => {
      try {
        const res = runOverlayValidation(quotaRecords, refRecords, selectedMonth, selectedRegion);
        setResults(res);
      } catch (e) {
        setError(`Validation error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  }, [quotaRecords, refRecords, selectedMonth, selectedRegion]);

  const handleReset = useCallback(() => {
    setQuotaFileName('');
    setRefFileName('');
    setQuotaRecords([]);
    setRefRecords([]);
    setSubmissionMonths([]);
    setSelectedMonth('');
    setSelectedRegion('APAC');
    setResults(null);
    setIsRunning(false);
    setError('');
  }, []);

  const canRun = quotaRecords.length > 0 && refRecords.length > 0 && !!selectedMonth;

  return (
    <main className="max-w-6xl mx-auto px-6 py-6 space-y-5">
      {/* Reset */}
      <div className="flex justify-end">
        <button
          onClick={handleReset}
          className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Step 1: File Upload */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Step 1: Upload Files
        </h2>
        <div className="flex gap-5">
          <FileUpload
            label="Quota File"
            description="Quota File (.xlsx)"
            onFileLoaded={handleQuotaFile}
            fileName={quotaFileName}
          />
          <FileUpload
            label="Reference File"
            description="Sales Compensation Report (.xlsx)"
            onFileLoaded={handleRefFile}
            fileName={refFileName}
          />
        </div>
        {quotaFileName && (
          <p className="text-xs text-gray-400 mt-3">
            {quotaRecords.length} total records loaded from {submissionMonths.length} submission month(s)
          </p>
        )}
        {refFileName && (
          <p className="text-xs text-gray-400 mt-1">
            {refRecords.length} reference records loaded
          </p>
        )}
      </div>

      {/* Step 2: Configuration */}
      <ConfigPanel
        submissionMonths={submissionMonths}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedRegion={selectedRegion}
        onRegionChange={setSelectedRegion}
      />

      {/* Run Button */}
      <div className="flex justify-center">
        <button
          onClick={handleRunValidation}
          disabled={!canRun || isRunning}
          className={`px-8 py-3 rounded-lg text-sm font-semibold transition-all ${
            canRun && !isRunning
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isRunning ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running Validation...
            </span>
          ) : (
            'Run Validation'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {results && <OverlayResultsPanel results={results} />}
    </main>
  );
}
