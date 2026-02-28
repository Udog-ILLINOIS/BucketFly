# Stack Research

**Domain:** Multimodal AI Equipment Inspection (Mobile Web)
**Researched:** 2026-02-27
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 18.x / 19.x | Frontend framework | Component-based UI, huge ecosystem, fast dev for hackathon |
| Vite | 5.x | Build tool & dev server | Lightning fast HMR, easy setup with `create-vite`, React template |
| Python Flask | 3.x | Backend API server | Lightweight, quick to prototype, bridges frontend ↔ Gemini API |
| Gemini 2.0 Flash | Latest | Multimodal AI engine | Native video + audio + structured JSON output in single API call |
| Supermemory SDK | Latest | Memory / history layer | Persistent memory API, semantic search, knowledge graph for component history |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-media-recorder` | 1.x | MediaRecorder wrapper | Simplified video/audio capture in React |
| `google-genai` (Python) | Latest | Gemini API client | Server-side multimodal analysis |
| `supermemory` (npm/pip) | Latest | Supermemory client SDK | Store and retrieve component inspection history |
| `flask-cors` | 4.x | CORS middleware | Allow frontend to call Flask API |
| `ffmpeg` (optional) | 6.x | Video processing | Extract frames from video clips if needed |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite dev server | Hot reload during development | Access via mobile on same WiFi for testing |
| ngrok | Expose local server to mobile | Required for camera/mic access (HTTPS) on mobile devices |

## Installation

```bash
# Frontend
npm create vite@latest frontend -- --template react
cd frontend && npm install
npm install react-media-recorder supermemory

# Backend
pip install flask flask-cors google-genai supermemory
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| React + Vite | React Native / Expo | If native volume button access is critical (requires app store deploy) |
| Flask (Python) | Next.js API routes | If you want a single JS stack (but Gemini Python SDK is more mature) |
| Gemini 2.0 | OpenAI GPT-4V | If Gemini API has issues; GPT-4V handles images but video support is weaker |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TensorFlow.js for CV | Reinventing the wheel; Gemini handles vision natively | Gemini 2.0 multimodal API |
| Firebase for history | Overkill for hackathon; Supermemory is simpler and a prize target | Supermemory API |
| WebRTC for capture | Too complex for simple clip recording | MediaRecorder API via `react-media-recorder` |

## Critical Finding: Volume Button Limitation

⚠️ **Hardware volume buttons CANNOT be captured in mobile web browsers (iOS/Android).** This is a security restriction.

**Workaround options:**
1. Large full-screen tap target (glove-friendly — the whole screen is the button)
2. PWA with keyboard shortcut mapping (limited browser support)
3. React Native app (full hardware access, but requires build/deploy)

**Recommendation for hackathon:** Use a massive full-screen tap zone. For demo, this is functionally equivalent and avoids the native app build overhead.

## Sources

- Google AI Developer Docs — Gemini 2.0 multimodal capabilities
- Supermemory.ai documentation — SDK integration guides
- MDN Web Docs — MediaRecorder API, KeyboardEvent limitations
- Stack Overflow — Volume button capture impossibility in mobile web

---
*Stack research for: Multimodal AI Equipment Inspection*
*Researched: 2026-02-27*
