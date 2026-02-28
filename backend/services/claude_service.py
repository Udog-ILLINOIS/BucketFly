"""
Claude AI Service — Cat Vision-Inspect

Handles visual frame analysis, cross-reference reasoning, and delta review
using Claude claude-sonnet-4-6. Audio transcription stays in gemini_service.py.

Structured outputs are enforced via Claude tool use.
"""

import os
import json
import base64
import time
from dotenv import load_dotenv

load_dotenv()

import anthropic


class ClaudeService:
    def __init__(self):
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set in .env")

        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = 'claude-sonnet-4-6'
        print(f'[CLAUDE] Using model: {self.model}')

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

        content = []

        for frame_b64 in frames_b64:
            if ',' in frame_b64:
                frame_b64 = frame_b64.split(',')[1]
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": frame_b64,
                }
            })

        content.append({"type": "text", "text": VISUAL_ANALYSIS_PROMPT})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            tools=[{
                "name": "submit_visual_analysis",
                "description": "Submit the structured visual analysis of the equipment inspection frames.",
                "input_schema": VISUAL_SCHEMA
            }],
            tool_choice={"type": "tool", "name": "submit_visual_analysis"},
            messages=[{"role": "user", "content": content}]
        )

        elapsed = round(time.time() - start, 2)

        tool_block = next((b for b in response.content if b.type == "tool_use"), None)
        result = tool_block.input if tool_block else {"preliminary_status": "UNCLEAR", "parse_error": True}
        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # CROSS-REFERENCE (Visual vs Audio)
    # ──────────────────────────────────────────────

    def cross_reference(self, visual_analysis: dict, audio_transcription: dict, frames_b64: list, history: list = None) -> dict:
        """
        Cross-reference visual analysis vs audio assessment, incorporating history.
        Maps the component to the Cat checklist and grades it.
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

        content = []

        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": raw,
                }
            })

        content.append({
            "type": "text",
            "text": f"{visual_summary}\n\n{audio_summary}\n\n{history_summary}\n\n{CROSSREF_PROMPT}"
        })

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            tools=[{
                "name": "submit_cross_reference",
                "description": "Submit the final cross-reference verdict mapping the inspection to the Cat TA1 checklist.",
                "input_schema": CROSSREF_SCHEMA
            }],
            tool_choice={"type": "tool", "name": "submit_cross_reference"},
            messages=[{"role": "user", "content": content}]
        )

        elapsed = round(time.time() - start, 2)

        tool_block = next((b for b in response.content if b.type == "tool_use"), None)
        result = tool_block.input if tool_block else {"final_status": "UNCLEAR", "parse_error": True}
        result["processing_time_seconds"] = elapsed
        return result

    # ──────────────────────────────────────────────
    # CLARIFY WITH CONTEXT
    # ──────────────────────────────────────────────

    def clarify_with_context(self, original_analysis: dict, clarification_transcript: str, frames_b64: list) -> dict:
        """
        Takes the original inspection JSON (which returned CLARIFY),
        uses the new clarification transcript, and runs cross-reference again
        to get a definitive PASS/MONITOR/FAIL.

        Note: audio is already transcribed by GeminiService before this is called.
        """
        start = time.time()

        prior_context = (
            f"PREVIOUS ANALYSIS (Resulted in CLARIFY status):\n"
            f"Original Visual Analysis: {json.dumps(original_analysis.get('visual_analysis', {}))}\n"
            f"Original Audio Transcript: {original_analysis.get('audio_transcription', {}).get('full_text', '')}\n"
            f"Cross-Reference Mapped Item: {original_analysis.get('cross_reference', {}).get('checklist_mapped_item', 'Unknown')}\n"
            f"Clarification Question Asked: {original_analysis.get('cross_reference', {}).get('clarification_question', '')}\n"
            f"\nOPERATOR'S CLARIFICATION RESPONSE:\n\"{clarification_transcript}\"\n"
        )

        prompt = (
            f"{CROSSREF_PROMPT}\n\n"
            f"This is a CLARIFICATION round. The AI previously asked the operator a question to resolve an ambiguity.\n"
            f"Read the operator's response and definitively grade the item Green, Yellow, or Red. "
            f"Return the final status (PASS, MONITOR, or FAIL). Do not return CLARIFY again.\n\n"
            f"{prior_context}"
        )

        content = []
        for frame_b64 in frames_b64[:3]:
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": raw}
            })
        content.append({"type": "text", "text": prompt})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            tools=[{
                "name": "submit_cross_reference",
                "description": "Submit the final cross-reference verdict.",
                "input_schema": CROSSREF_SCHEMA
            }],
            tool_choice={"type": "tool", "name": "submit_cross_reference"},
            messages=[{"role": "user", "content": content}]
        )

        elapsed = round(time.time() - start, 2)
        tool_block = next((b for b in response.content if b.type == "tool_use"), None)
        result = tool_block.input if tool_block else {"final_status": "UNCLEAR", "parse_error": True}
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
            f"You are a Caterpillar predictive maintenance expert.\n"
            f"Compare TODAY'S inspection against the PREVIOUS one for the same component.\n"
            f"Identify if wear is accelerating or if new issues have appeared.\n\n"
            f"PREVIOUS ANALYSIS:\n{json.dumps(previous_analysis)}\n\n"
            f"TODAY'S ANALYSIS:\n{json.dumps(current_analysis)}"
        )

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            tools=[{
                "name": "submit_delta",
                "description": "Submit the wear delta comparison between inspections.",
                "input_schema": DELTA_SCHEMA
            }],
            tool_choice={"type": "tool", "name": "submit_delta"},
            messages=[{"role": "user", "content": prompt}]
        )

        elapsed = round(time.time() - start, 2)
        tool_block = next((b for b in response.content if b.type == "tool_use"), None)
        result = tool_block.input if tool_block else {"summary": "Error", "wear_trend": "UNKNOWN", "notable_changes": []}
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


# ──────────────────────────────────────────────────────
# SCHEMAS (input_schema for Claude tool use)
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
