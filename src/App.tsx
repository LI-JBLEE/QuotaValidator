import { useState } from 'react';
import LtsLssValidationTab from './components/LtsLssValidationTab';
import LmsValidationTab from './components/LmsValidationTab';

type AppTab = 'lts-lss' | 'lms';

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('lts-lss');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-gray-800">Quota File Validation Tool</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Sales Compensation Quota File Validator
          </p>
        </div>
      </header>

      {/* Top-Level Tab Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 flex">
          <button
            onClick={() => setActiveTab('lts-lss')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'lts-lss'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            LTS / LSS Validation
          </button>
          <button
            onClick={() => setActiveTab('lms')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'lms'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            LMS Validation
          </button>
        </div>
      </div>

      {/* Tab Content — both mounted, hidden via CSS to preserve state */}
      <div className={activeTab === 'lts-lss' ? '' : 'hidden'}>
        <LtsLssValidationTab />
      </div>
      <div className={activeTab === 'lms' ? '' : 'hidden'}>
        <LmsValidationTab />
      </div>
    </div>
  );
}

export default App;
