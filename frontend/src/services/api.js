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
