# Phase 1: Foundation & Capture - Research

**Researched:** 2026-02-27
**Phase Goal:** Working video+audio capture on mobile web with glove-friendly full-screen tap interface

## Key Findings

### MediaRecorder API (Browser-Native)
- `MediaRecorder` API is supported in all modern browsers (Chrome, Safari, Firefox)
- `getUserMedia()` provides camera + microphone streams
- Preferred format: `video/webm;codecs=vp9` (Chrome) or `video/mp4` (Safari fallback)
- **CRITICAL:** Requires HTTPS context — `localhost` works on desktop but mobile needs ngrok
- The `react-media-recorder` npm package wraps this with a clean hook: `useReactMediaRecorder`
  - Provides: `status`, `startRecording`, `stopRecording`, `mediaBlobUrl`, `previewStream`
  - `previewStream` can be attached to a `<video>` element for live camera viewfinder

### Key Frame Extraction
- Browser-side: Use `HTMLCanvasElement.toDataURL()` to capture frames from video element
- Extract frames at interval (e.g., every 500ms) during recording via `setInterval`
- Store as base64 PNG or JPEG — send as array to backend
- **User decision:** Keep MORE frames than needed (err on side of caution)
- Recommended: 2 frames per second (every 500ms) to balance quality and data

### Flask Backend for Video Upload
- `request.files` handles multipart form data
- `flask-cors` enables cross-origin requests from frontend
- Endpoint receives: video blob OR array of base64 frames + audio blob
- For Phase 1: just receive and acknowledge. AI processing is Phase 2

### Mobile HTTPS via ngrok
- `ngrok http 5173` exposes Vite dev server over HTTPS
- Mobile device accesses HTTPS URL → camera/mic permissions work
- Free tier is sufficient for hackathon

### Caterpillar Brand Colors
- **CAT Yellow:** `#FFCC00` (primary brand)
- **CAT Gray/Black:** `#333333` or `#1A1A1A` (secondary)
- **White accent:** `#FFFFFF` for text on dark backgrounds
- Cat logo available as SVG for embedding

## Validation Architecture

### What to validate
1. Camera + mic permissions granted on mobile
2. Video recording starts/stops on tap
3. Live viewfinder shows camera feed
4. Key frames captured during recording
5. Frames uploaded to Flask backend
6. Responsive layout on mobile screen

### How to validate
- Manual: Open app on phone via ngrok HTTPS URL, tap to record, verify upload
- Automated: `curl` to Flask endpoint with test payload, verify 200 response

## RESEARCH COMPLETE

---
*Research for Phase 1: Foundation & Capture*
*Researched: 2026-02-27*
