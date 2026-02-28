---
phase: 03-ai-analysis-results
plan: 02
subsystem: api
tags: [gemini, flask, multi-turn, clarification, python]

# Dependency graph
requires:
  - phase: 03-01
    provides: GeminiService with cross_reference(), /api/analyze saving frames+analysis.json to disk

provides:
  - clarify_with_context() method on GeminiService using Gemini multi-turn contents array
  - CLARIFY_PROMPT constant prohibiting recursive CLARIFY returns
  - /api/clarify Flask endpoint reading saved inspection from disk and running re-analysis
  - CLARIFY loop guard forcing MONITOR when Gemini returns CLARIFY in clarification turn

affects: [04-integration-ui, frontend clarification flow, demo-03-air-filter-scenario]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gemini multi-turn conversation via types.Content list with user/model roles"
    - "CLARIFY loop guard: server-side enforcement prevents infinite clarification recursion"
    - "Disk-first frame loading: clarification reuses persisted frames, not re-uploaded"

key-files:
  created: []
  modified:
    - backend/services/gemini_service.py
    - backend/app.py

key-decisions:
  - "Reuse CROSSREF_SCHEMA for clarification response (same shape, final_status excludes CLARIFY)"
  - "Server forces MONITOR (not FAIL) when Gemini recurses into CLARIFY — safer default"
  - "Max 5 frames in clarification turn (token limit guard vs. original 3 in cross_reference)"

patterns-established:
  - "Multi-turn: user turn with frames+context, model turn echoing prior verdict, user turn with new audio"
  - "Loop guards for AI status recursion: server-side forcing prevents undefined feedback cycles"

requirements-completed: [CLAR-03, CLAR-04]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 3 Plan 02: Clarification Feedback Loop Backend Summary

**Gemini 3-turn multi-turn clarification re-analysis with CLARIFY loop guard, closing the DEMO-03 air filter scenario**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T07:21:52Z
- **Completed:** 2026-02-28T07:23:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `CLARIFY_PROMPT` constant with explicit prohibition on returning CLARIFY again
- Added `clarify_with_context()` method building a 3-turn Gemini multi-turn contents array (original frames + context, prior verdict as model turn, clarification audio + instruction)
- Added `/api/clarify` Flask endpoint that loads saved inspection from disk, calls clarify_with_context(), and applies a CLARIFY loop guard forcing MONITOR if Gemini recurses

## Task Commits

Each task was committed atomically:

1. **Task 1: Add clarify_with_context() to GeminiService** - `2378bf4` (feat)
2. **Task 2: Add /api/clarify endpoint to app.py** - `cead500` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `backend/services/gemini_service.py` - Added CLARIFY_PROMPT constant and clarify_with_context() method with 3-turn Gemini multi-turn logic
- `backend/app.py` - Added /api/clarify route with frame loading, prior analysis loading, CLARIFY loop guard, and structured response

## Decisions Made
- Reused CROSSREF_SCHEMA for clarification response shape — same fields, final_status enum excludes CLARIFY at runtime via loop guard
- Server forces MONITOR (not FAIL) when Gemini returns CLARIFY in clarification turn — MONITOR is the safer conservative choice for ambiguous operator responses
- Load top 5 frames (not 3 as in cross_reference) to give the clarification turn richer visual context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full clarification feedback loop is complete: /api/analyze → CLARIFY → /api/clarify → PASS/MONITOR/FAIL
- Frontend can now send inspection_id + audio to /api/clarify and receive a definitive final status
- Ready for Phase 4 integration: UI wiring for the clarification recording flow

---
*Phase: 03-ai-analysis-results*
*Completed: 2026-02-28*

## Self-Check: PASSED

- backend/services/gemini_service.py: FOUND
- backend/app.py: FOUND
- .planning/phases/03-ai-analysis-results/03-02-SUMMARY.md: FOUND
- Commit 2378bf4 (Task 1): FOUND
- Commit cead500 (Task 2): FOUND
