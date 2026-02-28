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
| 3 | AI Analysis & Results | Cross-reference, identify checklist item, structured verdict (2.5 Flash) | AI-04, AI-05, AI-06, CLAR-01–04 |
| 4 | Memory, History & UI | Supermemory integration, standard Cat checklist, history view | HIST-01–04, LIST-01–04, UI-01, UI-03, UI-05 |
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

### Phase 3: AI Analysis & Results (Checkpoint Reverted - Rebuilding)

**Goal:** Cross-reference visual & audio, map found components to the Cat checklist framework, and produce structured verdict with clarification flow (using Gemini 2.5 Flash).

**Requirements:** AI-04, AI-05, AI-06, CLAR-01, CLAR-02, CLAR-03, CLAR-04

**Success Criteria:**
1. AI identifies the part from visual + audio context and maps it to the standard Caterpillar inspection checklist
2. AI looks up history for the identified part
3. AI determines status (PASS/MONITOR/FAIL/CLARIFY) by cross-referencing what operator said vs what AI sees
4. AI grades the identified item (Green/Yellow/Red) based on the assessment
5. When AI detects disagreement (e.g., visual is worse than audio assessment) → triggers CLARIFY status with specific question
6. Clarification feedback loop: user records follow-up → AI re-analyzes with full context
7. Result includes: mapped checklist item, status grading (Green/Yellow/Red), and actionable recommendation
8. Chain-of-thought reasoning is visible

**Build order:**
1. Upgrade to `gemini-2.5-flash` model and build `/api/analyze` combining visual + audio
2. Engineer cross-reference prompt (audio vs visual) returning mapped checklist component and grade
3. Implement clarification detection (disagreement triggers)
4. Create AlertDropdown component for CLARIFY status
5. Build `/api/clarify` endpoint with context chaining
6. Add processing animation during AI wait

---

### Phase 4: Memory, History & UI

**Goal:** Supermemory integration for historical comparison, standard Cat checklist rendering, tabs, history view

**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04, LIST-01, LIST-02, LIST-03, LIST-04, UI-01, UI-03, UI-05

**Success Criteria:**
1. Inspection results stored in Supermemory with component tags and timestamps
2. AI analysis includes comparison against previous inspections (wear tracking)
3. Three-tab navigation: Record → Checklist → History
4. Checklist matches the Cat framework (From the Ground, Engine Compartment, Inside Cab, etc.)
5. Items graded dynamically in real-time (Green=Pass, Yellow=Monitor, Red=Fail) based on analysis
6. History view shows past inspections per component
7. Pre-seeded demo data for target components

**Build order:**
1. Integrate Supermemory SDK and store inspection results
2. Query history by component during analysis
3. Build tab navigation
4. Build standard Cat Checklist component with dynamic color-coded status badges (Green/Yellow/Red)
5. Build History view
6. Seed demo data

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
