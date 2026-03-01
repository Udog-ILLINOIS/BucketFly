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
from services.training_data import (
    GRADE_DEFINITIONS, TRAINING_EXAMPLES_TEXT, load_all_training_images,
    F1TENTH_TRAINING_EXAMPLES_TEXT, load_f1tenth_training_images,
    get_f1tenth_reference_entries_for_text, load_training_image_b64,
)


class GeminiService:
    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set in .env")

        self.client = genai.Client(api_key=api_key)
        self.model = 'gemini-2.5-flash-lite'
        print(f'[GEMINI] Using model: {self.model}')

        # Pre-load training images for few-shot prompting
        try:
            self._training_images = load_all_training_images()
            total = sum(len(v) for v in self._training_images.values())
            print(f'[GEMINI] Loaded {total} CAT training images for few-shot learning')
        except Exception as e:
            print(f'[GEMINI] Warning: Could not load CAT training images: {e}')
            self._training_images = {}

        try:
            self._f1tenth_training_images = load_f1tenth_training_images()
            print(f'[GEMINI] Loaded {len(self._f1tenth_training_images)} F1Tenth training images')
        except Exception as e:
            print(f'[GEMINI] Warning: Could not load F1Tenth training images: {e}')
            self._f1tenth_training_images = []

    # ──────────────────────────────────────────────
    # VISUAL ANALYSIS
    # ──────────────────────────────────────────────

    def analyze_frames(self, frames_b64: list[str], use_few_shot: bool = True, machine_type: str = 'cat_ta1') -> dict:
        """
        Analyze key frames from an equipment inspection.

        Args:
            frames_b64: List of base64-encoded JPEG images
            use_few_shot: If True, include labeled training images for few-shot learning
            machine_type: 'cat_ta1' or 'f1tenth'

        Returns:
            Structured analysis dict with CoT reasoning
        """
        start = time.time()

        parts = []

        # For CAT, include few-shot training images
        # F1Tenth reference images are injected later in cross_reference (audio-targeted)
        if machine_type == 'cat_ta1' and use_few_shot and self._training_images:
            parts.append("=== REFERENCE EXAMPLES (use these to calibrate your grading) ===\n")
            for entry in self._training_images.get("red", []):
                raw = entry["image_b64"].split(',')[1] if ',' in entry["image_b64"] else entry["image_b64"]
                mime = "image/png" if entry["entry"]["filename"].endswith(".png") else "image/jpeg"
                parts.append(types.Part.from_bytes(data=base64.b64decode(raw), mime_type=mime))
                parts.append(f"[EXAMPLE — RED] {entry['entry']['component']}: {entry['entry']['reason']}\n")

            for entry in self._training_images.get("yellow", []):
                raw = entry["image_b64"].split(',')[1] if ',' in entry["image_b64"] else entry["image_b64"]
                mime = "image/png" if entry["entry"]["filename"].endswith(".png") else "image/jpeg"
                parts.append(types.Part.from_bytes(data=base64.b64decode(raw), mime_type=mime))
                parts.append(f"[EXAMPLE — YELLOW] {entry['entry']['component']}: {entry['entry']['reason']}\n")

            for entry in self._training_images.get("false_positives", []):
                raw = entry["image_b64"].split(',')[1] if ',' in entry["image_b64"] else entry["image_b64"]
                mime = "image/png" if entry["entry"]["filename"].endswith(".png") else "image/jpeg"
                parts.append(types.Part.from_bytes(data=base64.b64decode(raw), mime_type=mime))
                parts.append(f"[EXAMPLE — GREEN (was wrongly flagged)] {entry['entry']['component']}: {entry['entry']['why_actually_green']}\nLESSON: {entry['entry']['lesson']}\n")

            parts.append("=== END REFERENCE EXAMPLES ===\n\n=== NOW ANALYZE THE FOLLOWING INSPECTION FRAMES ===\n")

        for frame_b64 in frames_b64:
            if ',' in frame_b64:
                frame_b64 = frame_b64.split(',')[1]
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(frame_b64), mime_type="image/jpeg"
            ))

        prompt = F1TENTH_VISUAL_ANALYSIS_PROMPT if machine_type == 'f1tenth' else VISUAL_ANALYSIS_PROMPT
        parts.append(prompt)

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

    def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/webm", machine_type: str = 'cat_ta1') -> dict:
        """
        Transcribe audio from an equipment inspection.

        Args:
            audio_bytes: Raw audio bytes (WebM format)
            mime_type: MIME type of the audio
            machine_type: 'cat_ta1' or 'f1tenth' — selects the transcription prompt

        Returns:
            Structured transcription with timestamps and component mentions
        """
        start = time.time()

        prompt = F1TENTH_AUDIO_TRANSCRIPTION_PROMPT if machine_type == 'f1tenth' else AUDIO_TRANSCRIPTION_PROMPT
        parts = [
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            prompt,
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

    def transcribe_video(self, video_bytes: bytes, mime_type: str = 'video/mp4', machine_type: str = 'cat_ta1') -> dict:
        """
        Transcribe audio from a video file and extract keyword timestamps.

        For files ≤ 20 MB, sends bytes inline.  For larger files, uploads
        via the Gemini File API then deletes after transcription.

        Returns the same schema as transcribe_audio:
            {full_text, segments, components_mentioned: [{name, timestamp}]}
        where `timestamp` is in **seconds** from the start of the video.
        """
        import tempfile
        import os as _os

        start = time.time()
        SIZE_LIMIT = 20 * 1024 * 1024  # 20 MB

        prompt = F1TENTH_AUDIO_TRANSCRIPTION_PROMPT if machine_type == 'f1tenth' else AUDIO_TRANSCRIPTION_PROMPT

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AUDIO_SCHEMA,
            temperature=0.1,
        )

        if len(video_bytes) <= SIZE_LIMIT:
            # ── Inline path (fast, no File API round-trip) ──────────────
            parts = [
                types.Part.from_bytes(data=video_bytes, mime_type=mime_type),
                prompt,
            ]
            response = self.client.models.generate_content(
                model=self.model, contents=parts, config=config
            )
        else:
            # ── File API path (for larger videos) ───────────────────────
            ext_map = {
                'video/mp4': '.mp4', 'video/quicktime': '.mov',
                'video/webm': '.webm', 'video/avi': '.avi',
                'video/x-msvideo': '.avi', 'video/mpeg': '.mpeg',
            }
            ext = ext_map.get(mime_type, '.mp4')
            tmp_path = None
            video_file = None
            try:
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                    tmp.write(video_bytes)
                    tmp_path = tmp.name

                video_file = self.client.files.upload(
                    path=tmp_path,
                    config={'mime_type': mime_type},
                )
                # Wait for Gemini to finish processing the upload
                for _ in range(30):
                    state = getattr(getattr(video_file, 'state', None), 'name', 'ACTIVE')
                    if state != 'PROCESSING':
                        break
                    time.sleep(2)
                    video_file = self.client.files.get(name=video_file.name)

                response = self.client.models.generate_content(
                    model=self.model,
                    contents=[video_file, prompt],
                    config=config,
                )
            finally:
                if tmp_path and _os.path.exists(tmp_path):
                    _os.unlink(tmp_path)
                if video_file:
                    try:
                        self.client.files.delete(name=video_file.name)
                    except Exception:
                        pass

        elapsed = round(time.time() - start, 2)
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"full_text": "", "segments": [], "components_mentioned": [], "parse_error": True}

        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # CROSS-REFERENCE (Visual vs Audio)
    # ──────────────────────────────────────────────

    def cross_reference(self, visual_analysis: dict, audio_transcription: dict, frames_b64: list, history: list = None, machine_type: str = 'cat_ta1') -> dict:
        """
        Cross-reference visual analysis vs audio assessment, incorporating history.
        Maps the component to the machine-specific checklist and grades it.
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

        # For F1Tenth: select the reference image(s) that match what the operator described,
        # then inject them before the inspection frames so Gemini can compare.
        if machine_type == 'f1tenth':
            audio_text = audio_transcription.get('full_text', '')
            visual_component = visual_analysis.get('component', '')
            search_text = f"{audio_text} {visual_component}"

            ref_entries = get_f1tenth_reference_entries_for_text(search_text)
            if ref_entries:
                parts.append(
                    "=== REFERENCE: What a HEALTHY version of this component looks like on "
                    "this specific F1Tenth RoboRacer ===\n"
                    "The image(s) below are verified GREEN (passing) baselines for this car. "
                    "Use them to:\n"
                    "  1. Confirm the inspection frames actually show the SAME component.\n"
                    "  2. Compare condition — spot deformation, damage, or issues vs the baseline.\n"
                )
                for ref in ref_entries:
                    b64 = load_training_image_b64("F1Tenth", ref["filename"])
                    if b64:
                        raw = b64.split(',')[1] if ',' in b64 else b64
                        parts.append(types.Part.from_bytes(
                            data=base64.b64decode(raw), mime_type="image/jpeg"
                        ))
                        parts.append(
                            f"[REFERENCE — VERIFIED GREEN] {ref['component']}: {ref['reason']}\n"
                        )
                parts.append(
                    "\n=== INSPECTION FRAMES TO EVALUATE (compare against reference above) ===\n"
                )
            else:
                parts.append(
                    "=== INSPECTION FRAMES TO EVALUATE ===\n"
                    "(No matching reference image found for this component — assess from context alone.)\n"
                )

        # Include top 3 key frames for model to re-examine
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            parts.append(types.Part.from_bytes(
                data=base64.b64decode(raw), mime_type="image/jpeg"
            ))

        crossref_prompt = F1TENTH_CROSSREF_PROMPT if machine_type == 'f1tenth' else CROSSREF_PROMPT
        parts.append(visual_summary)
        parts.append("\n\n")
        parts.append(audio_summary)
        parts.append("\n\n")
        parts.append(history_summary)
        parts.append("\n\n")
        parts.append(crossref_prompt)

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

    def identify_component(self, frame_b64: str, machine_type: str = 'cat_ta1') -> dict:
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
        prompt = F1TENTH_IDENTIFY_PROMPT if machine_type == 'f1tenth' else IDENTIFY_PROMPT
        parts = [
            types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg"),
            prompt,
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

VISUAL_ANALYSIS_PROMPT = f"""You are a senior Caterpillar field service engineer conducting a TA1 Daily Walkaround inspection on heavy equipment.

{GRADE_DEFINITIONS}

{TRAINING_EXAMPLES_TEXT}

Analyze the provided inspection frames using Chain of Thought reasoning.

STEP 1 — OBSERVE: Describe exactly what you see in the frames. Note details like fluid stains, surface condition, wear patterns, cracks, corrosion, loose connections, fluid levels, and structural integrity.

STEP 2 — IDENTIFY: Identify the specific equipment component being inspected. Use standard Caterpillar terminology (e.g., "hydraulic cylinder rod", "bucket cutting edge", "air filter element", "track shoe", "engine oil dipstick", "coolant reservoir").

STEP 3 — ASSESS: Evaluate the component's condition using the COLOR-CODE GRADING DEFINITIONS above.
  - Is this a RED situation (machine must stop)?
  - Is this YELLOW (schedule repair, operate today)?
  - Is this GREEN (acceptable, even if showing normal wear)?
  - Or is the image INSUFFICIENT to determine (FAIL)?

  CRITICAL: Do NOT confuse normal wear, surface dirt, paint loss, or cosmetic damage with actual failures.
  Review the FALSE POSITIVE WARNINGS above — heavy equipment gets dirty and shows wear marks. That is NORMAL and GREEN.
  Only flag Yellow for real degradation that needs scheduled maintenance.
  Only flag Red for genuine safety-critical failures that require immediate shutdown.

STEP 4 — CONCLUDE: State your preliminary assessment:
  - PASS = Green (acceptable condition)
  - MONITOR = Yellow (needs scheduled repair)
  - FAIL = Red (safety-critical, needs immediate attention)
  - UNCLEAR = Fail (insufficient image data to classify)

Be thorough but concise. You are protecting the operator's safety, but also protecting their productivity — do NOT ground a machine for cosmetic issues."""

CROSSREF_PROMPT = f"""You are a senior Caterpillar TA1 inspection verifier.

{GRADE_DEFINITIONS}

You have been provided:
1. A visual AI analysis of equipment frames (what the AI SEES)
2. The operator's spoken assessment (what the operator SAID) — including a list of components they mentioned
3. Historical inspection logs (past grade and condition)

Your job is to produce one graded verdict entry for EVERY component that was either:
  (a) identified visually in the frames, OR
  (b) mentioned by the operator in the audio transcript

This is a walkaround inspection — multiple components may be visible or discussed. Do NOT restrict to just one component. Evaluate ALL components that appear in either source.

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

Use these checklist item names EXACTLY (including the number prefix) in checklist_mapped_item.

STEP 1 — COLLECT ALL COMPONENTS:
  List every component that appears in the visual analysis OR in components_mentioned from the audio.
  For each one, note: what the AI saw (if anything) AND what the operator said (if anything).

STEP 2 — GRADE EACH COMPONENT INDEPENDENTLY:
  For each component from Step 1, map it to the exact checklist item name above and grade it:
    Green = Component is acceptable, machine can operate normally
    Yellow = Component needs scheduled repair, but machine can operate today
    Red = Component has critical failure, machine MUST NOT operate
    None = Component mentioned but no clear evidence to grade it
  - If clear visual evidence exists → use visual grade, cross-check with audio
  - If only audio evidence exists → use operator's spoken assessment as primary grade source
  - If audio and visual DISAGREE → trust the more severe assessment; flag CLARIFY if critical
  - REMEMBER: Dirt, dust, paint wear, surface rust, and minor cosmetic damage are NORMAL and GREEN.
  - Does new visual show accelerated wear vs historical baseline?

STEP 3 — RESOLVE OVERALL STATUS:
  - Any Red item → overall FAIL
  - Any CLARIFY item → overall CLARIFY
  - Any Yellow item (no Red) → overall MONITOR
  - All Green → overall PASS
  - Image quality too poor to assess → INSUFFICIENT_DATA
  - DISAGREE (AI sees worse) → Trust the AI, escalate grade, return CLARIFY with a specific question
  - AMBIGUOUS → CLARIFY with a specific yes/no question"""

F1TENTH_VISUAL_ANALYSIS_PROMPT = """You are a robotics technician performing a pre-run safety inspection on an F1Tenth RoboRacer autonomous racing car.

The F1Tenth car is a 1:10 scale autonomous vehicle built on a Traxxas Slash 4x4 chassis. It has:
- CHASSIS: Traxxas aluminium/plastic frame, four wheels with foam/rubber tires on 2.2" hex hubs, brushless DC drive motor, steering servo, servo linkage/tie-rods, differential
- COMPUTE: NVIDIA Jetson Xavier NX, VESC motor controller, USB hub, power distribution board
- SENSORS: LiDAR unit (Hokuyo UTM-30LX or RPLiDAR A2), optional USB camera, IMU
- POWER: 3S LiPo battery (~11.1V), XT90/XT60 connectors, inline power switch
- SAFETY: Emergency stop (E-stop) button/system, WiFi/ROS2 connectivity

CHECKLIST ITEMS (use these exact names when identifying components):
  1.1 Chassis Frame & Body   ← the car's frame, body panels, mounting points
  1.2 Wheels & Tires         ← all four wheels: rims, foam/rubber tires, hex hubs, wheel nuts
  2.1 Jetson Xavier NX (Compute)
  2.2 LiDAR Unit
  2.3 Power Distribution Board

GRADING SYSTEM:
  RED — Vehicle must NOT operate. Safety-critical failure. Examples:
    • Swollen/puffed LiPo battery cell (fire/explosion hazard)
    • E-stop non-functional (mandatory safety requirement)
    • Severed motor leads or exposed high-current wiring
    • Jetson fails to boot
    • LiPo cell voltage below 3.3V per cell
    • Wheel nut missing or tire completely detached (loss-of-control hazard)

  YELLOW — Can operate at reduced speed for testing; needs repair before competition. Examples:
    • LiPo cell voltage 3.3–3.5V (low but not critical)
    • Loose servo horn set screw (steering less precise)
    • WiFi latency >30ms (degraded telemetry)
    • Cracked antenna mount
    • Tie rod ball joint slop
    • Tire visibly deflated, deformed, or partially unseated from rim

  GREEN — Acceptable condition for full-speed operation. Examples:
    • Battery charged above 3.7V per cell
    • All ROS2 nodes running, e-stop functional
    • LiDAR spinning and producing valid scan data
    • Servo and steering linkage tight with full range of motion
    • All four wheels seated firmly, tires intact and properly inflated, wheel nuts tight

  FAIL — Insufficient image quality to assess

IMPORTANT: Normal cable routing and slight dust accumulation are NOT failures.
Zip ties that are slightly loose are YELLOW only if they could allow a cable to snag a wheel.
If you see any wheel / tire / rim / hub, classify the component as "1.2 Wheels & Tires".

Analyze the inspection frames using Chain of Thought reasoning:

STEP 1 — OBSERVE: Describe what you see — connectors, wiring condition, mounting hardware, LED indicators, physical damage, component positions. Explicitly note any wheels, tires, or rims visible.

STEP 2 — IDENTIFY: Name the specific F1Tenth component being inspected using the checklist terminology above.

STEP 3 — ASSESS: Apply the grading system above. Is this RED, YELLOW, GREEN, or FAIL (insufficient data)?

STEP 4 — CONCLUDE: State your preliminary assessment (PASS/MONITOR/FAIL/UNCLEAR).

Be precise about robotics-specific failure modes."""


F1TENTH_CROSSREF_PROMPT = """You are an F1Tenth RoboRacer pre-run inspection verifier.

You have been provided:
1. A visual AI analysis of the car's frames (what the AI SEES)
2. The operator's spoken assessment (what the operator SAID) — including a list of components they mentioned with timestamps
3. Historical inspection logs (past grade and condition)

Your job is to produce one graded verdict entry for EVERY component that was either:
  (a) identified visually in the frames, OR
  (b) mentioned by the operator in the audio transcript

This is a walkaround inspection — the operator moves around the car and speaks about each part. Do NOT restrict to just one component. Evaluate ALL components that appear in either source.

[OFFICIAL F1TENTH ROBORACER INSPECTION CHECKLIST]
1.1 Chassis Frame & Body
1.2 Wheels & Tires
2.1 Jetson Xavier NX (Compute)
2.2 LiDAR Unit
2.3 Power Distribution Board

Use these names exactly in checklist_mapped_item.

GRADING PER ITEM:
  Green = Acceptable, vehicle can operate at full speed
  Yellow = Needs repair soon, vehicle can operate at reduced speed for testing
  Red = Critical failure, vehicle MUST NOT operate
  Fail = Component mentioned but no clear visual evidence — use operator's spoken assessment as primary grade source

STEP 1 — COLLECT ALL COMPONENTS:
  List every component that appears in the visual analysis OR in components_mentioned from the audio.
  For each one, note: what the AI saw (if anything) AND what the operator said (if anything).

STEP 2 — GRADE EACH COMPONENT INDEPENDENTLY:
  For each component:
    - If clear visual evidence exists → use visual grade, cross-check with audio
    - If only audio evidence exists → use operator's spoken assessment (Fail grade only if the operator explicitly flagged a problem)
    - If audio and visual DISAGREE → trust the more severe assessment; flag as CLARIFY if critical

STEP 3 — RESOLVE OVERALL STATUS:
  - Any Red item → overall FAIL
  - Any CLARIFY item → overall CLARIFY
  - Any Yellow item (no Red) → overall MONITOR
  - All Green → overall PASS"""


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

F1TENTH_AUDIO_TRANSCRIPTION_PROMPT = """You are transcribing a pre-run safety inspection of an F1Tenth RoboRacer autonomous racing car.

The inspector is speaking while physically examining each part of the car. Transcribe their speech accurately.

For each segment of speech:
1. Provide the exact text spoken
2. Estimate the start and end timestamp in **seconds** from the beginning of the recording
3. If an F1Tenth component is mentioned, identify it using the standard checklist name below

F1Tenth components to listen for (use these exact checklist names):
- "Chassis Frame & Body" — frame, body, chassis, shell, body panel, mounting points
- "Wheels & Tires" — wheel, tire, tyre, rim, hub, wheel nut, rubber, foam tire, front wheel, rear wheel, left wheel, right wheel
- "Jetson Xavier NX (Compute)" — Jetson, compute board, SBC, single board computer, NX
- "LiDAR Unit" — LiDAR, lidar, laser scanner, Hokuyo, RPLiDAR, laser
- "Power Distribution Board" — power board, PDB, power distribution, power module, VESC, motor controller

Be precise with timestamps. Every time the inspector says a component name (even informally, e.g. "wheel", "tire", "lidar"), log it as a component mention with the timestamp."""


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

F1TENTH_IDENTIFY_PROMPT = """You are an F1Tenth RoboRacer technician. Quickly identify the car component shown in this single frame.

Map it to the closest item from the official F1Tenth pre-run checklist (output the item EXACTLY as written):
1.1 Chassis Frame & Body | 1.2 Wheels & Tires | 2.1 Jetson Xavier NX (Compute) | 2.2 LiDAR Unit | 2.3 Power Distribution Board

If the frame does not clearly show any of these components, set checklist_item to "None".

Rate your confidence (0.0 to 1.0) in the identification.
If confidence < 0.5, provide guidance on how the operator should adjust their camera angle.

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
        "color_code": {
            "type": "string",
            "enum": ["Green", "Yellow", "Red", "Fail"],
            "description": "Green=acceptable, Yellow=needs scheduled repair, Red=critical failure, Fail=insufficient data"
        },
        "confidence": {"type": "number"},
        "concerns": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["chain_of_thought", "component", "condition_observations", "preliminary_status", "color_code", "confidence"]
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
            "enum": ["PASS", "MONITOR", "FAIL", "CLARIFY"],
            "description": "The overall status across all evaluated items. If any item fails, the overall status is FAIL."
        },
        "confidence": {"type": "number"},
        "items_evaluated": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "checklist_mapped_item": {"type": "string"},
                    "checklist_grade": {
                        "type": "string",
                        "enum": ["Green", "Yellow", "Red", "None"]
                    },
                    "verdict_reasoning": {"type": "string"},
                    "recommendation": {"type": "string"}
                },
                "required": ["checklist_mapped_item", "checklist_grade", "verdict_reasoning"]
            }
        },
        "clarification_question": {"type": "string"},
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
    "required": ["final_status", "confidence", "items_evaluated", "chain_of_thought"]
}
