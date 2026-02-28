# Cat Vision-Inspect AI

## What This Is

A multimodal, proactive inspection agent for Caterpillar heavy equipment built for the HackIllinois 2026 Caterpillar Track. The app replaces manual paper checklists with an AI "Truth Engine" that verifies equipment safety component-by-component using video + voice analysis. Designed for harsh field conditions (-10°F, heavy gloves) with a glove-friendly, zero-precision-tap interface.

## Core Value

AI-powered safety verification that catches what humans miss — comparing today's inspection against historical baselines to detect accelerated wear, override incorrect assessments, and prevent equipment failures before they cause injury.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Glove-friendly capture interface (volume button trigger, no precision taps)
- [ ] Video + audio recording of individual components (5-10s clips)
- [ ] AI transcription of spoken assessment (intent extraction)
- [ ] AI visual verification against spoken assessment (anomaly detection)
- [ ] Historical comparison (pull previous day's logs/images for wear tracking)
- [ ] Component-level status system (Green/Yellow/Red/Orange)
- [ ] Human-in-the-loop alerts (iOS-style dropdown for AI uncertainty)
- [ ] Audio-based clarification flow (user speaks response, no typing)
- [ ] Dynamic inspection checklist (Tab 2 — live updating as user works)
- [ ] History / Digital Twin view (Tab 3 — visual comparison across days)
- [ ] Structured AI Chain-of-Thought output (intent → verification → history check → alert)
- [ ] Demo scenarios for hydraulic cylinders, bucket teeth, and air filter

### Out of Scope

- Full fleet management dashboard — hackathon scope, single machine focus
- Offline mode / edge deployment — requires internet for AI APIs
- Multi-user roles (admin vs operator) — single user for demo
- Integration with Caterpillar VisionLink API — no access during hackathon
- Weight estimation tiers — pivoted away from this approach

## Context

- **Event**: HackIllinois 2026, 36-hour hackathon, Caterpillar Track
- **Target machine**: Cat 320 Excavator or Cat 950 Wheel Loader
- **Demo strategy**: Three scripted scenarios (hydraulic leak detection, bucket tooth wear tracking, air filter clarification) using mock props
- **Prize targets**: Supermemory integration prize; Caterpillar track prize
- **Field reality**: Workers wear heavy gloves, operate in extreme cold, cannot use touchscreens with precision
- **Inspection standard**: Based on Caterpillar TA1 Daily Walkaround checklist

## Constraints

- **Timeline**: 36 hours (hackathon) — must be demo-ready, not production-ready
- **Platform**: Web app optimized for mobile; demo on phone for judges
- **AI Engine**: Gemini 2.0 Multimodal API (video, audio, structured JSON output)
- **Backend**: Python Flask bridging frontend, database, and AI
- **Frontend**: React (or React Native for mobile-first)
- **Memory/History**: Supermemory API (or local JSON fallback) for component logs and image storage
- **Hardware input**: Must support physical volume button for start/stop recording

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Volume button for capture instead of tap | Workers wear heavy gloves in -10°F; precision tapping is impossible | — Pending |
| Audio-only clarification (no keyboard) | Same glove constraint; voice is the only reliable input method | — Pending |
| Component-by-component processing | Discrete analysis is more accurate than full-machine scan | — Pending |
| Gemini 2.0 over OpenAI | Multimodal (video + audio + structured output) in single API | — Pending |
| Supermemory for historical tracking | Prize target + natural fit for component degradation history | — Pending |
| Mock props for demo | Can't bring real excavator to hackathon; scripted scenarios prove the concept | — Pending |

---
*Last updated: 2026-02-27 after initialization*
