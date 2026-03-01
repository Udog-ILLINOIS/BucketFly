"""
Groq Llama AI Service — Cat Vision-Inspect

Handles visual frame analysis, audio transcription, cross-reference reasoning,
live component identification, and delta review using Groq-hosted Llama models.

- Vision tasks: meta-llama/llama-4-scout-17b-16e-instruct (multimodal)
- Audio transcription: whisper-large-v3-turbo (Groq-hosted Whisper)
- Text reasoning: meta-llama/llama-4-scout-17b-16e-instruct
"""

import os
import json
import base64
import time
import tempfile
from dotenv import load_dotenv

load_dotenv()

from groq import Groq
from services.training_data import (
    GRADE_DEFINITIONS, TRAINING_EXAMPLES_TEXT, load_all_training_images,
    F1TENTH_TRAINING_EXAMPLES_TEXT, load_f1tenth_training_images,
    get_f1tenth_reference_entries_for_text, load_training_image_b64,
)


class GroqService:
    def __init__(self):
        api_key = os.getenv('GROQ_API_KEY')
        if not api_key:
            raise ValueError("GROQ_API_KEY not set in .env")

        self.client = Groq(api_key=api_key)
        self.vision_model = 'meta-llama/llama-4-scout-17b-16e-instruct'
        self.whisper_model = 'whisper-large-v3-turbo'
        print(f'[GROQ] Using vision model: {self.vision_model}')
        print(f'[GROQ] Using whisper model: {self.whisper_model}')

        # Pre-load training images for few-shot prompting
        try:
            self._training_images = load_all_training_images()
            total = sum(len(v) for v in self._training_images.values())
            print(f'[GROQ] Loaded {total} CAT training images for few-shot learning')
        except Exception as e:
            print(f'[GROQ] Warning: Could not load CAT training images: {e}')
            self._training_images = {}

        try:
            self._f1tenth_training_images = load_f1tenth_training_images()
            print(f'[GROQ] Loaded {len(self._f1tenth_training_images)} F1Tenth training images')
        except Exception as e:
            print(f'[GROQ] Warning: Could not load F1Tenth training images: {e}')
            self._f1tenth_training_images = []

    # ──────────────────────────────────────────────
    # HELPERS
    # ──────────────────────────────────────────────

    def _make_image_content(self, b64_data: str, mime_type: str = "image/jpeg") -> dict:
        """Build an OpenAI-style image_url content block from base64 data."""
        return {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{b64_data}"
            }
        }

    def _has_images(self, messages: list) -> bool:
        """Check if any message contains image content parts."""
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "image_url":
                        return True
        return False

    def _chat(self, messages: list, temperature: float = 0.1, max_tokens: int = 4096, model: str = None) -> str:
        """Send a chat completion request and return the raw text response."""
        response = self.client.chat.completions.create(
            model=model or self.vision_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    def _extract_json(self, text: str) -> dict:
        """Extract a JSON object from text that may contain markdown fences or preamble."""
        if not text:
            return {"raw_response": text, "parse_error": True}
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Try extracting from markdown code fences
        import re
        m = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass
        # Try finding the first { ... } block
        start = text.find('{')
        if start != -1:
            depth = 0
            for i in range(start, len(text)):
                if text[i] == '{':
                    depth += 1
                elif text[i] == '}':
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i+1])
                        except json.JSONDecodeError:
                            break
        return {"raw_response": text, "parse_error": True}

    def _chat_json(self, messages: list, temperature: float = 0.1, max_tokens: int = 4096, model: str = None) -> dict:
        """
        Send a chat completion and parse JSON from the response.
        
        NOTE: Groq does not support response_format=json_object on vision
        (multimodal) requests.  For those we rely on the system-prompt
        instruction to return JSON and parse it from the raw text.
        """
        kwargs = dict(
            model=model or self.vision_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # Only request structured JSON mode for text-only calls
        if not self._has_images(messages):
            kwargs["response_format"] = {"type": "json_object"}

        response = self.client.chat.completions.create(**kwargs)
        text = response.choices[0].message.content
        return self._extract_json(text)

    # ──────────────────────────────────────────────
    # VISUAL ANALYSIS
    # ──────────────────────────────────────────────

    def analyze_frames(self, frames_b64: list[str], use_few_shot: bool = True, machine_type: str = 'cat_ta1') -> dict:
        """
        Analyze key frames from an equipment inspection.

        Args:
            frames_b64: List of base64-encoded JPEG images
            use_few_shot: If True, include labeled training examples in the prompt
            machine_type: 'cat_ta1' or 'f1tenth'

        Returns:
            Structured analysis dict with CoT reasoning
        """
        start = time.time()

        content_parts = []

        # Few-shot: include labeled training images
        if machine_type == 'cat_ta1' and use_few_shot and self._training_images:
            content_parts.append({
                "type": "text",
                "text": "=== REFERENCE EXAMPLES (use these to calibrate your grading) ===\n"
            })

            for entry in self._training_images.get("red", []):
                raw = entry["image_b64"].split(',')[1] if ',' in entry["image_b64"] else entry["image_b64"]
                mime = "image/png" if entry["entry"]["filename"].endswith(".png") else "image/jpeg"
                content_parts.append(self._make_image_content(raw, mime))
                content_parts.append({
                    "type": "text",
                    "text": f"[EXAMPLE — RED] {entry['entry']['component']}: {entry['entry']['reason']}\n"
                })

            for entry in self._training_images.get("yellow", []):
                raw = entry["image_b64"].split(',')[1] if ',' in entry["image_b64"] else entry["image_b64"]
                mime = "image/png" if entry["entry"]["filename"].endswith(".png") else "image/jpeg"
                content_parts.append(self._make_image_content(raw, mime))
                content_parts.append({
                    "type": "text",
                    "text": f"[EXAMPLE — YELLOW] {entry['entry']['component']}: {entry['entry']['reason']}\n"
                })

            for entry in self._training_images.get("false_positives", []):
                raw = entry["image_b64"].split(',')[1] if ',' in entry["image_b64"] else entry["image_b64"]
                mime = "image/png" if entry["entry"]["filename"].endswith(".png") else "image/jpeg"
                content_parts.append(self._make_image_content(raw, mime))
                content_parts.append({
                    "type": "text",
                    "text": (
                        f"[EXAMPLE — GREEN (was wrongly flagged)] {entry['entry']['component']}: "
                        f"{entry['entry']['why_actually_green']}\n"
                        f"LESSON: {entry['entry']['lesson']}\n"
                    )
                })

            content_parts.append({
                "type": "text",
                "text": "=== END REFERENCE EXAMPLES ===\n\n=== NOW ANALYZE THE FOLLOWING INSPECTION FRAMES ===\n"
            })

        # Add inspection frames
        for frame_b64 in frames_b64:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            content_parts.append(self._make_image_content(raw, "image/jpeg"))

        # Prompt
        prompt = F1TENTH_VISUAL_ANALYSIS_PROMPT if machine_type == 'f1tenth' else VISUAL_ANALYSIS_PROMPT
        content_parts.append({"type": "text", "text": prompt})

        messages = [
            {"role": "system", "content": "You are an expert equipment inspection AI. Always respond with valid JSON matching the requested schema."},
            {"role": "user", "content": content_parts}
        ]

        result = self._chat_json(messages, max_tokens=2048)

        elapsed = round(time.time() - start, 2)

        # Ensure required fields exist with defaults
        result.setdefault("chain_of_thought", {
            "observations": "", "component_identification": "",
            "condition_assessment": "", "conclusion": ""
        })
        result.setdefault("component", "Unknown")
        result.setdefault("condition_observations", [])
        result.setdefault("preliminary_status", "UNCLEAR")
        result.setdefault("color_code", "Fail")
        result.setdefault("confidence", 0.0)
        result.setdefault("concerns", [])
        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # AUDIO TRANSCRIPTION (Groq Whisper)
    # ──────────────────────────────────────────────

    def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/webm", machine_type: str = 'cat_ta1') -> dict:
        """
        Transcribe audio using Groq's Whisper model, then extract
        component mentions with a follow-up LLM call.

        Args:
            audio_bytes: Raw audio bytes
            mime_type: MIME type of the audio
            machine_type: 'cat_ta1' or 'f1tenth'

        Returns:
            Structured transcription with timestamps and component mentions
        """
        start = time.time()

        # Map mime types to file extensions for the temp file
        ext_map = {
            'audio/webm': '.webm', 'audio/mp4': '.mp4', 'audio/mpeg': '.mp3',
            'audio/wav': '.wav', 'audio/ogg': '.ogg', 'audio/flac': '.flac',
        }
        ext = ext_map.get(mime_type, '.webm')

        # Write to temp file — Groq Whisper API expects a file
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            # Whisper transcription with word-level timestamps
            with open(tmp_path, 'rb') as audio_file:
                whisper_result = self.client.audio.transcriptions.create(
                    file=audio_file,
                    model=self.whisper_model,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                    language="en",
                )
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

        full_text = whisper_result.text or ""

        # Build segments from Whisper response
        segments = []
        for seg in getattr(whisper_result, 'segments', []) or []:
            segments.append({
                "text": seg.get("text", "") if isinstance(seg, dict) else getattr(seg, 'text', ''),
                "start_time": seg.get("start", 0) if isinstance(seg, dict) else getattr(seg, 'start', 0),
                "end_time": seg.get("end", 0) if isinstance(seg, dict) else getattr(seg, 'end', 0),
            })

        # Use LLM to extract component mentions from the transcript
        extraction_prompt = F1TENTH_COMPONENT_EXTRACTION_PROMPT if machine_type == 'f1tenth' else CAT_COMPONENT_EXTRACTION_PROMPT
        extraction_messages = [
            {"role": "system", "content": "You are a technical transcript analyzer. Always respond with valid JSON."},
            {"role": "user", "content": f"Transcript: \"{full_text}\"\n\nSegments with timestamps:\n{json.dumps(segments)}\n\n{extraction_prompt}"}
        ]

        components_result = self._chat_json(extraction_messages, max_tokens=1024)
        components_mentioned = components_result.get("components_mentioned", [])

        elapsed = round(time.time() - start, 2)

        return {
            "full_text": full_text,
            "segments": segments,
            "components_mentioned": components_mentioned,
            "processing_time_seconds": elapsed,
        }

    def transcribe_video(self, video_bytes: bytes, mime_type: str = 'video/mp4', machine_type: str = 'cat_ta1') -> dict:
        """
        Transcribe audio from a video file.
        Extracts audio via temp file and sends to Whisper.

        Returns the same schema as transcribe_audio.
        """
        ext_map = {
            'video/mp4': '.mp4', 'video/quicktime': '.mov',
            'video/webm': '.webm', 'video/avi': '.avi',
            'video/x-msvideo': '.avi', 'video/mpeg': '.mpeg',
        }
        ext = ext_map.get(mime_type, '.mp4')

        # Groq Whisper can accept video files directly — it extracts the audio track
        return self.transcribe_audio(video_bytes, mime_type=mime_type, machine_type=machine_type)

    # ──────────────────────────────────────────────
    # CROSS-REFERENCE (Visual vs Audio)
    # ──────────────────────────────────────────────

    def cross_reference(self, visual_analysis: dict, audio_transcription: dict, frames_b64: list, history: list = None, machine_type: str = 'cat_ta1') -> dict:
        """
        Cross-reference visual analysis vs audio assessment, incorporating history.
        Maps the component to the machine-specific checklist and grades it.
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

        content_parts = []

        # For F1Tenth: inject reference baseline images
        if machine_type == 'f1tenth':
            audio_text = audio_transcription.get('full_text', '')
            visual_component = visual_analysis.get('component', '')
            search_text = f"{audio_text} {visual_component}"

            ref_entries = get_f1tenth_reference_entries_for_text(search_text)
            if ref_entries:
                content_parts.append({
                    "type": "text",
                    "text": (
                        "=== REFERENCE: What a HEALTHY version of this component looks like ===\n"
                        "Use these verified GREEN baselines to compare against the inspection frames.\n"
                    )
                })
                for ref in ref_entries:
                    b64 = load_training_image_b64("F1Tenth", ref["filename"])
                    if b64:
                        raw = b64.split(',')[1] if ',' in b64 else b64
                        content_parts.append(self._make_image_content(raw, "image/jpeg"))
                        content_parts.append({
                            "type": "text",
                            "text": f"[REFERENCE — VERIFIED GREEN] {ref['component']}: {ref['reason']}\n"
                        })
                content_parts.append({
                    "type": "text",
                    "text": "\n=== INSPECTION FRAMES TO EVALUATE ===\n"
                })

        # Include top 3 key frames
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            content_parts.append(self._make_image_content(raw, "image/jpeg"))

        crossref_prompt = F1TENTH_CROSSREF_PROMPT if machine_type == 'f1tenth' else CROSSREF_PROMPT
        content_parts.append({
            "type": "text",
            "text": f"{visual_summary}\n\n{audio_summary}\n\n{history_summary}\n\n{crossref_prompt}"
        })

        messages = [
            {"role": "system", "content": "You are an expert equipment inspection verifier. Always respond with valid JSON matching the requested schema."},
            {"role": "user", "content": content_parts}
        ]

        result = self._chat_json(messages, max_tokens=2048)

        elapsed = round(time.time() - start, 2)

        # Ensure required fields
        result.setdefault("final_status", "UNCLEAR")
        result.setdefault("confidence", 0.0)
        result.setdefault("items_evaluated", [])
        result.setdefault("chain_of_thought", {
            "audio_says": "", "visual_shows": "", "comparison": ""
        })
        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # CLARIFY WITH CONTEXT
    # ──────────────────────────────────────────────

    def clarify_with_context(self, original_analysis: dict, new_audio_bytes: bytes, frames_b64: list) -> dict:
        """
        Takes the original inspection JSON (which returned CLARIFY),
        processes the new audio response, and runs cross-reference again.
        """
        start = time.time()

        # 1. Transcribe the new clarification audio
        clarification_transcription = self.transcribe_audio(new_audio_bytes)

        # 2. Build context
        items_evaluated = original_analysis.get('cross_reference', {}).get('items_evaluated', [])
        items_str = ", ".join([item.get('checklist_mapped_item', 'Unknown') for item in items_evaluated])

        prior_context = (
            f"PREVIOUS ANALYSIS (Resulted in CLARIFY status):\n"
            f"Original Visual Analysis: {json.dumps(original_analysis.get('visual_analysis', {}))}\n"
            f"Original Audio Transcript: {original_analysis.get('audio_transcription', {}).get('full_text', '')}\n"
            f"Cross-Reference Mapped Items: {items_str}\n"
            f"Clarification Question Asked: {original_analysis.get('cross_reference', {}).get('clarification_question', '')}\n"
        )

        operator_response = (
            f"\nOPERATOR'S CLARIFICATION RESPONSE:\n"
            f"\"{clarification_transcription.get('full_text', 'No talking detected')}\"\n"
        )

        prompt = (
            f"{CROSSREF_PROMPT}\n\n"
            f"This is a CLARIFICATION round. The AI previously asked the operator a question to resolve an ambiguity.\n"
            f"Read the operator's response and definitively grade the item Green, Yellow, or Red, "
            f"and return the final status (PASS, MONITOR, or FAIL).\n"
            f"Do not return CLARIFY again."
        )

        content_parts = []
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            content_parts.append(self._make_image_content(raw, "image/jpeg"))

        content_parts.append({
            "type": "text",
            "text": f"{prior_context}\n{operator_response}\n{prompt}"
        })

        messages = [
            {"role": "system", "content": "You are an expert equipment inspection verifier. Always respond with valid JSON."},
            {"role": "user", "content": content_parts}
        ]

        result = self._chat_json(messages, max_tokens=2048)

        elapsed = round(time.time() - start, 2)
        result.setdefault("final_status", "UNCLEAR")
        result["processing_time_seconds"] = elapsed
        result["clarification_transcript"] = clarification_transcription.get('full_text', '')
        return result

    # ──────────────────────────────────────────────
    # COMPONENT IDENTIFICATION (lightweight)
    # ──────────────────────────────────────────────

    def identify_component(self, frame_b64: str, machine_type: str = 'cat_ta1') -> dict:
        """
        Lightweight, fast identification of the component visible in a single frame.
        Used for real-time feedback during recording.
        """
        start = time.time()

        raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64

        prompt = F1TENTH_IDENTIFY_PROMPT if machine_type == 'f1tenth' else IDENTIFY_PROMPT
        content_parts = [
            self._make_image_content(raw, "image/jpeg"),
            {"type": "text", "text": prompt}
        ]

        messages = [
            {"role": "system", "content": "You are an expert equipment inspector. Always respond with valid JSON."},
            {"role": "user", "content": content_parts}
        ]

        result = self._chat_json(messages, max_tokens=512)

        elapsed = round(time.time() - start, 2)

        result.setdefault("component", "Unknown")
        result.setdefault("checklist_item", "None")
        result.setdefault("confidence", 0.0)
        result.setdefault("confidence_label", "LOW")
        result.setdefault("guidance", "Cannot identify component from this angle")
        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # DELTA REVIEW
    # ──────────────────────────────────────────────

    def review_delta(self, current_analysis: dict, previous_analysis: dict) -> dict:
        """
        Subjective comparison between today's analysis and the previous one.
        Returns a wear_delta object.
        """
        start = time.time()

        prompt = (
            f"SYSTEM: You are a Caterpillar predictive maintenance expert.\n"
            f"TASK: Compare TODAY'S inspection against YESTERDAY'S for the same component.\n"
            f"Identify if wear is accelerating or if new issues have appeared.\n\n"
            f"YESTERDAY'S ANALYSIS:\n{json.dumps(previous_analysis)}\n\n"
            f"TODAY'S ANALYSIS:\n{json.dumps(current_analysis)}\n\n"
            f"Return a JSON object with fields: summary (string), wear_trend (one of STABLE/INCREASING/ACCELERATING/CRITICAL_CHANGE), "
            f"notable_changes (array of strings), days_since_previous (number)."
        )

        messages = [
            {"role": "system", "content": "You are a predictive maintenance expert. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]

        result = self._chat_json(messages, max_tokens=1024)

        elapsed = round(time.time() - start, 2)
        result.setdefault("summary", "Error parsing delta analysis")
        result.setdefault("wear_trend", "UNKNOWN")
        result.setdefault("notable_changes", [])
        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # TIMESTAMP CORRELATION (static — same as Gemini)
    # ──────────────────────────────────────────────

    @staticmethod
    def correlate_timestamps(transcription: dict, frame_timestamps: list[float]) -> dict:
        """Map spoken component names to the nearest video frames."""
        components = transcription.get("components_mentioned", [])
        if not components or not frame_timestamps:
            return {"correlations": [], "note": "No components or frames to correlate"}

        correlations = []
        for comp in components:
            comp_name = comp.get("name", "unknown")
            audio_ts = comp.get("timestamp", 0.0)

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

VISUAL_ANALYSIS_PROMPT = f"""You are a senior Caterpillar field service engineer conducting a TA1 Daily Walkaround inspection on heavy equipment.

{GRADE_DEFINITIONS}

{TRAINING_EXAMPLES_TEXT}

Analyze the provided inspection frames using Chain of Thought reasoning.

STEP 1 — OBSERVE: Describe exactly what you see in the frames. Note details like fluid stains, surface condition, wear patterns, cracks, corrosion, loose connections, fluid levels, and structural integrity.

STEP 2 — IDENTIFY: Identify the specific equipment component being inspected. Use standard Caterpillar terminology.

STEP 3 — ASSESS: Evaluate the component's condition using the COLOR-CODE GRADING DEFINITIONS above.
  CRITICAL: Do NOT confuse normal wear, surface dirt, paint loss, or cosmetic damage with actual failures.
  Only flag Yellow for real degradation. Only flag Red for genuine safety-critical failures.

STEP 4 — CONCLUDE: State your preliminary assessment:
  - PASS = Green (acceptable condition)
  - MONITOR = Yellow (needs scheduled repair)
  - FAIL = Red (safety-critical, needs immediate attention)
  - UNCLEAR = Fail (insufficient image data to classify)

Respond with a JSON object containing:
{{
  "chain_of_thought": {{
    "observations": "string",
    "component_identification": "string",
    "condition_assessment": "string",
    "conclusion": "string"
  }},
  "component": "string",
  "condition_observations": ["string"],
  "preliminary_status": "PASS|MONITOR|FAIL|UNCLEAR",
  "color_code": "Green|Yellow|Red|Fail",
  "confidence": 0.0-1.0,
  "concerns": ["string"]
}}"""

F1TENTH_VISUAL_ANALYSIS_PROMPT = """You are a robotics technician performing a pre-run safety inspection on an F1Tenth RoboRacer autonomous racing car.

CHECKLIST ITEMS:
  1.1 Chassis Frame & Body
  1.2 Wheels & Tires
  2.1 Jetson Xavier NX (Compute)
  2.2 LiDAR Unit
  2.3 Power Distribution Board

GRADING:
  RED — Vehicle must NOT operate. Safety-critical failure.
  YELLOW — Can operate at reduced speed; needs repair before competition.
  GREEN — Acceptable condition for full-speed operation.
  FAIL — Insufficient image quality to assess.

Analyze using Chain of Thought:
STEP 1 — OBSERVE: Describe what you see.
STEP 2 — IDENTIFY: Name the component using checklist terminology.
STEP 3 — ASSESS: Grade RED/YELLOW/GREEN/FAIL.
STEP 4 — CONCLUDE: PASS/MONITOR/FAIL/UNCLEAR.

Respond with a JSON object containing:
{
  "chain_of_thought": {
    "observations": "string",
    "component_identification": "string",
    "condition_assessment": "string",
    "conclusion": "string"
  },
  "component": "string",
  "condition_observations": ["string"],
  "preliminary_status": "PASS|MONITOR|FAIL|UNCLEAR",
  "color_code": "Green|Yellow|Red|Fail",
  "confidence": 0.0-1.0,
  "concerns": ["string"]
}"""

CROSSREF_PROMPT = f"""You are a senior Caterpillar TA1 inspection verifier.

{GRADE_DEFINITIONS}

You have been provided:
1. A visual AI analysis of equipment frames
2. The operator's spoken assessment
3. Historical inspection logs

Cross-reference these sources, map to the official Caterpillar TA1 checklist, and produce a final graded verdict.

[OFFICIAL CATERPILLAR TA1 CHECKLIST]
1.1 Tires and Rims | 1.2 Bucket Cutting Edge, Tips, or Moldboard | 1.3 Bucket Tilt Cylinders and Hoses | 1.4 Bucket, Lift Cylinders and Hoses | 1.5 Lift arm attachment to frame | 1.6 Underneath of Machine | 1.7 Transmission and Transfer Gears | 1.8 Differential and Final Drive Oil | 1.9 Steps and Handrails | 1.10 Brake Air Tank; inspect | 1.11 Fuel Tank | 1.12 Axles- Final Drives, Differentials, Brakes, Duo-cone Seals | 1.13 Hydraulic fluid tank, inspect | 1.14 Transmission Oil | 1.15 Work Lights | 1.16 Battery & Cables | 2.1 Engine Oil Level | 2.2 Engine Coolant Level | 2.3 Check Radiator Cores for Debris | 2.4 Inspect Hoses for Cracks or Leaks | 2.5 Primary/secondary fuel filters | 2.6 All Belts | 2.7 Air Cleaner and Air Filter Service Indicator | 2.8 Overall Engine Compartment | 3.1 Steps & Handrails | 3.2 ROPS/FOPS | 3.3 Fire Extinguisher | 3.4 Windshield wipers and washers | 3.5 Side Doors | 4.1 Seat | 4.2 Seat belt and mounting | 4.3 Horn | 4.4 Backup Alarm | 4.5 Windows and Mirrors | 4.6 Cab Air Filter | 4.7 Indicators & Gauges | 4.8 Switch functionality | 4.9 Overall Cab Interior

Respond with a JSON object containing:
{{
  "final_status": "PASS|MONITOR|FAIL|CLARIFY",
  "confidence": 0.0-1.0,
  "items_evaluated": [
    {{
      "checklist_mapped_item": "exact checklist item name",
      "checklist_grade": "Green|Yellow|Red|None",
      "verdict_reasoning": "string",
      "recommendation": "string"
    }}
  ],
  "clarification_question": "string or null",
  "chain_of_thought": {{
    "audio_says": "string",
    "visual_shows": "string",
    "comparison": "string",
    "checklist_mapping_reasoning": "string"
  }}
}}"""

F1TENTH_CROSSREF_PROMPT = """You are an F1Tenth RoboRacer pre-run inspection verifier.

You have been provided:
1. A visual AI analysis of the car's frames
2. The operator's spoken assessment
3. Historical inspection logs

Produce one graded verdict entry for EVERY component that was either identified visually or mentioned by the operator.

[OFFICIAL F1TENTH CHECKLIST]
1.1 Chassis Frame & Body | 1.2 Wheels & Tires | 2.1 Jetson Xavier NX (Compute) | 2.2 LiDAR Unit | 2.3 Power Distribution Board

Respond with a JSON object containing:
{
  "final_status": "PASS|MONITOR|FAIL|CLARIFY",
  "confidence": 0.0-1.0,
  "items_evaluated": [
    {
      "checklist_mapped_item": "exact checklist item name",
      "checklist_grade": "Green|Yellow|Red|None",
      "verdict_reasoning": "string",
      "recommendation": "string"
    }
  ],
  "clarification_question": "string or null",
  "chain_of_thought": {
    "audio_says": "string",
    "visual_shows": "string",
    "comparison": "string",
    "checklist_mapping_reasoning": "string"
  }
}"""

IDENTIFY_PROMPT = """You are a Caterpillar field service engineer. Quickly identify the equipment component shown in this single frame.

Map it to the closest item from the official TA1 checklist:
1.1 Tires and Rims | 1.2 Bucket Cutting Edge, Tips, or Moldboard | 1.3 Bucket Tilt Cylinders and Hoses | 1.4 Bucket, Lift Cylinders and Hoses | 1.5 Lift arm attachment to frame | 1.6 Underneath of Machine | 1.7 Transmission and Transfer Gears | 1.8 Differential and Final Drive Oil | 1.9 Steps and Handrails | 1.10 Brake Air Tank; inspect | 1.11 Fuel Tank | 1.12 Axles- Final Drives, Differentials, Brakes, Duo-cone Seals | 1.13 Hydraulic fluid tank, inspect | 1.14 Transmission Oil | 1.15 Work Lights | 1.16 Battery & Cables | 2.1 Engine Oil Level | 2.2 Engine Coolant Level | 2.3 Check Radiator Cores for Debris | 2.4 Inspect Hoses for Cracks or Leaks | 2.5 Primary/secondary fuel filters | 2.6 All Belts | 2.7 Air Cleaner and Air Filter Service Indicator | 2.8 Overall Engine Compartment | 3.1 Steps & Handrails | 3.2 ROPS/FOPS | 3.3 Fire Extinguisher | 3.4 Windshield wipers and washers | 3.5 Side Doors | 4.1 Seat | 4.2 Seat belt and mounting | 4.3 Horn | 4.4 Backup Alarm | 4.5 Windows and Mirrors | 4.6 Cab Air Filter | 4.7 Indicators & Gauges | 4.8 Switch functionality | 4.9 Overall Cab Interior

If you cannot identify any Cat equipment component, set checklist_item to "None".

Respond with JSON: {"component": "string", "checklist_item": "string", "confidence": 0.0-1.0, "confidence_label": "HIGH|MEDIUM|LOW", "guidance": "string"}"""

F1TENTH_IDENTIFY_PROMPT = """You are an F1Tenth RoboRacer technician. Quickly identify the car component shown in this frame.

Map to: 1.1 Chassis Frame & Body | 1.2 Wheels & Tires | 2.1 Jetson Xavier NX (Compute) | 2.2 LiDAR Unit | 2.3 Power Distribution Board

If the frame does not clearly show any of these, set checklist_item to "None".

Respond with JSON: {"component": "string", "checklist_item": "string", "confidence": 0.0-1.0, "confidence_label": "HIGH|MEDIUM|LOW", "guidance": "string"}"""

# Component extraction prompts (used after Whisper transcription)
CAT_COMPONENT_EXTRACTION_PROMPT = """From the transcript above, extract every Caterpillar equipment component mentioned.

For each component, output its standard name and the approximate timestamp (in seconds) when it was first mentioned.

Common components: hydraulic cylinders, hoses, bucket, cutting edge, undercarriage, engine oil, coolant, belts, filters, tires, rims, steps, handrails, fuel tank, battery, transmission, differential, axles, brakes, radiator, air filter, windshield, mirrors, seat, horn, backup alarm.

IMPORTANT: If the inspector mentions a fluid near a location (e.g., "oil under the tires"), the component is the FLUID SOURCE, not the location.

Respond with JSON: {"components_mentioned": [{"name": "component name", "timestamp": seconds_float}]}"""

F1TENTH_COMPONENT_EXTRACTION_PROMPT = """From the transcript above, extract every F1Tenth RoboRacer component mentioned.

Use these exact checklist names:
- "Chassis Frame & Body" — frame, body, chassis, shell, body panel, mounting points
- "Wheels & Tires" — wheel, tire, rim, hub, wheel nut, rubber, foam tire
- "Jetson Xavier NX (Compute)" — Jetson, compute, SBC, NX
- "LiDAR Unit" — LiDAR, lidar, laser scanner, Hokuyo, RPLiDAR
- "Power Distribution Board" — power board, PDB, VESC, motor controller

Respond with JSON: {"components_mentioned": [{"name": "exact checklist name", "timestamp": seconds_float}]}"""
