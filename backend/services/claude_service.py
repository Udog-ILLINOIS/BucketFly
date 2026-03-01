"""
Gemini Vision Service — Calls 2 and 3

Call 2 (analyze_frames):  Pure visual observation of camera frames. No grading.
Call 3 (cross_reference): Final diagnosis. Text-only — NO images re-sent.
                          Applies strict grading rules. Returns graded_items[].

Naming note: this file is called claude_service.py for backward compatibility
but uses the Gemini API exclusively (gemini-2.5-flash).
"""

import os
import json
import base64
import time
from dotenv import load_dotenv

load_dotenv(override=True)

from google import genai
from google.genai import types


class ClaudeService:
    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set in .env")

        self.client = genai.Client(api_key=api_key)
        self.model = 'gemini-2.5-flash-preview-04-17'
        print(f'[CALL 2/3 — VISION] Model: {self.model}')

    def _image_parts(self, frames_b64: list, max_frames: int = None) -> list:
        parts = []
        frames = frames_b64[:max_frames] if max_frames else frames_b64
        for frame_b64 in frames:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            img_bytes = base64.b64decode(raw)
            parts.append(types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"))
        return parts

    # ──────────────────────────────────────────────
    # CALL 2 — VISUAL OBSERVATION (frames → observations)
    # ──────────────────────────────────────────────

    def analyze_frames(self, frames_b64: list) -> dict:
        """
        Call 2: Pure visual observation. No audio context. No grading.

        Describes only what is literally visible in the frames.
        Reports defects only if clearly visible.
        Returns structured observations for Call 3 to reason from.
        """
        if not frames_b64:
            return {
                "scene_description": "No frames provided.",
                "components_observed": [],
                "unidentified_frame_count": 0,
                "processing_time_seconds": 0
            }

        start = time.time()

        parts = self._image_parts(frames_b64)
        parts.append(VISUAL_OBSERVATION_PROMPT)

        response = self.client.models.generate_content(
            model=self.model,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VISUAL_SCHEMA,
                temperature=0.0,
            )
        )

        elapsed = round(time.time() - start, 2)
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {
                "scene_description": "Parse error.",
                "components_observed": [],
                "unidentified_frame_count": len(frames_b64),
                "parse_error": True
            }
        result["processing_time_seconds"] = elapsed
        observed = [c.get("name") for c in result.get("components_observed", [])]
        print(f'[CALL 2 — VISION] {elapsed}s | observed: {observed}')
        return result

    # ──────────────────────────────────────────────
    # CALL 3 — DIAGNOSIS (text-only, NO images)
    # ──────────────────────────────────────────────

    def cross_reference(self, visual_analysis: dict, audio_transcription: dict, history: list = None) -> dict:
        """
        Call 3: Final diagnosis. Receives structured text from Calls 1 and 2.
        NO images are sent — Call 2 must have captured enough visual detail.

        Applies strict grading rules:
        - Only grade components that were MENTIONED in audio
        - PASS only if: mentioned + clearly visible + zero defects
        - CLARIFY if: mentioned but not clearly visible
        - FAIL/MONITOR based on confirmed visible defects
        - Visible but not mentioned = unmentioned observation only (not graded)
        """
        start = time.time()

        # Build plain-text summary of Call 1 output
        audio_lines = [f'TRANSCRIPT: "{audio_transcription.get("full_text", "(no audio)")}"', ""]
        audio_lines.append("COMPONENTS THE OPERATOR NAMED:")
        mentioned = audio_transcription.get("components_mentioned", [])
        if mentioned:
            for comp in mentioned:
                audio_lines.append(
                    f'  - {comp["name"]} (at t={comp.get("timestamp", "?")}s) — operator said: "{comp.get("operator_statement", "(nothing)")}"'
                )
        else:
            audio_lines.append("  (none — operator did not name any component)")

        # Build plain-text summary of Call 2 output
        visual_lines = [f'SCENE: {visual_analysis.get("scene_description", "(no description)")}', ""]
        visual_lines.append("WHAT THE CAMERA SAW:")
        observed = visual_analysis.get("components_observed", [])
        if observed:
            for comp in observed:
                visual_lines.append(f'  [{comp.get("visibility", "UNCLEAR")}] {comp.get("name", "?")}:')
                for obs in comp.get("physical_observations", []):
                    visual_lines.append(f'    observation: {obs}')
                for defect in comp.get("defects_noted", []):
                    visual_lines.append(f'    DEFECT VISIBLE: {defect}')
        else:
            visual_lines.append("  (no components clearly identified in any frame)")
        unid = visual_analysis.get("unidentified_frame_count", 0)
        if unid:
            visual_lines.append(f'  ({unid} frame(s) had no identifiable component)')

        # Build history summary
        history_lines = ["PREVIOUS INSPECTION HISTORY:"]
        if history:
            for rec in history:
                history_lines.append(
                    f'  - Grade: {rec.get("grade", "?")} | Notes: {rec.get("notes", "")}'
                )
        else:
            history_lines.append("  (no previous records)")

        prompt = (
            "\n".join(audio_lines) + "\n\n" +
            "\n".join(visual_lines) + "\n\n" +
            "\n".join(history_lines) + "\n\n" +
            DIAGNOSIS_PROMPT
        )

        # TEXT ONLY — no images sent to Call 3
        response = self.client.models.generate_content(
            model=self.model,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CROSSREF_SCHEMA,
                temperature=0.0,
            )
        )

        elapsed = round(time.time() - start, 2)
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {
                "graded_items": [],
                "unmentioned_observations": [],
                "overall_status": "INCOMPLETE",
                "parse_error": True
            }
        result["processing_time_seconds"] = elapsed
        grades = [(i.get("checklist_item"), i.get("final_status")) for i in result.get("graded_items", [])]
        print(f'[CALL 3 — DIAGNOSIS] {elapsed}s | grades: {grades}')
        return result

    # ──────────────────────────────────────────────
    # CLARIFY — re-run Call 3 with new audio, same visual
    # ──────────────────────────────────────────────

    def clarify_with_context(self, original_analysis: dict, clarification_transcript: str, _frames_b64: list = None) -> dict:
        """
        Clarification round: uses the stored visual analysis from the original inspection.
        Only Call 1 (transcription) + Call 3 (diagnosis) run — no new Call 2.
        The original visual_analysis is passed back as-is.

        The clarification_transcript is the operator's verbal response to the CLARIFY question.
        """
        start = time.time()

        original_visual = original_analysis.get("visual_analysis", {})
        original_audio = original_analysis.get("audio_transcription", {})
        original_xref = original_analysis.get("cross_reference", {})

        clarify_items = [
            i for i in original_xref.get("graded_items", [])
            if i.get("final_status") == "CLARIFY"
        ]
        clarify_question = clarify_items[0].get("clarification_question", "") if clarify_items else ""

        # Build prompt combining original context + clarification
        prompt = (
            f'ORIGINAL TRANSCRIPT: "{original_audio.get("full_text", "")}"\n'
            f'QUESTION THAT WAS ASKED: "{clarify_question}"\n'
            f'OPERATOR CLARIFICATION RESPONSE: "{clarification_transcript}"\n\n'
            f'ORIGINAL VISUAL ANALYSIS (unchanged):\n'
            f'  Scene: {original_visual.get("scene_description", "")}\n'
        )
        for comp in original_visual.get("components_observed", []):
            prompt += f'  [{comp.get("visibility")}] {comp.get("name")}: '
            prompt += ', '.join(comp.get("physical_observations", []))
            defects = comp.get("defects_noted", [])
            if defects:
                prompt += f' | DEFECTS: {", ".join(defects)}'
            prompt += '\n'

        prompt += f'\n{CLARIFY_PROMPT}'

        response = self.client.models.generate_content(
            model=self.model,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CROSSREF_SCHEMA,
                temperature=0.0,
            )
        )

        elapsed = round(time.time() - start, 2)
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"graded_items": [], "unmentioned_observations": [], "overall_status": "INCOMPLETE", "parse_error": True}
        result["processing_time_seconds"] = elapsed
        print(f'[CLARIFY] {elapsed}s | grades: {[(i.get("checklist_item"), i.get("final_status")) for i in result.get("graded_items", [])]}')
        return result


# ──────────────────────────────────────────────────────
# PROMPTS
# ──────────────────────────────────────────────────────

VISUAL_OBSERVATION_PROMPT = """You are a camera observing an F1TENTH racing car inspection. These frames were extracted at moments the inspector was examining the car.

YOUR ONLY TASK: Describe what is literally visible. Do not grade. Do not conclude. Do not speculate.

STRICT RULES:
- Describe only what is physically present and unambiguous.
- For each component you can identify: name it, describe its exact physical state.
- Report defects ONLY if they are clearly visible: cracks, chips, missing pieces, misalignment, frayed wires, corrosion, discoloration, loose fasteners, deformation.
- Do NOT use evaluative language: "looks good", "appears healthy", "seems fine", "normal" are conclusions, not observations. Only report facts.
- Do NOT infer from context. If you cannot clearly see a component, do not invent it.
- If a frame is blurry, dark, or shows no identifiable component, count it as unidentified.
- Visibility levels: CLEAR = component plainly visible and identifiable. PARTIAL = partially visible or obstructed. UNCLEAR = cannot confirm identity or condition.

Output one entry per distinct component you observe across all frames."""


DIAGNOSIS_PROMPT = """You are the final inspector applying the F1TENTH pre-run inspection checklist.

You have received:
1. What the operator said (audio transcript with exact component names and their verbatim statements)
2. What the camera recorded (visual observations with defects noted)
3. Previous inspection history

GRADING RULES — STRICTLY ENFORCED. NO EXCEPTIONS:

RULE 1 — ONLY grade components that appear in the audio transcript.
  If the operator did not name a component, it does NOT get graded, regardless of what the camera saw.

RULE 2 — A component receives PASS (Green) ONLY when ALL three conditions are true:
  (a) The operator explicitly named it in the audio.
  (b) The camera shows it with visibility CLEAR or PARTIAL (not UNCLEAR).
  (c) The visual analysis lists ZERO defects for it.

RULE 3 — A component receives MONITOR (Yellow) when:
  Mentioned in audio + visible in camera + minor defects noted (wear, slight discoloration, minor misalignment).

RULE 4 — A component receives FAIL (Red) when:
  Mentioned in audio + visible in camera + significant defects confirmed (cracks, missing parts, severe wear, dangerous condition).

RULE 5 — A component receives CLARIFY when ANY of:
  - Mentioned in audio but visibility is UNCLEAR in all frames.
  - Mentioned in audio but the component does not appear in the visual observations at all.
  - Visibility is PARTIAL and defect status is ambiguous (cannot confirm pass or fail).
  Include a specific yes/no clarification question.

RULE 6 — Do NOT default to PASS because no defects were spotted. UNCLEAR visibility = CLARIFY, not PASS.

RULE 7 — Components visible in camera but NOT mentioned by operator: list in unmentioned_observations. Do NOT grade them.

RULE 8 — If the operator claims it is good but the camera shows a clear defect, the camera evidence takes priority. Grade on physical evidence.

RULE 9 — Map each component to EXACTLY one of these checklist items (copy character-for-character):

MECHANICAL:
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

ELECTRONICS & POWER:
  2.1 Battery
  2.2 Powerboard
  2.3 NVIDIA Jetson
  2.4 Antenna

SENSORS:
  3.1 LiDAR

MAPPING RULES:
- If the operator says "tire" or "wheel" without specifying position, use the camera orientation to determine which tire. If ambiguous, use CLARIFY.
- If operator says "shock" or "suspension" without position, same rule — use camera orientation or CLARIFY.
- "Lidar", "lidar", "laser sensor" → "3.1 LiDAR"
- "Jetson", "computer", "compute" → "2.3 NVIDIA Jetson"
- "battery", "lipo" → "2.1 Battery"
- "powerboard", "power board", "power distribution" → "2.2 Powerboard"

Output one entry in graded_items per component the operator mentioned. A single recording may yield multiple graded items."""


CLARIFY_PROMPT = """This is a CLARIFICATION round.

The operator has answered a follow-up question. Using their clarification response AND the original visual analysis:
- Re-apply the same grading rules (Rules 1-9 from the original diagnosis).
- Do NOT return CLARIFY again. Resolve to PASS, MONITOR, or FAIL based on the full evidence.
- If the operator's clarification confirms good condition AND no defects were visible, assign PASS.
- If the operator's clarification reveals a defect OR the camera showed defects, assign MONITOR or FAIL.
- Base the grade on physical evidence. Operator words alone are insufficient for PASS if defects are visible."""


# ──────────────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────────────

VISUAL_SCHEMA = {
    "type": "object",
    "properties": {
        "scene_description": {
            "type": "string",
            "description": "Brief factual description of what is shown across all frames."
        },
        "components_observed": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Component name as identified visually."
                    },
                    "visibility": {
                        "type": "string",
                        "enum": ["CLEAR", "PARTIAL", "UNCLEAR"],
                        "description": "CLEAR=plainly visible, PARTIAL=partially visible, UNCLEAR=cannot confirm."
                    },
                    "physical_observations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Factual descriptions of what is physically seen. No evaluative language."
                    },
                    "defects_noted": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Defects that are clearly and unambiguously visible. Empty array if none."
                    }
                },
                "required": ["name", "visibility", "physical_observations", "defects_noted"]
            }
        },
        "unidentified_frame_count": {
            "type": "integer",
            "description": "Number of frames with no identifiable component."
        }
    },
    "required": ["scene_description", "components_observed", "unidentified_frame_count"]
}


CROSSREF_SCHEMA = {
    "type": "object",
    "properties": {
        "graded_items": {
            "type": "array",
            "description": "One entry per component the operator mentioned. May be empty if no components named.",
            "items": {
                "type": "object",
                "properties": {
                    "checklist_item": {
                        "type": "string",
                        "description": "Must be character-for-character identical to a checklist item (e.g. '1.1 Tire 1 — Front Left')."
                    },
                    "checklist_grade": {
                        "type": "string",
                        "enum": ["Green", "Yellow", "Red", "None"],
                        "description": "Green=PASS, Yellow=MONITOR, Red=FAIL, None=CLARIFY/unresolved."
                    },
                    "final_status": {
                        "type": "string",
                        "enum": ["PASS", "MONITOR", "FAIL", "CLARIFY"]
                    },
                    "audio_evidence": {
                        "type": "string",
                        "description": "What the operator said about this component (verbatim)."
                    },
                    "visual_evidence": {
                        "type": "string",
                        "description": "What the camera showed for this component (from Call 2 observations)."
                    },
                    "defects_confirmed": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Defects confirmed from visual evidence. Empty if none."
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Why this grade was assigned, citing specific evidence from audio and visual."
                    },
                    "clarification_question": {
                        "type": "string",
                        "description": "Specific yes/no question for operator. Only populated when final_status is CLARIFY."
                    },
                    "recommendation": {
                        "type": "string",
                        "description": "Recommended action for MONITOR or FAIL items."
                    }
                },
                "required": ["checklist_item", "checklist_grade", "final_status", "audio_evidence", "visual_evidence", "defects_confirmed", "reasoning"]
            }
        },
        "unmentioned_observations": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Components the camera saw that the operator never mentioned. Listed for awareness only — not graded."
        },
        "overall_status": {
            "type": "string",
            "enum": ["ALL_PASS", "HAS_ISSUES", "NEEDS_CLARIFICATION", "NO_COMPONENTS_IDENTIFIED"],
            "description": "Summary of this inspection round."
        }
    },
    "required": ["graded_items", "unmentioned_observations", "overall_status"]
}
