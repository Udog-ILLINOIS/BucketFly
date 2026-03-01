# SOLUTIONS.md — HackAstra Pipeline Fixes

Each solution maps to a problem in PROBLEMS.md. Ordered by priority (critical first).

---

## S3 — Fix Clarification Handler Argument Destructuring (P3 — Critical)

**File:** `frontend/src/App.jsx:152`

**Current:**
```js
const handleClarificationComplete = async (videoBlob) => {
    const result = await sendClarification(inspectionId, videoBlob);
```

**Fix:** Destructure the result object and pass the audio blob:
```js
const handleClarificationComplete = async ({ videoBlob, audioBlob }) => {
    const blobToSend = audioBlob || videoBlob;   // prefer audio-only
    const result = await sendClarification(inspectionId, blobToSend);
```

This ensures that a valid Blob (with a `.size` property) is passed to `sendClarification`, so the audio IS appended to FormData and the backend receives it.

---

## S4 — Fix `/api/clarify` to Not Depend on a Saved Video File (P4 — Critical)

The `/api/clarify` endpoint currently tries to load `recording.webm` from the inspection directory, which never exists in the current pipeline. Two options:

**Option A (Simpler) — Remove visual re-analysis from clarify; use frames from original analysis:**

In `app.py`, the clarify route should pull frames from the stored `analysis.json` rather than re-extracting from a video:

```python
# Instead of:
video_path = os.path.join(inspection_dir, 'recording.webm')
frames = extract_frames_at_timestamps(video_path, [], fallback_count=3)

# Do:
frames = original_analysis.get("frames_b64_sample", [])   # store a few sample frames in analyze_frames
```

**Option B — Save video during analyze_frames:**

In `app.py /api/analyze_frames`, before saving `analysis.json`, also save the sample frames into the JSON:

```python
result["frames_b64_sample"] = frames[:3]   # store up to 3 frames for clarify use
```

Then in `/api/clarify`, load them back from `original_analysis["frames_b64_sample"]`.

Option B is recommended: it requires zero changes to `api.js` or the clarify endpoint flow, and frames are already base64-encoded in the request payload.

---

## S7 — Add Rundown Completion Detection and "Show Item Again" Prompt (P7 — High)

**Files:** `frontend/src/App.jsx`, `frontend/src/components/ReportView.jsx`

### Step 1 — Detect incomplete items after each inspection

In `handleUpdateResult` (App.jsx), after updating `checklistState`, compute which items remain ungraded:

```js
const handleUpdateResult = (result) => {
    // ... existing update logic ...

    // After updating checklistState, check for remaining items
    const allItems = Object.values(CAT_TA1_CHECKLIST).flat();
    const updatedState = { ...checklistState, [mappedItem]: crossRef.checklist_grade };
    const ungraded = allItems.filter(item => !updatedState[item] || updatedState[item] === 'None');

    if (ungraded.length === 0) {
        setNotification({
            status: 'PASS',
            component: 'Inspection Complete',
            message: 'All items have been graded. Rundown complete.'
        });
    }
};
```

**Note:** `CAT_TA1_CHECKLIST` is currently defined only in `ReportView.jsx`. Move it to a shared constants file (e.g., `src/constants/checklist.js`) so both `App.jsx` and `ReportView.jsx` can import it.

### Step 2 — Add "Show Item Again" prompt in ReportView

For items with grade `None`, show a tap-to-record CTA:

```jsx
{grade === 'None' && (
    <button
        className="reinspect-btn"
        onClick={(e) => { e.stopPropagation(); onReinspectItem(item); }}
    >
        Show item to camera
    </button>
)}
```

Add `onReinspectItem` callback prop to `ReportView`. In `App.jsx`, handle it by switching to the record tab with a hint:

```js
const handleReinspect = (item) => {
    setReinspectHint(item);   // new state: show which item needs reinspection
    setActiveTab('record');
};
```

Display the hint on the CaptureZone screen (e.g., "Now recording: 1.3 Tire 3 — Rear Left").

---

## S8 — Validate and Normalize `checklist_mapped_item` Server-Side (P8 — High)

**File:** `backend/app.py` in `analyze_frames` route

After getting `cross_ref`, validate the mapped item against the known checklist before saving:

```python
VALID_CHECKLIST_ITEMS = [
    "1.1 Tire 1 — Front Left", "1.2 Tire 2 — Front Right",
    "1.3 Tire 3 — Rear Left", "1.4 Tire 4 — Rear Right",
    "1.5 Shock 1 — Front Left", "1.6 Shock 2 — Front Right",
    "1.7 Shock 3 — Rear Left", "1.8 Shock 4 — Rear Right",
    "1.9 Bumper 1 — Front", "1.10 Bumper 2 — Rear",
    "1.11 Undercarriage", "2.1 Battery", "2.2 Powerboard",
    "2.3 NVIDIA Jetson", "2.4 Antenna", "3.1 LiDAR"
]

def normalize_checklist_item(raw: str) -> str:
    """Fuzzy-match a Gemini-returned item name to the canonical checklist."""
    if not raw:
        return "Unknown"
    # Exact match first
    if raw in VALID_CHECKLIST_ITEMS:
        return raw
    # Case-insensitive match
    raw_lower = raw.lower()
    for item in VALID_CHECKLIST_ITEMS:
        if item.lower() == raw_lower:
            return item
    # Partial match (contains number prefix)
    for item in VALID_CHECKLIST_ITEMS:
        prefix = item.split(' ')[0]   # e.g. "1.1"
        if raw.startswith(prefix):
            return item
    return raw   # Return as-is, but log a warning
```

Call this before storing and returning the result:
```python
cross_ref["checklist_mapped_item"] = normalize_checklist_item(
    cross_ref.get("checklist_mapped_item", "")
)
```

---

## S5 — Apply Timestamp Offset for Frame Extraction (P5 — High)

**File:** `frontend/src/App.jsx:116`

Apply a small backward offset to catch the frame *before* the operator speaks, when the camera is most likely still on the component:

```js
const AUDIO_FRAME_OFFSET_SEC = -1.0;  // grab frame 1 second before speech

const timestamps = (transcription.components_mentioned || []).map(c =>
    Math.max(0, c.timestamp + AUDIO_FRAME_OFFSET_SEC)
);
```

Also add a small forward offset variant so we sample both before and after:

```js
const timestamps = (transcription.components_mentioned || []).flatMap(c => [
    Math.max(0, c.timestamp - 1.0),
    c.timestamp,
    c.timestamp + 0.5
]);
```

This triples frame count per mention but gives the AI more chances to see the component clearly. Cap total frames at 6-9 to avoid overwhelming the model.

---

## S6 — Make Frame Extraction Robust for Mobile (P6 — High)

**File:** `frontend/src/App.jsx:16-72`

### Fix 1 — Guard against invalid duration

```js
video.onloadedmetadata = () => {
    const duration = isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 10;  // assume 10 second recording if metadata is broken
    // ... rest of logic
};
```

### Fix 2 — Add a timeout in case `onseeked` never fires

```js
const seekTimeout = setTimeout(() => {
    console.warn('[FRAMES] Seek timed out, using current frame');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
    targetIdx++;
    if (targetIdx < targets.length) {
        video.currentTime = targets[targetIdx] + 0.001;
    } else {
        URL.revokeObjectURL(videoUrl);
        resolve(frames);
    }
}, 3000);  // 3 second timeout per seek

video.onseeked = () => {
    clearTimeout(seekTimeout);
    // ... original code
};
```

### Fix 3 — Fallback to interval-based capture if no frames extracted

If `frames.length === 0` after the seek loop, resolve with a direct blob-read instead of rejecting:

```js
if (frames.length === 0) {
    console.warn('[FRAMES] Zero frames extracted — returning empty array, backend will use fallback');
    resolve([]);
}
```

The backend `analyze_frames` already handles empty frame arrays gracefully via the UNCLEAR fallback.

---

## S1 — Fix Debug Step Flags to Match Actual Events (P1 — Medium)

**File:** `frontend/src/App.jsx:88-93, 105-123`

### Add a 4th explicit state:

```js
const [stepAudioDone, setStepAudioDone] = useState(false);
const [stepTranscriptDone, setStepTranscriptDone] = useState(false);
const [stepFramesDone, setStepFramesDone] = useState(false);
const [stepAnalysisDone, setStepAnalysisDone] = useState(false);  // NEW
```

### Fire the flags at correct times:

```js
const transRes = await uploadAudio(audioBlob);
setStepAudioDone(true);       // audio sent AND transcription returned
setStepTranscriptDone(true);  // same response — mark together or keep split

const framesB64 = await extractFramesFromVideo(videoBlob, timestamps);
setStepFramesDone(true);      // ← move here: fires AFTER frame extraction, BEFORE upload

setPollingStatus('Frames extracted. Submitting for AI Visual Analysis...');
const analysisRes = await uploadFrames(inspectionId, framesB64, transcription);
setStepAnalysisDone(true);    // ← NEW: fires after full AI analysis returns
```

### Update the 4th flag in JSX:

```jsx
<span>{stepAnalysisDone ? '✅' : '⏳'}</span>
<span>Gemini Visual Analysis</span>
```

---

## S9 — Rename `stepTranscriptDone` Label to Match (P9 — Low)

**File:** `frontend/src/App.jsx:241`

The step label "Transcribed & Timestamps" is accurate — rename the JSX label only:

```jsx
<span>Audio Transcribed (Gemini)</span>
```

No logic change needed.

---

## S2 — Rename `ClaudeService` to `GeminiVisionService` (P2 — Low)

**Files:** `backend/services/claude_service.py`, `backend/app.py`

```python
# claude_service.py -> rename file to gemini_vision_service.py
class GeminiVisionService:    # was: ClaudeService
    ...
    print(f'[GEMINI_VISION] Using model: {self.model}')

# app.py
from services.gemini_vision_service import GeminiVisionService

def get_claude():     # rename to:
def get_vision():
    global _vision_service
    if _vision_service is None:
        _vision_service = GeminiVisionService()
    return _vision_service
```

---

## S10 — Add Model Attribution to Debug Output (P10 — Low)

**File:** `frontend/src/App.jsx:234-253`

Add model labels to each step:

```jsx
<span>Audio Transcribed (gemini-2.5-flash-lite)</span>
<span>Frames Extracted (local browser)</span>
<span>Visual Analysis (gemini-2.5-flash × 2 calls)</span>
```

Optionally surface the model name from the backend response (add `model_used` field to both service responses).

---

## Implementation Order (Priority Queue)

| Priority | Fix | Effort |
|----------|-----|--------|
| 1 | S3 — Fix clarify arg destructuring | 5 min |
| 2 | S4 — Save frames into analysis.json for clarify re-use | 15 min |
| 3 | S7 — Add rundown complete detection + reinspect prompt | 45 min |
| 4 | S8 — Server-side checklist_mapped_item normalization | 20 min |
| 5 | S5 — Audio timestamp offset for frame extraction | 10 min |
| 6 | S6 — Mobile seek robustness (timeout + duration guard) | 20 min |
| 7 | S1 — Fix debug step flag timing | 15 min |
| 8 | S2 — Rename ClaudeService → GeminiVisionService | 10 min |
| 9 | S9/S10 — Label cleanup | 5 min |
