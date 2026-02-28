# Implementation Plan: Digital Twin & Proactive AI (Revised)

## 🏗️ Phase 0: Mobile Migration & UI Overhaul
**Goal:** Transition the current web app to a true mobile-first interface matching the provided design references.
- **Task 0.1:** Update CSS architecture to handle mobile viewports strictly (e.g., locking orientation, preventing pull-to-refresh).
- **Task 0.2:** Replicate the UI layout from the provided "Stitch" reference images.
- **Task 0.3:** Ensure the "Glove-Friendly" paradigms (full-screen tap, high-contrast) are perfectly integrated into the new mobile design.

---

## 🛠️ Phase 1: History, "Digital Twin" & Delta Analysis
**Goal:** Implement robust history tracking and calculate "Accelerated Wear" using a two-step AI comparison, matching industry standards.
- **Task 1.1 (Single Analysis):** Perform standard multimodal analysis on *today's* video clip to determine the current state and component.
- **Task 1.2 (Fetch History):** Query Supermemory for the component's *previous* analysis JSON/summary and the key frame used.
- **Task 1.3 (Delta Review):** Pass *today's analysis* and *yesterday's analysis* into a secondary Gemini prompt specifically designed to review differences and output a "Wear Delta" (e.g., identifying if wear is accelerating faster than expected).
- **Task 1.4 (Visual Timeline):** Implement the `HistoryView.jsx` tab to visualize this timeline, showing a vertical feed of past inspections with their corresponding key frames and grades.

---

## 🛠️ Phase 2: Global Alert System
**Goal:** Implement the "iOS-style" proactive notification.
- **Task 2.1:** Create `AlertDropdown.jsx` and `AlertDropdown.css` with a "slide-down" entry animation.
- **Task 2.2:** Add a `notification` state to `App.jsx` (Global Context).
- **Task 2.3:** Trigger the notification whenever an inspection result returns a `FAIL` or `CLARIFY` status, persisting across all tabs.
- **Task 2.4:** Add a "Hold to Answer" or "View Report" action inside the alert.

---

## 🛠️ Phase 3: Demo Seeding & Validation
**Goal:** Prepare for the judges using synthetic but realistic historical data.
- **Task 3.1:** Extract base images from the target GitHub repository.
- **Task 3.2:** Use AI image generation ("Nano/Banana") to create "Yesterday's" (less wear) and "Tomorrow's" (more wear) variations of the base images.
- **Task 3.3:** Create `scripts/seed_demo.py` to populate Supermemory with 3 days of historical data for:
    - *Bucket Teeth:* Progressive blunting.
    - *Hydraulic Cylinder:* A "dry" seal that slowly becomes "wet/leaking".
- **Task 3.4:** Validate the "Override" logic live.

---
*Last Updated: 2026-02-28*