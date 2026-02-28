import { CaptureZone } from './components/CaptureZone'
import { uploadInspection } from './services/api'
import './App.css'

function App() {
  const handleInspectionComplete = async (frames, audioBlob) => {
    console.log(`Uploading ${frames.length} frames...`);
    const result = await uploadInspection(frames, audioBlob);
    console.log('Upload result:', result);
    return result;
  };

  return (
    <CaptureZone onInspectionComplete={handleInspectionComplete} />
  )
}

export default App
