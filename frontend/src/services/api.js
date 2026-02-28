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
 * Poll inspection status
 */
export async function getInspectionStatus(inspectionId) {
    const response = await fetch(`${API_BASE}/api/status/${inspectionId}`);
    if (!response.ok) {
        throw new Error(`Failed to get status: ${response.status}`);
    }
    return response.json();
}

/**
 * Get all inspections for debug view
 */
export async function getInspections() {
    const response = await fetch(`${API_BASE}/api/debug/inspections`);
    if (!response.ok) {
        throw new Error(`Failed to fetch inspections: ${response.status}`);
    }
    return response.json();
}

/**
 * Approve inspection (Debug view)
 */
export async function approveInspection(inspectionId, finalData) {
    const response = await fetch(`${API_BASE}/api/debug/inspections/${inspectionId}/approve`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData),
    });

    if (!response.ok) {
        throw new Error(`Failed to approve: ${response.status}`);
    }
    return response.json();
}

/**
 * Get global debug config
 */
export async function getDebugConfig() {
    const response = await fetch(`${API_BASE}/api/debug/config`);
    if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
    }
    return response.json();
}

/**
 * Set global debug config
 */
export async function setDebugConfig(manualMode) {
    const response = await fetch(`${API_BASE}/api/debug/config`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manual_mode: manualMode }),
    });

    if (!response.ok) {
        throw new Error(`Failed to set config: ${response.status}`);
    }
    return response.json();
}
