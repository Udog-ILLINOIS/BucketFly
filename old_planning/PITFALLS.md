# Pitfalls Research

**Domain:** Multimodal AI Equipment Inspection (Hackathon)
**Researched:** 2026-02-27
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Volume Button Capture is Impossible in Mobile Web

**What goes wrong:**
The INIT.md specifies volume button as the primary interaction. Mobile web browsers (Safari, Chrome) do not expose hardware volume button events to JavaScript. The app will have no way to detect volume presses.

**Why it happens:**
OS-level security restriction. Volume buttons are system-level controls — web apps cannot intercept them.

**How to avoid:**
Replace volume button with a massive full-screen tap zone. The entire viewport becomes the record button. Works with gloves, requires zero precision. Alternatively, build a React Native app (but adds 4-8 hours of setup).

**Warning signs:**
Testing only on desktop where keyboard shortcuts work, then failing on actual mobile device.

**Phase to address:**
Phase 1 — UI/Capture Zone design

---

### Pitfall 2: HTTPS Required for Camera/Mic on Mobile

**What goes wrong:**
MediaRecorder API requires HTTPS context. `localhost` works on desktop but mobile devices accessing via IP address (e.g. `192.168.1.x:3000`) will silently fail to request camera/mic permissions.

**Why it happens:**
Browser security policy — getUserMedia requires secure context.

**How to avoid:**
Use `ngrok` to tunnel local dev server with HTTPS URL. Test on mobile device early (hour 1, not hour 30).

**Warning signs:**
Camera works on desktop browser but black screen / no permission prompt on mobile.

**Phase to address:**
Phase 1 — Dev environment setup

---

### Pitfall 3: Gemini API Latency for Video

**What goes wrong:**
Uploading a 5-10 second video clip and waiting for Gemini analysis can take 5-15 seconds. The user stands there wondering if the app froze.

**Why it happens:**
Video upload + multimodal processing is computationally expensive.

**How to avoid:**
- Show a clear processing animation (spinning gear, "AI is thinking...")
- Extract key frames (1-2 per second) instead of full video if latency is >10s
- Use Gemini 2.0 Flash (faster) rather than Pro (smarter but slower)

**Warning signs:**
Demo feels sluggish; judges lose patience during the wait.

**Phase to address:**
Phase 2 — AI integration pipeline

---

### Pitfall 4: Pre-seeded History Not Matching Demo Script

**What goes wrong:**
The demo compares "today's" inspection to "yesterday's" history, but the pre-seeded data doesn't match the physical props being demonstrated.

**Why it happens:**
Demo props are improvised (spray bottle for hydraulic leak, blunted object for teeth wear). If the seeded history doesn't describe these exact props, the AI comparison will be nonsensical.

**How to avoid:**
- Script the exact demo scenario end-to-end
- Seed history that exactly matches the props you'll use
- Do a full dress rehearsal with the actual props before judging

**Warning signs:**
AI says "comparing to previous inspection" but the comparison makes no sense.

**Phase to address:**
Phase 4 — Demo preparation

---

### Pitfall 5: Gemini Hallucinating Component Details

**What goes wrong:**
Gemini may "see" things that aren't there or provide overly confident assessments about equipment it doesn't actually understand.

**Why it happens:**
LLMs confabulate. Gemini will try to be helpful even when the video is ambiguous.

**How to avoid:**
- Use structured output schema with explicit confidence scores
- Prompt engineering: instruct Gemini to say "uncertain" when unsure
- Build the "CLARIFY" status as a first-class outcome, not an edge case

**Warning signs:**
AI gives high confidence on obviously ambiguous inputs during testing.

**Phase to address:**
Phase 2 — Gemini prompt engineering

---

### Pitfall 6: Audio Transcription Accuracy in Noisy Environments

**What goes wrong:**
Construction sites are loud. The user's spoken assessment may be garbled by background noise (engine rumble, wind, other workers).

**Why it happens:**
On-device microphones pick up ambient noise. Gemini's audio processing may struggle with low-quality audio.

**How to avoid:**
- Accept that hackathon demo will be in a quiet room (this is fine)
- In the real product, add noise cancellation or use dedicated mic
- For demo: speak clearly, close to phone

**Warning signs:**
Transcription misidentifies component or misinterprets assessment.

**Phase to address:**
Phase 2 — AI pipeline, but not critical for hackathon demo environment

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| JSON file instead of real DB | Fast setup, no DB config | No querying, scaling, or concurrent access | Hackathon only |
| Hardcoded demo components | Quick demo, reliable flow | No flexibility for new machines | Hackathon only |
| No auth/login | Skip user management entirely | No multi-user, no audit trail | Hackathon only |
| Synchronous Gemini calls | Simpler code | Blocks server during processing | Hackathon (low traffic) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Gemini video upload | Sending raw blob without proper MIME type | Set `mime_type: "video/webm"` explicitly |
| Supermemory | Not structuring memories with tags | Use structured tags: `component:bucket_teeth, date:2026-02-27` |
| MediaRecorder | Assuming `video/mp4` is supported | Use `video/webm` (universal browser support), convert if needed |
| CORS | Forgetting flask-cors setup | Add `CORS(app)` immediately on Flask init |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Small buttons/controls | Impossible to use with gloves | Full-screen tap zones, high contrast, large text |
| Text input for clarification | Workers can't type with gloves | Voice-only clarification flow |
| Complex navigation | Workers confused by multi-step UI | Three simple tabs, linear workflow |
| No feedback during processing | User thinks app crashed | Animated processing indicator with estimated time |

## "Looks Done But Isn't" Checklist

- [ ] **Camera capture:** Works on desktop but verify on actual mobile device via HTTPS
- [ ] **Audio recording:** Test with actual spoken words, not just silence
- [ ] **Demo history:** Verify pre-seeded data matches actual demo props
- [ ] **Gemini response:** Confirm structured JSON schema is enforced, not just hoped for
- [ ] **Clarification flow:** Test the full loop: alert → record → re-analyze → update
- [ ] **Three demo scenarios:** Run each end-to-end with physical props before presenting

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Volume button impossible | Phase 1 (UI) | Test tap capture on mobile device |
| HTTPS requirement | Phase 1 (Setup) | Access via ngrok on phone |
| Gemini latency | Phase 2 (AI) | Measure response time, add loading UX |
| History mismatch | Phase 4 (Demo) | Full dress rehearsal |
| AI hallucination | Phase 2 (AI) | Test with ambiguous inputs |
| Audio noise | Phase 2 (AI) | Test in quiet room (hackathon venue) |

## Sources

- MDN Web Docs — MediaRecorder API constraints & secure context requirements
- Mobile web browser security documentation (Apple/Google)
- Gemini API documentation — structured output & confidence scoring
- Hackathon post-mortems from similar AI demo projects

---
*Pitfalls research for: Multimodal AI Equipment Inspection*
*Researched: 2026-02-27*
