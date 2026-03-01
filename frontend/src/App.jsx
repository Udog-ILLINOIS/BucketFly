import { useState, useRef } from 'react';
import { CaptureZone } from './components/CaptureZone';
import { ReportView } from './components/ReportView';
import { HistoryView } from './components/HistoryView';
import { UploadInspect } from './components/UploadInspect';
import { AlertDropdown } from './components/AlertDropdown';
import { uploadInspection, sendClarification, saveInspection, uploadImageInspection } from './services/api';
import { MOCK_RESULTS } from './constants/mockData';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [checklistReasoningState, setChecklistReasoningState] = useState({});
  const [notification, setNotification] = useState(null);
  const [injectedRecords, setInjectedRecords] = useState([]);
  const [isClarifying, setIsClarifying] = useState(false);
  const pendingInspectionId = useRef(null);

  // -- Result Processing --

  const handleUpdateResult = (result) => {
    setLastResult(result);

    const crossRef = result?.cross_reference;
    const items = crossRef?.items_evaluated || [];
    const finalStatus = result?.final_status || 'UNCLEAR';

    // Convert evaluated items into history-compatible records
    if (items.length > 0) {
      const confidence = crossRef?.confidence || result.visual_analysis?.confidence || 0;

      const newRecords = items.map(item => ({
        inspection_id: result.inspection_id || `local_${Date.now()}`,
        component: item.checklist_mapped_item || result.visual_analysis?.component || 'Unknown',
        grade: item.checklist_grade || 'None',
        confidence: item.confidence || confidence,
        operator_notes: item.verdict_reasoning || '',
        audio_transcript: result.audio_transcription?.full_text || '',
        frame_count: result.frame_count || 0,
        ai_analysis: {
          final_status: finalStatus,
          checklist_mapped_item: item.checklist_mapped_item,
          checklist_grade: item.checklist_grade,
          confidence: item.confidence || confidence,
          verdict_reasoning: item.verdict_reasoning || '',
          recommendation: item.recommendation || '',
        },
        content: '',
      }));
      setInjectedRecords(prev => [...prev, ...newRecords]);

      // Update checklist grades
      setChecklistState(prev => {
        const next = { ...prev };
        items.forEach(item => {
          if (item.checklist_mapped_item && item.checklist_grade && item.checklist_grade !== 'None') {
            next[item.checklist_mapped_item] = item.checklist_grade;
          }
        });
        return next;
      });

      // Update reasoning details
      setChecklistReasoningState(prev => {
        const next = { ...prev };
        items.forEach(item => {
          if (item.checklist_mapped_item && item.checklist_grade && item.checklist_grade !== 'None') {
            next[item.checklist_mapped_item] = {
              ...item,
              chain_of_thought: crossRef.chain_of_thought,
            };
          }
        });
        return next;
      });
    }

    // Trigger alert for non-passing statuses
    if (['FAIL', 'CLARIFY', 'MONITOR', 'UNCLEAR'].includes(finalStatus) || crossRef?.error) {
      const worstItem = items.find(i => i.checklist_grade === 'Red')
        || items.find(i => i.checklist_grade === 'Yellow')
        || items[0];

      setNotification({
        status: (finalStatus === 'UNCLEAR' || crossRef?.error) ? 'FAIL' : finalStatus,
        component: worstItem?.checklist_mapped_item || result.visual_analysis?.component || 'Equipment Item',
        message: finalStatus === 'CLARIFY'
          ? crossRef.clarification_question
          : crossRef?.error
            ? `AI Error: ${crossRef.error}`
            : worstItem?.verdict_reasoning || 'Issue detected.',
      });
    }
  };

  // -- Inspection Handlers --

  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`Uploading ${frames.length} frames...`);
    try {
      const result = await uploadInspection(frames, audioBlob);
      console.log('Upload result:', result);

      if (result.inspection_id) pendingInspectionId.current = result.inspection_id;
      handleUpdateResult(result);

      if (result.final_status === 'PASS') {
        setTimeout(() => setActiveTab('report'), 2000);
      } else if (result.cross_reference?.error) {
        setTimeout(() => setActiveTab('report'), 3000);
      }
      return result;
    } catch (err) {
      console.error('Inspection failed:', err);
      setNotification({ status: 'FAIL', component: 'System Error', message: `Upload failed: ${err.message}` });
      throw err;
    }
  };

  const handleClarificationComplete = async (_frames, audioBlob) => {
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
      setNotification({ status: 'FAIL', component: 'Clarification Error', message: err.message });
      throw err;
    }
  };

  const handleInjectMock = async (index) => {
    const mock = MOCK_RESULTS[index];
    if (!mock) return;
    handleUpdateResult(mock);
    setActiveTab('report');

    // Persist to Supermemory in the background
    const items = mock.cross_reference?.items_evaluated || [];
    if (items.length > 0) {
      const id = mock.inspection_id || `mock_${Date.now()}`;
      const transcript = mock.audio_transcription?.full_text || '';
      saveInspection(id, items, transcript).catch(err =>
        console.warn('Supermemory save failed:', err.message)
      );
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

  // -- Render --

  return (
    <div className="app">
      <AlertDropdown
        notification={notification}
        onAction={handleAlertAction}
        onDismiss={() => setNotification(null)}
      />

      <div className="tab-content">
        {activeTab === 'record' && (
          <CaptureZone
            onInspectionComplete={isClarifying ? handleClarificationComplete : handleInspectionComplete}
            checklistState={checklistState}
            onRecordingStart={() => {}}
            onItemIdentified={(item) => {
              setChecklistState(prev => ({ ...prev, [item]: prev[item] || 'Green' }));
            }}
          />
        )}
        {activeTab === 'report' && (
          <ReportView
            result={lastResult}
            checklistState={checklistState}
            checklistReasoningState={checklistReasoningState}
            onInjectMock={handleInjectMock}
            mockList={MOCK_RESULTS}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView
            injectedRecords={injectedRecords}
            onClearInjected={() => {
              setInjectedRecords([]);
              setChecklistState({});
              setChecklistReasoningState({});
              setLastResult(null);
            }}
          />
        )}
        {activeTab === 'upload' && (
          <UploadInspect
            onResult={async (imageDataUrl, description) => {
              const result = await uploadImageInspection(imageDataUrl, description);
              handleUpdateResult(result);
              setTimeout(() => setActiveTab('report'), 1500);
              return result;
            }}
          />
        )}
      </div>

      <nav className="tab-bar">
        <button className={`tab-item ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => { setActiveTab('record'); setIsClarifying(false); }}>
          <span className="tab-icon">{isClarifying ? '❓' : '📹'}</span>
          <span className="tab-label">{isClarifying ? 'Clarify' : 'Record'}</span>
        </button>
        <button className={`tab-item ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}>
          <span className="tab-icon">📋</span>
          <span className="tab-label">Report</span>
          {Object.keys(checklistState).length > 0 && (
            <span className="tab-badge">{Object.keys(checklistState).length}/38</span>
          )}
        </button>
        <button className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}>
          <span className="tab-icon">🕒</span>
          <span className="tab-label">History</span>
        </button>
        <button className={`tab-item ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}>
          <span className="tab-icon">📤</span>
          <span className="tab-label">Upload</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
