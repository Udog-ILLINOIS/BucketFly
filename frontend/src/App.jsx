import { useState } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ReportView } from './components/ReportView'
import { HistoryView } from './components/HistoryView'
import { uploadInspection } from './services/api'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);

  // App-wide state for the checklist grades
  // Gray = uninspected/no info, Green = pass, Yellow = monitor, Red = fail
  const [checklistState, setChecklistState] = useState({});

  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`Uploading ${frames.length} frames...`);
    const result = await uploadInspection(frames, audioBlob);
    console.log('Upload result:', result);
    handleUpdateResult(result);

    // Auto-switch to report tab after analysis
    setTimeout(() => setActiveTab('report'), 500);
    return result;
  };

  const handleUpdateResult = (result) => {
    setLastResult(result);

    // Update the checklist state if we got a mapped component and grade
    const crossRef = result?.cross_reference;
    if (crossRef && crossRef.checklist_mapped_item && crossRef.checklist_grade !== "None") {
      setChecklistState(prev => ({
        ...prev,
        [crossRef.checklist_mapped_item]: crossRef.checklist_grade
      }));
    }
  };

  return (
    <div className="app">
      {/* Debug hidden file input for browser subagent end-to-end testing */}
      <input
        type="file"
        id="debug-upload"
        style={{ position: 'absolute', top: -1000, left: -1000 }}
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              // Creating a mock audio blob so transcription is generated
              const audioResponse = await fetch('/mock_audio.webm').catch(() => null);
              const audioBlob = audioResponse ? await audioResponse.blob() : new Blob(["mock"], { type: "audio/webm" });
              handleInspectionComplete([event.target.result], audioBlob);
            };
            reader.readAsDataURL(file);
          }
        }}
      />

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'record' && (
          <CaptureZone onInspectionComplete={handleInspectionComplete} />
        )}
        {activeTab === 'report' && (
          <ReportView
            result={lastResult}
            checklistState={checklistState}
            onUpdateResult={handleUpdateResult}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView />
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
          className={`tab-item ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">Report</span>
          {lastResult && (
            <span className="tab-dot" style={{
              backgroundColor: lastResult?.cross_reference?.checklist_grade === 'Green' ? '#22c55e'
                : lastResult?.cross_reference?.checklist_grade === 'Red' ? '#ef4444'
                  : lastResult?.cross_reference?.checklist_grade === 'Yellow' ? '#f59e0b'
                    : '#94a3b8'
            }} />
          )}
        </button>
        <button
          className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-icon">🕒</span>
          <span className="tab-label">History</span>
        </button>
      </nav>
    </div>
  )
}

export default App
