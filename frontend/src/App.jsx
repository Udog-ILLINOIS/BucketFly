import { useState, useRef } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ReportView } from './components/ReportView'
import { HistoryView } from './components/HistoryView'
import { AlertDropdown } from './components/AlertDropdown'
import { uploadInspection, sendClarification } from './services/api'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [notification, setNotification] = useState(null);
  
  // Phase 3: Clarification State
  const [isClarifying, setIsClarifying] = useState(false);
  const pendingInspectionId = useRef(null);

  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`Uploading ${frames.length} frames...`);
    try {
      const result = await uploadInspection(frames, audioBlob);
      console.log('Upload result:', result);
      
      if (result.inspection_id) {
        pendingInspectionId.current = result.inspection_id;
      }
      
      handleUpdateResult(result);
      
      // Auto-switch logic
      if (result.final_status === 'PASS') {
        setTimeout(() => setActiveTab('report'), 2000);
      } else if (result.cross_reference?.error) {
        // Switch to report even on error so user can see the highlighted failed item/context
        setTimeout(() => setActiveTab('report'), 3000);
      }
      
      return result;
    } catch (err) {
      console.error('Inspection failed:', err);
      setNotification({
        status: 'FAIL',
        component: 'System Error',
        message: `Upload failed: ${err.message}`
      });
      throw err;
    }
  };

  const handleClarificationComplete = async (frames, audioBlob) => {
    const inspectionId = pendingInspectionId.current;
    if (!inspectionId) return;

    try {
      const result = await sendClarification(inspectionId, audioBlob);
      setIsClarifying(false);
      handleUpdateResult(result);
      setTimeout(() => setActiveTab('report'), 1500);
      return result;
    } catch (err) {
      console.error('Clarification failed:', err);
      setIsClarifying(false);
      setNotification({
        status: 'FAIL',
        component: 'Clarification Error',
        message: err.message
      });
      throw err;
    }
  };

  const handleUpdateResult = (result) => {
    setLastResult(result);

    const crossRef = result?.cross_reference;
    const finalStatus = result?.final_status;
    const mappedItem = crossRef?.checklist_mapped_item;

    // 1. Update the checklist state
    if (mappedItem && crossRef.checklist_grade && crossRef.checklist_grade !== "None") {
      setChecklistState(prev => ({
        ...prev,
        [mappedItem]: crossRef.checklist_grade
      }));
    }

    // 2. Trigger Global Alert
    const hasError = crossRef?.error;
    if (finalStatus === 'FAIL' || finalStatus === 'CLARIFY' || finalStatus === 'MONITOR' || finalStatus === 'UNCLEAR' || hasError) {
      setNotification({
        status: (finalStatus === 'UNCLEAR' || hasError) ? 'FAIL' : finalStatus,
        component: mappedItem || result.visual_analysis?.component || 'Equipment Item',
        message: finalStatus === 'CLARIFY' 
          ? crossRef.clarification_question 
          : hasError 
            ? `AI Error: ${crossRef.error}` 
            : crossRef.verdict_reasoning || result.wear_delta?.summary || 'Issue detected.'
      });
    }
  };

  const handleAlertAction = (notif) => {
    if (notif.status === 'CLARIFY') {
      setIsClarifying(true);
      setActiveTab('record');
    } else {
      setActiveTab('report');
    }
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
          <CaptureZone 
            onInspectionComplete={isClarifying ? handleClarificationComplete : handleInspectionComplete}
            checklistState={checklistState}
          />
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
          onClick={() => {
            setActiveTab('record');
            setIsClarifying(false);
          }}
        >
          <span className="tab-icon">{isClarifying ? '❓' : '📹'}</span>
          <span className="tab-label">{isClarifying ? 'Clarify' : 'Record'}</span>
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
