# Phase 1: Foundation & Capture - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Working video+audio capture on mobile web browser with a glove-friendly, full-screen interface. Deliver a React + Vite frontend and Flask backend skeleton, accessible via HTTPS on a real mobile device. AI analysis, history, and checklist are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Capture interaction
- Single tap to start recording, single tap to stop — no press-and-hold, no double-tap
- Full-screen tap zone (the entire viewport is the button)
- Clear visual feedback during recording (pulsing border, timer, or recording indicator)

### Recording format & processing
- User-controlled video length (no fixed 5-10s cap; user decides when to stop)
- After recording: extract key frames from the video, discard the raw video
- Audio is transcribed (by Gemini in Phase 2), then the raw audio file is discarded
- Only key frames + transcript text are stored and sent for analysis
- This reduces upload size and storage cost significantly
- It is improtant that we do not accidentialy discard key frames, we would rather keep more frames than we need

### Screen layout & visual design
- Camera viewfinder modeled after the iPhone Camera app
- Bordered with Caterpillar brand colors: **gray frame with yellow accent border and cat logo on left side**
- Clean, minimal — no cluttered controls during capture
- High-contrast for outdoor visibility

### Post-capture flow
- Auto-upload immediately after user taps to stop recording
- No preview step, no confirmation screen
- User sees processing indicator while upload + analysis happens (Phase 2)
- Component identification comes from AI audio transcription (user speaks what they're inspecting)

### Claude's Discretion
- Exact recording indicator style (pulsing border vs. red dot vs. timer)
- Key frame extraction rate (1 per second, 2 per second, etc.)
- Loading/processing animation design
- Camera resolution settings (balance quality vs upload speed)

</decisions>

<specifics>
## Specific Ideas

- "Camera mode is like the camera on iPhone but bounded with a Cat-style gray and yellow border, and no start/stop/other-video-style buttons"
- Auto-upload — zero friction after recording stops
- Key frames only — smart compression to reduce data before AI analysis
- when not recording, the screen should be black with the text prompt "Tap anywhere to start recording" in the center of the screen

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-capture*
*Context gathered: 2026-02-27*
