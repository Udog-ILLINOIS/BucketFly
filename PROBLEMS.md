# PROBLEMS.md — HackAstra Pipeline Diagnosis

Scope: Video/audio capture → Gemini transcription → frame extraction → visual AI analysis → report mapping.
All problems traced from source code as of 2026-02-28.

---

## P1 — Debug Step Flags Don't Match Actual Pipeline Timing

**File:** `frontend/src/App.jsx:229-253`

The loading screen shows four debug flags:
1. Audio Uploaded
2. Transcribed & Timestamps
3. Local DOM Video Frames Extracted
4. Video AI Analysis

**Actual code sequence:**
```
uploadAudio()          → setStepAudioDone(true)
                       → setStepTranscriptDone(true)   ← fires immediately after (same response)
extractFramesFromVideo()
uploadFrames()         → setStepFramesDone(true)        ← fires after FULL AI analysis returns
setIsPolling(false)    → 4th flag becomes ✅ simultaneously with 3rd
```

**Problems:**
- Step 3 label says "Local DOM Video Frames Extracted" but `setStepFramesDone(true)` doesn't fire until `uploadFrames()` (the entire server-side AI analysis) completes — it never shows the intermediate "frames extracted, waiting on AI" state.
- Step 4 "Video AI Analysis" is never explicitly set. It uses `(!isPolling && stepFramesDone)` so it lights up at the exact same instant as step 3, giving the false impression that steps 3 and 4 are separate events.
- Steps 1 and 2 (`stepAudioDone`, `stepTranscriptDone`) both fire from the same `await uploadAudio()` response — they appear as two separate steps but complete in one round-trip. There is no visual distinction.

---

## P2 — `claude_service.py` Is Not Claude — It's Gemini

**File:** `backend/services/claude_service.py:22-29`

```python
class ClaudeService:
    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')   # ← Gemini key
        self.client = genai.Client(api_key=api_key)
        self.model = 'gemini-2.5-flash'
        print(f'[VISION] Using model: {self.model}')
```

The class is named `ClaudeService`, imported as `claude_service`, and referred to as "Claude" throughout `app.py`. It is 100% Gemini. The debug logs say `[VISION]` rather than `[GEMINI]` or `[CLAUDE]`. This creates real confusion about which model processes visual analysis — especially when reading logs.

---

## P3 — Clarification Flow Passes Wrong Argument Type

**File:** `frontend/src/App.jsx:152-172` and `frontend/src/components/CaptureZone.jsx:48-54`

When in clarification mode, `onInspectionComplete` is set to `handleClarificationComplete`:

```js
// CaptureZone (line 54):
await onInspectionComplete(result);  // result = { videoBlob, audioBlob }

// App.jsx (line 152):
const handleClarificationComplete = async (videoBlob) => {
    const result = await sendClarification(inspectionId, videoBlob);
```

The parameter is named `videoBlob` but receives the full `{ videoBlob, audioBlob }` object. Then `sendClarification` does:

```js
// api.js line 65:
if (videoBlob && videoBlob.size > 0) {   // videoBlob.size is undefined on an object
    formData.append('audio', videoBlob, 'clarify.webm');
}
```

`videoBlob.size` is `undefined` on a plain object, so the condition is falsy and NO audio blob is ever appended to the FormData. The clarification endpoint receives no audio and fails silently or returns garbage.

---

## P4 — `/api/clarify` Tries to Read a Video File That Was Never Saved

**File:** `backend/app.py:262-263`

```python
video_path = os.path.join(inspection_dir, 'recording.webm')
frames = extract_frames_at_timestamps(video_path, [], fallback_count=3)
```

The current 2-step pipeline (`/api/transcribe` → `/api/analyze_frames`) only saves `analysis.json` to the inspection directory. No video file is ever written to disk. When `/api/clarify` runs, it tries to open `recording.webm`, gets an empty `VideoCapture`, and `frames` is an empty list. Any clarification visual analysis runs on zero frames.

---

## P5 — Audio Timestamps May Not Correspond to When Component Is In Frame

**File:** `frontend/src/App.jsx:116-117`

```js
const timestamps = (transcription.components_mentioned || []).map(c => c.timestamp);
const framesB64 = await extractFramesFromVideo(videoBlob, timestamps);
```

The Gemini transcription timestamps indicate when the operator *spoke* a component name. The camera may have been pointing at the component several seconds *before* or *after* the mention. Extracting a frame at exact speech timestamp often captures:
- The operator mid-sentence (mouth open, not pointing at component)
- Camera being moved between components
- A blurry transition frame

No offset correction is applied. This directly reduces the quality of visual analysis.

---

## P6 — Frame Extraction Fails Silently on Mobile (Seek Unreliable)

**File:** `frontend/src/App.jsx:16-72`

`extractFramesFromVideo` uses an HTMLVideoElement seek + canvas draw strategy:

```js
video.onseeked = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(base64.split(',')[1]);
    ...
    video.currentTime = targets[targetIdx] + 0.001;
};
```

On iOS Safari (and some Android browsers), seeking a MediaRecorder-produced WebM/MP4 blob is unreliable because:
- The blob may lack a proper `duration` in metadata until the file is "finalized" by the browser
- `video.duration` may return `NaN` or `Infinity` before full decode
- The `onseeked` event may not fire at all, causing the Promise to hang forever

If `targets.length === 0` falls back to evenly-spaced frames using `video.duration`, which will also be wrong if duration is `NaN`.

---

## P7 — No "Rundown Complete" Detection or "Show Item Again" Prompt

**File:** `frontend/src/App.jsx:77`, `frontend/src/components/ReportView.jsx:46-51`

The app tracks which checklist items have been graded in `checklistState`. `ReportView` shows a grey count for ungraded items. But:
- There is no logic to detect when all items have at least one inspection
- There is no prompt to the user when items remain at "None" after a full pass
- There is no session-end summary that lists which items were skipped
- The user has no in-app prompt to re-inspect or confirm an item is intentionally skipped

After a complete walkthrough, ungraded items silently remain grey with no call to action.

---

## P8 — `checklist_mapped_item` String Must Exactly Match Checklist — But No Validation

**File:** `backend/services/claude_service.py:259`, `frontend/src/App.jsx:182-191`

The CROSSREF_PROMPT says:
> "Your output `checklist_mapped_item` MUST be character-for-character identical to an item from the checklist above."

But there is no server-side validation of this constraint. If Gemini returns e.g. `"1.1 Tire 1 - Front Left"` (dash instead of em-dash) or `"Tire 1 — Front Left"` (missing number prefix), the `checklistState` update:

```js
setChecklistState(prev => ({
    ...prev,
    [mappedItem]: crossRef.checklist_grade
}));
```

adds an entry with a key that doesn't match any item in `CAT_TA1_CHECKLIST`, so the checklist in ReportView never highlights or greys the correct item. The grade is stored but never shown.

---

## P9 — `setStepTranscriptDone` Fires Before Frames Are Extracted — Label Is Misleading

**File:** `frontend/src/App.jsx:112-113`

```js
setPollingStatus('Audio transcribed. Extracting local frames...');
setStepTranscriptDone(true);

// Next line: actual frame extraction begins
const framesB64 = await extractFramesFromVideo(videoBlob, timestamps);
```

The `setStepTranscriptDone(true)` fires and correctly marks transcription as done. But the `pollingStatus` text switches to "Extracting local frames..." while step 2 ✅ fires simultaneously — so the user briefly sees "Transcribed & Timestamps ✅" and "Local DOM Video Frames Extracted ⏳" with the spinner saying "Extracting local frames..." which is accurate, but step 3 stays ⏳ the entire time frames AND AI analysis are running (since `setStepFramesDone` fires at the end of the server call). This is the same root issue as P1 — the label doesn't match what the flag actually tracks.

---

## P10 — Two Gemini Models Used, Neither Identified Correctly in Debug Output

**Files:** `backend/services/gemini_service.py:25`, `backend/services/claude_service.py:29`

```python
# gemini_service.py
self.model = 'gemini-2.5-flash-lite'   # Used for audio transcription

# claude_service.py (misnamed)
self.model = 'gemini-2.5-flash'        # Used for visual analysis
```

The frontend debug flags say "Audio Uploaded", "Transcribed & Timestamps", etc. — but never state which AI model processed which step. A user watching the debug screen can't tell that:
- Audio → `gemini-2.5-flash-lite`
- Visual Analysis → `gemini-2.5-flash` (via `ClaudeService`)
- Cross-Reference → `gemini-2.5-flash` (same service, second call)

When debugging AI quality issues (e.g. "why did it map the wrong component?") there's no model attribution in the report.

---

## Summary Table

| ID  | Severity | Area              | Issue                                              |
|-----|----------|-------------------|----------------------------------------------------|
| P1  | Medium   | Frontend/Debug    | Step flags misaligned with actual pipeline events  |
| P2  | Low      | Backend/Naming    | `ClaudeService` is actually Gemini — name confusion|
| P3  | Critical | Frontend/Clarify  | Wrong arg type passed to clarify handler, no audio sent |
| P4  | Critical | Backend/Clarify   | `/api/clarify` reads a video file that doesn't exist |
| P5  | High     | Pipeline/Frames   | Audio timestamps don't align to when component is in frame |
| P6  | High     | Mobile/Frames     | Seek-based frame extraction unreliable on iOS      |
| P7  | High     | UX/Checklist      | No detection of incomplete rundown, no re-inspect prompt |
| P8  | High     | AI/Mapping        | Gemini-returned `checklist_mapped_item` not validated — mismatches silently |
| P9  | Low      | Frontend/Debug    | Step 3 label says "frames extracted" but fires after full AI round-trip |
| P10 | Low      | Debug/Attribution | No model name shown in debug output for each step  |
