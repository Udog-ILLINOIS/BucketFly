import { useState } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ReportView } from './components/ReportView'
import { HistoryView } from './components/HistoryView'
import { AlertDropdown } from './components/AlertDropdown'
import { uploadInspection } from './services/api'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [notification, setNotification] = useState(null);

  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`Uploading ${frames.length} frames...`);
    try {
      const result = await uploadInspection(frames, audioBlob);
      console.log('Upload result:', result);
      handleUpdateResult(result);
      return result;
    } catch (err) {
      console.error('Inspection failed:', err);
      throw err;
    }
  };

  const handleUpdateResult = (result) => {
    setLastResult(result);

    const crossRef = result?.cross_reference;
    const finalStatus = result?.final_status;
    const mappedItem = crossRef?.checklist_mapped_item;

    // 1. Update the checklist state
    if (mappedItem && crossRef.checklist_grade !== "None") {
      setChecklistState(prev => ({
        ...prev,
        [mappedItem]: crossRef.checklist_grade
      }));
    }

    // 2. Trigger Global Alert if FAIL or CLARIFY
    if (finalStatus === 'FAIL' || finalStatus === 'CLARIFY' || finalStatus === 'MONITOR') {
      setNotification({
        status: finalStatus,
        component: mappedItem || result.visual_analysis?.component || 'Equipment Item',
        message: finalStatus === 'CLARIFY' 
          ? crossRef.clarification_question 
          : crossRef.verdict_reasoning || result.wear_delta?.summary || 'Issue detected.'
      });
    }
  };

  const handleAlertAction = (notif) => {
    setActiveTab('report');
    setNotification(null);
  };

  return (
    <div className="app">
      {/* Global Alert */}
      <AlertDropdown 
        notification={notification} 
        onAction={handleAlertAction}
        onDismiss={() => setNotification(null)}
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
          {Object.keys(checklistState).length > 0 && (
            <span className="tab-dot" style={{ backgroundColor: 'var(--cat-yellow)' }} />
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
