import { useCallback, useState, useRef, useEffect } from 'react';
import { useMediaCapture } from '../hooks/useMediaCapture';
import { LiveFeedback } from './LiveFeedback';
import { identifyFrame } from '../services/api';
import './CaptureZone.css';

/**
 * Full-screen capture interface with Cat branding.
 * 
 * States:
 * - idle: Black screen with "Tap anywhere to start recording"
 * - recording: Camera viewfinder with pulsing yellow border
 * - processing: Upload progress indicator
 * - done: Upload confirmation
 * - error: Error message with retry
 */
const IDENTIFY_INTERVAL_MS = 3000; // Send a frame every 3 seconds

export function CaptureZone({ onInspectionComplete, checklistState = {} }) {
    const {
        status,
        frames,
        audioBlob,
        error,
        recordingTime,
        startRecording,
        stopRecording,
        reset,
        attachStream,
        getLatestFrame,
    } = useMediaCapture({ frameInterval: 500 });

    const [uploadStatus, setUploadStatus] = useState(null);
    const [uploadMessage, setUploadMessage] = useState('');
    const [identification, setIdentification] = useState(null);
    const liveVideoRef = useRef(null);
    const identifyIntervalRef = useRef(null);
    const isIdentifyingRef = useRef(false);

    // Start/stop the periodic identify loop based on recording status
    useEffect(() => {
        if (status === 'recording') {
            // Start identify loop
            identifyIntervalRef.current = setInterval(async () => {
                if (isIdentifyingRef.current) return; // Skip if previous call still pending
                const frame = getLatestFrame();
                if (!frame) return;

                isIdentifyingRef.current = true;
                try {
                    const result = await identifyFrame(frame, checklistState);
                    setIdentification(result);
                } catch (err) {
                    console.warn('[IDENTIFY] Real-time identify failed:', err.message);
                } finally {
                    isIdentifyingRef.current = false;
                }
            }, IDENTIFY_INTERVAL_MS);
        } else {
            // Clear when not recording
            if (identifyIntervalRef.current) {
                clearInterval(identifyIntervalRef.current);
                identifyIntervalRef.current = null;
            }
            if (status === 'idle') {
                setIdentification(null);
            }
        }

        return () => {
            if (identifyIntervalRef.current) {
                clearInterval(identifyIntervalRef.current);
                identifyIntervalRef.current = null;
            }
        };
    }, [status, getLatestFrame, checklistState]);

    // When status changes to 'recording', attach the stream to the visible video element
    useEffect(() => {
        if (status === 'recording' && liveVideoRef.current) {
            attachStream(liveVideoRef.current);
        }
    }, [status, attachStream]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const handleTap = useCallback(async () => {
        if (status === 'idle' || status === 'error') {
            await startRecording();
        } else if (status === 'recording') {
            const result = await stopRecording();
            if (result && onInspectionComplete) {
                setUploadStatus('uploading');
                setUploadMessage(`Uploading ${result.frames.length} frames...`);
                try {
                    await onInspectionComplete(result.frames, result.audioBlob);
                    setUploadStatus('success');
                    setUploadMessage(`Upload complete! ${result.frames.length} frames captured ✓`);
                    setTimeout(() => {
                        reset();
                        setUploadStatus(null);
                        setUploadMessage('');
                    }, 3000);
                } catch (err) {
                    setUploadStatus('error');
                    setUploadMessage(`Upload failed: ${err.message}`);
                }
            } else if (result) {
                setUploadStatus('success');
                setUploadMessage(`Captured ${result.frames.length} frames ✓`);
                setTimeout(() => {
                    reset();
                    setUploadStatus(null);
                    setUploadMessage('');
                }, 3000);
            }
        } else if (status === 'done' && uploadStatus === 'error') {
            reset();
            setUploadStatus(null);
            setUploadMessage('');
        }
    }, [status, uploadStatus, startRecording, stopRecording, reset, onInspectionComplete]);

    return (
        <div
            className={`capture-zone ${status === 'recording' ? 'recording' : ''}`}
            onClick={handleTap}
        >
            {/* Cat branding border */}
            <div className="cat-border">
                {/* Cat logo */}
                <div className="cat-logo">
                    <span className="cat-logo-text">CAT</span>
                    <span className="cat-logo-sub">VISION</span>
                </div>

                {/* IDLE STATE */}
                {(status === 'idle' || (status === 'done' && !uploadStatus)) && (
                    <div className="idle-screen">
                        <div className="idle-content">
                            <div className="tap-icon">
                                <div className="tap-circle"></div>
                                <div className="tap-ring"></div>
                            </div>
                            <p className="idle-text">Tap anywhere to start recording</p>
                            <p className="idle-subtext">Speak your assessment while filming the component</p>
                        </div>
                    </div>
                )}

                {/* REQUESTING PERMISSIONS */}
                {status === 'requesting' && (
                    <div className="idle-screen">
                        <div className="idle-content">
                            <div className="spinner"></div>
                            <p className="idle-text">Requesting camera access...</p>
                        </div>
                    </div>
                )}

                {/* RECORDING STATE */}
                {status === 'recording' && (
                    <div className="viewfinder">
                        <video
                            ref={liveVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="camera-preview"
                        />
                        {/* Live AI Feedback Overlay */}
                        <LiveFeedback
                            identification={identification}
                            checklistState={checklistState}
                            isActive={status === 'recording'}
                        />
                        {/* Recording timer */}
                        <div className="recording-timer">
                            <div className="rec-dot"></div>
                            <span>{formatTime(recordingTime)}</span>
                        </div>
                        {/* Tap to stop hint */}
                        <div className="tap-hint">
                            <p>Tap anywhere to stop</p>
                        </div>
                    </div>
                )}

                {/* PROCESSING / UPLOAD STATE */}
                {(status === 'processing' || status === 'done') && uploadStatus && (
                    <div className="idle-screen">
                        <div className="idle-content">
                            {uploadStatus === 'uploading' && <div className="spinner"></div>}
                            {uploadStatus === 'success' && <div className="check-mark">✓</div>}
                            {uploadStatus === 'error' && <div className="error-mark">✕</div>}
                            <p className="idle-text">{uploadMessage}</p>
                            {uploadStatus === 'error' && (
                                <p className="idle-subtext">Tap to retry</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ERROR STATE */}
                {status === 'error' && (
                    <div className="idle-screen">
                        <div className="idle-content">
                            <div className="error-mark">⚠</div>
                            <p className="idle-text">{error}</p>
                            <p className="idle-subtext">Tap to try again</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
