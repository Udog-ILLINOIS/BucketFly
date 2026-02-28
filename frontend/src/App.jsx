import { useState } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ResultsView } from './components/ResultsView'
import { uploadInspection } from './services/api'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);

  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`Uploading ${frames.length} frames...`);
    const result = await uploadInspection(frames, audioBlob);
    console.log('Upload result:', result);
    setLastResult(result);
    // Auto-switch to results tab after analysis
    setTimeout(() => setActiveTab('results'), 2000);
    return result;
  };

  return (
    <div className="app">
      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'record' && (
          <CaptureZone onInspectionComplete={handleInspectionComplete} />
        )}
        {activeTab === 'results' && (
          <ResultsView result={lastResult} />
        )}
      </div>

      {/* Bottom tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-item ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => setActiveTab('record')}
        >
          <span className="tab-icon">📹</span>
          <span className="tab-label">Record</span>
        </button>
        <button
          className={`tab-item ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          <span className="tab-icon">🧠</span>
          <span className="tab-label">Results</span>
          {lastResult && (
            <span className="tab-dot" style={{
              backgroundColor: lastResult?.visual_analysis?.preliminary_status === 'PASS' ? '#22c55e'
                : lastResult?.visual_analysis?.preliminary_status === 'FAIL' ? '#ef4444'
                  : '#f59e0b'
            }} />
          )}
        </button>
      </nav>
    </div>
  )
}

export default App
