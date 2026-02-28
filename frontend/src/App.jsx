import { useState, useRef } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ReportView } from './components/ReportView'
import { HistoryView } from './components/HistoryView'
import { AlertDropdown } from './components/AlertDropdown'
import { uploadInspection, sendClarification } from './services/api'
import './App.css'

const MOCK_RESULTS = [
  {
    inspection_id: 'mock-001',
    final_status: 'MONITOR',
    visual_analysis: {
      component: 'Bucket Tilt Cylinder',
      preliminary_status: 'MONITOR',
      confidence: 0.82,
      condition_observations: ['Minor oil seepage around rod seal', 'Surface scoring on chrome rod'],
      concerns: ['Seal degradation likely within next 200 hours'],
      chain_of_thought: {
        observations: 'The hydraulic cylinder rod shows minor scoring on the chrome surface with a small amount of oil seepage visible around the rod seal area.',
        component_identification: 'Bucket Tilt Cylinder — hydraulic actuator rod and seal assembly on a Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Early-stage seal wear within acceptable monitoring range.',
        conclusion: 'MONITOR — Minor hydraulic seal seepage detected. Component is functional but trending toward service requirement.'
      }
    },
    audio_transcription: {
      full_text: 'Looking at the tilt cylinder, I can see some oil around the seal, looks like it might be starting to seep a little bit.',
      segments: [],
      components_mentioned: [{ name: 'tilt cylinder', timestamp: 1.2 }]
    },
    cross_reference: {
      final_status: 'MONITOR',
      confidence: 0.85,
      checklist_mapped_item: '1.2 Bucket Cutting Edge, Tips, or Moldboard',
      checklist_grade: 'Yellow',
      verdict_reasoning: 'Both visual AI and operator audio confirm minor oil seepage at the tilt cylinder rod seal. Not safety-critical but requires monitoring.',
      recommendation: 'Flag for next scheduled PM. Monitor seepage rate. Escalate if seepage increases before next PM.',
      chain_of_thought: {
        audio_says: 'Operator confirmed seeing oil around the seal area of the tilt cylinder.',
        visual_shows: 'AI vision detects minor surface scoring on the cylinder rod and small oil seepage around the rod seal.',
        comparison: 'AGREE — Both operator and AI visual analysis are consistent.',
        checklist_mapping_reasoning: 'Maps directly to checklist item 1.2 Bucket Cutting Edge, Tips, or Moldboard.'
      }
    }
  },
  {
    inspection_id: 'mock-002',
    final_status: 'FAIL',
    visual_analysis: {
      component: 'Engine Coolant Reservoir',
      preliminary_status: 'FAIL',
      confidence: 0.94,
      condition_observations: ['Coolant level critically low — below MIN mark', 'White residue deposits', 'Discoloration (brownish tinge)'],
      concerns: ['Risk of engine overheating', 'Possible coolant contamination with oil'],
      chain_of_thought: {
        observations: 'Coolant reservoir is visibly below the minimum fill line. White mineral deposits around the cap.',
        component_identification: 'Engine coolant reservoir / overflow tank on a Caterpillar 982 Medium Wheel Loader.',
        condition_assessment: 'Critical finding. Coolant level is dangerously low with signs of contamination.',
        conclusion: 'FAIL — Critical coolant level deficiency. Machine should not be operated.'
      }
    },
    audio_transcription: {
      full_text: "Coolant looks really low, I can barely see it. And there's some brown stuff in there.",
      segments: [],
      components_mentioned: [{ name: 'coolant reservoir', timestamp: 0.5 }]
    },
    cross_reference: {
      final_status: 'FAIL',
      confidence: 0.94,
      checklist_mapped_item: '2.2 Engine Coolant Level',
      checklist_grade: 'Red',
      verdict_reasoning: 'Both visual analysis and operator report confirm critically low coolant with contamination. Immediate action required.',
      recommendation: 'Do not start machine. Drain and inspect coolant system. Check for head gasket leak. Refill with correct CAT ELC coolant.',
      chain_of_thought: {
        audio_says: 'Operator reported coolant is very low and discolored.',
        visual_shows: 'AI vision confirms coolant below MIN line, white deposits at cap, and brownish discoloration.',
        comparison: 'AGREE — Both sources are fully consistent. Critical failure confirmed.',
        checklist_mapping_reasoning: 'Maps directly to checklist item 2.2 Engine Coolant Level.'
      }
    }
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [checklistReasoningState, setChecklistReasoningState] = useState({});
  const [notification, setNotification] = useState(null);
  const mockIndexRef = useRef(0);
  
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

  const handleInjectMock = () => {
    const mock = MOCK_RESULTS[mockIndexRef.current % MOCK_RESULTS.length];
    mockIndexRef.current += 1;
    handleUpdateResult(mock);
    setActiveTab('report');
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
      setChecklistReasoningState(prev => ({
        ...prev,
        [mappedItem]: crossRef
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
          />
        )}
        {activeTab === 'report' && (
          <ReportView
            result={lastResult}
            checklistState={checklistState}
            checklistReasoningState={checklistReasoningState}
            onInjectMock={handleInjectMock}
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
