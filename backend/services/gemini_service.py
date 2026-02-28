"""
Gemini AI Service — Cat Vision-Inspect

Handles all AI tasks: visual analysis, audio transcription, cross-reference reasoning,
live component identification, and delta review using Gemini 1.5 Flash.
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
        self.model = 'gemini-2.5-flash-lite'
        print(f'[GEMINI] Using model: {self.model}')

    # ──────────────────────────────────────────────
    # VISUAL ANALYSIS
    # ──────────────────────────────────────────────

    def analyze_frames(self, frames_b64: list[str]) -> dict:
        """
        Analyze key frames from an equipment inspection.

        Args:
            frames_b64: List of base64-encoded JPEG images

        Returns:
            Structured analysis dict with CoT reasoning
        """
        start = time.time()

        parts = []
        for frame_b64 in frames_b64:
            if ',' in frame_b64:
                frame_b64 = frame_b64.split(',')[1]
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(frame_b64), mime_type="image/jpeg"
            ))

        parts.append(VISUAL_ANALYSIS_PROMPT)

        response = self.client.models.generate_content(
            model=self.model,
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
            result = {"raw_response": response.text, "parse_error": True,
                      "preliminary_status": "UNCLEAR"}

        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # AUDIO TRANSCRIPTION
    # ──────────────────────────────────────────────

    def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> dict:
        """
        Transcribe audio from an equipment inspection.

        Args:
            audio_bytes: Raw audio bytes (WebM format)
            mime_type: MIME type of the audio

        Returns:
            Structured transcription with timestamps and component mentions
        """
        start = time.time()

        parts = [
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            AUDIO_TRANSCRIPTION_PROMPT
        ]

        response = self.client.models.generate_content(
            model=self.model,
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
    # CROSS-REFERENCE (Visual vs Audio)
    # ──────────────────────────────────────────────
    
    def cross_reference(self, visual_analysis: dict, audio_transcription: dict, frames_b64: list, history: list = None) -> dict:
        """
        Cross-reference visual analysis vs audio assessment, incorporating history.
        Maps the component to the Cat checklist and grades it.
        Returns final verdict.
        """
        start = time.time()

        visual_summary = (
            f"VISUAL ANALYSIS:\n"
            f"  Component: {visual_analysis.get('component', 'unknown')}\n"
            f"  Preliminary status: {visual_analysis.get('preliminary_status', 'UNCLEAR')}\n"
            f"  Observations: {', '.join(visual_analysis.get('condition_observations', []))}\n"
            f"  Concerns: {', '.join(visual_analysis.get('concerns', []))}\n"
            f"  Confidence: {visual_analysis.get('confidence', 0)}\n"
            f"  AI reasoning: {visual_analysis.get('chain_of_thought', {}).get('conclusion', '')}"
        )

        audio_summary = (
            f"OPERATOR'S SPOKEN ASSESSMENT:\n"
            f"  Transcript: \"{audio_transcription.get('full_text', 'No audio provided')}\"\n"
            f"  Components mentioned: {[c.get('name', 'unknown') for c in audio_transcription.get('components_mentioned', [])]}"
        )

        history_summary = "HISTORICAL INSPECTION LOGS:\n"
        if not history:
            history_summary += "  No previous inspections found for this component.\n"
        else:
            for item in history:
                grade = item.get("grade", "unknown")
                notes = item.get("operator_notes", "")
                history_summary += f"  - Previous Grade: {grade}, Notes: '{notes}'\n"

        parts = []

        # Include top 3 key frames for model to re-examine if needed
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(raw), mime_type="image/jpeg"
            ))

        parts.append(visual_summary)
        parts.append("\n\n")
        parts.append(audio_summary)
        parts.append("\n\n")
        parts.append(history_summary)
        parts.append("\n\n")
        parts.append(CROSSREF_PROMPT)

        response = self.client.models.generate_content(
            model=self.model,
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
            result = {"raw_response": response.text, "parse_error": True,
                      "final_status": "UNCLEAR"}

        result["processing_time_seconds"] = elapsed
        return result

    def clarify_with_context(self, original_analysis: dict, new_audio_bytes: bytes, frames_b64: list) -> dict:
        """
        Takes the original inspection JSON (which returned CLARIFY),
        process the new audio response, and run cross-reference again
        to get a definitive PASS/MONITOR/FAIL.
        """
        start = time.time()
        
        # 1. Transcribe the new clarification audio
        clarification_transcription = self.transcribe_audio(new_audio_bytes)
        
        # 2. Build the context history
        prior_context = (
            f"PREVIOUS ANALYSIS (Resulted in CLARIFY status):\n"
            f"Original Visual Analysis: {json.dumps(original_analysis.get('visual_analysis', {}))}\n"
            f"Original Audio Transcript: {original_analysis.get('audio_transcription', {}).get('full_text', '')}\n"
            f"Cross-Reference Mapped Item: {original_analysis.get('cross_reference', {}).get('checklist_mapped_item', 'Unknown')}\n"
            f"Clarification Question Asked: {original_analysis.get('cross_reference', {}).get('clarification_question', '')}\n"
        )
        
        operator_response = (
            f"\nOPERATOR'S CLARIFICATION RESPONSE:\n"
            f"\"{clarification_transcription.get('full_text', 'No talking detected')}\"\n"
        )
        
        prompt = (
            f"{CROSSREF_PROMPT}\n\n"
            f"This is a CLARIFICATION round. The AI previously asked the operator a question to resolve an ambiguity.\n"
            f"Read the operator's response and definitively grade the item Green, Yellow, or Red, and return the final status (PASS, MONITOR, or FAIL).\n"
            f"Do not return CLARIFY again."
        )

        parts = []

        # Include frames again
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(raw), mime_type="image/jpeg"
            ))

        parts.append(prior_context)
        parts.append(operator_response)
        parts.append(prompt)

        response = self.client.models.generate_content(
            model=self.model,
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
            result = {"raw_response": response.text, "parse_error": True, "final_status": "UNCLEAR"}

        result["processing_time_seconds"] = elapsed
        result["clarification_transcript"] = clarification_transcription.get('full_text', '')
        return result

    # ──────────────────────────────────────────────
    # TIMESTAMP CORRELATION
    # ──────────────────────────────────────────────

    @staticmethod
    def correlate_timestamps(transcription: dict, frame_timestamps: list[float]) -> dict:
        """
        Map spoken component names to the nearest video frames.

        If operator says "bucket" at timestamp 1.5s and we have frames at
        [0.0, 0.5, 1.0, 1.5, 2.0], the frame at index 3 (1.5s) is tagged
        as likely depicting "bucket".

        Args:
            transcription: Output from transcribe_audio()
            frame_timestamps: List of capture times in seconds for each frame

        Returns:
            Correlation map linking component mentions to frame indices
        """
        components = transcription.get("components_mentioned", [])

        if not components or not frame_timestamps:
            return {"correlations": [], "note": "No components or frames to correlate"}

        correlations = []
        for comp in components:
            comp_name = comp.get("name", "unknown")
            audio_ts = comp.get("timestamp", 0.0)

            # Find nearest frame
            best_idx = 0
            best_diff = abs(frame_timestamps[0] - audio_ts)

            for i, ft in enumerate(frame_timestamps):
                diff = abs(ft - audio_ts)
                if diff < best_diff:
                    best_diff = diff
                    best_idx = i

            correlations.append({
                "component": comp_name,
                "audio_timestamp": audio_ts,
                "nearest_frame_index": best_idx,
                "nearest_frame_timestamp": frame_timestamps[best_idx],
                "time_offset": round(best_diff, 2),
                "confidence": "high" if best_diff < 1.0 else "medium" if best_diff < 3.0 else "low"
            })

        return {"correlations": correlations}

    def identify_component(self, frame_b64: str) -> dict:
        """
        Lightweight, fast identification of the component visible in a single frame.
        Used for real-time feedback during recording. No full CoT — speed is priority.

        Args:
            frame_b64: A single base64-encoded JPEG image

        Returns:
            {component, checklist_item, confidence, confidence_label, guidance}
        """
        start = time.time()

        if ',' in frame_b64:
            frame_b64 = frame_b64.split(',')[1]

        frame_bytes = base64.b64decode(frame_b64)
        parts = [
            types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg"),
            IDENTIFY_PROMPT
        ]

        response = self.client.models.generate_content(
            model=self.model,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=IDENTIFY_SCHEMA,
                temperature=0.1,
            )
        )

        elapsed = round(time.time() - start, 2)

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {
                "component": "Unknown",
                "checklist_item": "None",
                "confidence": 0.0,
                "confidence_label": "LOW",
                "guidance": "Cannot identify component from this angle"
            }

        result["processing_time_seconds"] = elapsed
        return result

    def review_delta(self, current_analysis: dict, previous_analysis: dict) -> dict:
        """
        Perform a subjective comparison between today's analysis and the previous one.
        Returns a 'wear_delta' object.
        """
        start = time.time()

        prompt = (
            f"SYSTEM: You are a Caterpillar predictive maintenance expert.\n"
            f"TASK: Compare TODAY'S inspection against YESTERDAY'S for the same component.\n"
            f"Identify if wear is accelerating or if new issues have appeared.\n\n"
            f"YESTERDAY'S ANALYSIS:\n{json.dumps(previous_analysis)}\n\n"
            f"TODAY'S ANALYSIS:\n{json.dumps(current_analysis)}\n\n"
            f"Return a JSON object with a subjective summary of the changes."
        )

        response = self.client.models.generate_content(
            model=self.model,
            contents=[prompt],
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
            result = {"summary": "Error parsing delta analysis", "wear_trend": "UNKNOWN"}

        result["processing_time_seconds"] = elapsed
        return result

# ──────────────────────────────────────────────────────
# PROMPTS
# ──────────────────────────────────────────────────────

VISUAL_ANALYSIS_PROMPT = """You are a senior Caterpillar field service engineer conducting a TA1 Daily Walkaround inspection on heavy equipment.

Analyze the provided inspection frames using Chain of Thought reasoning.

STEP 1 — OBSERVE: Describe exactly what you see in the frames. Note details like fluid stains, surface condition, wear patterns, cracks, corrosion, loose connections, fluid levels, and structural integrity.

STEP 2 — IDENTIFY: Identify the specific equipment component being inspected. Use standard Caterpillar terminology (e.g., "hydraulic cylinder rod", "bucket cutting edge", "air filter element", "track shoe", "engine oil dipstick", "coolant reservoir").

STEP 3 — ASSESS: Evaluate the component's condition based on Caterpillar maintenance standards. Consider: Is this within normal operating condition? Is there evidence of accelerated wear? Are there safety-critical findings?

STEP 4 — CONCLUDE: State your preliminary assessment. Use one of: PASS (acceptable condition), MONITOR (minor concerns, track for next inspection), FAIL (safety-critical, needs immediate attention), or UNCLEAR (cannot determine from these frames).

Be thorough but concise. You are protecting the operator's safety."""

CROSSREF_PROMPT = """You are a senior Caterpillar TA1 inspection verifier.

You have been provided:
1. A visual AI analysis of equipment frames (what the AI SEES)
2. The operator's spoken assessment (what the operator SAID)
3. Historical inspection logs (past grade and condition)

Your job is to cross-reference these three sources, map the inspected component to the official Caterpillar TA1 checklist, compare current wear to history, and produce a final graded verdict.

[OFFICIAL CATERPILLAR TA1 CHECKLIST]
1.1 Tires and Rims
1.2 Bucket Cutting Edge, Tips, or Moldboard
1.3 Bucket Tilt Cylinders and Hoses
1.4 Bucket, Lift Cylinders and Hoses
1.5 Lift arm attachment to frame
1.6 Underneath of Machine
1.7 Transmission and Transfer Gears
1.8 Differential and Final Drive Oil
1.9 Steps and Handrails
1.10 Brake Air Tank; inspect
1.11 Fuel Tank
1.12 Axles- Final Drives, Differentials, Brakes, Duo-cone Seals
1.13 Hydraulic fluid tank, inspect
1.14 Transmission Oil
1.15 Work Lights
1.16 Battery & Cables
2.1 Engine Oil Level
2.2 Engine Coolant Level
2.3 Check Radiator Cores for Debris
2.4 Inspect Hoses for Cracks or Leaks
2.5 Primary/secondary fuel filters
2.6 All Belts
2.7 Air Cleaner and Air Filter Service Indicator
2.8 Overall Engine Compartment
3.1 Steps & Handrails
3.2 ROPS/FOPS
3.3 Fire Extinguisher
3.4 Windshield wipers and washers
3.5 Side Doors
4.1 Seat
4.2 Seat belt and mounting
4.3 Horn
4.4 Backup Alarm
4.5 Windows and Mirrors
4.6 Cab Air Filter
4.7 Indicators & Gauges
4.8 Switch functionality
4.9 Overall Cab Interior

STEP 1 — MAP & GRADE:
  - Identify which exact item from the checklist above is being inspected. Output it exactly as written.
  - Grade: Green (Pass), Yellow (Monitor), Red (Fail/Action Required), None (unidentifiable)

STEP 2 — COMPARE: What did the operator say vs what the AI sees vs History?
  - Do they agree or disagree?
  - Does new visual show accelerated wear vs historical baseline?

STEP 3 — RESOLVE & STATUS:
  - AGREE + Green -> PASS
  - AGREE + Yellow -> MONITOR
  - AGREE + Red -> FAIL
  - DISAGREE (AI sees worse) -> Trust the AI, escalate grade, return CLARIFY with a specific question
  - AMBIGUOUS -> CLARIFY with a specific yes/no question

Focus ONLY on the component present in the current clip."""

AUDIO_TRANSCRIPTION_PROMPT = """You are transcribing a Caterpillar equipment field inspection.

The inspector is speaking while examining a component. Transcribe their speech accurately.

For each segment of speech:
1. Provide the exact text spoken
2. Estimate the start and end timestamp in seconds
3. If a Caterpillar equipment component is mentioned, identify it using standard Cat terminology

Common components to listen for:
- Hydraulic cylinders, hoses, fittings
- Bucket (cutting edge, teeth, side cutters)
- Undercarriage (track shoes, rollers, idlers, sprockets)
- Engine components (oil, coolant, belts, filters)
- Structural members (boom, stick, frame)
- Ground engaging tools (GET)

IMPORTANT — Location vs. Component:
If the inspector mentions a fluid (oil, coolant, hydraulic fluid) near or under another part (e.g., "oil under the tires", "fluid near the tracks"), the component is the FLUID SOURCE (e.g., "engine oil", "hydraulic fluid"), NOT the structural location (e.g., "tires", "tracks"). The location describes where the leak is visible, not the component being identified.

Be precise with timestamps and exact with the spoken words."""


# ──────────────────────────────────────────────────────
# SCHEMA
# ──────────────────────────────────────────────────────

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

IDENTIFY_PROMPT = """You are a Caterpillar field service engineer. Quickly identify the equipment component shown in this single frame.

Map it to the closest item from the official TA1 checklist:
1.1 Tires and Rims | 1.2 Bucket Cutting Edge, Tips, or Moldboard | 1.3 Bucket Tilt Cylinders and Hoses | 1.4 Bucket, Lift Cylinders and Hoses | 1.5 Lift arm attachment to frame | 1.6 Underneath of Machine | 1.7 Transmission and Transfer Gears | 1.8 Differential and Final Drive Oil | 1.9 Steps and Handrails | 1.10 Brake Air Tank; inspect | 1.11 Fuel Tank | 1.12 Axles- Final Drives, Differentials, Brakes, Duo-cone Seals | 1.13 Hydraulic fluid tank, inspect | 1.14 Transmission Oil | 1.15 Work Lights | 1.16 Battery & Cables | 2.1 Engine Oil Level | 2.2 Engine Coolant Level | 2.3 Check Radiator Cores for Debris | 2.4 Inspect Hoses for Cracks or Leaks | 2.5 Primary/secondary fuel filters | 2.6 All Belts | 2.7 Air Cleaner and Air Filter Service Indicator | 2.8 Overall Engine Compartment | 3.1 Steps & Handrails | 3.2 ROPS/FOPS | 3.3 Fire Extinguisher | 3.4 Windshield wipers and washers | 3.5 Side Doors | 4.1 Seat | 4.2 Seat belt and mounting | 4.3 Horn | 4.4 Backup Alarm | 4.5 Windows and Mirrors | 4.6 Cab Air Filter | 4.7 Indicators & Gauges | 4.8 Switch functionality | 4.9 Overall Cab Interior

Rate your confidence (0.0 to 1.0) in the identification.
If confidence < 0.5, provide guidance on how the operator should adjust (e.g. move closer, change angle, point at the component).
If you cannot identify any Cat equipment component, set checklist_item to "None" and give helpful guidance.

Be fast and concise."""

IDENTIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "component": {"type": "string"},
        "checklist_item": {"type": "string"},
        "confidence": {"type": "number"},
        "confidence_label": {
            "type": "string",
            "enum": ["HIGH", "MEDIUM", "LOW"]
        },
        "guidance": {"type": "string"}
    },
    "required": ["component", "checklist_item", "confidence", "confidence_label", "guidance"]
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
