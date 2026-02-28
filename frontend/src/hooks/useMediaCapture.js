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
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const frameIntervalRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const audioChunksRef = useRef([]);
    const framesRef = useRef([]);

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

            // Attach to video element for live preview
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Create canvas for frame extraction
            if (!canvasRef.current) {
                canvasRef.current = document.createElement('canvas');
            }

            // Set up MediaRecorder for audio capture
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                    ? 'video/webm;codecs=vp9'
                    : 'video/webm'
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(1000); // Collect chunks every second

            // Start key frame extraction at ~2fps
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
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Set canvas size to match video
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

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

        // Capture one final frame to make sure we don't miss the last moment
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
        videoRef,
    };
}
