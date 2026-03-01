import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for video+audio capture.
 * Records a video/webm blob and sends it whole to the backend.
 * Gemini File API handles frame selection server-side.
 */
export function useMediaCapture() {
    const [status, setStatus] = useState('idle'); // idle | requesting | recording | processing | done | error
    const [videoBlob, setVideoBlob] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const [error, setError] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);

    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioRecorderRef = useRef(null);

    const timerIntervalRef = useRef(null);
    const chunksRef = useRef([]);
    const audioChunksRef = useRef([]);
    const resolveStopRef = useRef(null);

    useEffect(() => {
        return () => stopAllStreams();
    }, []);

    const stopAllStreams = useCallback(() => {
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
            setVideoBlob(null);
            setAudioBlob(null);
            setRecordingTime(0);
            chunksRef.current = [];
            audioChunksRef.current = [];

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true
            });

            streamRef.current = stream;

            // --- 1. Main Video Recorder ---
            const candidates = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4', ''];
            const mimeType = candidates.find(t => t === '' || MediaRecorder.isTypeSupported(t)) ?? '';
            console.log(`[CAPTURE] video mimeType: ${mimeType || 'default'}`);

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            // --- 2. Audio-only Recorder ---
            const audioStream = new MediaStream(stream.getAudioTracks());
            const aCandidates = ['audio/webm;codecs=opus', 'audio/webm', ''];
            const aMimeType = aCandidates.find(t => t === '' || MediaRecorder.isTypeSupported(t)) ?? '';
            console.log(`[CAPTURE] audio mimeType: ${aMimeType || 'default'}`);

            const audioRecorder = new MediaRecorder(audioStream, aMimeType ? { mimeType: aMimeType } : {});
            audioRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            // Handling the simultaneous stop event resolution
            let vBlob = null;
            let aBlob = null;
            let stopsLeft = 2;

            const finalizeStop = () => {
                stopsLeft--;
                if (stopsLeft === 0) {
                    setVideoBlob(vBlob);
                    setAudioBlob(aBlob);
                    setStatus('done');
                    if (resolveStopRef.current) {
                        resolveStopRef.current({ videoBlob: vBlob, audioBlob: aBlob });
                        resolveStopRef.current = null;
                    }
                }
            };

            recorder.onstop = () => {
                vBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
                finalizeStop();
            };

            audioRecorder.onstop = () => {
                aBlob = new Blob(audioChunksRef.current, { type: audioRecorder.mimeType || 'audio/webm' });
                finalizeStop();
            };

            mediaRecorderRef.current = recorder;
            audioRecorderRef.current = audioRecorder;

            setTimeout(() => {
                if (recorder.state === 'inactive') recorder.start(1000);
                if (audioRecorder.state === 'inactive') audioRecorder.start(1000);
            }, 100);

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
    }, []);

    const stopRecording = useCallback(() => {
        if (status !== 'recording') return Promise.resolve(null);

        return new Promise((resolve) => {
            resolveStopRef.current = resolve;
            setStatus('processing');

            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
                audioRecorderRef.current.stop();
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        });
    }, [status]);

    const reset = useCallback(() => {
        stopAllStreams();
        setStatus('idle');
        setVideoBlob(null);
        setAudioBlob(null);
        setError(null);
        setRecordingTime(0);
        chunksRef.current = [];
        audioChunksRef.current = [];
    }, [stopAllStreams]);

    return {
        status,
        videoBlob,
        audioBlob,
        error,
        recordingTime,
        startRecording,
        stopRecording,
        reset,
        attachStream,
    };
}
