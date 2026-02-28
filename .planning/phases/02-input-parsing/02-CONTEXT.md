# Phase 2: Input Parsing - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Test Gemini visual analysis (frames) and audio transcription independently. Verify both work with real captured data before combining in Phase 3. This phase does NOT build the cross-reference or result UI — it proves the input parsing works.

</domain>

<decisions>
## Implementation Decisions

### Gemini configuration
- Model: **gemini-2.0-flash** (fast, good enough for hackathon)
- API key stored in `backend/.env` (gitignored, never pushed)
- Use `google-genai` Python SDK

### Audio-video timestamp correlation
- "Bucket @ 1:30" means: if audio mentions "bucket" at timestamp 1:30, the video frames near 1:30 should be tagged as LIKELY depicting "bucket"
- This is probabilistic, not definitive — the visual analysis confirms or overrides
- Transcription must include word-level timestamps to enable correlation
- Frames are captured at 2fps with their own timestamps — match audio timestamps to nearest frames

### Transcription approach
- Use **Gemini 2.0 Flash** for both visual AND audio (single API, simpler)
- Gemini handles audio natively — send the audio blob directly
- If Gemini transcription is too slow, fallback: browser Web Speech API for real-time transcription during recording (free, instant, sends text instead of audio)
- Transcription output: text + timestamps per word/segment
- for visual make sure gemini is CoT, Chain of Thought, so we can see its reasoning

### Visual analysis
- Send key frames (already captured at 2fps as base64 JPEGs)
- Gemini returns: what component is visible, observed condition, any concerns
- Structured JSON output from Gemini

### Claude's Discretion
- Exact Gemini prompt wording for visual analysis (should be profesional and follow Catipillars workflow)
- Exact Gemini prompt wording for audio transcription (should be exact, fast, and follow Catipillars termanology)
- Whether to batch frames or send individually
- Error retry strategy
- How to handle no audio / silence 

</decisions>

<specifics>
## Specific Ideas

- Timestamp correlation is the key insight: audio tells you WHAT, video tells you CONDITION
- "1:30" on whiteboard = audio timestamp where a component name was spoken (maybe find that frame in video?)
- Test each independently first, then combine in Phase 3

</specifics>

<deferred>
## Deferred Ideas

- Cross-referencing audio vs visual (Phase 3)
- Clarification flow / CLARIFY status (Phase 3)
- History lookup / Supermemory (Phase 4)
- Result UI / status badges (Phase 3-4)

</deferred>

<post-implementation>
## Post-Implementation Notes (Phase 2)

During the execution of Phase 2, the following challenges and changes occurred:
1. **Gemini Quota Issue:** `gemini-2.0-flash` returned a 429 error (quota exceeded, 0 limit for standard tier). We switched to `gemini-2.5-flash` which works perfectly.
2. **Payload Size Limit:** Uploading 17 base64 frames exceeded Flask/Werkzeug's default `MAX_FORM_MEMORY_SIZE` of 500KB. We increased this to 50MB in `app.py`.
3. **UI Addition:** The user requested to see the Chain of Thought reasoning immediately. We built the `ResultsView` UI (tabs for Record/Results) early in Phase 2 instead of waiting for Phase 3/4.
4. **Audio Bug:** At the end of Phase 2, we noticed the real frontend capture wasn't successfully sending the audio blob to the backend (`has_audio: False`). The backend audio transcription works perfectly (verified with mock tests), but the frontend ↔ backend payload for audio needs debugging in Phase 3.

</post-implementation>

---

*Phase: 02-input-parsing*
*Context gathered: 2026-02-28*
