import { useState, useEffect } from 'react'
import { CaptureZone } from './components/CaptureZone'
import { ReportView } from './components/ReportView'
import { ClarificationView } from './components/ClarificationView'
import { DebugDashboard } from './components/DebugDashboard'
import { uploadInspection, getInspectionStatus } from './services/api'
import './App.css'

function App() {
  const [view, setView] = useState('capture'); // 'capture', 'waiting', 'report', 'clarification', 'debug'
  const [analysisResult, setAnalysisResult] = useState(null);
  const [currentInspectionId, setCurrentInspectionId] = useState(null);

  // Simple router based on URL hash for the debug view
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#debug') {
        setView('debug');
      } else if (view === 'debug') {
        setView('capture');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    // Initial check
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [view]);

  // Polling effect
  useEffect(() => {
    let pollInterval;
    if (view === 'waiting' && currentInspectionId) {
      pollInterval = setInterval(async () => {
        try {
          const statusResult = await getInspectionStatus(currentInspectionId);
          console.log("Poll status:", statusResult.status);

          if (statusResult.status === 'completed') {
            clearInterval(pollInterval);
            setAnalysisResult(statusResult.analysis);
            if (statusResult.analysis.is_complete) {
              setView('report');
            } else {
              setView('clarification');
            }
          } else if (statusResult.status === 'error') {
            clearInterval(pollInterval);
            alert("Error analyzing inspection: " + statusResult.error);
            setView('capture');
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 3000); // Poll every 3 seconds
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [view, currentInspectionId]);

  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`Uploading ${frames.length} frames...`);
    try {
      const result = await uploadInspection(frames, audioBlob);
      console.log('Upload result:', result);

      if (result.status === 'processing') {
        setCurrentInspectionId(result.inspection_id);
        setView('waiting');
      } else {
        // Fallback if structured differently
        throw new Error("Unexpected response status");
      }
      return result;
    } catch (err) {
      console.error("Upload Error:", err);
      throw err;
    }
  };

  const handleRecordAgain = () => {
    setView('capture');
  };

  return (
    <div className="app-container">
      {/* Hidden admin trigger */}
      <a href="#debug" style={{ position: 'absolute', top: 5, right: 5, color: '#333', textDecoration: 'none', fontSize: '10px' }}>🔧</a>

      {view === 'debug' && (
        <DebugDashboard />
      )}

      {view === 'capture' && (
        <CaptureZone onInspectionComplete={handleInspectionComplete} />
      )}

      {view === 'waiting' && (
        <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#1a1a1a' }}>
          <div className="spinner" style={{ marginBottom: '20px' }}></div>
          <h2>Analyzing Inspection...</h2>
          <p>Please wait while the AI reviews the media and awaits admin approval.</p>
        </div>
      )}

      {view === 'report' && analysisResult?.report && (
        <ReportView report={analysisResult.report} />
      )}

      {view === 'clarification' && analysisResult?.clarifications && (
        <ClarificationView
          clarifications={analysisResult.clarifications}
          onRecordAgain={handleRecordAgain}
        />
      )}
    </div>
  )
}

export default App
