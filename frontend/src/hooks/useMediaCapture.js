import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for video+audio capture with key frame extraction.
 * 
 * Optimized for mobile:
 * - SMARTER SAMPLING: Caps at 12 frames regardless of length.
 * - ASYNC STOP: Ensures audio blob is ready before returning.
 * - COMPRESSION: Uses JPEG 0.6 quality for faster field uploads.
 * - ROBUST MEDIA: Handles varied mobile MediaRecorder mimeTypes.
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
    const hiddenVideoRef = useRef(null);
    const resolveStopRef = useRef(null);

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
    }, []);

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

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });

            streamRef.current = stream;

            if (!hiddenVideoRef.current) {
                hiddenVideoRef.current = document.createElement('video');
                hiddenVideoRef.current.setAttribute('autoplay', '');
                hiddenVideoRef.current.setAttribute('playsinline', '');
                hiddenVideoRef.current.setAttribute('muted', '');
                hiddenVideoRef.current.muted = true;
            }
            hiddenVideoRef.current.srcObject = stream;
            await hiddenVideoRef.current.play().catch(() => { });

            if (!canvasRef.current) {
                canvasRef.current = document.createElement('canvas');
            }

            // Find best supported mimeType
            const possibleTypes = [
                'video/webm;codecs=vp9,opus',
                'video/webm',
                'video/mp4',
                'audio/webm',
                '' // fallback to browser default
            ];
            
            let mimeType = '';
            for (const type of possibleTypes) {
                if (type === '' || MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            console.log(`[CAPTURE] Using mimeType: ${mimeType || 'default'}`);

            const options = mimeType ? { mimeType } : {};
            const mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioData = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'video/webm' });
                
                let capturedFrames = [...framesRef.current];
                const MAX_TOTAL_FRAMES = 12;
                
                if (capturedFrames.length > MAX_TOTAL_FRAMES) {
                    const sampled = [];
                    const step = (capturedFrames.length - 1) / (MAX_TOTAL_FRAMES - 1);
                    for (let i = 0; i < MAX_TOTAL_FRAMES; i++) {
                        sampled.push(capturedFrames[Math.round(i * step)]);
                    }
                    capturedFrames = sampled;
                }

                setFrames(capturedFrames);
                setAudioBlob(audioData);
                setStatus('done');

                if (resolveStopRef.current) {
                    resolveStopRef.current({ frames: capturedFrames, audioBlob: audioData });
                    resolveStopRef.current = null;
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            
            // Start recording after a tiny delay to ensure stream is hot
            setTimeout(() => {
                try {
                    if (mediaRecorder.state === 'inactive') {
                        mediaRecorder.start(1000);
                    }
                } catch (e) {
                    console.error("MediaRecorder start failed:", e);
                    setError("Failed to start recorder: " + e.message);
                    setStatus('error');
                }
            }, 100);

            frameIntervalRef.current = setInterval(() => {
                captureFrame();
            }, frameInterval);

            const startTime = Date.now();
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);

            setStatus('recording');
        } catch (err) {
            console.error('Failed to start recording:', err);
            setError(`Failed to start recording: ${err.message}`);
            setStatus('error');
        }
    }, [frameInterval]);

    const captureFrame = useCallback(() => {
        const video = hiddenVideoRef.current;
        if (!video || !canvasRef.current) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        const canvas = canvasRef.current;
        const maxWidth = 640;
        const maxHeight = 480;
        const scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight, 1);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const frameData = canvas.toDataURL('image/jpeg', 0.6);
        framesRef.current.push(frameData);
    }, []);

    const stopRecording = useCallback(() => {
        if (status !== 'recording') return Promise.resolve(null);

        return new Promise((resolve) => {
            resolveStopRef.current = resolve;
            setStatus('processing');

            if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

            captureFrame();

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            if (hiddenVideoRef.current) {
                hiddenVideoRef.current.srcObject = null;
            }
        });
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
        attachStream,
    };
}
