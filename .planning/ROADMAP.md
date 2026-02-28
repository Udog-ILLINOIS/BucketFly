# Roadmap: Cat Vision-Inspect AI

**Created:** 2026-02-27
**Depth:** Standard (5 phases)
**Core Value:** AI-powered safety verification that catches what humans miss

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation & Capture | Working video+audio capture on mobile web | CAPT-01–05, UI-02, UI-04 | 7 |
| 2 | AI Pipeline | Gemini-powered inspection analysis with clarification | AI-01–06, CLAR-01–04, UI-03, UI-05 | 11 |
| 3 | Memory & History | Supermemory integration for historical comparison | HIST-01–04 | 4 |
| 4 | Integration & UI | Full app with tabs, checklist, alert system | LIST-01–03, UI-01 | 4 |
| 5 | Demo Preparation | Three polished demo scenarios with rehearsal | DEMO-01–03 | 4 |

**5 phases** | **30 requirements mapped** | All v1 requirements covered ✓

---

## Phase Details

### Phase 1: Foundation & Capture

**Goal:** Working video+audio capture app on mobile browser with glove-friendly full-screen tap interface

**Requirements:** CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, UI-02, UI-04

**Success Criteria:**
1. User can tap full-screen zone on mobile phone and record a 5-10s video+audio clip
2. App is accessible over HTTPS via ngrok on a real mobile device
3. Camera and microphone permissions are requested and granted
4. Recording indicator (visual pulse/border) is visible during capture
5. Captured clip is retrievable as a blob for upload
6. UI has high-contrast, large-touch-target design suitable for gloved use
7. Responsive layout fills mobile screen without scrolling during capture

**Build order:**
1. Scaffold React + Vite project
2. Implement MediaRecorder capture hook
3. Build full-screen CaptureZone component
4. Set up Flask backend skeleton
5. Configure ngrok HTTPS tunnel
6. Test on physical mobile device

---

### Phase 2: AI Pipeline (Gemini Integration)

**Goal:** Backend processes video+audio clips through Gemini 2.0 and returns structured analysis with clarification flow

**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, CLAR-01, CLAR-02, CLAR-03, CLAR-04, UI-03, UI-05

**Success Criteria:**
1. Flask `/api/inspect` endpoint accepts video blob and returns structured JSON
2. Gemini transcribes spoken assessment accurately
3. Gemini analyzes video frames and identifies component condition
4. Gemini cross-references audio vs. visual and detects disagreements
5. Response includes: component name, status (PASS/MONITOR/FAIL/CLARIFY), confidence score, reasoning
6. When status is CLARIFY, frontend shows dropdown alert with AI's question
7. User can record follow-up clip; AI re-analyzes with full context
8. Processing animation displays during 3-15 second AI wait
9. Chain-of-thought reasoning is visible to user after analysis

**Build order:**
1. Implement Gemini service (Python) with structured output schema
2. Create `/api/inspect` Flask route
3. Engineer inspection prompt with CoT and confidence scoring
4. Build AlertDropdown component for clarification
5. Create `/api/clarify` Flask route with context chaining
6. Add processing animation component
7. Test with sample video clips

---

### Phase 3: Memory & History (Supermemory)

**Goal:** Supermemory stores inspection results and enables historical comparison for wear tracking

**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04

**Success Criteria:**
1. Inspection results are stored in Supermemory with component tags and timestamps
2. AI analysis includes comparison against most recent previous inspection
3. History view displays past inspection logs per component
4. Pre-seeded demo data exists for hydraulic cylinder, bucket teeth, and air filter

**Build order:**
1. Integrate Supermemory SDK in Flask backend
2. Create memory storage service (store after each inspection)
3. Create memory retrieval service (query by component)
4. Seed demo history data for 3 target components
5. Add historical context to Gemini prompt
6. Build History tab view in frontend

---

### Phase 4: Integration & UI Polish

**Goal:** Full three-tab app with dynamic checklist, polished alerts, and smooth navigation

**Requirements:** LIST-01, LIST-02, LIST-03, UI-01

**Success Criteria:**
1. Three-tab navigation works: Record → Checklist → History
2. Checklist shows all inspected components with color-coded status badges
3. Checklist updates in real-time after each component inspection
4. Each checklist item shows component name, status badge, and confidence

**Build order:**
1. Implement tab navigation (Record / Checklist / History)
2. Build Checklist component with status badges
3. Wire checklist to inspection state (live updates)
4. Polish alert dropdown animation
5. Mobile UX pass (font sizes, contrast, spacing)

---

### Phase 5: Demo Preparation & Testing

**Goal:** Three rehearsed demo scenarios with physical props, backup plans, and presentation materials

**Requirements:** DEMO-01, DEMO-02, DEMO-03

**Success Criteria:**
1. Hydraulic leak scenario works end-to-end (AI overrides user's "looks good" → FAIL)
2. Bucket teeth scenario works end-to-end (AI detects accelerated wear from history → MONITOR)
3. Air filter scenario works end-to-end (AI triggers CLARIFY → user speaks → status updates)
4. Full dress rehearsal completed with physical props on actual mobile device

**Build order:**
1. Script each demo scenario step-by-step
2. Prepare physical props (water/oil for leak, blunted object for teeth, cup with dirt for filter)
3. Verify pre-seeded history matches demo props
4. Run each scenario end-to-end 3 times
5. Create backup plan (screenshots/recording if live demo fails)
6. Time the full demo (target: 3-5 minutes)

---

## Phase Dependencies

```
Phase 1 (Capture) ──────────────────────────────────────┐
                                                         ↓
Phase 2 (AI Pipeline) ──────────────────────────────────┤
                                                         ↓
Phase 3 (Memory & History) ────────────────────────────┤
                                                         ↓
Phase 4 (Integration & UI) ────────────────────────────┤
                                                         ↓
Phase 5 (Demo Preparation) ────────────────────────────┘
```

Phases are sequential — each depends on the previous phase's deliverables.

---
*Roadmap created: 2026-02-27*
*Last updated: 2026-02-27 after initial creation*
