# Cat Vision-Inspect AI

> **HackIllinois 2026 — Caterpillar Track**

A multimodal, proactive inspection agent for Caterpillar heavy equipment. Replaces manual paper checklists with an AI "Truth Engine" that verifies equipment safety component-by-component using video and voice analysis.

Designed for harsh field conditions (–10°F, heavy gloves) with a glove-friendly, zero-precision-tap interface. The core value lies in catching what humans miss — comparing today's inspection against historical baselines to detect accelerated wear and prevent failures.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Endpoints](#api-endpoints)
- [Demo Scenarios](#demo-scenarios)
- [Architecture](#architecture)
- [License](#license)

---

## Features

- **Glove-Friendly Capture** — Full-screen tap to start/stop 5–10 second video clips. No precision tapping required.
- **AI Reasoning Engine** — Gemini 2.5 Flash analyzes video frames and compares the operator's spoken assessment against visual evidence.
- **Clarification Loop** — If the AI detects discrepancies (e.g., operator says "looks good" but AI sees a leak), it triggers a follow-up question the operator answers via voice.
- **Live Feedback Overlay** — Real-time component identification while recording, showing confidence level and remaining checklist items.
- **PDF-Fidelity Reporting** — The Report tab mirrors an official Caterpillar TA1 Daily Walkaround checklist, updating in real time as components are inspected.
- **Digital Twin / History** — Historical wear tracking via Supermemory API; visualize component health over time and flag accelerated wear.
- **Proactive Alerts** — iOS-style drop-down notifications for FAIL or CLARIFY statuses, visible across all tabs.

---

## Tech Stack

| Layer         | Technology                                          |
| ------------- | --------------------------------------------------- |
| Frontend      | React 19 (Vite 7) + Vanilla CSS                    |
| Backend       | Python 3 / Flask                                    |
| AI Engine     | Google Gemini 2.5 Flash (Multimodal: Video + Audio) |
| Memory/History| Supermemory API                                     |
| Platform      | Mobile-optimized Web App                            |

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- A **Google Gemini API key** (for the AI analysis engine)
- A **Supermemory API key** (for historical inspection storage)

---

## Project Structure

```
├── backend/
│   ├── app.py                  # Flask API server (port 5001)
│   ├── requirements.txt        # Python dependencies
│   ├── services/
│   │   ├── gemini_service.py   # Gemini multimodal AI integration
│   │   ├── memory_service.py   # Supermemory history/persistence
│   │   ├── claude_service.py   # Claude AI service (secondary)
│   │   └── training_data.py    # TA1 checklist reference data
│   ├── uploads/                # Saved inspection frames & audio
│   └── seed_demo_scenarios.py  # Seed synthetic demo history
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx             # Root component + tab navigation
│       ├── components/
│       │   ├── CaptureZone.jsx     # Camera viewfinder + recording
│       │   ├── ReportView.jsx      # TA1 checklist report
│       │   ├── HistoryView.jsx     # Digital twin timeline
│       │   ├── AlertDropdown.jsx   # Proactive notification overlay
│       │   └── LiveFeedback.jsx    # Real-time recording overlay
│       ├── hooks/              # Custom React hooks
│       ├── services/           # API client helpers
│       └── constants/          # Checklist item definitions
│
├── data/                       # Test data (images by grade)
├── old_planning/               # Archived planning documents
├── OVERVIEW.md                 # High-level project overview
├── PHASE_PLAN.md               # Implementation phase plan
└── LIVE_FEEDBACK_PLAN.md       # Live feedback feature spec
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd HackAstraILL2026
```

### 2. Backend Setup

```bash
cd backend

# Create and activate a virtual environment (recommended)
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

---

## Environment Variables

Create a `.env` file in the **`backend/`** directory with the following keys:

```env
GEMINI_API_KEY=your_google_gemini_api_key
SUPERMEMORY_API_KEY=your_supermemory_api_key
```

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `GEMINI_API_KEY`      | Google Gemini API key for multimodal AI analysis  |
| `SUPERMEMORY_API_KEY` | Supermemory API key for historical data storage   |

---

## Running the App

You need **two terminals** — one for the backend and one for the frontend.

### Start the Backend (Flask API)

```bash
cd backend
python app.py
```

The API server starts at **http://localhost:5001**.

### Start the Frontend (Vite Dev Server)

```bash
cd frontend
npm run dev
```

The frontend starts at **http://localhost:5173** and is accessible from any device on the local network (Vite binds to `0.0.0.0`).

### Access the App

Open **http://localhost:5173** in a mobile browser (or use Chrome DevTools device emulation) for the best experience. The UI is optimized for mobile viewports.

---

## API Endpoints

| Method | Endpoint               | Description                                      |
| ------ | ---------------------- | ------------------------------------------------ |
| GET    | `/api/health`          | Health check — returns server status              |
| POST   | `/api/analyze`         | Full AI inspection pipeline (frames + audio)      |
| POST   | `/api/identify`        | Lightweight real-time component identification    |
| POST   | `/api/clarify`         | Follow-up audio clarification for an inspection   |
| POST   | `/api/save-inspection` | Persist inspection results without running AI     |
| GET    | `/api/history`         | Fetch history for a specific component            |
| GET    | `/api/history/dates`   | List dates with inspection records                |
| GET    | `/api/history/by-date` | Fetch all inspections for a given date            |
| POST   | `/api/history/clear`   | Delete inspection records for a specific date     |

---

## Demo Scenarios

The app is designed around three key demo scenarios using a Cat Wheel Loader:

### Scenario A: Hydraulic Leak Detection (AI Override)
The operator says "looks good," but the AI detects dark fluid pooling at a cylinder seal and **overrides** the user's assessment → **FAIL**.

### Scenario B: Bucket Teeth Wear (History Comparison)
AI compares today's bucket teeth geometry against historical baseline, detects accelerated wear → **MONITOR** with part replacement recommendation.

### Scenario C: Air Filter Clarification (Human-in-the-Loop)
Dust indicator level is ambiguous in the video. AI triggers a clarification alert; operator responds via voice → **PASS** after clarification.

To seed demo history data:

```bash
cd backend
python seed_demo_scenarios.py
```

---

## Architecture

```
┌─────────────────────────────────┐
│         Mobile Browser          │
│   (React + Vite Dev Server)     │
│                                 │
│  ┌───────────┬────────┬───────┐ │
│  │  Capture  │ Report │History│ │
│  │   Zone    │  View  │ View  │ │
│  └─────┬─────┴────────┴───┬───┘ │
│        │   LiveFeedback    │     │
│        │   AlertDropdown   │     │
└────────┼───────────────────┼─────┘
         │  HTTP / REST      │
         ▼                   ▼
┌─────────────────────────────────┐
│       Flask API (port 5001)     │
│                                 │
│  /analyze  /identify  /clarify  │
│  /history  /save-inspection     │
│                                 │
│  ┌──────────┐  ┌──────────────┐ │
│  │  Gemini  │  │ Supermemory  │ │
│  │ Service  │  │   Service    │ │
│  └──────────┘  └──────────────┘ │
└─────────────────────────────────┘
         │                │
         ▼                ▼
   Google Gemini    Supermemory API
   2.5 Flash        (History DB)
```

**Inspection Flow:**
1. Operator taps screen to record a 5–10s clip while speaking their assessment.
2. Frontend sends frames + audio to `/api/analyze`.
3. Gemini performs visual analysis, audio transcription, and cross-reference against the TA1 checklist.
4. Supermemory is queried for historical data; a delta review detects accelerated wear.
5. Results populate the Report View in real time. Alerts fire for FAIL/CLARIFY statuses.
6. Operator can respond to clarifications via voice — no typing required.

---

## Build for Production

```bash
cd frontend
npm run build
```

The production bundle is output to `frontend/dist/`.

---

## License

This project was built for HackIllinois 2026.
