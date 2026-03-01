const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://bucketfly.onrender.com' : 'http://localhost:5001');

/** Shared fetch wrapper with JSON error handling. */
async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
    }
    return res.json();
}

/** Upload inspection frames + audio for full analysis. */
export async function uploadInspection(frames, audioBlob, machineType = 'cat_ta1') {
    const fd = new FormData();
    fd.append('frames', JSON.stringify(frames));
    fd.append('machine_type', machineType);
    if (audioBlob?.size > 0) fd.append('audio', audioBlob, 'audio.webm');
    return apiFetch(`${API_BASE}/api/analyze`, { method: 'POST', body: fd });
}

/** Send follow-up audio for clarification. */
export async function sendClarification(inspectionId, audioBlob) {
    const fd = new FormData();
    fd.append('inspection_id', inspectionId);
    if (audioBlob?.size > 0) fd.append('audio', audioBlob, 'audio.webm');
    return apiFetch(`${API_BASE}/api/clarify`, { method: 'POST', body: fd });
}

/** Backend health check. */
export async function healthCheck() {
    return apiFetch(`${API_BASE}/api/health`);
}

/** Fetch history for a specific component. */
export async function fetchHistory(component) {
    return apiFetch(`${API_BASE}/api/history?component=${encodeURIComponent(component)}`);
}

/** Send a single frame for real-time component identification during recording. */
export async function identifyFrame(frame, checklistState = {}, machineType = 'cat_ta1') {
    return apiFetch(`${API_BASE}/api/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame, checklist_state: checklistState, machine_type: machineType }),
    });
}

/** Fetch list of dates with inspection records. */
export async function fetchHistoryDates() {
    return apiFetch(`${API_BASE}/api/history/dates`);
}

/** Fetch all inspection records for a specific date. */
export async function fetchHistoryByDate(date) {
    return apiFetch(`${API_BASE}/api/history/by-date?date=${encodeURIComponent(date)}`);
}

/** Delete all Supermemory records for a given date. */
export async function clearHistoryByDate(date) {
    return apiFetch(`${API_BASE}/api/history/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
    });
}

/** Persist inspection items to Supermemory (used for injected/mock results). */
export async function saveInspection(inspectionId, itemsEvaluated, audioTranscript = '') {
    return apiFetch(`${API_BASE}/api/save-inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            inspection_id: inspectionId,
            items_evaluated: itemsEvaluated,
            audio_transcript: audioTranscript,
        }),
    });
}

/** Upload a video file for full pipeline analysis (audio transcription → timestamp seeks → AI). */
export async function uploadVideoInspection(videoFile, machineType = 'cat_ta1') {
    const fd = new FormData();
    fd.append('video', videoFile);
    fd.append('machine_type', machineType);
    return apiFetch(`${API_BASE}/api/analyze-video`, { method: 'POST', body: fd });
}

/** Upload a single image + text description for AI inspection. */
export async function uploadImageInspection(imageDataUrl, description) {
    // Convert data URL to a Blob
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();

    const fd = new FormData();
    fd.append('image', blob, 'upload.jpg');
    fd.append('description', description);
    return apiFetch(`${API_BASE}/api/analyze-upload`, { method: 'POST', body: fd });
}
