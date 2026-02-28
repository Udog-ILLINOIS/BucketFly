# Requirements: Cat Vision-Inspect AI

**Defined:** 2026-02-27
**Core Value:** AI-powered safety verification that catches what humans miss — comparing today's inspection against historical baselines to detect accelerated wear, override incorrect assessments, and prevent equipment failures.

## v1 Requirements

Requirements for HackIllinois 2026 demo. Each maps to roadmap phases.

### Capture

- [ ] **CAPT-01**: User can tap full-screen zone to start/stop video+audio recording
- [ ] **CAPT-02**: App captures video (camera) and audio (microphone) simultaneously as a single clip
- [ ] **CAPT-03**: Recording clip is 5-10 seconds with visual recording indicator
- [ ] **CAPT-04**: App works on mobile browser via HTTPS (ngrok tunnel)
- [ ] **CAPT-05**: Camera/microphone permissions are requested and handled gracefully

### AI Analysis

- [ ] **AI-01**: Backend receives video+audio clip and sends to Gemini 2.0 for analysis
- [ ] **AI-02**: Gemini transcribes user's spoken assessment (intent extraction)
- [ ] **AI-03**: Gemini analyzes video frames for visual evidence of component condition
- [x] **AI-04**: Gemini cross-references spoken assessment vs. visual evidence
- [x] **AI-05**: Gemini returns structured JSON with: component, status, confidence, reasoning
- [x] **AI-06**: Status system supports four states: PASS (green), MONITOR (yellow), FAIL (red), CLARIFY (orange)

### Clarification Flow

- [ ] **CLAR-01**: When AI status is CLARIFY, an alert notification drops down from top of screen
- [ ] **CLAR-02**: Alert displays AI's question (e.g., "Is that rust or mud?")
- [x] **CLAR-03**: User records a follow-up video clip to clarify (voice response, no typing)
- [x] **CLAR-04**: AI re-analyzes with original + clarification context and updates status

### Checklist

- [ ] **LIST-01**: Dynamic checklist displays all inspected components with color-coded status
- [ ] **LIST-02**: Checklist updates in real-time as components are inspected
- [ ] **LIST-03**: Each checklist item shows component name, status badge, and AI confidence

### History & Memory

- [ ] **HIST-01**: Supermemory stores inspection results with component tags and timestamps
- [ ] **HIST-02**: AI compares today's inspection against previous day's baseline
- [ ] **HIST-03**: History view shows past inspection logs per component
- [ ] **HIST-04**: Pre-seeded demo history exists for 3 target components

### UI/UX

- [ ] **UI-01**: Three-tab navigation: Record / Checklist / History
- [ ] **UI-02**: High-contrast, glove-friendly design (large touch targets, minimal text)
- [ ] **UI-03**: Processing animation shown during AI analysis (3-15 second wait)
- [ ] **UI-04**: Mobile-optimized responsive layout
- [ ] **UI-05**: Chain-of-Thought reasoning visible to user (AI transparency)

### Demo Scenarios

- [ ] **DEMO-01**: Hydraulic cylinder leak scenario — AI overrides user's "looks good" with FAIL
- [ ] **DEMO-02**: Bucket teeth wear scenario — AI detects accelerated wear from history comparison
- [ ] **DEMO-03**: Air filter clarification scenario — AI triggers CLARIFY alert, user responds verbally

## v2 Requirements

Deferred to post-hackathon. Tracked but not in current roadmap.

### Fleet Management

- **FLEET-01**: Multi-machine support (select machine before inspection)
- **FLEET-02**: Site manager dashboard with fleet-wide status

### Reporting

- **RPT-01**: Exportable PDF inspection report
- **RPT-02**: Email/push notification for FAIL statuses

### Advanced AI

- **ADV-01**: Real-time continuous video processing (streaming mode)
- **ADV-02**: Offline mode with edge AI model
- **ADV-03**: AR overlay highlighting components to inspect

### Integration

- **INT-01**: Caterpillar VisionLink API integration for part data
- **INT-02**: Machine lift capacity database for weight-based recommendations

## Out of Scope

| Feature | Reason |
|---------|--------|
| Volume button hardware capture | Impossible in mobile web browsers; full-screen tap replaces this |
| Native mobile app (React Native) | Build time too long for 36-hour hackathon |
| User authentication/login | Single-user demo, no auth needed |
| Real-time streaming video analysis | Battery/bandwidth cost; discrete clips are sufficient |
| Offline/edge deployment | Requires internet for Gemini API |
| Multi-language support | English-only for hackathon |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAPT-01 | Phase 1 | Pending |
| CAPT-02 | Phase 1 | Pending |
| CAPT-03 | Phase 1 | Pending |
| CAPT-04 | Phase 1 | Pending |
| CAPT-05 | Phase 1 | Pending |
| AI-01 | Phase 2 | Pending |
| AI-02 | Phase 2 | Pending |
| AI-03 | Phase 2 | Pending |
| AI-04 | Phase 3 | Complete |
| AI-05 | Phase 3 | Complete |
| AI-06 | Phase 3 | Complete |
| CLAR-01 | Phase 2 | Pending |
| CLAR-02 | Phase 2 | Pending |
| CLAR-03 | Phase 2 | Complete |
| CLAR-04 | Phase 2 | Complete |
| LIST-01 | Phase 4 | Pending |
| LIST-02 | Phase 4 | Pending |
| LIST-03 | Phase 4 | Pending |
| HIST-01 | Phase 3 | Pending |
| HIST-02 | Phase 3 | Pending |
| HIST-03 | Phase 3 | Pending |
| HIST-04 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 2 | Pending |
| UI-04 | Phase 1 | Pending |
| UI-05 | Phase 2 | Pending |
| DEMO-01 | Phase 5 | Pending |
| DEMO-02 | Phase 5 | Pending |
| DEMO-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after initial definition*
