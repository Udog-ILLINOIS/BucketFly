from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
import base64
import time
from datetime import datetime

from services.memory_service import memory

load_dotenv()

app = Flask(__name__)
CORS(app)

# Allow large uploads — recordings with many base64 frames can be large
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB total request
app.config['MAX_FORM_MEMORY_SIZE'] = 100 * 1024 * 1024  # 100MB per form field (frames JSON)

# Config
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# Checklist normalization — maps AI-returned names → exact frontend keys
# Must mirror frontend/src/constants/checklist.js exactly.
# ──────────────────────────────────────────────────────────────────────────────

_F1TENTH_ITEMS = [
    '1.1 Chassis Frame & Body',
    '1.2 Wheels & Tires',
    '2.1 Jetson Xavier NX (Compute)',
    '2.2 LiDAR Unit',
    '2.3 Power Distribution Board',
]

_CAT_ITEMS = [
    '1.1 Tires and Rims', '1.2 Bucket Cutting Edge, Tips, or Moldboard',
    '1.3 Bucket Tilt Cylinders and Hoses', '1.4 Bucket, Lift Cylinders and Hoses',
    '1.5 Lift arm attachment to frame', '1.6 Underneath of Machine',
    '1.7 Transmission and Transfer Gears', '1.8 Differential and Final Drive Oil',
    '1.9 Steps and Handrails', '1.10 Brake Air Tank; inspect',
    '1.11 Fuel Tank', '1.12 Axles- Final Drives, Differentials, Brakes, Duo-cone Seals',
    '1.13 Hydraulic fluid tank, inspect', '1.14 Transmission Oil',
    '1.15 Work Lights', '1.16 Battery & Cables',
    '2.1 Engine Oil Level', '2.2 Engine Coolant Level',
    '2.3 Check Radiator Cores for Debris', '2.4 Inspect Hoses for Cracks or Leaks',
    '2.5 Primary/secondary fuel filters', '2.6 All Belts',
    '2.7 Air Cleaner and Air Filter Service Indicator', '2.8 Overall Engine Compartment',
    '3.1 Steps & Handrails', '3.2 ROPS/FOPS',
    '3.3 Fire Extinguisher', '3.4 Windshield wipers and washers',
    '3.5 Side Doors', '4.1 Seat',
    '4.2 Seat belt and mounting', '4.3 Horn',
    '4.4 Backup Alarm', '4.5 Windows and Mirrors',
    '4.6 Cab Air Filter', '4.7 Indicators & Gauges',
    '4.8 Switch functionality', '4.9 Overall Cab Interior',
]


def normalize_checklist_item(name: str, machine_type: str) -> str:
    """
    Fuzzy-match an AI-returned item name to the exact canonical checklist key.

    Priority order:
      1. Exact match
      2. Case-insensitive exact match
      3. Strip numeric prefix from canonical item then compare (e.g. "Wheels & Tires" → "1.2 Wheels & Tires")
      4. Substring containment (longer overlap wins)

    Returns the original name unchanged if no match found.
    """
    if not name:
        return name

    items = _F1TENTH_ITEMS if machine_type == 'f1tenth' else _CAT_ITEMS
    name_s = name.strip()
    name_lower = name_s.lower()

    # 1. Exact
    for item in items:
        if item == name_s:
            return item

    # 2. Case-insensitive exact
    for item in items:
        if item.lower() == name_lower:
            return item

    # 3. Strip prefix — "1.2 Wheels & Tires" → compare "wheels & tires"
    for item in items:
        parts = item.split(' ', 1)
        if len(parts) > 1 and parts[1].lower() == name_lower:
            return item

    # 4. Substring containment — pick the canonical item with the longest overlap
    best, best_score = None, 0
    for item in items:
        item_lower = item.lower()
        if name_lower in item_lower:
            score = len(name_lower)
        elif item_lower in name_lower:
            score = len(item_lower)
        else:
            # keyword overlap: count matching words
            item_words = set(item_lower.split())
            name_words = set(name_lower.split())
            score = len(item_words & name_words) * 3  # weight word matches
        if score > best_score:
            best_score = score
            best = item

    if best and best_score >= 3:
        return best

    return name_s  # no confident match — return cleaned original


def normalize_items_evaluated(cross_ref: dict, machine_type: str) -> dict:
    """Apply normalize_checklist_item to every item in cross_ref['items_evaluated']."""
    for item in cross_ref.get('items_evaluated', []):
        raw = item.get('checklist_mapped_item', '')
        item['checklist_mapped_item'] = normalize_checklist_item(raw, machine_type)
    return cross_ref


def backfill_visual_component(cross_ref: dict, visual_analysis: dict, machine_type: str) -> dict:
    """
    If the primary component identified by visual analysis was not mapped into
    items_evaluated by the cross-reference step, inject it now.

    This handles cases where the AI's general commentary identifies a component
    but the cross-reference only outputs other items in items_evaluated.
    """
    component = visual_analysis.get('component', '').strip()
    color_code = visual_analysis.get('color_code', '')
    if not component or color_code not in ('Green', 'Yellow', 'Red'):
        return cross_ref

    canonical = normalize_checklist_item(component, machine_type)
    valid_items = _F1TENTH_ITEMS if machine_type == 'f1tenth' else _CAT_ITEMS
    if canonical not in valid_items:
        return cross_ref  # couldn't map to a known item — skip

    existing = {item.get('checklist_mapped_item', '') for item in cross_ref.get('items_evaluated', [])}
    if canonical in existing:
        return cross_ref  # already present — nothing to do

    observations = ', '.join(visual_analysis.get('condition_observations', []))
    conclusion = visual_analysis.get('chain_of_thought', {}).get('conclusion', '')
    reasoning = observations or conclusion or 'Identified by visual analysis.'

    cross_ref.setdefault('items_evaluated', []).append({
        'checklist_mapped_item': canonical,
        'checklist_grade': color_code,
        'verdict_reasoning': reasoning,
        'recommendation': '',
    })
    print(f"[BACKFILL] Added missing visual component '{canonical}' ({color_code}) to items_evaluated")
    return cross_ref


# Lazy-initialize services
_gemini_service = None


def get_gemini():
    global _gemini_service
    if _gemini_service is None:
        from services.gemini_service import GeminiService
        _gemini_service = GeminiService()
    return _gemini_service


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "0.2.0"
    })


@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    Full analysis pipeline: visual + audio + cross-reference to Cat checklist.

    Accepts same multipart payload:
      - frames: JSON array of base64-encoded JPEG images
      - audio: audio blob file (optional, field name must be 'audio')

    Returns: {inspection_id, frame_count, has_audio, visual_analysis,
              audio_transcription, cross_reference, final_status}
    """
    try:
        # 1. Parse Input
        if request.is_json:
            data = request.get_json()
            frames = data.get('frames', [])
            audio_data = None
            machine_type = data.get('machine_type', 'cat_ta1')
        else:
            frames_json = request.form.get('frames', '[]')
            frames = json.loads(frames_json)
            audio_file = request.files.get('audio')
            audio_data = audio_file.read() if audio_file else None
            machine_type = request.form.get('machine_type', 'cat_ta1')

        if not frames:
            return jsonify({"error": "No frames provided"}), 400

        # 2. Save Inspection to Disk (Audit Trail)
        inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        os.makedirs(inspection_dir, exist_ok=True)

        for i, frame_b64 in enumerate(frames):
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            with open(os.path.join(inspection_dir, f'frame_{i:04d}.jpg'), 'wb') as f:
                f.write(base64.b64decode(raw))

        has_audio = bool(audio_data and len(audio_data) > 0)
        if has_audio:
            with open(os.path.join(inspection_dir, 'audio.webm'), 'wb') as f:
                f.write(audio_data)

        # 3. AI Pipeline
        gemini = get_gemini()
        result = {
            "inspection_id": inspection_id,
            "frame_count": len(frames),
            "has_audio": has_audio
        }

        # Step 3a: Visual analysis (Gemini)
        try:
            visual = gemini.analyze_frames(frames, machine_type=machine_type)
            result["visual_analysis"] = visual
            result["color_code"] = visual.get("color_code", "Fail")
        except Exception as e:
            print(f"[WARN] Visual analysis failed: {e}")
            result["visual_analysis"] = {"error": str(e), "preliminary_status": "UNCLEAR", "color_code": "Fail"}
            result["color_code"] = "Fail"
            visual = result["visual_analysis"]

        # Step 3b: Audio transcription (Gemini)
        audio_transcription = {}
        if has_audio:
            try:
                audio_transcription = gemini.transcribe_audio(audio_data, mime_type="audio/webm", machine_type=machine_type)
                result["audio_transcription"] = audio_transcription
            except Exception as e:
                print(f"[WARN] Audio transcription failed: {e}")
                result["audio_transcription"] = {"error": str(e), "full_text": ""}

        # Step 3c: Cross-reference & History Lookup (Gemini)
        try:
            component_name = visual.get("component", "")
            history = memory.get_history(component_name) if component_name else []

            previous_inspection = history[0] if history else None

            cross_ref = gemini.cross_reference(visual, audio_transcription, frames, history, machine_type=machine_type)
            normalize_items_evaluated(cross_ref, machine_type)
            backfill_visual_component(cross_ref, visual, machine_type)
            result["cross_reference"] = cross_ref
            result["final_status"] = cross_ref.get("final_status",
                visual.get("preliminary_status", "UNCLEAR"))
            # Override color_code with the cross-reference grade (more authoritative)
            result["color_code"] = cross_ref.get("checklist_grade",
                visual.get("color_code", "Fail"))

            # Step 3d: Subjective Delta Review (Gemini)
            if previous_inspection:
                try:
                    delta = gemini.review_delta(
                        current_analysis=cross_ref,
                        previous_analysis=previous_inspection.get("ai_analysis", {})
                    )
                    result["wear_delta"] = delta
                    print(f"[DELTA] Found history for {component_name}: {delta.get('wear_trend')}")
                except Exception as de:
                    print(f"[WARN] Delta review failed: {de}")

        except Exception as e:
            print(f"[WARN] Cross-reference failed: {e}")
            result["cross_reference"] = {"error": str(e)}
            result["final_status"] = visual.get("preliminary_status", "UNCLEAR")

        print(f"[ANALYZE] {inspection_id} completed. Status: {result.get('final_status')}")

        # 4. Persistence (Supermemory)
        try:
            items_evaluated = result.get("cross_reference", {}).get("items_evaluated", [])
            transcript = result.get("audio_transcription", {}).get("full_text", "")
            machine_id = data.get('machine_id', 'W8210127') if request.is_json else request.form.get('machine_id', 'W8210127')
            
            # Save each evaluated component to Supermemory separately
            for idx, item in enumerate(items_evaluated):
                mapped_component = item.get("checklist_mapped_item", "Unknown")
                grade = item.get("checklist_grade", "None")
                notes = item.get("verdict_reasoning", "")
                
                # Create a unique inspection ID per component for supermemory
                component_inspection_id = f"{inspection_id}_{idx}"
                
                memory.save_inspection(
                    inspection_id=component_inspection_id,
                    component=mapped_component,
                    grade=grade,
                    notes=notes,
                    raw_analysis=result.get("cross_reference", {}),
                    audio_transcript=transcript,
                    frames=frames[:1], # Save first frame for visual index
                    machine_id=machine_id
                )
        except Exception as e:
            print(f"[WARN] Supermemory persistence failed: {e}")

        # 5. Save Analysis Log
        with open(os.path.join(inspection_dir, 'analysis.json'), 'w') as f:
            json.dump(result, f, indent=2)

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Analyze failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/save-inspection', methods=['POST'])
def save_inspection():
    """
    Persist inspection items to Supermemory without running the AI pipeline.
    Used by the frontend when injecting mock / local results.

    Expects JSON:
      { inspection_id, items_evaluated: [{checklist_mapped_item, checklist_grade,
        verdict_reasoning, recommendation, confidence}],
        audio_transcript?, machine_id? }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing JSON body"}), 400

        inspection_id = data.get('inspection_id', datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
        items = data.get('items_evaluated', [])
        transcript = data.get('audio_transcript', '')
        machine_id = data.get('machine_id', 'W8210127')

        if not items:
            return jsonify({"error": "No items_evaluated provided"}), 400

        saved = 0
        for idx, item in enumerate(items):
            component = item.get('checklist_mapped_item', 'Unknown')
            grade = item.get('checklist_grade', 'None')
            notes = item.get('verdict_reasoning', '')
            component_id = f"{inspection_id}_{idx}"

            ok = memory.save_inspection(
                inspection_id=component_id,
                component=component,
                grade=grade,
                notes=notes,
                raw_analysis=item,
                audio_transcript=transcript,
                frames=[],
                machine_id=machine_id,
            )
            if ok:
                saved += 1

        print(f"[SAVE] {saved}/{len(items)} items persisted to Supermemory for {inspection_id}")
        return jsonify({"saved": saved, "total": len(items), "inspection_id": inspection_id}), 200

    except Exception as e:
        print(f"[ERROR] Save inspection failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/clarify', methods=['POST'])
def clarify():
    """
    Accepts follow-up audio clarification.
    Expects:
      - inspection_id (string)
      - audio (multipart file)
    """
    try:
        inspection_id = request.form.get('inspection_id')
        audio_file = request.files.get('audio')
        
        if not inspection_id or not audio_file:
            return jsonify({"error": "Missing inspection_id or audio"}), 400

        audio_data = audio_file.read()
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        
        if not os.path.exists(inspection_dir):
            return jsonify({"error": f"Inspection {inspection_id} not found"}), 404

        # Read original analysis
        analysis_path = os.path.join(inspection_dir, 'analysis.json')
        if not os.path.exists(analysis_path):
            return jsonify({"error": f"analysis.json not found for {inspection_id}"}), 404
            
        with open(analysis_path, 'r') as f:
            original_analysis = json.load(f)

        # Re-load frames
        frames = []
        for file in sorted(os.listdir(inspection_dir)):
            if file.startswith("frame_") and file.endswith(".jpg"):
                with open(os.path.join(inspection_dir, file), 'rb') as f:
                    frames.append(base64.b64encode(f.read()).decode('utf-8'))

        # Transcribe + reason (Gemini)
        gemini = get_gemini()
        clarify_result = gemini.clarify_with_context(original_analysis, audio_data, frames)
        
        # Save clarification audio
        clarify_audio_path = os.path.join(inspection_dir, 'clarify_audio.webm')
        with open(clarify_audio_path, 'wb') as f:
            f.write(audio_data)

        # Update and resave analysis
        original_analysis["clarification"] = clarify_result
        original_analysis["final_status"] = clarify_result.get("final_status", "UNCLEAR")
        
        with open(analysis_path, 'w') as f:
            json.dump(original_analysis, f, indent=2)

        print(f"[CLARIFY] {inspection_id} -> new status: {original_analysis['final_status']}")
        
        return jsonify(original_analysis), 200

    except Exception as e:
        print(f"[ERROR] Clarify failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/identify', methods=['POST'])
def identify():
    """
    Lightweight real-time component identification from a single frame.
    Used during recording to give the operator live feedback.

    Accepts JSON: { "frame": "<base64 JPEG>" }
    Returns: { component, checklist_item, confidence, confidence_label, guidance }
    """
    try:
        data = request.get_json()
        frame = data.get('frame')
        checklist_state = data.get('checklist_state', {})
        machine_type = data.get('machine_type', 'cat_ta1')

        if not frame:
            return jsonify({"error": "No frame provided"}), 400

        gemini = get_gemini()
        result = gemini.identify_component(frame, machine_type=machine_type)

        # Normalize the returned checklist item to the exact frontend key
        raw_item = result.get('checklist_item', 'None')
        if raw_item and raw_item != 'None':
            result['checklist_item'] = normalize_checklist_item(raw_item, machine_type)

        # Enrich: check if this item was already inspected today
        checklist_item = result.get('checklist_item', 'None')
        if checklist_item and checklist_item != 'None' and checklist_item in checklist_state:
            result['already_inspected'] = True
            result['existing_grade'] = checklist_state[checklist_item]
        else:
            result['already_inspected'] = False
            result['existing_grade'] = None

        # Count remaining items (machine-specific total)
        total_items = len(_F1TENTH_ITEMS) if machine_type == 'f1tenth' else len(_CAT_ITEMS)
        inspected_count = len(checklist_state)
        result['items_remaining'] = total_items - inspected_count
        result['items_inspected'] = inspected_count

        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Identify failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/history', methods=['GET'])
def get_component_history():
    """
    Fetch history logs for a specific component from Supermemory.
    Expects query param: ?component=X&machine_id=Y
    """
    component = request.args.get('component')
    machine_id = request.args.get('machine_id', 'W8210127')
    if not component:
        return jsonify({"error": "Missing component parameter"}), 400
        
    try:
        from services.memory_service import memory
        history = memory.get_history(component, limit=10, machine_id=machine_id)
        return jsonify({"component": component, "machine_id": machine_id, "history": history}), 200
    except Exception as e:
        print(f"[ERROR] History fetch failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    """
    Delete all inspection records for a given date from Supermemory.
    Expects JSON: { date: "YYYY-MM-DD", machine_id? }
    """
    try:
        data = request.get_json()
        if not data or not data.get('date'):
            return jsonify({"error": "Missing date"}), 400

        date_str = data['date']
        machine_id = data.get('machine_id', 'W8210127')
        deleted = memory.delete_by_date(date_str, machine_id=machine_id)

        print(f"[CLEAR] Deleted {deleted} records for {date_str}")
        return jsonify({"deleted": deleted, "date": date_str}), 200

    except Exception as e:
        print(f"[ERROR] Clear history failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/history/dates', methods=['GET'])
def get_history_dates():
    """Return list of distinct dates that have inspection records."""
    machine_id = request.args.get('machine_id', 'W8210127')
    try:
        dates = memory.get_available_dates(machine_id=machine_id)
        return jsonify({"dates": dates, "machine_id": machine_id}), 200
    except Exception as e:
        print(f"[ERROR] Dates fetch failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/history/by-date', methods=['GET'])
def get_history_by_date():
    """
    Fetch all inspection records for a given date.
    Expects query param: ?date=YYYY-MM-DD&machine_id=Y
    """
    date_str = request.args.get('date')
    machine_id = request.args.get('machine_id', 'W8210127')
    if not date_str:
        return jsonify({"error": "Missing date parameter"}), 400
    try:
        records = memory.get_history_by_date(date_str, machine_id=machine_id)
        return jsonify({"date": date_str, "machine_id": machine_id, "records": records}), 200
    except Exception as e:
        print(f"[ERROR] History by date failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze-video', methods=['POST'])
def analyze_video():
    """
    Full pipeline for an uploaded video file.

    Flow:
      1. Save video to disk.
      2. Transcribe audio via Gemini → get keyword timestamps (seconds).
      3. Seek to each timestamp with cv2 in O(1) → extract JPEG frames.
      4. Run existing visual-analysis + cross-reference pipeline on those frames.

    Accepts multipart/form-data:
      - video       : the video file (mp4, mov, webm …)
      - machine_type: 'cat_ta1' | 'f1tenth'  (default: 'cat_ta1')
      - machine_id  : equipment serial (default: 'W8210127')

    Returns the same JSON shape as /api/analyze.
    """
    try:
        video_file = request.files.get('video')
        machine_type = request.form.get('machine_type', 'cat_ta1')
        machine_id = request.form.get('machine_id', 'W8210127')

        if not video_file:
            return jsonify({"error": "No video provided"}), 400

        mime_type = video_file.content_type or 'video/mp4'
        ext_map = {
            'video/mp4': '.mp4', 'video/quicktime': '.mov',
            'video/webm': '.webm', 'video/avi': '.avi',
            'video/x-msvideo': '.avi', 'video/mpeg': '.mpeg',
        }
        ext = ext_map.get(mime_type, '.mp4')

        # 1. Persist video
        inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        os.makedirs(inspection_dir, exist_ok=True)

        video_bytes = video_file.read()
        video_path = os.path.join(inspection_dir, f'video{ext}')
        with open(video_path, 'wb') as f:
            f.write(video_bytes)

        gemini = get_gemini()
        result = {
            "inspection_id": inspection_id,
            "has_audio": True,
            "source": "video_upload",
        }

        # 2. Transcribe audio from video → keyword timestamps (in seconds)
        audio_transcription = {}
        timestamps_ms = []
        try:
            audio_transcription = gemini.transcribe_video(video_bytes, mime_type=mime_type, machine_type=machine_type)
            result["audio_transcription"] = audio_transcription

            for mention in audio_transcription.get("components_mentioned", []):
                ts = mention.get("timestamp")
                if ts is not None:
                    try:
                        ts = float(ts)
                        # Gemini returns timestamps in seconds; convert to ms for cv2
                        timestamps_ms.append(ts * 1000)
                    except (TypeError, ValueError):
                        pass
            print(f"[VIDEO] Transcription done. Keywords at {len(timestamps_ms)} timestamp(s).")
        except Exception as e:
            print(f"[WARN] Video transcription failed: {e}")
            result["audio_transcription"] = {"error": str(e), "full_text": ""}

        # 3. Extract frames at keyword timestamps (O(1) per frame via cv2 seek)
        from services.video_service import extract_frames_at_timestamps
        try:
            frames = extract_frames_at_timestamps(video_path, timestamps_ms, max_frames=12)
        except Exception as e:
            print(f"[WARN] Frame extraction failed: {e}")
            frames = []

        result["frame_count"] = len(frames)
        if not frames:
            return jsonify({"error": "Could not extract frames from video"}), 400

        # Save extracted frames to disk (audit trail)
        for i, frame_b64 in enumerate(frames):
            raw = frame_b64.split(',')[1] if ',' in frame_b64 else frame_b64
            with open(os.path.join(inspection_dir, f'frame_{i:04d}.jpg'), 'wb') as f:
                f.write(base64.b64decode(raw))

        print(f"[VIDEO] Extracted {len(frames)} frames from {len(timestamps_ms)} timestamps.")

        # 4a. Visual analysis
        try:
            visual = gemini.analyze_frames(frames, machine_type=machine_type)
            result["visual_analysis"] = visual
            result["color_code"] = visual.get("color_code", "Fail")
        except Exception as e:
            print(f"[WARN] Visual analysis failed: {e}")
            result["visual_analysis"] = {"error": str(e), "preliminary_status": "UNCLEAR", "color_code": "Fail"}
            result["color_code"] = "Fail"
            visual = result["visual_analysis"]

        # 4b. Cross-reference + history
        try:
            component_name = visual.get("component", "")
            history = memory.get_history(component_name) if component_name else []
            previous_inspection = history[0] if history else None

            cross_ref = gemini.cross_reference(
                visual, audio_transcription, frames, history, machine_type=machine_type
            )
            normalize_items_evaluated(cross_ref, machine_type)
            backfill_visual_component(cross_ref, visual, machine_type)
            result["cross_reference"] = cross_ref
            result["final_status"] = cross_ref.get(
                "final_status", visual.get("preliminary_status", "UNCLEAR")
            )
            result["color_code"] = cross_ref.get("checklist_grade", visual.get("color_code", "Fail"))

            if previous_inspection:
                try:
                    delta = gemini.review_delta(
                        current_analysis=cross_ref,
                        previous_analysis=previous_inspection.get("ai_analysis", {}),
                    )
                    result["wear_delta"] = delta
                except Exception as de:
                    print(f"[WARN] Delta review failed: {de}")
        except Exception as e:
            print(f"[WARN] Cross-reference failed: {e}")
            result["cross_reference"] = {"error": str(e)}
            result["final_status"] = visual.get("preliminary_status", "UNCLEAR")

        # 5. Persist to Supermemory
        try:
            items_evaluated = result.get("cross_reference", {}).get("items_evaluated", [])
            transcript = result.get("audio_transcription", {}).get("full_text", "")
            for idx, item in enumerate(items_evaluated):
                memory.save_inspection(
                    inspection_id=f"{inspection_id}_{idx}",
                    component=item.get("checklist_mapped_item", "Unknown"),
                    grade=item.get("checklist_grade", "None"),
                    notes=item.get("verdict_reasoning", ""),
                    raw_analysis=result.get("cross_reference", {}),
                    audio_transcript=transcript,
                    frames=frames[:1],
                    machine_id=machine_id,
                )
        except Exception as e:
            print(f"[WARN] Supermemory persistence failed: {e}")

        # Save analysis log
        with open(os.path.join(inspection_dir, 'analysis.json'), 'w') as f:
            json.dump(result, f, indent=2)

        print(f"[VIDEO-ANALYZE] {inspection_id} completed. Status: {result.get('final_status')}")
        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Video analyze failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze-upload', methods=['POST'])
def analyze_upload():
    """
    Analyze a single uploaded image with a text description from the operator.
    The text replaces the audio transcription in the normal pipeline.

    Accepts multipart form:
      - image: the image file (JPEG, PNG, etc.)
      - description: operator's text assessment of the component
      - machine_id (optional)

    Returns: same shape as /api/analyze
    """
    try:
        image_file = request.files.get('image')
        description = request.form.get('description', '')
        machine_type = request.form.get('machine_type', 'cat_ta1')

        if not image_file:
            return jsonify({"error": "No image provided"}), 400
        if not description.strip():
            return jsonify({"error": "No description provided"}), 400

        # Read image and convert to base64
        image_bytes = image_file.read()
        frame_b64 = base64.b64encode(image_bytes).decode('utf-8')
        frames = [frame_b64]

        # Save to disk
        inspection_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        inspection_dir = os.path.join(UPLOAD_DIR, inspection_id)
        os.makedirs(inspection_dir, exist_ok=True)

        with open(os.path.join(inspection_dir, 'frame_0000.jpg'), 'wb') as f:
            f.write(image_bytes)
        with open(os.path.join(inspection_dir, 'description.txt'), 'w') as f:
            f.write(description)

        # AI Pipeline
        gemini = get_gemini()
        result = {
            "inspection_id": inspection_id,
            "frame_count": 1,
            "has_audio": False,
        }

        # Visual analysis
        try:
            visual = gemini.analyze_frames(frames)
            result["visual_analysis"] = visual
            result["color_code"] = visual.get("color_code", "Fail")
        except Exception as e:
            print(f"[WARN] Visual analysis failed: {e}")
            result["visual_analysis"] = {"error": str(e), "preliminary_status": "UNCLEAR", "color_code": "Fail"}
            result["color_code"] = "Fail"
            visual = result["visual_analysis"]

        # Synthetic audio transcription from text
        audio_transcription = {
            "full_text": description,
            "segments": [],
            "components_mentioned": [],
        }
        result["audio_transcription"] = audio_transcription

        # Cross-reference with history
        try:
            component_name = visual.get("component", "")
            history = memory.get_history(component_name) if component_name else []
            previous_inspection = history[0] if history else None

            cross_ref = gemini.cross_reference(visual, audio_transcription, frames, history)
            normalize_items_evaluated(cross_ref, machine_type)
            backfill_visual_component(cross_ref, visual, machine_type)
            result["cross_reference"] = cross_ref
            result["final_status"] = cross_ref.get("final_status",
                visual.get("preliminary_status", "UNCLEAR"))
            result["color_code"] = cross_ref.get("checklist_grade",
                visual.get("color_code", "Fail"))

            if previous_inspection:
                try:
                    delta = gemini.review_delta(
                        current_analysis=cross_ref,
                        previous_analysis=previous_inspection.get("ai_analysis", {})
                    )
                    result["wear_delta"] = delta
                except Exception as de:
                    print(f"[WARN] Delta review failed: {de}")

        except Exception as e:
            print(f"[WARN] Cross-reference failed: {e}")
            result["cross_reference"] = {"error": str(e)}
            result["final_status"] = visual.get("preliminary_status", "UNCLEAR")

        # Persistence
        try:
            items_evaluated = result.get("cross_reference", {}).get("items_evaluated", [])
            machine_id = request.form.get('machine_id', 'W8210127')

            for idx, item in enumerate(items_evaluated):
                mapped_component = item.get("checklist_mapped_item", "Unknown")
                grade = item.get("checklist_grade", "None")
                notes = item.get("verdict_reasoning", "")
                component_inspection_id = f"{inspection_id}_{idx}"

                memory.save_inspection(
                    inspection_id=component_inspection_id,
                    component=mapped_component,
                    grade=grade,
                    notes=notes,
                    raw_analysis=result.get("cross_reference", {}),
                    audio_transcript=description,
                    frames=frames[:1],
                    machine_id=machine_id
                )
        except Exception as e:
            print(f"[WARN] Supermemory persistence failed: {e}")

        # Save analysis log
        with open(os.path.join(inspection_dir, 'analysis.json'), 'w') as f:
            json.dump(result, f, indent=2)

        print(f"[UPLOAD-ANALYZE] {inspection_id} completed. Status: {result.get('final_status')}")
        return jsonify(result), 200

    except Exception as e:
        print(f"[ERROR] Upload analysis failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("  CAT VISION-INSPECT API v0.2")
    print("  Running on http://0.0.0.0:5001")
    print("  Gemini: gemini-2.5-flash-lite")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5001)
