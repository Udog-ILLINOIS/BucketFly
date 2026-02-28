# Roadmap: Cat Vision-Inspect AI

**Created:** 2026-02-27
**Updated:** 2026-02-28
**Depth:** Standard (5 phases)
**Core Value:** AI-powered safety verification that catches what humans miss

## Overview

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 1 | Foundation & Capture | ✅ Working video+audio capture on mobile web | CAPT-01–05, UI-02, UI-04 |
| 2 | Input Parsing | ✅ Gemini analyzes frames (visual) and transcribes audio | AI-01, AI-02, AI-03 |
| 3 | AI Analysis & Results | Cross-reference visual + audio, produce structured verdict | AI-04, AI-05, AI-06, CLAR-01–04 |
| 4 | Memory, History & UI | Supermemory integration, checklist, tabs, history view | HIST-01–04, LIST-01–03, UI-01, UI-03, UI-05 |
| 5 | Demo Preparation | Three polished demo scenarios with rehearsal | DEMO-01–03 |

---

## Pipeline (from whiteboard)

```
┌─────────────────────────────────────────────────────┐
│                     INPUT                            │
│  audio → transcribe @ 1:30 buckets                  │
│  video → extract key frames                         │
└───────────────┬─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────┐
│                    VISUAL                            │
│  ID Part? → ID history → ID Status                  │
└───────────────┬─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────┐
│                    RESULT                            │
│  ID Misses Anything → ID Status → ID actionable?    │
└───────────────┬────────────────────┬────────────────┘
                ↓                    ↑
                └── feedback loop ───┘
                   (clarification)
```

---

## Phase Details

### Phase 1: Foundation & Capture ✅

**Goal:** Working video+audio capture app on mobile browser with glove-friendly full-screen tap interface

**Status:** COMPLETE — committed & pushed (`abc39c4`)

**Requirements:** CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, UI-02, UI-04

---

### Phase 2: Input Parsing ✅

**Goal:** Verify Gemini can analyze captured frames (visual) and transcribe audio — test each independently before combining

**Status:** COMPLETE — committed & pushed (`0a0ca73`)

**Requirements:** AI-01, AI-02, AI-03

**Success Criteria:**
1. Gemini receives key frames and returns visual analysis (what component, condition, observations)
2. Gemini receives audio blob and returns transcription of what the operator said
3. Both work with real captured data from Phase 1 (not mocked)
4. Audio is bucketed at 1:30 intervals for processing
5. Structured JSON output for both visual and audio results
6. Processing handles arbitrary-length recordings

**Build order:**
1. Create Gemini service with API key configuration
2. Implement visual analysis endpoint (send frames → get visual report)
3. Implement audio transcription endpoint (send audio → get transcript)
4. Test with actual captured inspection data
5. Handle errors and edge cases (blurry frames, garbled audio)

---

### Phase 3: AI Analysis & Results

**Goal:** Cross-reference visual analysis with audio transcription — produce structured verdict with clarification flow

**Requirements:** AI-04, AI-05, AI-06, CLAR-01, CLAR-02, CLAR-03, CLAR-04

**Success Criteria:**
1. AI identifies the part from visual + audio context
2. AI looks up history for the identified part
3. AI determines status (PASS/MONITOR/FAIL/CLARIFY) by cross-referencing what operator said vs what AI sees
4. When AI detects disagreement → triggers CLARIFY status with specific question
5. Clarification feedback loop: user records follow-up → AI re-analyzes with full context
6. Result includes: what AI missed (if anything), status, and actionable recommendation
7. Chain-of-thought reasoning is visible

**Build order:**
1. Engineer cross-reference prompt (audio says X, visual shows Y → analysis)
2. Build `/api/analyze` endpoint combining visual + audio results
3. Implement clarification detection (disagreement triggers)
4. Create AlertDropdown component for CLARIFY status
5. Build `/api/clarify` endpoint with context chaining
6. Add processing animation during AI wait

---

### Phase 4: Memory, History & UI

**Goal:** Supermemory integration for historical comparison, full three-tab app with checklist

**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04, LIST-01, LIST-02, LIST-03, UI-01, UI-03, UI-05

**Success Criteria:**
1. Inspection results stored in Supermemory with component tags and timestamps
2. AI analysis includes comparison against previous inspections (wear tracking)
3. Three-tab navigation: Record → Checklist → History
4. Checklist updates live after each inspection
5. History view shows past inspections per component
6. Pre-seeded demo data for target components

**Build order:**
1. Integrate Supermemory SDK
2. Store inspection results after each analysis
3. Query history by component during analysis
4. Build tab navigation
5. Build Checklist component with status badges
6. Build History view
7. Seed demo data

---

### Phase 5: Demo Preparation & Testing

**Goal:** Three rehearsed demo scenarios with physical props, backup plans

**Requirements:** DEMO-01, DEMO-02, DEMO-03

**Success Criteria:**
1. Hydraulic leak scenario: AI overrides user's "looks good" → FAIL
2. Bucket teeth scenario: AI detects accelerated wear from history → MONITOR
3. Air filter scenario: AI triggers CLARIFY → user speaks → status updates
4. Full dress rehearsal completed on actual mobile device

**Build order:**
1. Script each demo scenario
2. Prepare physical props
3. Verify pre-seeded history matches demo
4. Run each scenario 3 times end-to-end
5. Create backup plan (screenshots/recording)
6. Time full demo (target: 3-5 minutes)

---

## Phase Dependencies

```
Phase 1 (Capture) ✅ ──────────────────────────────────┐
                                                        ↓
Phase 2 (Input Parsing) ───────────────────────────────┤
                                                        ↓
Phase 3 (AI Analysis & Results) ───────────────────────┤
                                                        ↓
Phase 4 (Memory, History & UI) ────────────────────────┤
                                                        ↓
Phase 5 (Demo Preparation) ────────────────────────────┘
```

---
*Roadmap created: 2026-02-27*
*Last updated: 2026-02-28 — realigned phases to match whiteboard pipeline*
