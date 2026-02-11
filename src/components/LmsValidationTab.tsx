import { useState, useCallback, useMemo } from 'react';
import FileUpload from './FileUpload';
import LmsConfigPanel from './LmsConfigPanel';
import LmsResultsPanel from './LmsResultsPanel';
import { parseLmsQuotaFile, generateLmsProcessingMonths } from '../utils/lmsExcelParser';
import { parseReferenceFile } from '../utils/excelParser';
import { runLmsValidation } from '../utils/lmsValidators';
import type { LmsQuotaRecord, LmsValidationResults } from '../lmsTypes';
import type { ReferenceRecord, Region } from '../types';

export default function LmsValidationTab() {
  // File state
  const [quotaFileName, setQuotaFileName] = useState('');
  const [refFileName, setRefFileName] = useState('');
  const [lmsRecords, setLmsRecords] = useState<LmsQuotaRecord[]>([]);
  const [refRecords, setRefRecords] = useState<ReferenceRecord[]>([]);

  // Config state
  const processingMonths = useMemo(() => generateLmsProcessingMonths(), []);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const months = generateLmsProcessingMonths();
    return months.length > 0 ? months[months.length - 1] : '';
  });
  const [selectedRegion, setSelectedRegion] = useState<Region>('APAC');

  // Validation state
  const [results, setResults] = useState<LmsValidationResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  const handleLmsQuotaFile = useCallback((data: ArrayBuffer, fileName: string) => {
    try {
      setError('');
      const records = parseLmsQuotaFile(data);
      setLmsRecords(records);
      setQuotaFileName(fileName);
      setResults(null);
    } catch (e) {
      setError(`Failed to parse LMS Quota file: ${e instanceof Error ? e.message : String(e)}`);
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
    if (!lmsRecords.length || !refRecords.length || !selectedMonth) return;
    setIsRunning(true);
    setError('');
    setTimeout(() => {
      try {
        const res = runLmsValidation(lmsRecords, refRecords, selectedMonth, selectedRegion);
        setResults(res);
      } catch (e) {
        setError(`Validation error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  }, [lmsRecords, refRecords, selectedMonth, selectedRegion]);

  const handleReset = useCallback(() => {
    setQuotaFileName('');
    setRefFileName('');
    setLmsRecords([]);
    setRefRecords([]);
    setSelectedMonth(processingMonths.length > 0 ? processingMonths[processingMonths.length - 1] : '');
    setSelectedRegion('APAC');
    setResults(null);
    setIsRunning(false);
    setError('');
  }, [processingMonths]);

  const canRun = lmsRecords.length > 0 && refRecords.length > 0 && !!selectedMonth;

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
            label="LMS Quota File"
            description="Quota File (.xlsx)"
            onFileLoaded={handleLmsQuotaFile}
            fileName={quotaFileName}
          />
          <FileUpload
            label="Reference File (SCR)"
            description="Sales Compensation Report (.xlsx)"
            onFileLoaded={handleRefFile}
            fileName={refFileName}
          />
        </div>
        {quotaFileName && (
          <p className="text-xs text-gray-400 mt-3">
            {lmsRecords.length} LMS records loaded
          </p>
        )}
        {refFileName && (
          <p className="text-xs text-gray-400 mt-1">
            {refRecords.length} reference records loaded
          </p>
        )}
      </div>

      {/* Step 2: Configuration */}
      <LmsConfigPanel
        processingMonths={processingMonths}
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
      {results && <LmsResultsPanel results={results} />}
    </main>
  );
}
