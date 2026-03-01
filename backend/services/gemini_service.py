"""
Gemini AI Service — Call 1: Audio Transcription Only

Transcribes the inspector's speech and identifies which components were named.
No condition assessment is made here — that is Call 3's job.
"""

import os
import json
import time
from dotenv import load_dotenv

load_dotenv(override=True)

from google import genai
from google.genai import types


class GeminiService:
    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set in .env")

        self.client = genai.Client(api_key=api_key)
        self.model = 'gemini-2.5-flash-preview-04-17'
        print(f'[CALL 1 — AUDIO] Model: {self.model}')

    def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> dict:
        """
        Call 1: Pure transcription of inspector speech.

        Captures:
        - Exact words spoken
        - Timestamps per segment
        - Which component names were mentioned and when
        - The exact phrase the operator used per component (verbatim, not assessed)

        Does NOT assess condition — that is Call 3's responsibility.
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
                temperature=0.0,
            )
        )

        elapsed = round(time.time() - start, 2)

        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"raw_response": response.text, "parse_error": True, "full_text": "", "segments": [], "components_mentioned": []}

        result["processing_time_seconds"] = elapsed
        print(f'[CALL 1 — AUDIO] {elapsed}s | components heard: {[c.get("name") for c in result.get("components_mentioned", [])]}')
        return result


# ──────────────────────────────────────────────────────
# PROMPT
# ──────────────────────────────────────────────────────

AUDIO_TRANSCRIPTION_PROMPT = """You are transcribing audio from an F1TENTH autonomous racing car pre-run inspection.

YOUR ONLY TASK: Transcribe exactly what was spoken. Record component names and the operator's exact words. Do not assess, interpret, or grade anything.

RULES:
1. Transcribe word-for-word. Do not paraphrase or summarize.
2. For each segment of speech, record start and end time in seconds.
3. If the operator names an F1TENTH component, record the component name and the EXACT phrase they used (e.g. "looks good", "seems worn", "might be cracked"). Do not interpret these phrases — record them verbatim.
4. If nothing is said, return empty arrays.
5. Do not add any assessment of your own.

F1TENTH components to listen for (use these standardized names when a component is identified):
- Tire (Front Left / Front Right / Rear Left / Rear Right)
- Shock (Front Left / Front Right / Rear Left / Rear Right)
- Bumper (Front / Rear)
- Undercarriage
- Battery
- Powerboard
- NVIDIA Jetson
- Antenna
- LiDAR"""


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
                    "timestamp": {"type": "number"},
                    "operator_statement": {
                        "type": "string",
                        "description": "Exact verbatim phrase the operator used about this component. Do not interpret."
                    }
                },
                "required": ["name", "timestamp", "operator_statement"]
            }
        }
    },
    "required": ["full_text", "segments", "components_mentioned"]
}
