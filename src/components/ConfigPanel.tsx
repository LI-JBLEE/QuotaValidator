import type { Region } from '../types';
import { REGIONS } from '../types';

interface ConfigPanelProps {
  submissionMonths: string[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedRegion: Region;
  onRegionChange: (region: Region) => void;
}

const REGION_LABELS: Record<Region, string> = {
  APAC: 'APAC (Asia Pacific)',
  EMEAL: 'EMEAL (Europe, Middle East, Africa & LATAM)',
  NAMER: 'NAMER (North America)',
};

export default function ConfigPanel({
  submissionMonths,
  selectedMonth,
  onMonthChange,
  selectedRegion,
  onRegionChange,
}: ConfigPanelProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Step 2: Configuration
      </h2>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Submission Month */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Submission Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            disabled={submissionMonths.length === 0}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {submissionMonths.length === 0 ? (
              <option value="">Upload Quota file first</option>
            ) : (
              submissionMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Region */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Region
          </label>
          <div className="flex gap-2">
            {REGIONS.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => onRegionChange(region)}
                className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                  selectedRegion === region
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title={REGION_LABELS[region]}
              >
                {region}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">{REGION_LABELS[selectedRegion]}</p>
        </div>
      </div>
    </div>
  );
}
