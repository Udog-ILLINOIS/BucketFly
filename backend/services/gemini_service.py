"""
Gemini AI Service — Cat Vision-Inspect

Audio transcription only. Visual analysis and reasoning handled by claude_service.py.
"""

import os
import json
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
        print(f'[GEMINI] Using model: {self.model} (audio only)')

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


# ──────────────────────────────────────────────────────
# PROMPT
# ──────────────────────────────────────────────────────

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
