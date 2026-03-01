const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Upload purely the audio blob to get the Gemini transcription and timestamps.
 *
 * @param {Blob} audioBlob - Audio-only recording blob
 * @returns {Promise<object>} { inspection_id, audio_transcription }
 */
export async function uploadAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Audio upload failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Upload the locally-extracted base64 frames along with the transcript to the backend.
 *
 * @param {string} inspectionId - The ID returned from uploadAudio
 * @param {string[]} framesB64 - Array of base64 JPEG strings
 * @param {object} audioTranscription - The transcript object from uploadAudio
 * @returns {Promise<object>} Final inspection report
 */
export async function uploadFrames(inspectionId, framesB64, audioTranscription) {
    const response = await fetch(`${API_BASE}/api/analyze_frames`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inspection_id: inspectionId,
            frames_b64: framesB64,
            audio_transcription: audioTranscription
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Frame analysis failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Send follow-up video/audio clarification to the backend.
 *
 * @param {string} inspectionId - The ID of the inspection
 * @param {Blob} videoBlob - Follow-up recording blob
 * @returns {Promise<object>} Backend response
 */
export async function sendClarification(inspectionId, videoBlob) {
    const formData = new FormData();
    formData.append('inspection_id', inspectionId);
    if (videoBlob && videoBlob.size > 0) {
        formData.append('audio', videoBlob, 'clarify.webm');
    }

    const response = await fetch(`${API_BASE}/api/clarify`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Clarification failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Health check for backend connectivity.
 * @returns {Promise<object>}
 */
export async function healthCheck() {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.json();
}

/**
 * Fetch historical inspection logs for a specific component.
 * 
 * @param {string} component - The component name to lookup
 * @returns {Promise<object>} Backend response with history list
 */
export async function fetchHistory(component) {
    const response = await fetch(`${API_BASE}/api/history?component=${encodeURIComponent(component)}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch history: ${response.status}`);
    }
    return response.json();
}

export async function fetchHistoryDates() {
    const response = await fetch(`${API_BASE}/api/history/dates`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch dates: ${response.status}`);
    }
    return response.json();
}

export async function fetchHistoryByDate(date) {
    const response = await fetch(`${API_BASE}/api/history/by-date?date=${encodeURIComponent(date)}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch history for ${date}: ${response.status}`);
    }
    return response.json();
}
