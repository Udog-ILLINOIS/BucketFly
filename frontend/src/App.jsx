import { useState, useRef } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ResultsView } from './components/ResultsView'
import { AlertDropdown } from './components/AlertDropdown'
import { analyzeInspection, submitClarification } from './services/api'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('record');
  const [lastResult, setLastResult] = useState(null);

  // Clarification mode state
  const [isClarifying, setIsClarifying] = useState(false);
  const pendingInspectionId = useRef(null);

  // ── Normal inspection handler ─────────────────────────────────
  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`[App] Analyzing ${frames.length} frames, audioBlob size: ${audioBlob?.size}`);

    try {
      const result = await analyzeInspection(frames, audioBlob);
      console.log('[App] Analysis result:', result);
      setLastResult(result);

      // Store inspection_id for potential clarification
      if (result.inspection_id) {
        pendingInspectionId.current = result.inspection_id;
      }

      // Give CaptureZone time to show the success mark before switching tabs
      setTimeout(() => setActiveTab('results'), 2000);
      return result;
    } catch (err) {
      console.error('[App] Analysis failed:', err);
      throw err;
    }
  };

  // ── Clarification handlers ────────────────────────────────────
  const handleStartClarification = () => {
    // AlertDropdown calls this — switch to Record tab in clarification mode
    setIsClarifying(true);
    setActiveTab('record');
  };

  const handleClarificationComplete = async (frames, audioBlob) => {
    const inspectionId = pendingInspectionId.current;
    if (!inspectionId) {
      console.error('[App] No inspection_id for clarification');
      return;
    }

    console.log(`[App] Submitting clarification for ${inspectionId}`);

    try {
      const clarifyResponse = await submitClarification(inspectionId, audioBlob);
      console.log('[App] Clarification result:', clarifyResponse);

      // Merge clarification result into lastResult for display
      setLastResult(prev => ({
        ...prev,
        final_status: clarifyResponse.final_status,
        cross_reference: clarifyResponse.clarification_result,
        clarification_applied: true,
      }));

      setIsClarifying(false);
      setActiveTab('results');
      return clarifyResponse;
    } catch (err) {
      console.error('[App] Clarification failed:', err);
      setIsClarifying(false);
      throw err;
    }
  };

  // ── Derived state ─────────────────────────────────────────────
  const finalStatus = lastResult?.final_status
    || lastResult?.cross_reference?.final_status
    || lastResult?.visual_analysis?.preliminary_status;

  const showClarifyAlert = finalStatus === 'CLARIFY'
    && !isClarifying
    && activeTab === 'results';

  const clarifyQuestion = lastResult?.cross_reference?.clarification_question
    || 'Please record a follow-up to clarify.';

  // ── Tab dot color ─────────────────────────────────────────────
  const statusDotColor = {
    PASS: '#22c55e',
    MONITOR: '#f59e0b',
    FAIL: '#ef4444',
    CLARIFY: '#f97316',
    UNCLEAR: '#6b7280',
  }[finalStatus] || '#6b7280';

  return (
    <div className="app">
      {/* CLARIFY alert — slides from top when status is CLARIFY */}
      {showClarifyAlert && (
        <AlertDropdown
          question={clarifyQuestion}
          onStartClarification={handleStartClarification}
          onDismiss={() => {/* user dismissed without responding */ }}
        />
      )}

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'record' && (
          <CaptureZone
            onInspectionComplete={isClarifying ? handleClarificationComplete : handleInspectionComplete}
          />
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
          <span className="tab-label">{isClarifying ? 'Clarify' : 'Record'}</span>
        </button>
        <button
          className={`tab-item ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          <span className="tab-icon">🧠</span>
          <span className="tab-label">Results</span>
          {lastResult && (
            <span className="tab-dot" style={{ backgroundColor: statusDotColor }} />
          )}
        </button>
      </nav>
    </div>
  )
}

export default App
