# Live Feedback During Recording — Feature Plan

## Problem
The operator currently films a clip, stops, and **waits** for the full AI pipeline to return a verdict. There is zero real-time guidance while recording. This means:
- The operator may film the wrong area / miss a component entirely.
- The AI may receive poor-angle frames that tank confidence.
- There is no awareness of which checklist items are still missing.

## Feature: Real-Time Recording Overlay
While the camera is active and recording, the app will periodically send the latest frame to a **lightweight identification endpoint** and display a heads-up overlay on the viewfinder showing:

### Overlay Elements
1. **Component Detected** — "Currently seeing: *1.3 Bucket Tilt Cylinders and Hoses*" mapped to the official TA1 checklist.
2. **Confidence Indicator** — A color-coded bar/badge (High/Medium/Low) based on how clearly the AI can identify the component.  
   - Low → prompt "Move closer" or "Adjust angle".
3. **Missed Items Ticker** — A scrollable strip at the bottom showing remaining unchecked items from today's checklist (e.g., "8 items remaining").
4. **Duplicate Warning** — If the operator is filming a component already graded today, show "Already inspected — Green ✓" so they can move on.
5. **Guidance Hints** — Contextual tips: "Speak your assessment", "Hold steady for 2 more seconds".

---

## Architecture

### New Backend Endpoint: `POST /api/identify`
A **fast, lightweight** Gemini call that accepts a single frame and returns:
```json
{
  "component": "Bucket Tilt Cylinder",
  "checklist_item": "1.3 Bucket Tilt Cylinders and Hoses",
  "confidence": 0.78,
  "confidence_label": "MEDIUM",
  "guidance": "Move closer to the rod seal for better assessment"
}
```
Uses a stripped-down prompt (identify only, no full CoT analysis) and a small response schema for speed. Target latency: <1.5s.

### Frontend Changes

#### 1. `useMediaCapture.js` — Expose latest frame
Add a `latestFrameRef` that always holds the most recent captured frame data URL, accessible via a new returned value `getLatestFrame()`.

#### 2. `CaptureZone.jsx` — Periodic identify loop
When recording starts, launch an interval (every 3 seconds) that:
1. Grabs the latest frame via `getLatestFrame()`
2. Sends it to `POST /api/identify`
3. Stores the result in local state
4. Passes the result + `checklistState` to the overlay

When recording stops, clear the interval.

#### 3. New Component: `LiveFeedback.jsx` + `LiveFeedback.css`
An overlay rendered **on top of the camera viewfinder** (absolute positioned inside `.viewfinder`) showing:
- Top-left: Component name + confidence badge
- Bottom: Missed items ticker strip (horizontally scrollable)
- Center (transient): Guidance text that fades after 3s
- Duplicate badge if already inspected

#### 4. `api.js` — New `identifyFrame(frameBase64)` function

#### 5. `App.jsx` — Pass `checklistState` down to `CaptureZone`

---

## Implementation Steps

### Step 1: Backend — Lightweight Gemini identify method
Add `GeminiService.identify_component(frame_b64)` with a short prompt and minimal schema.

### Step 2: Backend — `/api/identify` endpoint
Accept `{ frame: "<base64>" }`, call the identify method, return the structured JSON.

### Step 3: Frontend — `api.js` helper
Add `identifyFrame(frame)` → `POST /api/identify`.

### Step 4: Frontend — Expose latest frame from `useMediaCapture`
Add `getLatestFrame` callback that returns `framesRef.current` last element.

### Step 5: Frontend — `LiveFeedback.jsx` + `LiveFeedback.css`
Build the overlay component. Props: `{ identification, checklistState, isActive }`.

### Step 6: Frontend — Wire into `CaptureZone.jsx`
- Accept `checklistState` prop.
- Add a 3-second interval during recording that calls `identifyFrame`.
- Render `<LiveFeedback>` inside the viewfinder div.

### Step 7: Frontend — `App.jsx` pass props
Pass `checklistState` to `<CaptureZone>`.

---

## File Change Summary
| File | Action |
|------|--------|
| `backend/services/gemini_service.py` | Add `identify_component()` method + prompt/schema |
| `backend/app.py` | Add `POST /api/identify` route |
| `frontend/src/services/api.js` | Add `identifyFrame()` |
| `frontend/src/hooks/useMediaCapture.js` | Expose `getLatestFrame()` |
| `frontend/src/components/LiveFeedback.jsx` | NEW — overlay component |
| `frontend/src/components/LiveFeedback.css` | NEW — overlay styles |
| `frontend/src/components/CaptureZone.jsx` | Add identify loop + render LiveFeedback |
| `frontend/src/App.jsx` | Pass `checklistState` to CaptureZone |
