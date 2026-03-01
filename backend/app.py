from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
from datetime import datetime

load_dotenv(override=True)

app = Flask(__name__)
CORS(app)

app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
app.config['MAX_FORM_MEMORY_SIZE'] = 100 * 1024 * 1024

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

from services.memory_service import memory

# ──────────────────────────────────────────────────────
# Canonical checklist — single source of truth
# ──────────────────────────────────────────────────────

VALID_CHECKLIST_ITEMS = [
    "1.1 Tire 1 — Front Left",
    "1.2 Tire 2 — Front Right",
    "1.3 Tire 3 — Rear Left",
    "1.4 Tire 4 — Rear Right",
    "1.5 Shock 1 — Front Left",
    "1.6 Shock 2 — Front Right",
    "1.7 Shock 3 — Rear Left",
    "1.8 Shock 4 — Rear Right",
    "1.9 Bumper 1 — Front",
    "1.10 Bumper 2 — Rear",
    "1.11 Undercarriage",
    "2.1 Battery",
    "2.2 Powerboard",
    "2.3 NVIDIA Jetson",
    "2.4 Antenna",
    "3.1 LiDAR",
]


def normalize_checklist_item(raw: str) -> str:
    """Fuzzy-match Gemini's returned item name to the canonical checklist string."""
    if not raw:
        return "Unknown"
    # Exact match
    if raw in VALID_CHECKLIST_ITEMS:
        return raw
    # Case-insensitive exact match
    raw_lower = raw.lower().strip()
    for item in VALID_CHECKLIST_ITEMS:
        if item.lower() == raw_lower:
            return item
    # Number-prefix match (e.g. "1.1 Tire..." → "1.1 Tire 1 — Front Left")
    for item in VALID_CHECKLIST_ITEMS:
        prefix = item.split(' ')[0]
        if raw.startswith(prefix):
            return item
    # Keyword match
    keyword_map = {
        "lidar": "3.1 LiDAR",
        "jetson": "2.3 NVIDIA Jetson",
        "nvidia": "2.3 NVIDIA Jetson",
        "battery": "2.1 Battery",
        "lipo": "2.1 Battery",
        "powerboard": "2.2 Powerboard",
        "power board": "2.2 Powerboard",
        "antenna": "2.4 Antenna",
        "undercarriage": "1.11 Undercarriage",
        "bumper front": "1.9 Bumper 1 — Front",
        "bumper rear": "1.10 Bumper 2 — Rear",
        "front bumper": "1.9 Bumper 1 — Front",
        "rear bumper": "1.10 Bumper 2 — Rear",
    }
    for keyword, canonical in keyword_map.items():
        if keyword in raw_lower:
            return canonical
    print(f'[WARN] Could not normalize checklist item: "{raw}"')
    return raw


def derive_final_status(graded_items: list) -> str:
    """Determine overall inspection status from the array of graded items."""
    if not graded_items:
        return "UNCLEAR"
    statuses = [item.get("final_status", "CLARIFY") for item in graded_items]
    if "FAIL" in statuses:
        return "FAIL"
    if "CLARIFY" in statuses:
        return "CLARIFY"
    if "MONITOR" in statuses:
        return "MONITOR"
    return "PASS"


# ──────────────────────────────────────────────────────
# Service singletons
# ──────────────────────────────────────────────────────

_gemini_service = None
_claude_service = None


def get_gemini():
    global _gemini_service
    if _gemini_service is None:
        from services.gemini_service import GeminiService
        _gemini_service = GeminiService()
    return _gemini_service


def get_claude():
    global _claude_service
    if _claude_service is None:
        from services.claude_service import ClaudeService
        _claude_service = ClaudeService()
    return _claude_service


# ──────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200


@app.route('/api/ping', methods=['POST'])
def ping_test():
    return jsonify({"status": "alive"}), 200


@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Call 1: Accept audio-only blob. Return transcript with component mentions and timestamps.
    """
    try:
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({"error": "No audio provided"}), 400

        audio_bytes = audio_file.read()
        if not audio_bytes:
            return jsonify({"error": "Empty audio file"}), 400

        inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')

        gemini = get_gemini()
        audio_transcription = gemini.transcribe_audio(audio_bytes, mime_type="audio/webm")

        mentioned = [c.get('name') for c in audio_transcription.get('components_mentioned', [])]
        print(f"[TRANSCRIBE] {inspection_id} | components: {mentioned} | text: {audio_transcription.get('full_text', '')[:60]}...")

        return jsonify({
            "inspection_id": inspection_id,
            "audio_transcription": audio_transcription
        }), 200

    except Exception as e:
        print(f"[ERROR] Transcribe failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze_frames', methods=['POST'])
def analyze_frames():
    """
    Calls 2 and 3:
    - Call 2: Visual observation of provided frames (no audio context)
    - Call 3: Diagnosis — text-only cross-reference of Call 1 + Call 2 outputs

    Returns graded_items[] — one entry per component the operator mentioned.
    Also stores a sample of frames in analysis.json for clarify use.
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        inspection_id = data.get('inspection_id')
        audio_transcription = data.get('audio_transcription', {})
        frames = data.get('frames_b64', [])

        if not inspection_id:
            return jsonify({"error": "Missing inspection_id"}), 400

        vision = get_claude()

        # Call 2 — Visual observation (frames only, no audio)
        visual = vision.analyze_frames(frames)

        # Fetch history for components mentioned
        mentioned_names = [c.get('name', '') for c in audio_transcription.get('components_mentioned', [])]
        history = []
        for name in mentioned_names:
            h = memory.get_history(name) if name else []
            history.extend(h)

        # Call 3 — Diagnosis (text-only, no images resent)
        cross_ref = vision.cross_reference(visual, audio_transcription, history)

        # Normalize checklist item names against canonical list
        for item in cross_ref.get('graded_items', []):
            item['checklist_item'] = normalize_checklist_item(item.get('checklist_item', ''))

        # Derive overall status from graded items
        final_status = derive_final_status(cross_ref.get('graded_items', []))

        result = {
            "inspection_id": inspection_id,
            "audio_transcription": audio_transcription,
            "frame_count": len(frames),
            "visual_analysis": visual,
            "cross_reference": cross_ref,
            "final_status": final_status,
            # Store sample frames for clarify route (S4 fix)
            "frames_b64_sample": frames[:3]
        }

        # Save each graded item to memory
        for graded_item in cross_ref.get('graded_items', []):
            component = graded_item.get('checklist_item', 'Unknown')
            grade = graded_item.get('checklist_grade', 'None')
            notes = graded_item.get('reasoning', '')
            if grade != 'None':
                try:
                    memory.save_inspection(
                        inspection_id=inspection_id,
                        component=component,
                        grade=grade,
                        notes=notes,
                        raw_analysis=graded_item,
                        audio_transcript=audio_transcription.get('full_text', ''),
                        frames=[]
                    )
                except Exception as me:
                    print(f"[WARN] Memory save failed for {component}: {me}")

        # Persist analysis
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        os.makedirs(inspection_dir, exist_ok=True)
        with open(os.path.join(inspection_dir, 'analysis.json'), 'w') as f:
            json.dump(result, f, indent=2)

        grades = [(i.get('checklist_item'), i.get('final_status')) for i in cross_ref.get('graded_items', [])]
        print(f"[ANALYZE_FRAMES] {inspection_id} | overall: {final_status} | grades: {grades}")

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] analyze_frames failed: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/clarify', methods=['POST'])
def clarify():
    """
    Clarification round.
    Accepts:
      - inspection_id (form field)
      - audio (file): operator's verbal response to the CLARIFY question

    Uses stored visual analysis from the original inspection (no new Call 2).
    Re-runs Call 3 diagnosis with new audio + original visual.
    """
    try:
        inspection_id = request.form.get('inspection_id')
        audio_file = request.files.get('audio')

        if not inspection_id or not audio_file:
            return jsonify({"error": "Missing inspection_id or audio"}), 400

        audio_data = audio_file.read()
        if not audio_data:
            return jsonify({"error": "Empty audio in clarification"}), 400

        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        analysis_path = os.path.join(inspection_dir, 'analysis.json')

        if not os.path.exists(analysis_path):
            return jsonify({"error": f"Inspection {inspection_id} not found"}), 404

        with open(analysis_path, 'r') as f:
            original_analysis = json.load(f)

        gemini = get_gemini()
        vision = get_claude()

        # Call 1 (clarify): transcribe the operator's clarification audio
        clarify_transcription = gemini.transcribe_audio(audio_data, mime_type="audio/webm")
        clarification_text = clarify_transcription.get("full_text", "")

        # Call 3 (clarify): re-diagnose using original visual + new audio
        # No new Call 2 — uses stored visual_analysis from original run
        clarify_result = vision.clarify_with_context(original_analysis, clarification_text)

        # Normalize checklist items
        for item in clarify_result.get('graded_items', []):
            item['checklist_item'] = normalize_checklist_item(item.get('checklist_item', ''))

        final_status = derive_final_status(clarify_result.get('graded_items', []))

        # Merge clarification results back
        original_analysis["clarification_transcription"] = clarify_transcription
        original_analysis["clarification"] = clarify_result
        original_analysis["final_status"] = final_status

        # Update cross_reference graded_items: replace CLARIFY items with resolved grades
        orig_items = {
            i.get('checklist_item'): i
            for i in original_analysis.get('cross_reference', {}).get('graded_items', [])
        }
        for resolved in clarify_result.get('graded_items', []):
            key = resolved.get('checklist_item')
            if key:
                orig_items[key] = resolved
        original_analysis['cross_reference']['graded_items'] = list(orig_items.values())

        with open(analysis_path, 'w') as f:
            json.dump(original_analysis, f, indent=2)

        print(f"[CLARIFY] {inspection_id} → {final_status}")

        return jsonify(original_analysis), 200

    except Exception as e:
        print(f"[ERROR] Clarify failed: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/history', methods=['GET'])
def get_component_history():
    component = request.args.get('component')
    if not component:
        return jsonify({"error": "Missing component parameter"}), 400
    try:
        history = memory.get_history(component, limit=10)
        return jsonify({"component": component, "history": history}), 200
    except Exception as e:
        print(f"[ERROR] History fetch failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/history/dates', methods=['GET'])
def get_history_dates():
    try:
        dates = memory.get_available_dates()
        return jsonify({"dates": dates}), 200
    except Exception as e:
        print(f"[ERROR] Dates fetch failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/history/by-date', methods=['GET'])
def get_history_by_date():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "Missing date parameter"}), 400
    try:
        records = memory.get_history_by_date(date_str)
        return jsonify({"date": date_str, "records": records}), 200
    except Exception as e:
        print(f"[ERROR] History by date failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    key = os.getenv('GEMINI_API_KEY', 'NOT SET')
    print("=" * 50)
    print("  F1TENTH VISION-INSPECT API")
    print("  Running on http://0.0.0.0:5001")
    print("  3-call pipeline: audio → visual → diagnosis")
    print(f"  Gemini key: ...{key[-6:]}")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5001)
