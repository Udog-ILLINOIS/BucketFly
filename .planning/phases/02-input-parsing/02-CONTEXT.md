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

### Visual analysis
- Send key frames (already captured at 2fps as base64 JPEGs)
- Gemini returns: what component is visible, observed condition, any concerns
- Structured JSON output from Gemini

### Claude's Discretion
- Exact Gemini prompt wording for visual analysis
- Exact Gemini prompt wording for audio transcription
- Whether to batch frames or send individually
- Error retry strategy
- How to handle no audio / silence

</decisions>

<specifics>
## Specific Ideas

- Timestamp correlation is the key insight: audio tells you WHAT, video tells you CONDITION
- "1:30" on whiteboard = audio timestamp where a component name was spoken
- Test each independently first, then combine in Phase 3

</specifics>

<deferred>
## Deferred Ideas

- Cross-referencing audio vs visual (Phase 3)
- Clarification flow / CLARIFY status (Phase 3)
- History lookup / Supermemory (Phase 4)
- Result UI / status badges (Phase 3-4)

</deferred>

---

*Phase: 02-input-parsing*
*Context gathered: 2026-02-28*
