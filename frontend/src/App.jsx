import { useState, useRef, useEffect } from 'react';
import { CaptureZone } from './components/CaptureZone';
import { ReportView } from './components/ReportView';
import { HistoryView } from './components/HistoryView';
import { UploadInspect } from './components/UploadInspect';
import { AlertDropdown } from './components/AlertDropdown';
import { uploadInspection, sendClarification, saveInspection, uploadImageInspection, uploadVideoInspection, fetchHistoryByDate, fetchHistoryDates, setAiProvider, getAiProvider } from './services/api';
import { MOCK_RESULTS, MOCK_RESULTS_F1TENTH } from './constants/mockData';
import { getMachineChecklistTotal, MACHINE_LABELS } from './constants/checklist';
import './App.css';

const todayStr = () => new Date().toISOString().slice(0, 10);

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [machineType, setMachineType] = useState('cat_ta1');
  const [aiProvider, setAiProviderState] = useState(getAiProvider());
  const [lastResult, setLastResult] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [checklistReasoningState, setChecklistReasoningState] = useState({});
  const [notification, setNotification] = useState(null);
  const [injectedRecords, setInjectedRecords] = useState([]);
  const [isClarifying, setIsClarifying] = useState(false);
  const [workingDate, setWorkingDate] = useState(todayStr());
  const [historyAlertState, setHistoryAlertState] = useState({});
  const pendingInspectionId = useRef(null);

  // Load most recent historical grades so the report can flag uninspected items
  useEffect(() => {
    const today = todayStr();
    fetchHistoryDates()
      .then(data => {
        const pastDates = (data.dates || []).filter(d => d !== today);
        if (pastDates.length === 0) return;
        // Fetch the most recent past date
        return fetchHistoryByDate(pastDates[0]);
      })
      .then(data => {
        if (!data) return;
        const alerts = {};
        (data.records || []).forEach(rec => {
          const item = rec.ai_analysis?.checklist_mapped_item || rec.component;
          const grade = rec.ai_analysis?.checklist_grade || rec.grade;
          if (!item || !grade || grade === 'None' || grade === 'Green') return;
          // Keep the worst grade if the item appears more than once
          if (grade === 'Red' || alerts[item] !== 'Red') {
            alerts[item] = grade;
          }
        });
        setHistoryAlertState(alerts);
      })
      .catch(() => {});
  }, []);

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
      const result = await uploadInspection(frames, audioBlob, machineType);
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

  const activeMockList = machineType === 'f1tenth' ? MOCK_RESULTS_F1TENTH : MOCK_RESULTS;

  const handleMachineChange = (newType) => {
    setMachineType(newType);
    // Reset inspection state when switching machines
    setChecklistState({});
    setChecklistReasoningState({});
    setLastResult(null);
    setInjectedRecords([]);
    setNotification(null);
    setIsClarifying(false);
  };

  const handleInjectMock = async (index) => {
    const mock = activeMockList[index];
    if (!mock) return;
    handleUpdateResult(mock);
    setActiveTab('report');

    // Persist to Supermemory using workingDate so data lands on the correct day
    const items = mock.cross_reference?.items_evaluated || [];
    if (items.length > 0) {
      const datePrefix = workingDate.replace(/-/g, '');
      const id = `${datePrefix}_${new Date().toTimeString().slice(0,8).replace(/:/g, '')}_${String(Date.now()).slice(-6)}`;
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

  // -- New Day: save current inspections to backend, advance workingDate, reset live state --
  const handleNewDay = async (nextDateStr) => {
    // Persist any un-saved injected records from the current session under the current workingDate
    if (injectedRecords.length > 0) {
      try {
        const datePrefix = workingDate.replace(/-/g, '');
        const inspectionId = `${datePrefix}_${new Date().toTimeString().slice(0,8).replace(/:/g, '')}_${String(Date.now()).slice(-6)}`;
        const itemsToSave = injectedRecords.map(rec => ({
          checklist_mapped_item: rec.ai_analysis?.checklist_mapped_item || rec.component,
          checklist_grade: rec.ai_analysis?.checklist_grade || rec.grade || 'None',
          verdict_reasoning: rec.ai_analysis?.verdict_reasoning || rec.operator_notes || '',
          recommendation: rec.ai_analysis?.recommendation || '',
          confidence: rec.ai_analysis?.confidence || rec.confidence || 0,
        }));
        const transcript = injectedRecords[0]?.audio_transcript || '';
        await saveInspection(inspectionId, itemsToSave, transcript);
        console.log(`[NEW DAY] Saved ${itemsToSave.length} records for ${workingDate}`);
      } catch (err) {
        console.warn('[NEW DAY] Failed to save current day records:', err.message);
      }
    }

    // Advance to the new working date
    if (nextDateStr) {
      setWorkingDate(nextDateStr);
    }

    // Reset all live inspection state for a fresh day
    setInjectedRecords([]);
    setChecklistState({});
    setChecklistReasoningState({});
    setLastResult(null);
    setNotification(null);
    setIsClarifying(false);
  };

  // -- Render --

  const checklistTotal = getMachineChecklistTotal(machineType);

  return (
    <div className="app">
      <AlertDropdown
        notification={notification}
        onAction={handleAlertAction}
        onDismiss={() => setNotification(null)}
      />

      <div className="machine-selector-bar">
        {Object.entries(MACHINE_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`machine-selector-btn ${machineType === key ? 'active' : ''}`}
            onClick={() => handleMachineChange(key)}
          >
            {label}
          </button>
        ))}
        <span className="selector-divider" />
        {[['gemini', 'Gemini'], ['groq', 'Groq Llama']].map(([key, label]) => (
          <button
            key={key}
            className={`machine-selector-btn ai-provider-btn ${aiProvider === key ? 'active' : ''}`}
            onClick={() => { setAiProvider(key); setAiProviderState(key); }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'record' && (
          <CaptureZone
            onInspectionComplete={isClarifying ? handleClarificationComplete : handleInspectionComplete}
            checklistState={checklistState}
            machineType={machineType}
            onRecordingStart={() => {}}
            onItemIdentified={(item) => {
              setChecklistState(prev => ({ ...prev, [item]: prev[item] || 'Green' }));
            }}
          />
        )}
        {activeTab === 'report' && (
          <ReportView
            result={lastResult}
            machineType={machineType}
            checklistState={checklistState}
            checklistReasoningState={checklistReasoningState}
            historyAlertState={historyAlertState}
            onInjectMock={handleInjectMock}
            mockList={activeMockList}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView
            injectedRecords={injectedRecords}
            workingDate={workingDate}
            machineType={machineType}
            onClearInjected={async (newDate) => {
              // Clear live state
              setInjectedRecords([]);
              setChecklistState({});
              setChecklistReasoningState({});
              setLastResult(null);

              // Update working date and load the new date's history into the report
              if (newDate) {
                setWorkingDate(newDate);
                try {
                  const data = await fetchHistoryByDate(newDate);
                  const recs = data.records || [];
                  // Populate checklist state from history records
                  const newChecklist = {};
                  const newReasoning = {};
                  recs.forEach(rec => {
                    const item = rec.ai_analysis?.checklist_mapped_item || rec.component;
                    const grade = rec.ai_analysis?.checklist_grade || rec.grade;
                    if (item && grade && grade !== 'None') {
                      newChecklist[item] = grade;
                      newReasoning[item] = rec.ai_analysis || {};
                    }
                  });
                  setChecklistState(newChecklist);
                  setChecklistReasoningState(newReasoning);
                  setInjectedRecords(recs);
                } catch (err) {
                  console.warn('Failed to load history for report:', err.message);
                }
              }
            }}
            onNewDay={handleNewDay}
          />
        )}
        {activeTab === 'upload' && (
          <UploadInspect
            onImageResult={async (imageDataUrl, description) => {
              const result = await uploadImageInspection(imageDataUrl, description);
              handleUpdateResult(result);
              setTimeout(() => setActiveTab('report'), 1500);
              return result;
            }}
            onVideoResult={async (videoFile) => {
              const result = await uploadVideoInspection(videoFile, machineType);
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
            <span className="tab-badge">{Object.keys(checklistState).length}/{checklistTotal}</span>
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
