"""
Gemini AI Service — F1Tenth Vision-Inspect

Handles audio transcription AND visual analysis / cross-reference.
"""

import os
import json
import base64
import time
from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types


class GeminiService:
    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set in .env")

        self.client = genai.Client(api_key=api_key)
        self.audio_model = 'gemini-2.5-flash-native-audio-preview-09-2025'
        self.vision_model = 'gemini-2.5-flash-lite'
        print(f'[GEMINI] Audio model: {self.audio_model}')
        print(f'[GEMINI] Vision model: {self.vision_model}')

    # ──────────────────────────────────────────────
    # AUDIO TRANSCRIPTION
    # ──────────────────────────────────────────────

    def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> dict:
        start = time.time()

        parts = [
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            AUDIO_TRANSCRIPTION_PROMPT
        ]

        response = self.client.models.generate_content(
            model=self.audio_model,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AUDIO_SCHEMA,
                temperature=0.1,
            )
        )

        elapsed = round(time.time() - start, 2)

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"raw_response": response.text, "parse_error": True}

        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # VISUAL ANALYSIS
    # ──────────────────────────────────────────────

    def analyze_frames(self, frames_b64: list) -> dict:
        start = time.time()

        parts = []
        for frame_b64 in frames_b64:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(raw),
                mime_type="image/jpeg"
            ))
        parts.append(VISUAL_ANALYSIS_PROMPT)

        response = self.client.models.generate_content(
            model=self.vision_model,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VISUAL_SCHEMA,
                temperature=0.1,
            )
        )

        elapsed = round(time.time() - start, 2)

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"preliminary_status": "UNCLEAR", "parse_error": True}

        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # CROSS-REFERENCE
    # ──────────────────────────────────────────────

    def cross_reference(self, visual_analysis: dict, audio_transcription: dict, frames_b64: list, history: list = None) -> dict:
        start = time.time()

        visual_summary = (
            f"VISUAL ANALYSIS:\n"
            f"  Component: {visual_analysis.get('component', 'unknown')}\n"
            f"  Preliminary status: {visual_analysis.get('preliminary_status', 'UNCLEAR')}\n"
            f"  Observations: {', '.join(visual_analysis.get('condition_observations', []))}\n"
            f"  Concerns: {', '.join(visual_analysis.get('concerns', []))}\n"
            f"  Confidence: {visual_analysis.get('confidence', 0)}\n"
            f"  Reasoning: {visual_analysis.get('chain_of_thought', {}).get('conclusion', '')}"
        )

        audio_summary = (
            f"INSPECTOR'S SPOKEN ASSESSMENT:\n"
            f"  Transcript: \"{audio_transcription.get('full_text', 'No audio provided')}\"\n"
            f"  Components mentioned: {[c.get('name', 'unknown') for c in audio_transcription.get('components_mentioned', [])]}"
        )

        history_summary = "HISTORICAL INSPECTION LOGS:\n"
        if not history:
            history_summary += "  No previous inspections found.\n"
        else:
            for item in history:
                grade = item.get("grade", "unknown")
                notes = item.get("operator_notes", "")
                history_summary += f"  - Previous Grade: {grade}, Notes: '{notes}'\n"

        parts = []
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(raw),
                mime_type="image/jpeg"
            ))
        parts.append(f"{visual_summary}\n\n{audio_summary}\n\n{history_summary}\n\n{CROSSREF_PROMPT}")

        response = self.client.models.generate_content(
            model=self.vision_model,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CROSSREF_SCHEMA,
                temperature=0.1,
            )
        )

        elapsed = round(time.time() - start, 2)

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"final_status": "UNCLEAR", "parse_error": True}

        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # CLARIFY WITH CONTEXT
    # ──────────────────────────────────────────────

    def clarify_with_context(self, original_analysis: dict, clarification_transcript: str, frames_b64: list) -> dict:
        start = time.time()

        prior_context = (
            f"PREVIOUS ANALYSIS (Resulted in CLARIFY status):\n"
            f"Original Visual Analysis: {json.dumps(original_analysis.get('visual_analysis', {}))}\n"
            f"Original Audio Transcript: {original_analysis.get('audio_transcription', {}).get('full_text', '')}\n"
            f"Cross-Reference Mapped Item: {original_analysis.get('cross_reference', {}).get('checklist_mapped_item', 'Unknown')}\n"
            f"Clarification Question Asked: {original_analysis.get('cross_reference', {}).get('clarification_question', '')}\n"
            f"\nINSPECTOR'S CLARIFICATION RESPONSE:\n\"{clarification_transcript}\"\n"
        )

        prompt = (
            f"{CROSSREF_PROMPT}\n\n"
            f"This is a CLARIFICATION round. Read the inspector's response and definitively grade the item. "
            f"Return PASS, MONITOR, or FAIL. Do not return CLARIFY again.\n\n"
            f"{prior_context}"
        )

        parts = []
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(raw),
                mime_type="image/jpeg"
            ))
        parts.append(prompt)

        response = self.client.models.generate_content(
            model=self.vision_model,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CROSSREF_SCHEMA,
                temperature=0.1,
            )
        )

        elapsed = round(time.time() - start, 2)

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"final_status": "UNCLEAR", "parse_error": True}

        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # DELTA REVIEW
    # ──────────────────────────────────────────────

    def review_delta(self, current_analysis: dict, previous_analysis: dict) -> dict:
        start = time.time()

        prompt = (
            f"You are an F1Tenth autonomous racing car maintenance expert.\n"
            f"Compare TODAY'S inspection against the PREVIOUS one for the same component.\n"
            f"Identify if wear is accelerating or if new issues have appeared.\n\n"
            f"PREVIOUS ANALYSIS:\n{json.dumps(previous_analysis)}\n\n"
            f"TODAY'S ANALYSIS:\n{json.dumps(current_analysis)}"
        )

        response = self.client.models.generate_content(
            model=self.vision_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DELTA_SCHEMA,
                temperature=0.1,
            )
        )

        elapsed = round(time.time() - start, 2)

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"summary": "Error", "wear_trend": "UNKNOWN", "notable_changes": []}

        result["processing_time_seconds"] = elapsed
        return result


# ──────────────────────────────────────────────────────
# PROMPTS
# ──────────────────────────────────────────────────────

AUDIO_TRANSCRIPTION_PROMPT = """You are transcribing an F1Tenth autonomous racing car pre-run inspection.

The inspector is speaking while examining a component. Transcribe their speech accurately.

For each segment of speech:
1. Provide the exact text spoken
2. Estimate the start and end timestamp in seconds
3. If an F1Tenth car component is mentioned, identify it using the standard component name below

Common components to listen for:
- Tires: Tire 1 (Front Left), Tire 2 (Front Right), Tire 3 (Rear Left), Tire 4 (Rear Right)
- Shocks: Shock 1 (Front Left), Shock 2 (Front Right), Shock 3 (Rear Left), Shock 4 (Rear Right)
- Bumpers: Bumper 1 (Front), Bumper 2 (Rear)
- Sensors: LiDAR
- Compute: NVIDIA Jetson
- Power: Battery, Powerboard
- Comms: Antenna
- Chassis: Undercarriage

IMPORTANT — Location vs. Component:
If the inspector mentions damage near another part, the component is the one actually being inspected, not the nearby reference point.

Be precise with timestamps and exact with the spoken words."""

VISUAL_ANALYSIS_PROMPT = """You are an F1Tenth autonomous racing car technician conducting a pre-run safety inspection.

Analyze the provided inspection frames using Chain of Thought reasoning.

STEP 1 — OBSERVE: Describe exactly what you see. Note tire wear, shock condition, bumper integrity, sensor mounting, cable routing, connector security, and structural integrity.

STEP 2 — IDENTIFY: Identify the specific F1Tenth component being inspected. Use standard names:
  Mechanical — Tire 1 (FL), Tire 2 (FR), Tire 3 (RL), Tire 4 (RR), Shock 1 (FL), Shock 2 (FR), Shock 3 (RL), Shock 4 (RR), Bumper 1 (Front), Bumper 2 (Rear), Undercarriage
  Electronics — NVIDIA Jetson, Powerboard, Battery, Antenna
  Sensors — LiDAR

STEP 3 — ASSESS: Is it securely mounted? Signs of damage, wear, or loose connections? Could this cause failure during a race run?

STEP 4 — CONCLUDE: PASS (acceptable), MONITOR (minor concerns), FAIL (unsafe, fix before running), or UNCLEAR (cannot determine).

Be thorough but concise. You are protecting the car and preventing a DNF."""

CROSSREF_PROMPT = """You are a senior F1Tenth pre-run inspection verifier.

Cross-reference the visual analysis, inspector's spoken assessment, and history. Map to the checklist and produce a final verdict.

[F1TENTH PRE-RUN INSPECTION CHECKLIST]
1. Mechanical
1.1 Tire 1 — Front Left
1.2 Tire 2 — Front Right
1.3 Tire 3 — Rear Left
1.4 Tire 4 — Rear Right
1.5 Shock 1 — Front Left
1.6 Shock 2 — Front Right
1.7 Shock 3 — Rear Left
1.8 Shock 4 — Rear Right
1.9 Bumper 1 — Front
1.10 Bumper 2 — Rear
1.11 Undercarriage

2. Electronics & Power
2.1 Battery
2.2 Powerboard
2.3 NVIDIA Jetson
2.4 Antenna

3. Sensors
3.1 LiDAR

STEP 1 — MAP & GRADE: Identify the exact checklist item. Output it exactly as written. Grade: Green (Pass), Yellow (Monitor), Red (Fail), None (unidentifiable).

STEP 2 — COMPARE: Do the inspector's words, visual evidence, and history agree or disagree?

STEP 3 — RESOLVE:
  AGREE + Green -> PASS
  AGREE + Yellow -> MONITOR
  AGREE + Red -> FAIL
  DISAGREE (AI sees worse) -> Trust the AI, escalate, return CLARIFY with a specific question
  AMBIGUOUS -> CLARIFY with a specific yes/no question

Focus ONLY on the component in the current clip."""


# ──────────────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────────────

AUDIO_SCHEMA = {
    "type": "object",
    "properties": {
        "full_text": {"type": "string"},
        "segments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "start_time": {"type": "number"},
                    "end_time": {"type": "number"},
                    "component_mentioned": {"type": "string"}
                },
                "required": ["text", "start_time", "end_time"]
            }
        },
        "components_mentioned": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "timestamp": {"type": "number"}
                },
                "required": ["name", "timestamp"]
            }
        }
    },
    "required": ["full_text", "segments", "components_mentioned"]
}

VISUAL_SCHEMA = {
    "type": "object",
    "properties": {
        "chain_of_thought": {
            "type": "object",
            "properties": {
                "observations": {"type": "string"},
                "component_identification": {"type": "string"},
                "condition_assessment": {"type": "string"},
                "conclusion": {"type": "string"}
            },
            "required": ["observations", "component_identification", "condition_assessment", "conclusion"]
        },
        "component": {"type": "string"},
        "condition_observations": {
            "type": "array",
            "items": {"type": "string"}
        },
        "preliminary_status": {
            "type": "string",
            "enum": ["PASS", "MONITOR", "FAIL", "UNCLEAR"]
        },
        "confidence": {"type": "number"},
        "concerns": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["chain_of_thought", "component", "condition_observations", "preliminary_status", "confidence"]
}

CROSSREF_SCHEMA = {
    "type": "object",
    "properties": {
        "final_status": {
            "type": "string",
            "enum": ["PASS", "MONITOR", "FAIL", "CLARIFY"]
        },
        "confidence": {"type": "number"},
        "checklist_mapped_item": {"type": "string"},
        "checklist_grade": {
            "type": "string",
            "enum": ["Green", "Yellow", "Red", "None"]
        },
        "verdict_reasoning": {"type": "string"},
        "clarification_question": {"type": "string"},
        "recommendation": {"type": "string"},
        "chain_of_thought": {
            "type": "object",
            "properties": {
                "audio_says": {"type": "string"},
                "visual_shows": {"type": "string"},
                "comparison": {"type": "string"},
                "checklist_mapping_reasoning": {"type": "string"}
            },
            "required": ["audio_says", "visual_shows", "comparison"]
        }
    },
    "required": ["final_status", "confidence", "checklist_mapped_item", "checklist_grade", "verdict_reasoning", "chain_of_thought"]
}

DELTA_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "wear_trend": {
            "type": "string",
            "enum": ["STABLE", "INCREASING", "ACCELERATING", "CRITICAL_CHANGE"]
        },
        "notable_changes": {
            "type": "array",
            "items": {"type": "string"}
        },
        "days_since_previous": {"type": "number"}
    },
    "required": ["summary", "wear_trend", "notable_changes"]
}
