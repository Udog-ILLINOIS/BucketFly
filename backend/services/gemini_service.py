"""
Gemini AI Service — Cat Vision-Inspect

Handles visual analysis (frames) and audio transcription via Gemini 2.0 Flash.
Uses Chain of Thought reasoning and Caterpillar TA1 inspection terminology.
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
        self.model = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')

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

        # Build content parts: frames + prompt
        parts = []

        for i, frame_b64 in enumerate(frames_b64):
            # Strip data URL prefix if present
            if ',' in frame_b64:
                frame_b64 = frame_b64.split(',')[1]

            frame_bytes = base64.b64decode(frame_b64)
            parts.append(types.Part.from_bytes(
                data=frame_bytes,
                mime_type="image/jpeg"
            ))

        parts.append(VISUAL_ANALYSIS_PROMPT)

        response = self.client.models.generate_content(
            model=self.model,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VISUAL_SCHEMA,
                temperature=0.2,  # Low temp for consistent analysis
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
                temperature=0.1,  # Very low temp for accurate transcription
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
    # CROSS-REFERENCE
    # ──────────────────────────────────────────────

    def cross_reference(self, visual_analysis: dict, audio_transcription: dict, frames_b64: list) -> dict:
        """
        Cross-reference visual analysis vs audio assessment. Returns final verdict.

        Args:
            visual_analysis: Output from analyze_frames()
            audio_transcription: Output from transcribe_audio() or {} if no audio
            frames_b64: Original base64 frames (top 3 used for context)

        Returns:
            Structured verdict dict with final_status, chain_of_thought, etc.
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
            f"  Components mentioned: {[c['name'] for c in audio_transcription.get('components_mentioned', [])]}"
        )

        parts = []

        # Include top 3 key frames for model to re-examine
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(raw), mime_type="image/jpeg"
            ))

        parts.append(visual_summary)
        parts.append("\n\n")
        parts.append(audio_summary)
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

    Your job is to cross-reference these two sources and produce a final verdict.

    STEP 1 — COMPARE: What did the operator say vs what the AI sees?
      - Do they agree? (e.g., operator says "looks good", AI sees no defects → AGREE)
      - Do they disagree? (e.g., operator says "looks good", AI sees hydraulic leak → DISAGREE)
      - Is the operator's assessment incomplete? (missed something the AI caught)

    STEP 2 — RESOLVE:
      - AGREE + no concerns → PASS or MONITOR based on severity
      - AGREE + serious concern → FAIL
      - DISAGREE (AI sees worse than operator) → trust the AI, escalate status
      - AMBIGUOUS or contradictory → CLARIFY (ask a specific yes/no question)
      - No audio provided → rely solely on visual analysis

    STEP 3 — CLARIFY conditions (use sparingly, only when genuinely unclear):
      - Visual shows something that could be dirt OR damage
      - Operator mentioned a different component than what AI sees
      - Critical safety component with borderline condition

    When returning CLARIFY, the clarification_question MUST be specific and answerable verbally:
      GOOD: "Is that brown staining on the cylinder rod wet/oily or dry?"
      BAD: "Can you clarify the condition?"

    You are protecting operator safety. When in doubt, escalate."""

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

Be precise with timestamps and exact with the spoken words. Use Caterpillar's standard terminology for component identification."""


# ──────────────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────────────

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
        "component": {"type": "string"},
        "verdict_reasoning": {"type": "string"},
        "disagreement_detected": {"type": "boolean"},
        "disagreement_reason": {"type": "string"},
        "clarification_question": {"type": "string"},
        "what_ai_sees": {"type": "string"},
        "what_operator_said": {"type": "string"},
        "recommendation": {"type": "string"},
        "chain_of_thought": {
            "type": "object",
            "properties": {
                "audio_says": {"type": "string"},
                "visual_shows": {"type": "string"},
                "comparison": {"type": "string"},
                "final_verdict": {"type": "string"}
            },
            "required": ["audio_says", "visual_shows", "comparison", "final_verdict"]
        }
    },
    "required": ["final_status", "confidence", "component", "verdict_reasoning",
                 "disagreement_detected", "chain_of_thought", "recommendation"]
}
