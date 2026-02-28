import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for video+audio capture with key frame extraction.
 * 
 * User decisions:
 * - Key frames extracted at ~2fps (every 500ms)
 * - Keep MORE frames than needed (err on side of caution)
 * - User-controlled recording length (no cap)
 * - Audio captured alongside video for transcription (Phase 2)
 */
export function useMediaCapture({ frameInterval = 500 } = {}) {
    const [status, setStatus] = useState('idle'); // idle | requesting | recording | processing | done | error
    const [frames, setFrames] = useState([]);
    const [audioBlob, setAudioBlob] = useState(null);
    const [error, setError] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);

    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const canvasRef = useRef(null);
    const frameIntervalRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const audioChunksRef = useRef([]);
    const framesRef = useRef([]);
    // Separate ref for the hidden video element used for frame capture
    const hiddenVideoRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopAllStreams();
        };
    }, []);

    const stopAllStreams = useCallback(() => {
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    /**
     * Attach stream to a video element. Call this from the component
     * via a ref callback when the <video> element mounts.
     */
    const attachStream = useCallback((videoElement) => {
        if (videoElement && streamRef.current) {
            videoElement.srcObject = streamRef.current;
        }
    }, []);

    const startRecording = useCallback(async () => {
        try {
            setStatus('requesting');
            setError(null);
            setFrames([]);
            setAudioBlob(null);
            setRecordingTime(0);
            framesRef.current = [];
            audioChunksRef.current = [];

            // Request camera + mic
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });

            streamRef.current = stream;

            // Create a hidden video element for frame extraction (always available)
            if (!hiddenVideoRef.current) {
                hiddenVideoRef.current = document.createElement('video');
                hiddenVideoRef.current.setAttribute('autoplay', '');
                hiddenVideoRef.current.setAttribute('playsinline', '');
                hiddenVideoRef.current.setAttribute('muted', '');
                hiddenVideoRef.current.muted = true;
            }
            hiddenVideoRef.current.srcObject = stream;
            await hiddenVideoRef.current.play().catch(() => { });

            // Create canvas for frame extraction
            if (!canvasRef.current) {
                canvasRef.current = document.createElement('canvas');
            }

            // Set up MediaRecorder for audio capture
            let mimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mimeType = 'video/webm';
            } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(1000); // Collect chunks every second

            // Start key frame extraction at ~2fps using the hidden video
            // USER DECISION: Keep MORE frames than needed, do NOT downsample
            frameIntervalRef.current = setInterval(() => {
                captureFrame();
            }, frameInterval);

            // Start recording timer
            const startTime = Date.now();
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);

            setStatus('recording');
        } catch (err) {
            console.error('Failed to start recording:', err);
            if (err.name === 'NotAllowedError') {
                setError('Camera and microphone permissions are required. Please allow access and try again.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera or microphone found on this device.');
            } else {
                setError(`Failed to start recording: ${err.message}`);
            }
            setStatus('error');
        }
    }, [frameInterval]);

    const captureFrame = useCallback(() => {
        const video = hiddenVideoRef.current;
        if (!video || !canvasRef.current) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Capture as JPEG with quality 0.8
        const frameData = canvas.toDataURL('image/jpeg', 0.8);
        framesRef.current.push(frameData);
    }, []);

    const stopRecording = useCallback(() => {
        if (status !== 'recording') return;

        setStatus('processing');

        // Stop frame extraction
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }

        // Stop timer
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        // Capture one final frame
        captureFrame();

        // Stop MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        // Stop all tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // Clean up hidden video
        if (hiddenVideoRef.current) {
            hiddenVideoRef.current.srcObject = null;
        }

        // Build audio blob from chunks
        const audioData = new Blob(audioChunksRef.current, { type: 'video/webm' });

        // Set final state
        const capturedFrames = [...framesRef.current];
        setFrames(capturedFrames);
        setAudioBlob(audioData);
        setStatus('done');

        return { frames: capturedFrames, audioBlob: audioData };
    }, [status, captureFrame]);

    const reset = useCallback(() => {
        stopAllStreams();
        if (hiddenVideoRef.current) {
            hiddenVideoRef.current.srcObject = null;
        }
        setStatus('idle');
        setFrames([]);
        setAudioBlob(null);
        setError(null);
        setRecordingTime(0);
        framesRef.current = [];
        audioChunksRef.current = [];
    }, [stopAllStreams]);

    return {
        status,
        frames,
        audioBlob,
        error,
        recordingTime,
        startRecording,
        stopRecording,
        reset,
        attachStream, // Use this as ref callback on <video> element
        stream: streamRef.current,
    };
}
