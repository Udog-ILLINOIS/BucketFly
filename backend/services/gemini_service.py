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
        self.model = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')

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
