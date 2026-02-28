# GSD: Cat Vision-Inspect AI

## 1. Project Objective
Build a multimodal, proactive inspection agent for the HackIllinois 2026 Caterpillar Track. The app replaces manual checklists with an AI "Truth Engine" that verifies equipment safety component-by-component. It is built strictly for harsh field conditions (-10°F, heavy gloves) and relies on audio-anchored video analysis and historical degradation tracking.

## 2. UI/UX Architecture (The "Glove-Friendly" Paradigm)
The interface is rugged, minimalist, and requires zero precision tapping. It is divided into three primary tabs:

* **Tab 1: Record Report (The Capture Zone)**
    * A massive, high-contrast camera viewfinder. 
    * **Interaction:** *No tap-to-hold.* The user taps anywhere on the screen once to start, or presses the physical **Volume Up/Down button** on the device to start/stop recording. This is a hard requirement for workers in heavy winter gear.
* **Tab 2: View Current Report (The Checklist)**
    * A dynamically updating list of the day's inspection items.
    * Shows Green (Pass), Yellow (Monitor), Red (Fail), and Orange (Needs Clarification) statuses as the user works through the components.
* **Tab 3: History (The Digital Twin)**
    * Displays previous text logs and past video frames/photos of specific components.
    * Allows the site manager or worker to visually compare yesterday's part condition with today's.

## 3. Core Functional Workflow
The application processes data discretely, one component at a time, using the following loop:

1.  **The Trigger:** User presses the volume button to start recording a 5-10 second video of a specific component.
2.  **The Audio Anchor:** The user speaks their assessment (e.g., *"Inspecting the bucket teeth. They look intact, no major cracks."*). The volume button is pressed again to stop.
3.  **The AI Audit (CoT):** * *Intent:* Transcribes audio to know what part we are looking at.
    * *Verification:* Analyzes video frames to confirm the spoken assessment.
    * *History Check:* Pulls the previous day's logs and images from the database to check for accelerated wear.
4.  **The Alert (Human-in-the-Loop):** If the AI detects an anomaly or is uncertain (e.g., *"Is that rust or mud on the cylinder?"*), an iOS-style notification drops down from the top of the screen.
5.  **The Audio Clarification:** *The user does not type a response.* To clarify, the user simply presses the volume button to start a new video clip and speaks the answer: *"Disregard the discoloration, it's just mud from the tracks."* The AI ingests this, updates the CoT, and clears the alert.

## 4. Technical Stack
* **Frontend:** React / React Native (or web app optimized for mobile).
* **Backend:** Python Flask (running locally/Aedify) bridging the frontend, database, and AI.
* **Memory/History:** Supermemory API (or local JSON structure) storing past component logs and image URLs.
* **AI Engine:** Gemini 2.0 Multimodal API (handling video, audio, and JSON structured outputs).

---

## 5. RESEARCH ACTION ITEM: Target Components for Demo
*Goal: Identify the best Caterpillar machine components to build our demo around. They must be highly visual, prone to degradation, and easy to mock up for the judges.*

### Target Machine: Cat 320 Excavator or Cat 950 Wheel Loader


Based on Caterpillar's standard TA1 Daily Walkaround, here are the three best components to feature in our "fake" history database and live demo:

**1. Hydraulic Cylinders & Hoses (The "Leak" Test)**
* **Why it works:** Hydraulic leaks are the #1 cause of downtime. They are highly visual (dark fluid on bright yellow paint or shiny chrome).
* **Demo Scenario:** * *History:* "Cylinder seal dry." 
    * *Today's Video:* You spray some water/oil on a metal pipe. 
    * *AI CoT:* "Audio says 'looks good', but video shows dark liquid pooling at the seal. Overriding user. Status: FAIL - Leak Detected."
    

**2. Bucket Teeth / Ground Engaging Tools (The "Wear" Test)**
* **Why it works:** These parts literally grind against rock all day. They have a predictable wear life.
* **Demo Scenario:**
    * *History:* "Tooth wear at 20%."
    * *Today's Video:* Show a heavily blunted object.
    * *AI CoT:* "Comparing geometry to historical baseline. Wear is accelerating. Status: MONITOR - Order replacement part #9W8552."

**3. Engine Air Pre-Cleaner / Filter (The "Clarification" Test)**
* **Why it works:** Construction sites are dusty. Filters have physical dust indicators (a little clear bowl that fills with dirt).
* **Demo Scenario:**
    * *Today's Video:* You film a plastic cup with some dirt in it.
    * *AI CoT:* "Dust indicator is yellow. Unsure if it crosses the red 'service' line due to shadow."
    * *App Action:* Triggers the iOS dropdown alert: *"Dust level unclear. Does the indicator cross the red line?"*
    * *User Action:* Hits record, says *"No, it's just below the line."* AI passes the component.