# Architecture Research

**Domain:** Multimodal AI Equipment Inspection (Mobile Web + Python Backend)
**Researched:** 2026-02-27
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MOBILE WEB CLIENT (React)                │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Capture  │  │ Checklist│  │ History  │  │  Alerts  │   │
│  │  Zone    │  │  View    │  │  View    │  │  System  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │              │              │         │
├───────┴──────────────┴──────────────┴──────────────┴─────────┤
│                     API SERVICE LAYER                         │
│            (fetch calls to Flask backend)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              FLASK BACKEND (Python)                  │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │     │
│  │  │ Gemini   │  │  Super   │  │  Report  │          │     │
│  │  │ Service  │  │  Memory  │  │  Builder │          │     │
│  │  │          │  │  Service │  │          │          │     │
│  │  └──────────┘  └──────────┘  └──────────┘          │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                     EXTERNAL SERVICES                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Gemini   │  │  Super   │  │  Local   │                   │
│  │ 2.0 API  │  │  Memory  │  │  JSON DB │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Capture Zone | Video/audio recording, full-screen tap trigger | React component with MediaRecorder API |
| Checklist View | Display component statuses, live updating | React state with status array |
| History View | Show past inspections, side-by-side comparison | Supermemory query + image grid |
| Alert System | iOS-style dropdown notifications for AI uncertainty | React portal/overlay component |
| Gemini Service | Send video+audio to Gemini, parse structured response | Python class wrapping google-genai SDK |
| SuperMemory Service | Store/retrieve component logs, query history | Python class wrapping supermemory SDK |
| Report Builder | Aggregate component results into inspection report | Python data aggregation |

## Recommended Project Structure

```
HackAstraILL2026/
├── frontend/                # React web app
│   ├── src/
│   │   ├── components/      # UI components
│   │   │   ├── CaptureZone.jsx
│   │   │   ├── Checklist.jsx
│   │   │   ├── HistoryView.jsx
│   │   │   ├── AlertDropdown.jsx
│   │   │   └── StatusBadge.jsx
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useMediaCapture.js
│   │   │   └── useInspection.js
│   │   ├── services/        # API calls to backend
│   │   │   └── api.js
│   │   ├── App.jsx          # Main app with tab routing
│   │   └── main.jsx         # Entry point
│   ├── public/
│   └── package.json
├── backend/                 # Flask API server
│   ├── app.py               # Flask app & routes
│   ├── services/
│   │   ├── gemini_service.py    # Gemini API integration
│   │   ├── memory_service.py    # Supermemory integration
│   │   └── report_service.py    # Report aggregation
│   ├── models/
│   │   └── inspection.py    # Data models
│   ├── seed_data/           # Pre-seeded demo history
│   │   └── demo_history.json
│   └── requirements.txt
├── .planning/               # GSD planning docs
└── INIT.md
```

### Structure Rationale

- **frontend/backend split:** Separate concerns; React handles UI, Flask handles AI processing
- **services/ pattern:** Each external service gets its own module for clean abstraction
- **seed_data/:** Pre-loaded history for hackathon demo; avoids needing real historical data
- **hooks/:** Encapsulate media capture and inspection state logic

## Architectural Patterns

### Pattern 1: Clip-Based Processing Pipeline

**What:** Each inspection is a discrete 5-10s video clip processed through a pipeline
**When to use:** Every component inspection
**Trade-offs:** Simple to implement, but no real-time analysis

```
[Record Clip] → [Upload to Backend] → [Gemini Analysis] → [Memory Check] → [Return Result]
```

### Pattern 2: Structured AI Output Schema

**What:** Gemini returns JSON following a strict schema for every analysis
**When to use:** Every Gemini API call
**Trade-offs:** Predictable parsing, but schema must be pre-defined

```python
response_schema = {
    "component": str,       # What was inspected
    "spoken_assessment": str, # What the user said
    "visual_assessment": str, # What the AI saw
    "agreement": bool,       # Does AI agree with user?
    "status": "PASS|MONITOR|FAIL|CLARIFY",
    "confidence": float,     # 0.0 - 1.0
    "reasoning": str,        # Chain of thought
    "alert_message": str,    # If CLARIFY, what to ask
}
```

### Pattern 3: Pre-Seeded History for Demo

**What:** Load fake historical data into Supermemory before demo
**When to use:** Hackathon demo setup
**Trade-offs:** Impressive demo, but not real data

## Data Flow

### Inspection Flow

```
[User taps to record] → [MediaRecorder captures video+audio]
    ↓
[Upload blob to Flask /api/inspect endpoint]
    ↓
[Flask → Gemini: "Analyze this video+audio, return JSON"]
    ↓
[Gemini returns structured analysis]
    ↓
[Flask → Supermemory: "Get history for this component"]
    ↓
[Flask compares: today's analysis vs. historical baseline]
    ↓
[Flask returns: status, reasoning, alert (if needed)]
    ↓
[React updates checklist, shows alert if CLARIFY]
```

### Clarification Flow

```
[Alert shown to user: "Is that rust or mud?"]
    ↓
[User taps to record clarification clip]
    ↓
[Upload to Flask /api/clarify endpoint with context]
    ↓
[Gemini analyzes new clip + previous context]
    ↓
[Status updated, alert dismissed]
```

## Anti-Patterns

### Anti-Pattern 1: Streaming Video to AI

**What people do:** Try to send a continuous video stream to Gemini
**Why it's wrong:** Expensive, slow, unnecessary for discrete inspections
**Do this instead:** Discrete 5-10s clips, processed one at a time

### Anti-Pattern 2: Client-Side AI Processing

**What people do:** Try to run AI models directly in the browser
**Why it's wrong:** Mobile browsers can't handle it; Gemini requires server-side calls
**Do this instead:** Send media to Flask backend, which calls Gemini API

### Anti-Pattern 3: Relying on Browser Storage for History

**What people do:** Use localStorage for inspection history
**Why it's wrong:** Lost on device change, no cross-session persistence for demo
**Do this instead:** Use Supermemory API or at minimum a JSON file on the server

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Gemini 2.0 API | REST via Python SDK | Send video blob + audio, receive structured JSON |
| Supermemory API | REST via SDK | Store memories with tags, query by component name |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Backend | REST API (JSON) | Video/audio sent as multipart form data |
| Backend ↔ Gemini | Python SDK | Async call, may take 3-10s per clip |
| Backend ↔ Supermemory | Python SDK | Fast queries for history retrieval |

## Sources

- Google AI Gemini documentation
- Supermemory.ai developer docs
- React MediaRecorder API patterns

---
*Architecture research for: Multimodal AI Equipment Inspection*
*Researched: 2026-02-27*
