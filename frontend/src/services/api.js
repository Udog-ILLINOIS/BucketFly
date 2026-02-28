const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Upload inspection frames and audio to backend.
 * 
 * @param {string[]} frames - Array of base64-encoded JPEG images
 * @param {Blob} audioBlob - Audio recording blob
 * @returns {Promise<object>} Backend response
 */
export async function uploadInspection(frames, audioBlob) {
    const formData = new FormData();
    formData.append('frames', JSON.stringify(frames));
    if (audioBlob && audioBlob.size > 0) {
        formData.append('audio', audioBlob, 'audio.webm');
    }

    const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Send follow-up audio for clarification to the backend.
 * 
 * @param {string} inspectionId - The ID of the inspection
 * @param {Blob} audioBlob - Audio recording blob
 * @returns {Promise<object>} Backend response
 */
export async function sendClarification(inspectionId, audioBlob) {
    const formData = new FormData();
    formData.append('inspection_id', inspectionId);
    if (audioBlob && audioBlob.size > 0) {
        formData.append('audio', audioBlob, 'audio.webm');
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
