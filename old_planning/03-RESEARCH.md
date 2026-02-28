# Phase 3: AI Analysis & Results - Research

**Researched:** 2026-02-28
**Domain:** Gemini multi-turn context chaining, cross-reference prompt engineering, React alert/clarification UI
**Confidence:** HIGH (core stack), MEDIUM (prompt patterns)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-04 | Gemini cross-references spoken assessment vs. visual evidence | Multi-turn contents array pattern enables passing visual result + audio transcription as context; cross-reference prompt in `## Code Examples` |
| AI-05 | Gemini returns structured JSON: component, status, confidence, reasoning | Existing `response_schema` / Pydantic pattern in gemini_service.py extends naturally to new CROSSREF_SCHEMA with `status` enum |
| AI-06 | Status system: PASS / MONITOR / FAIL / CLARIFY | `Literal["PASS","MONITOR","FAIL","CLARIFY"]` as Pydantic enum field, validated server-side |
| CLAR-01 | CLARIFY status triggers alert notification dropping from top of screen | Pure CSS `@keyframes slideDown` + React `useState` on result status — no new library needed |
| CLAR-02 | Alert displays AI's specific clarification question | `clarification_question` field in cross-reference JSON schema; rendered in AlertDropdown component |
| CLAR-03 | User records follow-up clip to respond (no typing) | Reuse `useMediaCapture` hook from Phase 1; clarification clip goes to new `/api/clarify` endpoint |
| CLAR-04 | AI re-analyzes with original + clarification context; updates status | `contents` array with original frames (as user turn), model's analysis, then clarification audio (as new user turn) — full history preserved |
</phase_requirements>

---

## Summary

Phase 3 adds the intelligence layer on top of Phase 2's independent visual/audio parsing. The core work is a **cross-reference prompt** that takes the `visual_analysis` result and `audio_transcription` result already produced by `/api/inspect`, synthesizes them, and returns a final verdict — including detecting disagreement between what the operator said and what the AI sees, which triggers `CLARIFY` status.

The second major piece is the **clarification feedback loop**: when the frontend receives `CLARIFY`, it shows a dropping alert with the AI's question. The user records a follow-up clip using the same `useMediaCapture` hook, sends it to `/api/clarify`, which rebuilds the full conversation history (original frames + first analysis + clarification audio) and re-runs Gemini to produce a final definitive status.

A **known Phase 2 bug** must be fixed first: the audio blob is not making it to the backend (`has_audio: False` even when audio was recorded). This is a frontend FormData issue. Fixing it is a prerequisite for cross-reference to work in the real case (though it can be developed against the mock path first).

**Primary recommendation:** Extend the existing `GeminiService` with two new methods — `cross_reference()` and `clarify_with_context()` — using the multi-turn `contents` array pattern. Keep all prompt logic in `gemini_service.py`. Add two new Flask routes: `/api/analyze` and `/api/clarify`. Build `AlertDropdown` in React with pure CSS animation; no new npm packages needed.

---

## Standard Stack

### Core (already installed — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `google-genai` | `>=1.0.0` | Gemini API calls (visual, audio, cross-reference) | Already in use; `generate_content` supports multi-turn contents array |
| `flask` | `3.1.0` | Backend routes for `/api/analyze` and `/api/clarify` | Already in use |
| `react` | `^19.2.0` | AlertDropdown component, processing animation state | Already in use |
| `pydantic` | bundled with google-genai | Schema definition for cross-reference JSON | Preferred over raw dict schemas; cleaner enum support |

### Supporting (no additions needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS `@keyframes` | native | Slide-from-top alert animation | No Framer Motion needed; project uses vanilla CSS already |
| `useMediaCapture` hook | Phase 1 | Reused for clarification re-recording | Import directly; no changes required |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw dict schema (current) | Pydantic BaseModel | Pydantic gives cleaner enum validation, but raw dict already works — use raw dict to match existing code style |
| Custom alert component | react-toastify | Library adds ~15KB; custom CSS achieves same slide effect; consistent with project's no-library CSS style |
| `client.chats.create()` | `contents` array manually | `chats.create()` tracks history automatically but doesn't support structured JSON output per-turn; use `generate_content` with explicit `contents` list |

**Installation:** No new packages. All dependencies already present.

---

## Architecture Patterns

### Recommended File Changes
```
backend/
├── app.py                    # Add: /api/analyze and /api/clarify routes
└── services/
    └── gemini_service.py     # Add: cross_reference() and clarify_with_context() methods
                              # Add: CROSSREF_PROMPT, CLARIFY_PROMPT constants
                              # Add: CROSSREF_SCHEMA dict

frontend/src/
├── services/
│   └── api.js                # Add: analyzeInspection() and submitClarification() functions
├── components/
│   ├── AlertDropdown.jsx     # NEW: CLARIFY status alert with slide animation
│   ├── AlertDropdown.css     # NEW: @keyframes slideDown animation
│   ├── ResultsView.jsx       # MODIFY: listen for CLARIFY status, show AlertDropdown
│   └── CaptureZone.jsx       # MODIFY: add "clarification mode" triggered by AlertDropdown
└── App.jsx                   # MODIFY: wire CLARIFY state between ResultsView and CaptureZone
```

### Pattern 1: Cross-Reference via Single Generate Call

**What:** Pass both `visual_analysis` result and `audio_transcription` result as text context in a single `generate_content` call. No need for actual multi-turn chat — the prior analysis is summarized as text.

**When to use:** First cross-reference call (no prior clarification). Simpler and faster than building a real multi-turn history for the initial analysis.

**Example:**
```python
# Source: Gemini API generate_content pattern (ai.google.dev/api/generate-content)
def cross_reference(self, visual_analysis: dict, audio_transcription: dict, frames_b64: list) -> dict:
    """Cross-reference visual analysis vs audio assessment. Returns final verdict."""

    # Build context from prior analyses as text summary
    visual_summary = (
        f"VISUAL ANALYSIS:\n"
        f"  Component: {visual_analysis.get('component', 'unknown')}\n"
        f"  Preliminary status: {visual_analysis.get('preliminary_status', 'UNCLEAR')}\n"
        f"  Observations: {', '.join(visual_analysis.get('condition_observations', []))}\n"
        f"  Concerns: {', '.join(visual_analysis.get('concerns', []))}\n"
        f"  Confidence: {visual_analysis.get('confidence', 0)}\n"
        f"  AI reasoning: {visual_analysis.get('chain_of_thought', {}).get('conclusion', '')}"
    )

    audio_summary = (
        f"OPERATOR'S SPOKEN ASSESSMENT:\n"
        f"  Transcript: \"{audio_transcription.get('full_text', 'No audio provided')}\"\n"
        f"  Components mentioned: {[c['name'] for c in audio_transcription.get('components_mentioned', [])]}"
    )

    parts = [visual_summary, "\n\n", audio_summary, "\n\n", CROSSREF_PROMPT]

    # Optionally include 2-3 key frames for the model to re-examine
    for frame_b64 in frames_b64[:3]:
        raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
        parts.insert(0, types.Part.from_bytes(
            data=base64.b64decode(raw), mime_type="image/jpeg"
        ))

    response = self.client.models.generate_content(
        model=self.model,
        contents=parts,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CROSSREF_SCHEMA,
            temperature=0.1,
        )
    )
    return json.loads(response.text)
```

### Pattern 2: Clarification via Multi-Turn Contents Array

**What:** Build a full conversation history and pass it to `generate_content` as a `contents` list. The "user" turn contains the original frames + analysis context. The "model" turn contains the first verdict (why it triggered CLARIFY). The next "user" turn contains the clarification audio.

**When to use:** `/api/clarify` endpoint — when re-analyzing with user's follow-up recording.

**Example:**
```python
# Source: Gemini API multi-turn pattern (ai.google.dev/api/generate-content)
def clarify_with_context(
    self,
    original_frames_b64: list,
    original_analysis: dict,
    clarification_audio_bytes: bytes,
) -> dict:
    """Re-analyze with clarification context. Returns definitive final status."""

    # Turn 1: Original inspection (user role)
    original_parts = []
    for frame_b64 in original_frames_b64[:5]:  # Keep top 5 frames
        raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
        original_parts.append(types.Part.from_bytes(
            data=base64.b64decode(raw), mime_type="image/jpeg"
        ))
    original_parts.append(types.Part.from_text(
        f"Inspection context: {json.dumps(original_analysis, indent=2)}"
    ))

    # Turn 2: AI's prior CLARIFY response (model role)
    prior_verdict = (
        f"I returned CLARIFY status because: "
        f"{original_analysis.get('disagreement_reason', 'unclear')}. "
        f"I asked: '{original_analysis.get('clarification_question', '')}'"
    )

    # Turn 3: Operator's clarification (user role)
    clarification_parts = [
        types.Part.from_bytes(data=clarification_audio_bytes, mime_type="audio/webm"),
        types.Part.from_text(
            "The operator has responded with a follow-up recording to clarify. "
            "Use this response to finalize your assessment. "
            "You MUST now produce a definitive PASS, MONITOR, or FAIL status — "
            "do NOT return CLARIFY again."
        )
    ]

    contents = [
        types.Content(role="user", parts=original_parts),
        types.Content(role="model", parts=[types.Part.from_text(prior_verdict)]),
        types.Content(role="user", parts=clarification_parts),
    ]

    response = self.client.models.generate_content(
        model=self.model,
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CROSSREF_SCHEMA,
            temperature=0.1,
        )
    )
    return json.loads(response.text)
```

### Pattern 3: AlertDropdown — Pure CSS Slide-from-Top

**What:** React component that renders conditionally when `status === 'CLARIFY'`. Uses `@keyframes slideDown` with `transform: translateY(-100%)` start state. No external library.

**When to use:** Whenever `lastResult.final_status === 'CLARIFY'` in App state.

**Example:**
```jsx
// AlertDropdown.jsx
import { useState } from 'react';
import './AlertDropdown.css';

export function AlertDropdown({ question, onStartClarification, onDismiss }) {
    const [isClosing, setIsClosing] = useState(false);

    const handleDismiss = () => {
        setIsClosing(true);
        setTimeout(onDismiss, 300); // Match animation duration
    };

    return (
        <div className={`alert-dropdown ${isClosing ? 'closing' : ''}`}>
            <div className="alert-icon">?</div>
            <div className="alert-content">
                <div className="alert-label">AI needs clarification</div>
                <div className="alert-question">{question}</div>
            </div>
            <button className="alert-record-btn" onClick={onStartClarification}>
                Tap to respond
            </button>
        </div>
    );
}
```

```css
/* AlertDropdown.css */
@keyframes slideDown {
    from { transform: translateY(-100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
}

@keyframes slideUp {
    from { transform: translateY(0);    opacity: 1; }
    to   { transform: translateY(-100%); opacity: 0; }
}

.alert-dropdown {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: #f97316;  /* Cat orange / CLARIFY color */
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: slideDown 0.3s ease-out forwards;
}

.alert-dropdown.closing {
    animation: slideUp 0.3s ease-in forwards;
}
```

### Pattern 4: Processing Animation During AI Wait

**What:** Extend the existing `uploadStatus` state in `CaptureZone.jsx` and `App.jsx` to show a spinner + elapsed-time counter during the 3–15 second AI analysis window.

**When to use:** After frames are uploaded, while waiting for `/api/analyze` or `/api/inspect` response.

**Example:**
```jsx
// In App.jsx — extend existing handleInspectionComplete
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [analyzeElapsed, setAnalyzeElapsed] = useState(0);

const handleInspectionComplete = async (frames, audioBlob) => {
    setIsAnalyzing(true);
    const startTime = Date.now();
    const timer = setInterval(() => {
        setAnalyzeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
        const result = await uploadInspection(frames, audioBlob);
        setLastResult(result);
        setActiveTab('results');
    } finally {
        clearInterval(timer);
        setIsAnalyzing(false);
        setAnalyzeElapsed(0);
    }
};
```

### Anti-Patterns to Avoid

- **Parallel visual + audio → then cross-reference in three separate API calls:** The existing `/api/inspect` already runs visual + audio in sequence. For Phase 3, add cross-reference as a third step in the same endpoint OR create a new `/api/analyze` that calls `inspect` logic + cross-reference. Do NOT restructure the existing endpoint — add to it.
- **Passing raw frames in the clarification multi-turn history:** Frames are large. Pass only the top 3–5 key frames in the `clarify_with_context` call, not the full set of 17. Otherwise token limits will be hit.
- **Using `client.chats.create()` for the clarify endpoint:** The chat SDK helper doesn't support `response_schema` per-turn. Use `generate_content` with a manual `contents` list instead.
- **Storing clarification context client-side only:** The `/api/clarify` request must include the original `inspection_id` so the backend can re-read the saved frames from disk. Don't try to re-upload 17 frames again.
- **Making CLARIFY permanent:** The clarify endpoint must prohibit returning CLARIFY again. Add explicit instruction in `CLARIFY_PROMPT` and add a post-process fallback: if model returns CLARIFY again, force to MONITOR.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Manual dict validation | `response_schema` in Gemini config | Gemini enforces the schema; malformed JSON auto-retried |
| Multi-turn history management | Custom history store/cache | Pass `contents` list directly to `generate_content` | Gemini is stateless; history is just a list you build |
| Alert animation | Canvas animation / JS timers | CSS `@keyframes` + `transform: translateY` | GPU-composited, 60fps, 10 lines of CSS |
| Audio format conversion | ffmpeg / librosa | Send raw WebM bytes; Gemini accepts `audio/webm` natively | Already proven in Phase 2 mock tests |
| Disagreement detection logic | Rule-based text diff | Gemini cross-reference prompt | LLM is better at nuanced semantic disagreement than string matching |

**Key insight:** The entire intelligence layer is prompt engineering, not code. The complex logic lives in `CROSSREF_PROMPT`, not in application code.

---

## Common Pitfalls

### Pitfall 1: Audio Still Not Reaching Backend (Known Phase 2 Bug)

**What goes wrong:** `has_audio: False` returned even when user spoke during recording. The audio blob is created (`audioBlob.size > 0`) but the FormData multipart upload is failing silently.

**Why it happens:** The `audioBlob` in `useMediaCapture` is typed as `video/webm` (not `audio/webm`), and the backend expects an `audio` field. The blob may not be appending correctly, or the field name may be getting dropped.

**How to avoid:** In Phase 3 Wave 0, add a debug log: `console.log('audioBlob size:', audioBlob?.size, 'type:', audioBlob?.type)` before the FormData append. Verify the `Content-Disposition` field name matches what Flask expects (`request.files.get('audio')`). Check that `audioBlob.size > 0` before appending.

**Warning signs:** Backend logs showing `has_audio: False` when you know you spoke. API response with empty `audio_transcription`.

### Pitfall 2: CROSSREF_SCHEMA Enum Not Matching Status Values

**What goes wrong:** Gemini returns `"status": "FAIL"` but the schema uses `"preliminary_status"` — different field names cause silent fallback to null.

**Why it happens:** The existing `VISUAL_SCHEMA` uses `preliminary_status`. The new cross-reference result should use `final_status` for clarity. If frontend checks `result.preliminary_status` on the cross-reference result, it gets undefined.

**How to avoid:** Define `final_status` (not `preliminary_status`) in `CROSSREF_SCHEMA`. Update `ResultsView.jsx` to check `result.cross_reference?.final_status || result.visual_analysis?.preliminary_status` for backward compatibility.

**Warning signs:** Status badge showing "N/A" even after cross-reference completes.

### Pitfall 3: Token Limit When Passing All Frames as Multi-Turn History

**What goes wrong:** Clarification call fails with a 400 error or truncated response because 17 frames × ~50KB each = ~850KB of image data in the contents array.

**Why it happens:** Gemini 2.5 Flash has a 1M token context window but each image costs tokens. Passing the full frame set in the clarification multi-turn hits practical limits.

**How to avoid:** In `clarify_with_context`, pass only the inspection_id, load frames from disk, and send only the top 3–5 most relevant frames. Use the timestamp correlation result to pick which frames are most relevant.

**Warning signs:** 400 errors on `/api/clarify` with `RESOURCE_EXHAUSTED` or `invalid_request` in the Gemini error message.

### Pitfall 4: CLARIFY Loop (AI Returns CLARIFY Twice)

**What goes wrong:** The `/api/clarify` endpoint re-runs Gemini which returns CLARIFY status again, creating an infinite clarification loop in the UI.

**Why it happens:** The prompt doesn't explicitly prohibit CLARIFY in the follow-up turn, and the model hedges when the clarification audio is ambiguous.

**How to avoid:** Add to `CLARIFY_PROMPT`: "You MUST produce PASS, MONITOR, or FAIL. Do not return CLARIFY — this is a follow-up inspection." Add server-side safeguard: `if result.get('final_status') == 'CLARIFY': result['final_status'] = 'MONITOR'`.

**Warning signs:** UI cycling through CLARIFY alerts repeatedly.

### Pitfall 5: Gemini Model Name Mismatch

**What goes wrong:** `app.py` has `print("Gemini: gemini-2.0-flash")` but `GeminiService` reads from env var `GEMINI_MODEL` defaulting to `'gemini-2.0-flash'`. Phase 2 switched to `gemini-2.5-flash` due to quota issues, but the env var default was not updated.

**Why it happens:** The switch was done in the `.env` file but the fallback default in code was left as `2.0-flash`.

**How to avoid:** Update the default in `gemini_service.py` line 28: `self.model = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')`. Update the print statement in `app.py`.

**Warning signs:** 429 quota errors on analysis requests despite having `GEMINI_MODEL=gemini-2.5-flash` in `.env`. Happens when `.env` is absent.

### Pitfall 6: Alert Dropout Blocked by Tab Bar

**What goes wrong:** The `AlertDropdown` slides from top but the CSS `position: fixed; top: 0` competes with any `position: fixed` header. On mobile, the browser URL bar may obscure part of the alert.

**Why it happens:** Mobile browsers have variable top bar heights. `top: 0` doesn't account for safe areas.

**How to avoid:** Use `top: env(safe-area-inset-top, 0)` or add `padding-top: env(safe-area-inset-top)` to the alert. Test on actual mobile device through ngrok.

**Warning signs:** Top of alert clipped on iPhone notch devices.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Cross-Reference Schema (extending existing pattern in gemini_service.py)
```python
# Extends the raw dict schema pattern already used in VISUAL_SCHEMA
# Source: existing gemini_service.py + Gemini structured output docs
CROSSREF_SCHEMA = {
    "type": "object",
    "properties": {
        "final_status": {
            "type": "string",
            "enum": ["PASS", "MONITOR", "FAIL", "CLARIFY"]
        },
        "confidence": {"type": "number"},
        "component": {"type": "string"},
        "verdict_reasoning": {"type": "string"},
        "disagreement_detected": {"type": "boolean"},
        "disagreement_reason": {"type": "string"},
        "clarification_question": {"type": "string"},
        "what_ai_sees": {"type": "string"},
        "what_operator_said": {"type": "string"},
        "recommendation": {"type": "string"},
        "chain_of_thought": {
            "type": "object",
            "properties": {
                "audio_says": {"type": "string"},
                "visual_shows": {"type": "string"},
                "comparison": {"type": "string"},
                "final_verdict": {"type": "string"}
            },
            "required": ["audio_says", "visual_shows", "comparison", "final_verdict"]
        }
    },
    "required": ["final_status", "confidence", "component", "verdict_reasoning",
                 "disagreement_detected", "chain_of_thought", "recommendation"]
}
```

### Cross-Reference Prompt Text
```python
CROSSREF_PROMPT = """You are a senior Caterpillar TA1 inspection verifier.

You have been provided:
1. A visual AI analysis of equipment frames (what the AI SEES)
2. The operator's spoken assessment (what the operator SAID)

Your job is to cross-reference these two sources and produce a final verdict.

STEP 1 — COMPARE: What did the operator say vs what the AI sees?
  - Do they agree? (e.g., operator says "looks good", AI sees no defects → AGREE)
  - Do they disagree? (e.g., operator says "looks good", AI sees hydraulic leak → DISAGREE)
  - Is the operator's assessment incomplete? (missed something the AI caught)

STEP 2 — RESOLVE:
  - AGREE + no concerns → PASS or MONITOR based on severity
  - AGREE + serious concern → FAIL
  - DISAGREE (AI sees worse than operator) → trust the AI, escalate status
  - AMBIGUOUS or contradictory → CLARIFY (ask a specific yes/no question)
  - No audio provided → rely solely on visual analysis

STEP 3 — CLARIFY conditions (use sparingly, only when genuinely unclear):
  - Visual shows something that could be dirt OR damage
  - Operator mentioned a different component than what AI sees
  - Critical safety component with borderline condition

When returning CLARIFY, the clarification_question MUST be specific and answerable verbally:
  GOOD: "Is that brown staining on the cylinder rod wet/oily or dry?"
  BAD: "Can you clarify the condition?"

You are protecting operator safety. When in doubt, escalate."""
```

### Flask Route for /api/analyze (new endpoint)
```python
# In app.py — new endpoint that combines inspect + cross-reference
@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    Full analysis: visual + audio + cross-reference.
    Accepts same payload as /api/inspect (frames + audio).
    Returns enhanced result with final_status and cross_reference field.
    """
    try:
        # Parse frames and audio (same as /api/inspect)
        frames_json = request.form.get('frames', '[]')
        frames = json.loads(frames_json)
        audio_file = request.files.get('audio')
        audio_data = audio_file.read() if audio_file else None

        if not frames:
            return jsonify({"error": "No frames provided"}), 400

        inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        os.makedirs(inspection_dir, exist_ok=True)

        # Save frames to disk for clarification re-use
        for i, frame_b64 in enumerate(frames):
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            with open(os.path.join(inspection_dir, f'frame_{i:04d}.jpg'), 'wb') as f:
                f.write(base64.b64decode(raw))

        gemini = get_gemini()
        result = {"inspection_id": inspection_id, "frame_count": len(frames)}

        # Step 1: Visual analysis
        visual = gemini.analyze_frames(frames)
        result["visual_analysis"] = visual

        # Step 2: Audio transcription (if present)
        audio_transcription = {}
        has_audio = bool(audio_data and len(audio_data) > 0)
        if has_audio:
            audio_path = os.path.join(inspection_dir, 'audio.webm')
            with open(audio_path, 'wb') as f:
                f.write(audio_data)
            audio_transcription = gemini.transcribe_audio(audio_data)
            result["audio_transcription"] = audio_transcription
        result["has_audio"] = has_audio

        # Step 3: Cross-reference
        cross_ref = gemini.cross_reference(visual, audio_transcription, frames)
        result["cross_reference"] = cross_ref
        result["final_status"] = cross_ref.get("final_status", visual.get("preliminary_status"))

        # Save result
        with open(os.path.join(inspection_dir, 'analysis.json'), 'w') as f:
            json.dump(result, f, indent=2)

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Analyze failed: {e}")
        return jsonify({"error": str(e)}), 500
```

### Flask Route for /api/clarify (new endpoint)
```python
@app.route('/api/clarify', methods=['POST'])
def clarify():
    """
    Re-analyze with clarification context.
    Accepts: inspection_id (from prior analysis) + clarification audio.
    """
    try:
        inspection_id = request.form.get('inspection_id')
        clarification_audio = request.files.get('audio')

        if not inspection_id or not clarification_audio:
            return jsonify({"error": "inspection_id and audio required"}), 400

        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        analysis_path = os.path.join(inspection_dir, 'analysis.json')

        if not os.path.exists(analysis_path):
            return jsonify({"error": f"Inspection {inspection_id} not found"}), 404

        with open(analysis_path) as f:
            prior_result = json.load(f)

        # Load original frames from disk (select top 5)
        frame_files = sorted([
            f for f in os.listdir(inspection_dir) if f.startswith('frame_')
        ])[:5]
        frames_b64 = []
        for fname in frame_files:
            with open(os.path.join(inspection_dir, fname), 'rb') as f:
                frames_b64.append(base64.b64encode(f.read()).decode())

        clarification_audio_bytes = clarification_audio.read()
        original_analysis = prior_result.get("cross_reference", prior_result.get("visual_analysis", {}))

        gemini = get_gemini()
        clarify_result = gemini.clarify_with_context(
            frames_b64, original_analysis, clarification_audio_bytes
        )

        # Prevent CLARIFY loop
        if clarify_result.get("final_status") == "CLARIFY":
            clarify_result["final_status"] = "MONITOR"
            clarify_result["verdict_reasoning"] += " [Defaulted to MONITOR — clarification was ambiguous]"

        return jsonify({
            "inspection_id": inspection_id,
            "clarification_result": clarify_result,
            "final_status": clarify_result.get("final_status"),
        }), 200

    except Exception as e:
        print(f"[ERROR] Clarify failed: {e}")
        return jsonify({"error": str(e)}), 500
```

### Frontend: api.js additions
```javascript
// Add to frontend/src/services/api.js
export async function analyzeInspection(frames, audioBlob) {
    const formData = new FormData();
    formData.append('frames', JSON.stringify(frames));
    if (audioBlob && audioBlob.size > 0) {
        formData.append('audio', audioBlob, 'audio.webm');
    }
    const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Analysis failed: ${response.status}`);
    }
    return response.json();
}

export async function submitClarification(inspectionId, clarificationAudioBlob) {
    const formData = new FormData();
    formData.append('inspection_id', inspectionId);
    if (clarificationAudioBlob && clarificationAudioBlob.size > 0) {
        formData.append('audio', clarificationAudioBlob, 'clarification.webm');
    }
    const response = await fetch(`${API_BASE}/api/clarify`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Clarification failed: ${response.status}`);
    }
    return response.json();
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gemini-2.0-flash` | `gemini-2.5-flash` | Phase 2 (quota 429 hit) | Must update default in code, not just .env |
| `google-generativeai` (old SDK) | `google-genai` (new unified SDK) | Late 2024 | Old SDK is deprecated; project already uses new SDK correctly |
| `response_schema` with raw dict | `response_json_schema` with Pydantic | Nov 2025 | Both work; raw dict already in use — maintain consistency |
| Separate API calls per modality | Single `generate_content` with `contents` list | Gemini 1.5+ | Pass all modalities in one call for cross-reference |

**Deprecated/outdated:**
- `google-generativeai` (pip package): Replaced by `google-genai`. Project already uses correct new package.
- `GenerativeModel` class: Replaced by `client.models.generate_content()`. Project already uses correct API.
- `gemini-2.0-flash`: Quota issues on free tier. Project switched to `gemini-2.5-flash` (confirmed working).

---

## Open Questions

1. **Audio blob bug root cause**
   - What we know: `has_audio: False` on backend despite `audioBlob.size > 0` in frontend
   - What's unclear: Is it FormData field name mismatch? MIME type? Blob type (`video/webm` vs `audio/webm`)? Content-Length issue?
   - Recommendation: Add `console.log` debugging in Phase 3 Wave 0 before building clarification flow. The cross-reference prompt can handle `no audio` gracefully (relying on visual only) but the clarify flow requires working audio.

2. **Which endpoint to use: `/api/inspect` (existing) or `/api/analyze` (new)?**
   - What we know: The existing `/api/inspect` already runs visual + audio. Phase 3 needs to add cross-reference as step 3.
   - What's unclear: Whether to modify `/api/inspect` to add cross-reference inline, or create separate `/api/analyze`.
   - Recommendation: Create `/api/analyze` as the new primary endpoint (adds cross-reference). Keep `/api/inspect` unchanged for backward compatibility. Update `App.jsx` to call `/api/analyze` via `analyzeInspection()` instead of `uploadInspection()`.

3. **Processing animation: where does it live?**
   - What we know: `CaptureZone.jsx` currently shows a spinner after recording stops. Analysis takes 3–15 seconds.
   - What's unclear: Should the spinner be in `CaptureZone`, in a full-screen overlay, or on the Results tab?
   - Recommendation: Add full-screen processing overlay in `App.jsx` at the top level, so it covers both tabs. Show elapsed time counter. This is a single `isAnalyzing` boolean in App state.

---

## Sources

### Primary (HIGH confidence)
- `ai.google.dev/api/generate-content` — Multi-turn contents array structure with role/parts, inline image data in conversation history
- `ai.google.dev/gemini-api/docs/structured-output` — `response_schema` and `response_json_schema` with Pydantic pattern
- `github.com/googleapis/python-genai` — SDK README: `types.Content`, `types.Part.from_bytes()`, `types.UserContent`, `types.ModelContent` constructors
- Existing `gemini_service.py` — Already-proven `types.Part.from_bytes()` and `generate_content` pattern with `response_schema`
- Existing `useMediaCapture.js` — Audio blob structure confirmed: `Blob(chunks, {type: 'video/webm'})`

### Secondary (MEDIUM confidence)
- Phase 2 CONTEXT.md post-implementation notes — confirmed: `gemini-2.5-flash` works, audio bug exists, `MAX_FORM_MEMORY_SIZE` fix applied
- `ai.google.dev/gemini-api/docs/models` — confirmed `gemini-2.5-flash` is current stable model ID
- CSS Tricks / Josh W. Comeau keyframes guide — `@keyframes slideDown` with `translateY(-100%)` is the standard CSS-only approach for top-of-screen alerts

### Tertiary (LOW confidence)
- WebSearch: "Gemini 2.5 Flash multi-turn conversation context chaining" — Thought signatures noted for multi-turn function calling; not applicable to our stateless `generate_content` + `contents` array pattern. LOW — not directly relevant to our approach.
- WebSearch: "React notification alert top of screen" — Libraries surveyed (react-toastify, etc.) but project avoids new npm packages; custom CSS is the right call here.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and proven in Phase 1/2; no new dependencies
- Architecture: HIGH — `generate_content` + `contents` list pattern verified against official Gemini API docs and existing codebase
- Prompt patterns: MEDIUM — cross-reference prompt is novel engineering; no official reference; informed by Phase 2 prompt style and Gemini multimodal docs
- Alert animation: HIGH — standard CSS `@keyframes translateY` pattern, no library needed
- Audio bug fix: LOW — root cause unknown; needs live debugging in Phase 3

**Research date:** 2026-02-28
**Valid until:** 2026-03-14 (14 days — Gemini API is fast-moving but core `generate_content` + `response_schema` pattern is stable)
