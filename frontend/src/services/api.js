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

    const response = await fetch(`${API_BASE}/api/inspect`, {
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
 * Health check for backend connectivity.
 * @returns {Promise<object>}
 */
export async function healthCheck() {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.json();
}

/**
 * Full analysis: visual + audio + cross-reference.
 * Replaces uploadInspection() for Phase 3+.
 *
 * @param {string[]} frames - Array of base64-encoded JPEG images
 * @param {Blob} audioBlob - Audio recording blob (may be video/webm type)
 * @returns {Promise<object>} Backend response with final_status, cross_reference, inspection_id
 */
export async function analyzeInspection(frames, audioBlob) {
    const formData = new FormData();
    formData.append('frames', JSON.stringify(frames));
    if (audioBlob && audioBlob.size > 0) {
        // Append with explicit filename — ensures Content-Disposition includes name field
        formData.append('audio', audioBlob, 'audio.webm');
    }
    console.log('[analyzeInspection] frames:', frames.length, 'audioBlob:', audioBlob?.size, 'type:', audioBlob?.type);

    const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Analysis failed: ${response.status}`);
    }
    return response.json();
}

/**
 * Submit clarification recording for an inspection that returned CLARIFY status.
 *
 * @param {string} inspectionId - From prior analyzeInspection() response
 * @param {Blob} clarificationAudioBlob - Follow-up recording blob
 * @returns {Promise<object>} {inspection_id, clarification_result, final_status}
 */
export async function submitClarification(inspectionId, clarificationAudioBlob) {
    const formData = new FormData();
    formData.append('inspection_id', inspectionId);
    if (clarificationAudioBlob && clarificationAudioBlob.size > 0) {
        formData.append('audio', clarificationAudioBlob, 'clarification.webm');
    }

    const response = await fetch(`${API_BASE}/api/clarify`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Clarification failed: ${response.status}`);
    }
    return response.json();
}
